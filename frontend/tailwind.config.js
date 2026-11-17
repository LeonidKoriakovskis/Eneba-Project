/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eneba: {
          bg: "#0b0e17",
          card: "#141926",
          hover: "#1e2436",
          border: "#252e42",
          yellow: "#ffbf00",
          orange: "#ff5400",
          purple: "#7928ca",
          cyan: "#00d8f6",
          text: {
            primary: "#ffffff",
            secondary: "#9ba3af",
            muted: "#6b7280"
          }
        }
      }
    },
  },
  plugins: [],
}
