/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#FAFBF8",
          light: "#F1F4EE",
          lighter: "#E0E6DC",
        },
        parchment: {
          DEFAULT: "#060606",
          muted: "#6E7267",
          dim: "#9CA096",
        },
        lamp: {
          DEFAULT: "#7FB069",
          bright: "#A3CB8F",
          dim: "#4C7238",
        },
        ledger: {
          DEFAULT: "#8FBFAE",
          bright: "#3F7A64",
          dim: "#D3E6DE",
        },
        rust: "#B8492A",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
 