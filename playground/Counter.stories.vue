<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import Stories from '../src/core/Stories.vue'
import Story from '../src/core/Story.vue'
import Counter from './Counter.vue'

import type { ComponentProps, ComponentSlots } from 'vue-component-type-helpers'

defineMeta({
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
  args: {
    title: 'Counter',
    default: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  },
})

const [DefineCounterStory, CounterStory] = createReusableTemplate<
  ComponentProps<typeof Counter>,
  ComponentSlots<typeof Counter>
>()
</script>

<template>
  <Stories v-slot="{ args }" title="Counter (Vue)" :component="Counter">
    <DefineCounterStory v-slot="{ $slots, ...slotProps }">
      <Counter v-bind="{ ...slotProps, ...args }">
        <template #default="{ prop1 }">
          <p>{{ args.default }}: {{ prop1 }}</p>
        </template>
        <template v-if="$slots.title" #title="titleProps">
          <component :is="$slots.title" v-bind="titleProps" />
        </template>
      </Counter>
    </DefineCounterStory>
    <Story title="Default">
      <CounterStory lorem="Default">
        <template #title="{ prop1 }">
          <h1>Title: {{ args.title }}: {{ prop1 }}</h1>
        </template>
      </CounterStory>
    </Story>
    <Story title="Non Default">
      <CounterStory lorem="Ipsum" />
    </Story>
  </Stories>
</template>
