/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pingo: {
          primary: "#1F4DFF",
          error: "#FF6F6F",
          accent: "#FFD400"
        }
      }
    }
  },
  plugins: []
};
