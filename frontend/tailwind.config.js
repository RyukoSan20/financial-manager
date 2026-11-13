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
          // The fallbacks are the Kakeibo palette, so the first paint
          // - before the appearance layer has run - is already the
          // colour the reader arrives at, and never a blue flash.
          50: 'rgb(var(--scheme-50-rgb, 250 249 246) / <alpha-value>)',
          100: 'rgb(var(--scheme-100-rgb, 244 241 234) / <alpha-value>)',
          200: 'rgb(var(--scheme-200-rgb, 216 243 220) / <alpha-value>)',
          300: 'rgb(var(--scheme-300-rgb, 168 207 192) / <alpha-value>)',
          400: 'rgb(var(--scheme-400-rgb, 82 121 111) / <alpha-value>)',
          500: 'rgb(var(--scheme-500-rgb, 61 90 82) / <alpha-value>)',
          600: 'rgb(var(--scheme-600-rgb, 47 72 66) / <alpha-value>)',
          700: 'rgb(var(--scheme-700-rgb, 38 59 53) / <alpha-value>)',
          800: 'rgb(var(--scheme-800-rgb, 30 43 39) / <alpha-value>)',
          900: 'rgb(var(--scheme-900-rgb, 22 33 30) / <alpha-value>)',
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
        // The warning family was a muddy brown; it is now the Kakeibo
        // terracotta, which reads as a warm warning rather than mud.
        warning: {
          50: '#FDF3EF',
          100: '#FBE7DF',
          200: '#F6CDBD',
          300: '#F0B09A',
          400: '#E79378',
          500: '#DC7455',
          600: '#C2543A',
          700: '#AD4530',
          800: '#9A3E2B',
          900: '#8A3728',
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
