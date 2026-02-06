<script lang="ts" setup>
import { userEvent, within } from 'storybook/test'
import AppAccordionGroup from '../components/AppAccordionGroup.vue'
import AppAccordion from '../components/AppAccordion.vue'

// const [DefineAccordionGroupStory, AccordionGroupStory] = createReusableTemplate<ComponentProps<typeof AppAccordionGroup>>()
const [DefineAccordionGroupStory, AccordionGroupStory] = createReusableTemplate()

const nums = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth']

const items = nums.map(num => ({
  triggerText: `${num} panel`,
  contentText: `contentText of the ${num.toLowerCase()} panel. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse.`,
}))
</script>

<script lang="ts">
// @ts-expect-error - Storybook Vue TS are not yet available
const expand = (positions) => async ({ canvasElement }) => {
  const buttons = within(canvasElement).getAllByRole('button')
  for (const position of positions) {
    // @ts-expect-error - Storybook Vue TS are not yet available
    await userEvent.click(buttons.at(position))
  }
}

const expandFirst = expand([0])

const expandMultiple = expand([2, 6])

const expandLast = expand([-1])
</script>

<template>
  <Stories
    title="Components/Accordion Group"
    :component="AppAccordionGroup"
  >
    <DefineAccordionGroupStory>
      <AppAccordionGroup>
        <AppAccordion
          v-for="{ triggerText, contentText } in items"
          :key="triggerText"
        >
          <template #trigger>{{ triggerText }}</template>
          {{ contentText }}
        </AppAccordion>
      </AppAccordionGroup>
    </DefineAccordionGroupStory>

    <Story title="Default">
      <AccordionGroupStory />
    </Story>
    <Story
      title="First Expanded"
      :play="expandFirst"
    >
      <AccordionGroupStory />
    </Story>
    <Story
      title="Multiple Expanded"
      :play="expandMultiple"
    >
      <AccordionGroupStory />
    </Story>
    <Story
      title="Last Expanded"
      :play="expandLast"
    >
      <AccordionGroupStory />
    </Story>
  </Stories>
</template>
