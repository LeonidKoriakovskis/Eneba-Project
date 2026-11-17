/** @type {import('tailwindcss').Config} */
const enebaColors = {
  canvas: "#1F0A4D",
  canvasLight: "#2B0F6B",
  brand: "#4618AC",
  card: "#37128A",
  cardHover: "#431A9E",
  line: "#5B2FC4",
  yellow: "#FFDC00",
  yellowHover: "#FFE633",
  ink: "#1F0A4D",
  orange: "#FD5A20",
  magenta: "#FF2E63",
  teal: "#19E3B1",
  muted: "#B9A8E8",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        eneba: enebaColors,
        "eneba-canvas": enebaColors.canvas,
        "eneba-canvasLight": enebaColors.canvasLight,
        "eneba-brand": enebaColors.brand,
        "eneba-card": enebaColors.card,
        "eneba-cardHover": enebaColors.cardHover,
        "eneba-line": enebaColors.line,
        "eneba-yellow": enebaColors.yellow,
        "eneba-yellowHover": enebaColors.yellowHover,
        "eneba-ink": enebaColors.ink,
        "eneba-orange": enebaColors.orange,
        "eneba-magenta": enebaColors.magenta,
        "eneba-teal": enebaColors.teal,
        "eneba-muted": enebaColors.muted,
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 6px 20px -6px rgba(10, 2, 36, 0.6)",
        glow: "0 0 0 3px rgba(255, 220, 0, 0.35)",
      },
    },
  },
  plugins: [],
};
