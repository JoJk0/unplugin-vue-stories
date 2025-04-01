<script setup lang="ts">
import Modal from './Modal.vue'
</script>

<template>
  <Stories title="Modal" :component="Modal">
    <Story title="Default">
      <Modal />
    </Story>
  </Stories>
</template>
