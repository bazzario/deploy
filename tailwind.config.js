/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F1720",
          soft: "#334155",
        },
        brand: {
          50: "#FFF3EC",
          100: "#FFE3D1",
          400: "#F17A32",
          500: "#E8590C",
          600: "#C7480A",
          700: "#9C3808",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#F7F8FA",
          border: "#E7EAEE",
        },
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,32,0.04), 0 4px 12px rgba(15,23,32,0.05)",
        pop: "0 8px 24px rgba(15,23,32,0.10)",
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
  plugins: [],
};
