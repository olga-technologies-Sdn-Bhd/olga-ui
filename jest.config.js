module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[a-z0-9-]+)?|@react-native(-community)?|@react-navigation)/)',
  ],
};
