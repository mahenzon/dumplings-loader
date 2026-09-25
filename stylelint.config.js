export default {
  extends: ['stylelint-config-standard'],
  overrides: [{ files: ['**/*.html'], customSyntax: 'postcss-html' }],
  ignoreFiles: ['dist/**', 'site/**', 'node_modules/**'],
};
