/* eslint-disable import/no-default-export */
import { CssPropsBlock } from '@ljcl/storybook-addon-cssprops'
import {
  Controls,
  Description,
  Primary,
  Stories,
  Subtitle,
  Title,
} from '@storybook/blocks'
import { createElement, Fragment } from 'react'

export default () => {
  return createElement(Fragment, null, [
    createElement(Title, { key: 'title' }),
    createElement(Subtitle, { key: 'subtitle' }),
    createElement(Description, { key: 'description' }),
    createElement(Primary, { key: 'primary' }),
    createElement(Controls, { key: 'controls' }),
    createElement(CssPropsBlock, { key: 'cssprops' }),
    createElement(Stories, { key: 'stories' }),
  ])
}
