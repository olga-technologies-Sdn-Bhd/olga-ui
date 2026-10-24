module.exports = {
  // Inter, the app's one typeface (src/theme/typography.ts). It's already
  // linked by hand: Android through res/font/inter.xml, iOS in the Xcode
  // project and Info.plist's UIAppFonts. `npx react-native-asset` would link
  // it a second time, so there's no need to run it for fonts.
  assets: ['./src/assets/fonts'],
};
