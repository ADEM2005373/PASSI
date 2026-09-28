import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'passi-bleu': '#101828',
        'passi-corail': '#FF6B5E',
        'passi-creme': '#FFF8F1',
        'passi-turquoise': '#19C3B1',
        'passi-surface': '#182230',
        'passi-text-sec': '#B8C2D1',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Assuming Inter for now as standard modern sans
      }
    },
  },
  plugins: [],
};
export default config;
