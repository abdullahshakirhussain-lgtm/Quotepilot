import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper background the whole app sits on.
        canvas: "#F6F5F1",
        // Burnt-orange accent: brand mark, urgency, focus. Used sparingly.
        brand: {
          50: "#FFF5EF",
          100: "#FFE7D9",
          200: "#FFCDB0",
          300: "#FDA77A",
          400: "#F77E45",
          500: "#EA5F22",
          600: "#D24A12",
          700: "#AE3A0E",
          800: "#8C3010",
          900: "#732B12",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
