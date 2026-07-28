/** @type {import('tailwindcss').Config} */
// ZORYXA MAIL — locked brand palette, exposed as CSS variables (src/index.css)
// so light and dark modes share one token table.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: v('--c-ink'),
        navy: v('--c-navy'),
        navydeep: v('--c-navydeep'),
        mist: v('--c-mist'),
        paper: v('--c-paper'),
        gold: v('--c-gold'),
        golddeep: v('--c-golddeep'),
        goldsoft: v('--c-goldsoft'),
        line: v('--c-line'),
        muted: v('--c-muted'),
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.10), 0 6px 20px rgba(0,0,0,.10)',
        lift: '0 2px 4px rgba(0,0,0,.12), 0 12px 32px rgba(0,0,0,.18)',
        nav: '0 -4px 24px rgba(0,0,0,.14)',
      },
      fontFamily: {
        sans: [
          'DM Sans',
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif',
        ],
        display: [
          'Space Grotesk',
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif',
        ],
      },
      keyframes: {
        fadeup: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeup: 'fadeup 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
