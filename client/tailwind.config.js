/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FAF9FC',
          card: '#FFFFFF',
          primary: '#6D28D9',
          dark: '#4C1D95',
          lavender: '#F1EBFF',
          text: '#24212B',
          muted: '#777180',
          border: '#EAE6F0',
          success: '#16865B',
          error: '#DC4040',
        }
      }
    },
  },
  plugins: [],
}
