/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * The accent colour, in every step of its scale.
         *
         * These are not fixed colours. They read the custom properties
         * that the appearance layer sets on the root element, so when
         * the user picks a different colour scheme the whole app
         * follows, without a single component having to know about it.
         *
         * The values that are not set fall back to the blue that was
         * here before, so a page that is rendered before the
         * appearance has been applied still looks right.
         */
        primary: {
          50: 'rgb(var(--scheme-50-rgb, 239 246 255) / <alpha-value>)',
          100: 'rgb(var(--scheme-100-rgb, 219 234 254) / <alpha-value>)',
          200: 'rgb(var(--scheme-200-rgb, 191 219 254) / <alpha-value>)',
          300: 'rgb(var(--scheme-300-rgb, 147 197 253) / <alpha-value>)',
          400: 'rgb(var(--scheme-400-rgb, 96 165 250) / <alpha-value>)',
          500: 'rgb(var(--scheme-500-rgb, 59 130 246) / <alpha-value>)',
          600: 'rgb(var(--scheme-600-rgb, 37 99 235) / <alpha-value>)',
          700: 'rgb(var(--scheme-700-rgb, 29 78 216) / <alpha-value>)',
          800: 'rgb(var(--scheme-800-rgb, 30 64 175) / <alpha-value>)',
          900: 'rgb(var(--scheme-900-rgb, 30 58 138) / <alpha-value>)',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68d',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
};
