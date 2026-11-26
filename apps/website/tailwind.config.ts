import type { Config } from 'tailwindcss';
import portalPreset from '../../packages/portal-ui/design-tokens.tailwind.js';

const config: Config = {
  presets: [portalPreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/portal-ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--color-accent-50) / <alpha-value>)',
          100: 'rgb(var(--color-accent-100) / <alpha-value>)',
          200: 'rgb(var(--color-accent-200) / <alpha-value>)',
          300: 'rgb(var(--color-accent-300) / <alpha-value>)',
          400: 'rgb(var(--color-accent-400) / <alpha-value>)',
          500: 'rgb(var(--color-accent-500) / <alpha-value>)',
          600: 'rgb(var(--color-accent-600) / <alpha-value>)',
          700: 'rgb(var(--color-accent-700) / <alpha-value>)',
          800: 'rgb(var(--color-accent-800) / <alpha-value>)',
          900: 'rgb(var(--color-accent-900) / <alpha-value>)',
          950: 'rgb(var(--color-accent-950) / <alpha-value>)',
        },
      },
      // Marketing layer on top of compact product tokens (DESIGN_SYSTEM.md §2.2)
      fontSize: {
        'display-2xl': ['3.5rem', { lineHeight: '4rem', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-xl': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-lg': ['2.5rem', { lineHeight: '3rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-md': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-sm': ['1.625rem', { lineHeight: '2.125rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        lead: ['1.125rem', { lineHeight: '1.75rem', fontWeight: '400' }],
        'lead-lg': ['1.25rem', { lineHeight: '1.875rem', fontWeight: '400' }],
      },
      // Wider spacing rhythm for marketing sections (on top of 4px base grid)
      spacing: {
        18: '4.5rem',
        20: '5rem',
        24: '6rem',
        28: '7rem',
        32: '8rem',
      },
      maxWidth: {
        container: '75rem',
        narrow: '48rem',
        wide: '82rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
