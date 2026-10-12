// Design system: warm neutral ground (bone/sand/ink), no blue, no gradients.
// Green is reserved for live/match signals only; amber for outcome states
// only. Everything else (buttons, selected chips, progress, tab icons) uses
// the single ink neutral. Both light and dark variants share the same shape
// so any screen can switch via useTheme() without branching logic.
export const lightColors = {
  bg: '#F4F1EC', // Bone — app ground
  surface: '#FFFDF9', // Card surface
  surface2: '#EDE5D8', // Sand — secondary surface (date blocks, pill base)
  text: '#171310', // Ink
  muted: '#6B6259', // Muted — secondary text, 5.3:1 on bone
  line: '#E6DFD4', // Card border
  // Ink doubles as the one neutral "accent": primary buttons, selected
  // chips, progress fill, tab active tint. Never blue, never a hue.
  brand: '#171310',
  // Text/icons on a brand (primary) button.
  onBrand: '#ffffff',
  // Outline button border (spec: outline buttons use #CFC6B8).
  brand2: '#CFC6B8',
  // Sand strong — selected chips, icon-wrap fills.
  brandSoft: '#E4DACB',
  // Sand — avatar/icon backgrounds, soft pill tint, chat "me" bubble.
  accentSoft: '#EDE5D8',
  // Functional near-black for buttons like chat "send" — same as text/ink.
  ink: '#171310',
  onInk: '#FFFDF9',
  // Green TEXT — match scores and counts. Never used as a fill/icon color.
  positive: '#147A3A',
  // Green tint — background behind green text (e.g. a match-count pill).
  positiveSoft: '#E7F3EB',
  // Green FILL — live dot, live ring (PulseRings), live button. Never text.
  liveFill: '#16A34A',
  // Amber — outcome states only (e.g. "Confirm you met").
  amber: '#F2A93B',
  amberSoft: '#FBEBD0',
  amberText: '#7A4E0F',
  // The one large dark element (default Go Live button).
  charcoal: '#3A3531',
  // Selected chip / active tab underline, and the text on it.
  selected: '#3A3531',
  onSelected: '#ffffff',
  danger: '#ef5a67',
  white: '#ffffff',
  // Warm concentric halo behind the Go Live ring, lightest to deepest.
  tint: '#F1EBE0',
  tint2: '#E7DCC9',
  tintLine: '#CFC6B8',
  track: '#D9D3C8',
  progressTrack: '#EFEAE0',
};

export const darkColors = {
  // Dark mode isn't covered by the brand spec (which is light/warm only).
  // Graphite: neutral near-black greys with no brown cast, same roles as the
  // light palette. Not a client-approved palette yet.
  bg: '#121314',
  surface: '#1B1C1E',
  surface2: '#242628',
  text: '#F2F3F4',
  muted: '#9DA1A6',
  line: '#2E3033',
  brand: '#F2F3F4',
  onBrand: '#121314',
  brand2: '#4A4D52',
  brandSoft: '#303236',
  accentSoft: '#242628',
  // Light 'send' button on the dark ground, dark arrow on it (the mirror of
  // light mode); ink/onInk were both near-black, so the button disappeared.
  ink: '#F2F3F4',
  onInk: '#121314',
  positive: '#34D399',
  positiveSoft: '#14291E',
  liveFill: '#16A34A',
  amber: '#F2C98A',
  amberSoft: '#33280F',
  amberText: '#F2C98A',
  // A step lighter than the surfaces so the dark card and buttons still read.
  charcoal: '#2E3034',
  selected: '#F2F3F4',
  onSelected: '#121314',
  danger: '#ff7a86',
  white: '#ffffff',
  tint: '#1E1F21',
  tint2: '#26282A',
  tintLine: '#3E4145',
  track: '#3A3D41',
  progressTrack: '#2A2C2F',
};

export type ThemeColors = typeof lightColors;

// Static export kept for screens not yet migrated to useTheme() — always
// the light palette. New/updated screens should use useTheme() instead.
export const colors = lightColors;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};
