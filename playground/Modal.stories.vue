<script setup lang="ts">
// import type { ComponentProps } from 'vue-component-type-helpers'
import { createReusableTemplate } from '@vueuse/core'
import AppButton from './Counter.vue'
import AppModal from './Counter.vue'

const title = 'Would you like to add a comment to the PDF Report?'

const unusedlol = ''

// defineMeta<typeof AppModal>({
defineMeta({
  parameters: {
    chromatic: { delay: 500 },
  },
  args: {
    activator: 'Submit report',
    title,
    actions: 'Add comment',
    default: 'Comments are not saved and will only appear on the PDF Report once created. To edit or add new comments please create a new report.',
  },
})

// const [DefineModalStory, ModalStory] = createReusableTemplate<ComponentProps<typeof AppModal>>()
const [DefineModalStory, ModalStory] = createReusableTemplate()

const constrainedDimensions = {
  '--app-modal-min-width': '30em',
  '--app-modal-max-width': '40em',
  '--app-modal-min-height': '20em',
  '--app-modal-max-height': '25em',
}

const setDimensions = {
  '--app-modal-width': '34em',
  '--app-modal-height': '22em',
}
</script>

<template>
  <Stories
    v-slot="{ args }"
    title="Components/Modal"
    :component="AppModal"
  >
    <DefineModalStory v-slot="props">
      <AppModal v-bind="{ ...props, ...args }" :is-open="true" :loc :[sd]="4" :git="a ?? b">
        <template #activator>
          <AppButton>{{ args.activator }}</AppButton>
        </template>
        <template #title>
          {{ args.title }}
          {{ title.map(t => t.a) }}
        </template>
        <template #actions>
          <AppButton :text="args.actions" />
          <AppButton text="Continue without comments" variant="outlined" style="--app-button-color: var(--app-color-secondary); --app-button-text-color: var(--app-color-on-secondary);" />
        </template>
        <b>Please note:</b> {{ args.default }}
      </AppModal>
    </DefineModalStory>

    <Story title="Normal">
      <ModalStory :is-open="false" />
    </Story>
    <Story title="Fullscreen">
      <ModalStory :full-screen="true" />
    </Story>
    <Story title="Without Backdrop">
      <ModalStory :style="{ '--app-modal-backdrop-display': 'none' }" />
    </Story>
    <Story title="Without Close Button">
      <ModalStory :show-close-button="false" />
    </Story>
    <Story title="Persistent">
      <ModalStory :hide-on-outside-click="false" />
    </Story>
    <Story title="Constrained Dimensions">
      <ModalStory
        :style="constrainedDimensions"
      />
    </Story>
    <Story title="Set Dimensions">
      <ModalStory
        :style="setDimensions"
      />
    </Story>
    <Story title="Set And Constrained Dimensions">
      <ModalStory
        :style="{ ...constrainedDimensions, ...setDimensions }"
      />
    </Story>
    <Story title="With Position Block End">
      <ModalStory
        position-block="end"
      />
    </Story>
    <Story title="With Position Block Start">
      <ModalStory
        position-block="start"
      />
    </Story>
    <Story title="With Position Inline Start">
      <ModalStory
        position-inline="start"
      />
    </Story>
    <Story title="With Position Inline End">
      <ModalStory
        position-inline="end"
      />
    </Story>
    <Story title="With Position Block Start Inline Start">
      <ModalStory
        position-block="start"
        position-inline="start"
      />
    </Story>
    <Story title="With Position Block Start Inline End">
      <ModalStory
        position-block="start"
        position-inline="end"
      />
    </Story>
    <Story title="With Position Block End Inline Start">
      <ModalStory
        position-block="end"
        position-inline="start"
      />
    </Story>
    <Story title="With Position Block End Inline End">
      <ModalStory
        position-block="end"
        position-inline="end"
      />
    </Story>
  </Stories>
</template>
