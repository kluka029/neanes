import type { GhostscriptModule } from '@okathira/ghostpdl-wasm';

export interface ConvertedImage {
  data: string;
  width: number;
  height: number;
}

const maxResolutionDpi = 600;
const maxImageDimensionPx = 3000;
const pointsPerInch = 72;

export function isEpsFile(fileName: string) {
  return /\.(eps|epsf|epsi|ps)$/i.test(fileName);
}

// Large artwork is rendered at a lower resolution so the embedded PNG stays a
// reasonable size.
export function getEpsResolution(eps: Uint8Array) {
  const header = new TextDecoder('latin1').decode(
    eps.subarray(0, Math.min(eps.length, 64 * 1024)),
  );
  const match =
    /%%HiResBoundingBox:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/.exec(header) ??
    /%%BoundingBox:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/.exec(header);

  if (match == null) {
    return maxResolutionDpi;
  }

  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  const largestSidePt = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));

  if (!Number.isFinite(largestSidePt) || largestSidePt <= 0) {
    return maxResolutionDpi;
  }

  return Math.min(
    maxResolutionDpi,
    Math.floor((maxImageDimensionPx * pointsPerInch) / largestSidePt),
  );
}

export function getPngDimensions(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function renderEpsWithGhostscript(
  ghostscript: GhostscriptModule,
  eps: Uint8Array,
  errors: string[] = [],
) {
  ghostscript.FS.writeFile('input.eps', eps);

  const exitCode = ghostscript.callMain([
    '-dSAFER',
    '-dBATCH',
    '-dNOPAUSE',
    '-dQUIET',
    '-dEPSCrop',
    '-sDEVICE=pngalpha',
    `-r${getEpsResolution(eps)}`,
    '-dTextAlphaBits=4',
    '-dGraphicsAlphaBits=4',
    '-sOutputFile=output.png',
    'input.eps',
  ]);

  if (exitCode !== 0 || !ghostscript.FS.readdir('.').includes('output.png')) {
    throw new Error(
      errors.join('\n') || `Ghostscript exited with code ${exitCode}`,
    );
  }

  return ghostscript.FS.readFile('output.png');
}

function toPngDataUrl(png: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < png.length; i += chunkSize) {
    binary += String.fromCharCode(...png.subarray(i, i + chunkSize));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function convertEpsToPng(
  eps: Uint8Array,
): Promise<ConvertedImage> {
  // Loaded on demand: the Ghostscript binary is large and rarely needed.
  const [{ default: loadGhostscript }, { default: wasmUrl }] =
    await Promise.all([
      import('@okathira/ghostpdl-wasm'),
      import('@okathira/ghostpdl-wasm/gs.wasm?url'),
    ]);

  const errors: string[] = [];

  // Ghostscript exits after each run, so every conversion gets a fresh module.
  const ghostscript = await loadGhostscript({
    locateFile: () => wasmUrl,
    print: () => {},
    printErr: (message: string) => errors.push(message),
  });

  const png = renderEpsWithGhostscript(ghostscript, eps, errors);

  return { data: toPngDataUrl(png), ...getPngDimensions(png) };
}
