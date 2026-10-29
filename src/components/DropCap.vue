<template>
  <div
    ref="container"
    class="drop-cap-container"
    :class="{ 'has-image': element.imageData != null }"
    dir="auto"
    @click="$emit('select-single')"
  >
    <span class="handle"></span>

    <img
      v-if="element.imageData != null"
      class="drop-cap-image"
      :src="element.imageData"
      :alt="element.content"
      :style="imageStyle"
      draggable="false"
    />

    <ContentEditable
      ref="text"
      class="drop-cap"
      :class="{ 'drop-cap-hidden-text': element.imageData != null }"
      :style="style"
      :content="element.content"
      :editable="editable"
      @blur="updateContent"
    ></ContentEditable>
  </div>
</template>

<script setup lang="ts">
import type { PropType, StyleValue } from 'vue';
import { computed, useTemplateRef } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';

import ContentEditable from '@/components/ContentEditable.vue';
import type { DropCapElement } from '@/models/Element';
import type { PageSetup } from '@/models/PageSetup';
import { getFontFamilyWithFallback } from '@/utils/getFontFamilyWithFallback';
import { withZoom } from '@/utils/withZoom';

const emit = defineEmits(['update:content', 'select-single']);
const props = defineProps({
  element: {
    type: Object as PropType<DropCapElement>,
    required: true,
  },
  pageSetup: {
    type: Object as PropType<PageSetup>,
    required: true,
  },
  editable: {
    type: Boolean,
    required: true,
  },
});

const container = useTemplateRef<HTMLElement>('container');
const text = useTemplateRef<ComponentExposed<typeof ContentEditable>>('text');

const htmlElement = computed(() => container.value!);
const textElement = computed(() => text.value!);

const style = computed(() => {
  const hasImage = props.element.imageData != null;
  const style = {
    color: hasImage ? 'transparent' : props.element.computedColor,
    fontFamily: getFontFamilyWithFallback(props.element.computedFontFamily),
    fontSize: withZoom(props.element.computedFontSize),
    fontWeight: props.element.computedFontWeight,
    fontStyle: props.element.computedFontStyle,
    fontVariantCaps: props.element.computedFontVariantCaps,
    fontVariantNumeric: props.element.computedFontVariantNumeric,
    fontVariantLigatures: props.element.computedFontVariantLigatures,
    fontVariantAlternates: props.element.computedFontVariantAlternates,
    lineHeight: `${props.element.computedLineHeight ?? 'normal'}`,
    webkitTextStrokeWidth: hasImage
      ? 0
      : withZoom(props.element.computedStrokeWidth),
    webkitTextStrokeColor: props.element.computedStrokeColor,
  } as StyleValue;

  return style;
});

const imageStyle = computed(
  () =>
    ({
      height: withZoom(props.element.computedFontSize),
      width: withZoom(
        props.element.computedFontSize * props.element.imageAspectRatio,
      ),
    }) as StyleValue,
);

function focus() {
  if (props.editable) {
    textElement.value.focus(true);
  }
}

function blur() {
  textElement.value.blur();
}

function updateContent(content: string) {
  // Nothing actually changed, so do nothing
  if (props.element.content === content) {
    return;
  }

  emit('update:content', content);
}

defineExpose({
  blur,
  focus,
  htmlElement,
  textElement,
});
</script>

<style scoped>
.drop-cap:focus {
  outline: none;
}

.drop-cap-container.has-image {
  position: relative;
}

.drop-cap-image {
  display: block;
  max-width: none;
}

/* The letter stays focusable over the image so that keyboard navigation and
   editing keep working, but it is not drawn. */
.drop-cap-hidden-text {
  position: absolute;
  inset: 0;
  overflow: hidden;
  caret-color: transparent;
}

.drop-cap-container .handle {
  bottom: calc(50% - 5px);
  left: -10px;

  z-index: 1;

  display: none;
}
</style>
