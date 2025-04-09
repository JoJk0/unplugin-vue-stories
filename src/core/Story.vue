<script lang="ts" setup generic="T">
import type { Meta } from '@storybook/vue3'

defineProps<Meta<T>>()
</script>

<template><slot /></template>
