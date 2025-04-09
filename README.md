# `unplugin-vue-stories`

Write Storybook stories in Vue SFC format.

## Why?

Existing `storybook-vue-addon` is great, but it lacks some features that are essential workflows for many people. 
The main goal of this addon is to have **everything** auto-generated from components and only define test cases (stories) inside stories file.

## Features

### `<script setup>` component description

Insert JSDoc tag just under the `<script setup>` tag to describe the component.

```vue
<script lang="ts" setup>
/**
 * Displays a button.
 */
```

###  `Models` section

Using `defineModels` and `defineModel` alongside with JSDoc comments, will generate a `Models` section in the story.

### CSS Variables with controls

Just add JSDoc comment over any CSS variable to define it as component CSS property (requires `@ljcl/storybook-addon-cssprops`)

```vue
<style scoped>
:root {
  /**
   * The width of the component.
   * @syntax <length>
   */
  --my-component-width: 20em;
}
```

### Design link support 

Add `@<design>Id` tag to your component JSDoc block (requires `@storybook/addon-designs`). 
Set `getUrl` in options to have IDs and URLs decoupled.
  
### Category support 

Add through `@category` tag in your component JSDoc block. It will namespace the stories.

### Controls for props and parts of slots

Destructure `args` from default slot props of `Stories` or `Story` and use `args[<your-slot-name>]` to control an aspect of a slot.

Controllable props are available if `<Story>` has either a single child component, or one of child components is a component defined within story file either through `component` property in meta, or `component` prop in `<Stories>`.

```vue
<template>
  <Stories
    v-slot="{ args }"
    title="Components/Modal"
    :component="AppModal"
  >
    <Story title="Normal">
      <AppModal v-bind="args">
        <template #activator>
          <AppButton>{{ args.activator }}</AppButton>
        </template>
```

### Template reusability 

Reuse templates via `createReusableTemplate` `@vueuse/core` function. 
Anything inside `Stories` that is not a `Story` will be added to each story, respecting the original order.

```html
<Stories>
  <DefineMyStory />
  <Story name="A">
    <MyComponent>
  </Story>
  <SomeOtherReusableTemplate />
  <Story name="B">
    <MyComponent>
  </Story>
</Stories>
```

Will be transformed into:

```html
<Stories>
  <Story name="A">
    <DefineMyStory />
    <MyComponent>
    <SomeOtherReusableTemplate />
  </Story>
  <Story name="B">
    <SomeOtherReusableTemplate />
    <DefineMyStory />
    <MyComponent>
  </Story>
</Stories>
```
Full example:

```vue
<script lang="ts" setup>
import { createReusableTemplate } from '@vueuse/core'

const [DefineModalStory, ModalStory] = createReusableTemplate()
</script>

<template>
  <Stories
    v-slot="{ args }"
    title="Components/ModalVue"
    :component="AppModal"
  >
    <DefineModalStory v-slot="props">
      <AppModal v-bind="{ ...props, ...args }">
        <template #activator>
          <AppButton>{{ args.activator }}</AppButton>
        </template>
        <b>Please note:</b> {{ args.default }}
      </AppModal>
    </DefineModalStory>

    <Story title="Unchecked">
      <ModalStory :is-open="false" />
    </Story>

    <Story title="Fullscreen">
      <ModalStory full-screen />
    </Story>
```

::: warning
You can only pass data into the reusable template that do not require `<script setup>` context (e.g. refs, reactive properties, composables etc.)
:::

### `defineMeta` SFC macro

Compiler macro to define metadata for the component. 
Defined properties are deep-merged on top of the existing metadata.

```vue
<script setup>

defineMeta({
  parameters: {
    chromatic: { delay: 500 },
  }
})
```

### Component previews

Add `?preview` suffix to the story import to get the default story should you need it for external documentation

```vue
<script setup lang="ts">
import CounterPreview from './Counter.stories.vue?preview'
</script>

<template>
  <section>
    <h1>Preview Example</h1>
    <CounterPreview />
  </section>
</template>
```
