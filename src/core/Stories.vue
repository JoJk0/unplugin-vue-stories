<script lang="ts" setup generic="T">
import type { Meta } from '@storybook/vue3'

const props = defineProps<Meta<T>>()
</script>

<template>
  <slot v-bind="{ args: props.args! as any }" />
</template>
