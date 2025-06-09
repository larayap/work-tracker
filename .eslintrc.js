module.exports = {
  root: true,
  env: {
    node: true,
  },
  "globals": {
    "__static": "readonly"
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    parser: '@babel/eslint-parser',
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  extends: [
    'plugin:vue/essential',
    'eslint:recommended'
  ],
  rules: {
    // ...
  }
}