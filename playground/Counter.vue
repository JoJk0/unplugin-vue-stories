<script setup lang="ts">
/**
 * Counts the number of clicks.
 * @designId 55-555
 * @category Counter
 */

import type { VNodeArrayChildren } from 'vue'

withDefaults(
  defineProps<{
    /**
     * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
     * Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
     */
    lorem?: string
  }>(),
  {
    lorem: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  },
)

defineEmits<{
  /**
   * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
   * Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
   */
  (e: 'click', event: MouseEvent): void
}>()

defineSlots<{
  /**
   * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
   * Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
   */
  default: (props: { prop1: string }) => VNodeArrayChildren
}>()

/**
 * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 */
const modelValue = defineModel<string>('modelValue', { default: 'MyDefault' })
</script>

<template>
  <div class="counter">
    Counter component {{ modelValue }}<slot prop1="Lorem" />
  </div>
</template>

<style scoped>
.counter {
  /**
   * The color of the counter.
   * @syntax <color>
   */
  --default-counter-color: #42b983;
  /**
   * The font size of the counter.
   */
  --default-counter-font-size: 16px;

  color: var(--counter-color, var(--default-counter-color));
  font-size: var(--counter-font-size, var(--default-counter-font-size));
}
</style>
