export default [
  {
    ignores: [".tmp/**", "dist/**", "node_modules/**", "*.js"]
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "warn",
      "prefer-const": "warn"
    }
  }
];
