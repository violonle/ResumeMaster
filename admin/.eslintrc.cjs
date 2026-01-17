module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-essential'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'off',
    'no-empty': 'off',
    'no-useless-catch': 'off',
    'no-unsafe-optional-chaining': 'off',
    'no-undef': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'vue/valid-v-slot': 'off',
    'vue/no-parsing-error': 'off'
  }
};
