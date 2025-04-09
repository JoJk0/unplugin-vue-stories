<script setup lang="ts">
/**
 * Counts the number of clicks.
 * @figmaId 55-555
 * @category Components
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

const emit = defineEmits<{
  /**
   *  Emitted when the counter is incremented.
   *  @param n - The new value of the counter.
   */
  (e: 'inc', n: number): void
  /**
   *  Emitted when the counter is decremented.
   *  @param n - The new value of the counter.
   */
  (e: 'dec', n: number): void
  /**
   *  Emitted when the counter is reset.
   */
  (e: 'reset'): void
}>()

defineSlots<{
  /**
   * The content of the counter.
   * @param prop1 - Lorem ipsum dolor sit amet, consectetur adipiscing elit.
   */
  default: (props: { prop1: string }) => VNodeArrayChildren
  /**
   * The title of the counter.
   * @param prop1 - Lorem ipsum dolor sit amet, consectetur adipiscing elit.
   */
  title: (props: { prop1: string }) => VNodeArrayChildren
}>()

/**
 * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 */
const modelValue = defineModel<number>('modelValue', { default: 0 })

function reset() {
  modelValue.value = 0
  emit('reset')
}
function inc() {
  modelValue.value++
  emit('inc', modelValue.value)
}
function dec() {
  modelValue.value--
  emit('dec', modelValue.value)
}
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="counter">
    <h1><slot name="title" prop1="Ipsum">Counter</slot></h1>
    <div class="content">
      <button class="btn" @click="inc">+</button>
      {{ modelValue }}<slot prop1="Lorem" />
      <button class="btn" @click="dec">-</button>
    </div>
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
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  font-family: sans-serif;
  text-align: center;
  .content {
    display: flex;
    gap: 0.5em;
    align-items: center;
    justify-content: center;
  }

  .btn {
    font-family: monospace;
    font-weight: bold;
    border-radius: 100%;
    font-size: inherit;
    background: var(--counter-color, var(--default-counter-color));
    border: 0;
    &:hover {
      opacity: 0.7;
    }
    &:active {
      opacity: 0.6;
    }
  }
}
</style>
