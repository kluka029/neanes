import loadGhostscript from '@okathira/ghostpdl-wasm';
import { describe, expect, it } from 'vitest';

import {
  getEpsResolution,
  getPngDimensions,
  isEpsFile,
  renderEpsWithGhostscript,
} from './EpsConverter';

function encodeEps(boundingBox: string) {
  return new TextEncoder().encode(
    [
      '%!PS-Adobe-3.0 EPSF-3.0',
      `%%BoundingBox: ${boundingBox}`,
      '0.6 0 0 setrgbcolor',
      '10 10 moveto 50 100 lineto 90 10 lineto closepath fill',
      'showpage',
      '',
    ].join('\n'),
  );
}

describe('EpsConverter', () => {
  it('recognizes PostScript file names', () => {
    expect(isEpsFile('A.eps')).toBe(true);
    expect(isEpsFile('A.EPSF')).toBe(true);
    expect(isEpsFile('A.png')).toBe(false);
  });

  it('renders small artwork at 600 dpi', () => {
    expect(getEpsResolution(encodeEps('0 0 100 120'))).toBe(600);
  });

  it('lowers the resolution for large artwork', () => {
    expect(getEpsResolution(encodeEps('0 0 720 360'))).toBe(300);
  });

  it('renders an EPS file to a PNG cropped to its bounding box', async () => {
    const ghostscript = await loadGhostscript({ print: () => {} });

    const png = renderEpsWithGhostscript(ghostscript, encodeEps('0 0 100 120'));

    expect(Array.from(png.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
    expect(getPngDimensions(png)).toEqual({ width: 833, height: 1000 });
  });

  it('reports invalid PostScript as an error', async () => {
    const errors: string[] = [];
    const ghostscript = await loadGhostscript({
      print: () => {},
      printErr: (message: string) => errors.push(message),
    });

    expect(() =>
      renderEpsWithGhostscript(
        ghostscript,
        new TextEncoder().encode('%!PS\nnot-a-command\n'),
        errors,
      ),
    ).toThrow();
  });
});
