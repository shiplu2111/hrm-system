/** @type {import('tailwindcss').Config} */

const scale = (prefix) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      .filter((step) => step !== 950 || prefix === 'accent' || prefix === 'secondary')
      .map((step) => [step, `rgb(var(--color-${prefix}-${step}) / <alpha-value>)`]),
  );

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/portal-ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // primary in DESIGN_SYSTEM.md — implemented as `accent` for existing class names
        accent: scale('accent'),
        primary: scale('accent'),
        secondary: scale('secondary'),
        neutral: scale('secondary'),
        success: scale('success'),
        warning: scale('warning'),
        error: scale('error'),
        danger: scale('error'),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.125rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.625rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.5rem', { lineHeight: '2rem' }],
        '4xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '5xl': ['2rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        0.5: 'var(--spacing-0-5)',
        1: 'var(--spacing-1)',
        2: 'var(--spacing-2)',
        3: 'var(--spacing-3)',
        4: 'var(--spacing-4)',
        5: 'var(--spacing-5)',
        6: 'var(--spacing-6)',
        8: 'var(--spacing-8)',
        10: 'var(--spacing-10)',
        12: 'var(--spacing-12)',
        16: 'var(--spacing-16)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        elevated: 'var(--shadow-elevated)',
        xl: 'var(--shadow-xl)',
      },
      ringColor: {
        focus: 'rgb(var(--ring-focus) / <alpha-value>)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
