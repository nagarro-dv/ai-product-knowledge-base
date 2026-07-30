import type { Preview } from '@storybook/react-vite'
// The design system's real tokens + global styles — stories render exactly
// like the shipped components, not an unstyled approximation.
import '../src/index.css'

// Token values are scoped to these attributes (see apps/web/index.html);
// without them every var(--ds-*) resolves to nothing and stories render bare.
document.documentElement.setAttribute('data-ds-theme', 'default')
document.documentElement.setAttribute('data-ds-appearance', 'Light')
document.documentElement.setAttribute('data-ds-density', 'Standard')

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;