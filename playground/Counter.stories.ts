/* eslint-disable import/no-default-export */
import Counter from './Counter.vue'
import type { Meta, StoryObj } from '@storybook/vue3'

console.log('Counter', Counter)

const meta = {
  title: 'Counter (CSF)',
  component: Counter,
  tags: ['autodocs'],
} satisfies Meta<typeof Counter>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    modelValue: '',
    lorem: 'ipsum',
  },
}
