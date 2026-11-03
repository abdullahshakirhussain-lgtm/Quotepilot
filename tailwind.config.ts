import type { Config } from "tailwindcss";

// Cards on a light grey page: graphite text and buttons, and colour only where
// it means something (red late, amber today, blue open, green won). The default
// `stone`, `red` and `emerald` scales are replaced, so every existing utility
// picks up the palette; `brand` is the yellow highlight at the light end and
// graphite at the dark end.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F2F4F6",
        line: "#E4E7EB",
        // Open quotes and anything scheduled.
        info: { 50: "#E8F1FC", 500: "#2A78D6", 700: "#1C5CAB" },
        // Due today, and quotes not sent yet.
        due: { 50: "#FFF4D6", 500: "#EDA100", 800: "#7A4F00" },
        stone: {
          50: "#F6F7F8",
          100: "#ECEFF1",
          200: "#D6DBDF",
          300: "#B9C0C6",
          400: "#8A949C",
          500: "#5F6872",
          600: "#4B535C",
          700: "#363D45",
          800: "#282E35",
          900: "#1F2328",
          950: "#15181C",
        },
        brand: {
          50: "#FFFBE0",
          100: "#FFF5B8",
          200: "#FFE45C",
          300: "#FFD92E",
          400: "#E8C21A",
          500: "#1F2328",
          600: "#1F2328",
          700: "#1F2328",
          800: "#15181C",
          900: "#15181C",
        },
        red: {
          50: "#FDF1F1",
          100: "#FBE0E0",
          200: "#F4BDBD",
          300: "#EA8F8F",
          400: "#DD5C5C",
          500: "#D03B3B",
          600: "#C62828",
          700: "#A91F1F",
          800: "#861A1A",
          900: "#6E1616",
        },
        emerald: {
          50: "#EEF6EF",
          100: "#D9EBDB",
          200: "#B4D7B8",
          300: "#86BD8C",
          400: "#4F9A57",
          500: "#2F7D37",
          600: "#23692A",
          700: "#1C5822",
          800: "#17461C",
          900: "#123817",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // The one motion curve: quick start, soft stop, no bounce.
      transitionTimingFunction: {
        board: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
      fontSize: {
        xs: ["12px", "16px"],
        sm: ["14px", "20px"],
        base: ["15px", "22px"],
        lg: ["17px", "24px"],
      },
    },
  },
  plugins: [],
};

export default config;
