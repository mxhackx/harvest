// Seul le code web a une configuration ESLint ; l'API est couverte par le contrôle de types.
export default {
  "web/**/*.{ts,tsx}": "node scripts/eslint-web.mjs",
};
