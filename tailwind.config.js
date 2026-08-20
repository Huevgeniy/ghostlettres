/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#071821',
        ice: '#edf3f6',
        gold: '#c9ad67',
        cyan: '#5fb3b3',
      },
    },
  },
  plugins: [],
};
