// Design system: a warm, quiet ground (ivory, white cards, sand fills) with
// near-black ink as the one deep colour: buttons, selection, the active tab.
// No blue anywhere. Green is reserved for live/match signals; a muted gold for
// outcome states; a soft apricot glow belongs to the Olga agent alone (its
// sparkle, the Ask Olga bar). Both light and dark variants share the same
// shape so any screen can switch via useTheme() without branching logic.
export const lightColors = {
  bg: '#F6F3EE', // App ground: warm ivory, so white cards lift off it
  bgClear: 'rgba(246,243,238,0)', // The ground, fully transparent (fades into it)
  surface: '#FFFFFF', // Card surface
  surface2: '#EFEAE3', // Secondary surface (date blocks, inputs, pill base): warm sand
  text: '#1A1917', // Ink: a warm near-black
  muted: '#6F6A63', // Secondary text
  line: '#E8E2D9', // Hairlines and card borders
  // Ink is the one "accent": primary buttons, selected chips, progress fill,
  // tab active tint.
  brand: '#1A1917',
  // Text/icons on a brand (primary) button.
  onBrand: '#ffffff',
  // Outline button border.
  brand2: '#D8D1C6',
  // Selected chips, icon-wrap fills.
  brandSoft: '#ECE6DD',
  // Avatar/icon backgrounds, soft pill tint, chat "me" bubble.
  accentSoft: '#F2EEE8',
  // Buttons like chat "send": the same ink as brand.
  ink: '#1A1917',
  onInk: '#FFFFFF',
  // Green TEXT: match scores and counts. Never used as a fill/icon color.
  positive: '#147A3A',
  // Green tint: background behind green text (e.g. a match-count pill).
  positiveSoft: '#E5F2E8',
  // Green FILL: live dot, live ring (PulseRings), live button. Never text.
  liveFill: '#16A34A',
  // Muted gold: outcome states only (e.g. "Confirm you met").
  amber: '#B8975A',
  amberSoft: '#F4ECDC',
  amberText: '#6B5220',
  // The one large dark element (default Go Live button, dark avatars): ink.
  charcoal: '#1A1917',
  // Dark cards: a slow diagonal fade within the same warm ink.
  cardFrom: '#2B2825',
  cardTo: '#161513',
  // Champagne: a small title on a dark card.
  champagne: '#E3CBA4',
  // Olga agent only: its sparkle, the glow behind it, the rings on the
  // Social Capital card.
  glow: '#E08A4F',
  glowSoft: '#FBEADC',
  glowRing: '#F2C9A6',
  glowRing2: '#D9C9E8',
  // The floating tab bar: frosted warm glass. A translucent gradient (lighter
  // at the top), a bright inner top edge where light catches it, a faint outline.
  glass: 'rgba(255,253,250,0.90)',
  glassLow: 'rgba(248,244,238,0.86)',
  glassHighlight: 'rgba(255,255,255,0.95)',
  glassLine: 'rgba(26,25,23,0.08)',
  // Selected chip / active tab underline, and the text on it.
  selected: '#1A1917',
  onSelected: '#ffffff',
  danger: '#D64555',
  dangerSoft: 'rgba(214,69,85,0.12)',
  // Active states (selected tab, its pill, menu icons, links): ink, on a
  // soft sand fill.
  accent: '#1A1917',
  accentFill: 'rgba(26,25,23,0.07)',
  white: '#ffffff',
  // Concentric halo behind the Go Live ring, lightest to deepest.
  tint: '#F0ECE6',
  tint2: '#E8E2DA',
  tintLine: '#D4CCC1',
  track: '#D9D2C8',
  progressTrack: '#ECE7E0',
  // Conversations: my messages in ink, theirs on white.
  bubbleMe: '#262422',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#FFFFFF',
  bubbleThemLine: '#E8E2D9',
  chatGround: '#F3EFE9',
};

export const darkColors = {
  // Dark mode isn't covered by the brand spec (which is light/warm only).
  // Warm graphite: near-black greys with a slight warm cast, same roles as
  // the light palette. Not a client-approved palette yet.
  bg: '#121110',
  bgClear: 'rgba(18,17,16,0)', // The ground, fully transparent (fades into it)
  surface: '#1C1B19',
  surface2: '#262422',
  text: '#F3F1EE',
  muted: '#A19C95',
  line: '#302E2B',
  brand: '#F3F1EE',
  onBrand: '#121110',
  brand2: '#4B4844',
  brandSoft: '#33312E',
  accentSoft: '#262422',
  // Light 'send' button on the dark ground, dark arrow on it (the mirror of
  // light mode); ink/onInk were both near-black, so the button disappeared.
  ink: '#F3F1EE',
  onInk: '#121110',
  positive: '#34D399',
  positiveSoft: '#14291E',
  liveFill: '#16A34A',
  amber: '#F2C98A',
  amberSoft: '#33280F',
  amberText: '#F2C98A',
  // A step lighter than the surfaces so the dark card and buttons still read.
  charcoal: '#302E2B',
  cardFrom: '#3A3733',
  cardTo: '#24221F',
  champagne: '#E3CBA4',
  glow: '#F0A46C',
  glowSoft: '#3A2A1E',
  glowRing: '#6E4A30',
  glowRing2: '#4A3F5A',
  glass: 'rgba(44,42,39,0.90)',
  glassLow: 'rgba(28,27,25,0.86)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  glassLine: 'rgba(255,255,255,0.10)',
  selected: '#F3F1EE',
  onSelected: '#121110',
  danger: '#ff7a86',
  dangerSoft: 'rgba(255,122,134,0.16)',
  accent: '#F3F1EE',
  accentFill: 'rgba(243,241,238,0.12)',
  white: '#ffffff',
  tint: '#1F1E1C',
  tint2: '#282624',
  tintLine: '#423F3B',
  track: '#3D3A36',
  progressTrack: '#2C2A27',
  bubbleMe: '#3A3733',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#262422',
  bubbleThemLine: '#302E2B',
  chatGround: '#161513',
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
