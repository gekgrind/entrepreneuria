/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "sans-serif"],
        heading: ["var(--font-heading)", "serif"],
      },
      /* 🎨 Brand Colors - powered by CSS variables */
      colors: {
        entrepreneuria: {
          navy: "var(--brand-navy)",      // #1a2942
          accent: "var(--brand-accent)",  // #00D4FF
          gray: "#6c6c6c",
          light: "#d8d9d9",
        },
      },
    },
  },
  plugins: [],
}
