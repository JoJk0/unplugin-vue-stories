<script setup lang="ts">
import Counter from './Counter.vue'
</script>

<template>
  <Stories title="Counter (Vue)" :component="Counter">
    <Story title="Default">
      <Counter />
    </Story>
  </Stories>
</template>
