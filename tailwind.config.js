/** @type {import('tailwindcss').Config} */

// All color tokens are driven by CSS custom properties defined in
// `src/styles.css`. The dark palette lives under :root; a
// prefers-color-scheme: light media query swaps them for the light palette.
// Using `rgb(var(--token) / <alpha-value>)` keeps Tailwind's opacity modifiers
// (e.g. `bg-primary/40`) working in both themes.
const tokenColor = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'surface-container-lowest': tokenColor('surface-container-lowest'),
        'surface-container-low': tokenColor('surface-container-low'),
        surface: tokenColor('surface'),
        'surface-dim': tokenColor('surface-dim'),
        'surface-container': tokenColor('surface-container'),
        'surface-container-high': tokenColor('surface-container-high'),
        'surface-container-highest': tokenColor('surface-container-highest'),
        'surface-variant': tokenColor('surface-variant'),
        'surface-bright': tokenColor('surface-bright'),
        'surface-tint': tokenColor('surface-tint'),
        background: tokenColor('background'),
        'on-background': tokenColor('on-background'),
        'on-surface': tokenColor('on-surface'),
        'on-surface-variant': tokenColor('on-surface-variant'),
        'inverse-surface': tokenColor('inverse-surface'),
        'inverse-on-surface': tokenColor('inverse-on-surface'),
        outline: tokenColor('outline'),
        'outline-variant': tokenColor('outline-variant'),

        primary: tokenColor('primary'),
        'primary-dim': tokenColor('primary-dim'),
        'primary-container': tokenColor('primary-container'),
        'on-primary': tokenColor('on-primary'),
        'on-primary-container': tokenColor('on-primary-container'),
        'inverse-primary': tokenColor('inverse-primary'),

        secondary: tokenColor('secondary'),
        'secondary-dim': tokenColor('secondary-dim'),
        'secondary-container': tokenColor('secondary-container'),
        'on-secondary': tokenColor('on-secondary'),
        'on-secondary-container': tokenColor('on-secondary-container'),

        tertiary: tokenColor('tertiary'),
        'tertiary-dim': tokenColor('tertiary-dim'),
        'tertiary-container': tokenColor('tertiary-container'),
        'on-tertiary': tokenColor('on-tertiary'),
        'on-tertiary-container': tokenColor('on-tertiary-container'),

        error: tokenColor('error'),
        'error-dim': tokenColor('error-dim'),
        'error-container': tokenColor('error-container'),
        'on-error': tokenColor('on-error'),
        'on-error-container': tokenColor('on-error-container'),
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.02em',
      },
      keyframes: {
        'soft-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
        'slide-in': 'slide-in 280ms ease-out',
        'fade-in': 'fade-in 240ms ease-out',
      },
    },
  },
  plugins: [],
};
