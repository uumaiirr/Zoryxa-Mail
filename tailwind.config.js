/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm-ivory luxury neutrals + deep navy + antique gold.
        ink: '#12202E', // primary text
        navy: '#122B44', // primary actions, brand
        navydeep: '#0A1A2C',
        mist: '#F6F4EF', // app background (warm ivory)
        paper: '#FFFFFF',
        gold: '#C6A15B', // fills, badges, accents (pair with navy text)
        golddeep: '#8F7434', // gold-toned TEXT on light bg (AA contrast)
        goldsoft: '#F3ECDC',
        line: '#E8E4DA', // hairlines, borders
        muted: '#5C6B7A', // secondary text
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,32,46,.05), 0 6px 20px rgba(18,32,46,.05)',
        lift: '0 2px 4px rgba(18,32,46,.06), 0 12px 32px rgba(18,32,46,.10)',
        nav: '0 -4px 24px rgba(18,32,46,.08)',
      },
      fontFamily: {
        sans: [
          'Jost',
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif',
        ],
        display: ['Bodoni Moda', 'Didot', 'Playfair Display', 'Georgia', 'serif'],
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
