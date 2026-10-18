module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['*.js', '*.jsx', '*.ts', '*.tsx'],
      rules: {
        // Every popup uses the app's themed dialog (showDialog / ConfirmDialog), never the system alert.
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-native',
                importNames: ['Alert'],
                message: "Use showDialog() from components/DialogHost (or ConfirmDialog) so popups match the app's theme.",
              },
            ],
          },
        ],
      },
    },
  ],
};
