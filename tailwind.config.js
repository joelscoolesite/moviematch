/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        reel: {
          950: '#07090d',
          900: '#0b0e14',
          800: '#12161f',
          700: '#1a1f2c',
          600: '#262c3c',
          500: '#3a4257',
          400: '#5b6478',
          300: '#8890a3',
          200: '#c2c7d3',
          100: '#e9ebf0'
        },
        marquee: {
          DEFAULT: '#e8b75a',
          light: '#f3d190',
          dark: '#b8863b'
        },
        skip: '#e2555a',
        like: '#3fb98a'
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 20px 60px -15px rgba(0,0,0,0.6)'
      },
      borderRadius: {
        card: '20px'
      }
    }
  },
  plugins: []
}
