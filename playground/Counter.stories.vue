<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import Stories from '../src/core/Stories.vue'
import Story from '../src/core/Story.vue'
import Counter from './Counter.vue'

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

const [DefineCounterStory, CounterStory] = createReusableTemplate()
</script>

<template>
  <Stories v-slot="{ args }" title="Counter (Vue)" :component="Counter">
    <DefineCounterStory v-slot="props">
      <Counter v-bind="{ ...props, ...args }">
        <template #title="{ prop1 }">
          <h1>{{ args.title }}: {{ prop1 }}</h1>
        </template>
        <template #default="{ prop1 }">
          <p>{{ args.default }}: {{ prop1 }}</p>
        </template>
      </Counter>
    </DefineCounterStory>
    <Story title="Default">
      <CounterStory lorem="Default" />
    </Story>
    <Story title="Non Default">
      <CounterStory lorem="Ipsum" />
    </Story>
  </Stories>
</template>
