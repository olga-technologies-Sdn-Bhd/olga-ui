module.exports = {
  preset: '@react-native/jest-preset',
  // lucide-react-native resolves to an .mjs build jest won't compile; use its CommonJS build.
  moduleNameMapper: {
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[a-z0-9-]+)?|@react-native(-community)?|@react-navigation)/)',
  ],
};
