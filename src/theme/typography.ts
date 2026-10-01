// Outfit (headings, scores) · Instrument Sans (body, buttons) · IBM Plex
// Mono (small uppercase labels), per the brand spec. The body family is also
// set as the app-wide Text/TextInput default (see App.tsx), so most copy
// needs no explicit fontFamily — only headings, scores and the small
// uppercase "eyebrow"/section-title labels need one of these.
export const fonts = {
  headingBold: 'Outfit-Bold',
  headingExtraBold: 'Outfit-ExtraBold',
  bodyRegular: 'InstrumentSans-Regular',
  bodyBold: 'InstrumentSans-Bold',
  monoRegular: 'IBMPlexMono-Regular',
  monoMedium: 'IBMPlexMono-Medium',
  monoBold: 'IBMPlexMono-Bold',
};
