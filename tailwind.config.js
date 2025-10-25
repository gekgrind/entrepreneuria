/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "*.{js,ts,jsx,tsx,mdx}"
    ],
  theme: {
    extend: {
      colors: {
        entrepreneuria: {
          blue: '#4f7ca7',
          orange: '#d27a2c',
          gray: '#6c6c6c',
          light: '#f5f7fa',
          dark: '#1f1f1f',
        },
      },
      backgroundImage: {
        'entrepreneuria-gradient': 'linear-gradient(135deg, #4f7ca7, #d27a2c)',
        'entrepreneuria-gradient-rev': 'linear-gradient(135deg, #d27a2c, #4f7ca7)',
      },
    },
  },
  plugins: [],
}
