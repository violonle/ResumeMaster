/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    "../../js/ui-components.js",
    "../../css/design-system.css",
    "!./node_modules/**"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
