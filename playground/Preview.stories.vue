<script setup lang="ts">
import PreviewCode from '@preview-test'
import Counter from './Counter.vue'
</script>

<template>
  <Stories title="Preview (Vue)" :component="Counter">
    <Story title="Default">
      <Counter />
      <code style="white-space: pre-wrap">
        {{ PreviewCode.code }}
      </code>
    </Story>
  </Stories>
</template>
