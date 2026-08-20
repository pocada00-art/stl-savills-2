import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        savills: { blue: "#002A54", yellow: "#FFCC00" },
      },
      boxShadow: {
        soft: "0 8px 30px rgba(15, 23, 42, .06)",
      },
    },
  },
  plugins: [],
};
export default config;
