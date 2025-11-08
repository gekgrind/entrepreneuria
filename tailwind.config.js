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
      /* 🎨 Brand Colors - powered by CSS variables */
      colors: {
        entrepreneuria: {
          blue: "var(--brand-blue)",      // #4f7ca7
          orange: "var(--brand-orange)",  // #d27a2c
          navy: "var(--brand-navy)",      // #1a2942
          gray: "#6c6c6c",
          light: "#d8d9d9",
        },
      },

      /* 🌈 Gradient Utilities */
      backgroundImage: {
        "entrepreneuria-gradient":
          "linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-blue) 50%, var(--brand-orange) 100%)",
        "entrepreneuria-gradient-rev":
          "linear-gradient(135deg, var(--brand-orange) 0%, var(--brand-blue) 50%, var(--brand-navy) 100%)",
        "entrepreneuria-accent":
          "linear-gradient(90deg, var(--brand-blue), var(--brand-orange))",
      },

      /* ✨ Optional subtle animation for gradients */
      animation: {
        "gradient-flow": "gradientFlow 6s ease infinite",
      },
      keyframes: {
        gradientFlow: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
}

