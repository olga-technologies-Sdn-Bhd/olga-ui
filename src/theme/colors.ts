// Design system: three looks that share one shape, so any screen can switch
// via useTheme() without branching logic.
//
//   Sunrise  (light): a warm, quiet ground (ivory, white cards, sand fills)
//                     with sunrise coral as the one accent: buttons, selection.
//   Harbor   (light): white cards on a cool grey-blue ground, with navy blue as
//                     the one accent, and blue outlines on secondary buttons.
//   Midnight (dark):  deep navy with champagne gold as the one accent.
//
// In every look green is reserved for live/match signals; a muted gold for
// outcome states; a soft apricot glow belongs to the Olga agent alone (its
// sparkle, the Ask Olga bar).
//
// The "on" colours (onBrand, onCharcoal, onLive, onInk, onSelected) are the
// text and icons that sit on the matching fill. Always use them instead of
// plain white: on Midnight the fills are gold and need dark text.
// `outline` is the border of outlined (ghost) buttons and pills.
export const sunriseColors = {
  bg: '#FBFAF8', // App ground: a crisp warm white, so white cards still lift off it
  bgClear: 'rgba(251,250,248,0)', // The ground, fully transparent (fades into it)
  surface: '#FFFFFF', // Card surface
  surface2: '#EFEAE3', // Secondary surface (date blocks, inputs, pill base): warm sand
  text: '#1A1917', // Ink: a warm near-black
  muted: '#6F6A63', // Secondary text
  line: '#E8E2D9', // Hairlines and card borders
  // Sunrise coral (the Go Live button's colour, from the photos) is the one
  // accent: primary buttons, selected chips, progress fill. Text stays a warm
  // near-black.
  brand: '#EC6A55',
  // Text/icons on a brand (primary) button.
  onBrand: '#ffffff',
  // Outline button border.
  brand2: '#D8D1C6',
  // Border of outlined buttons and pills.
  outline: '#D8D1C6',
  // Selected chips, icon-wrap fills.
  brandSoft: '#ECE6DD',
  // Avatar/icon backgrounds, soft pill tint, chat "me" bubble.
  accentSoft: '#F2EEE8',
  // Buttons like chat "send", the mic, icon circles: the same coral as brand.
  ink: '#EC6A55',
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
  // The one large accent element (default Go Live button, dark avatars): coral.
  charcoal: '#EC6A55',
  // Text/icons on the charcoal fill.
  onCharcoal: '#FFFFFF',
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
  // The warm halo that swells behind the Social Capital orb.
  orbHalo: '#FFB385',
  // The Go Live button: a sunrise gradient (coral into pink), and the text and
  // icons on it.
  liveFrom: '#FF8A5B',
  liveTo: '#F2668B',
  onLive: '#FFFFFF',
  // The soft sunrise wash at the top of tab screens (TopGlow), to clear.
  glowTop: '#FDF0E6',
  glowTopClear: 'rgba(253,240,230,0)',
  // The floating tab bar: bright white glass. A translucent gradient (lighter
  // at the top), a bright inner top edge where light catches it, a faint outline.
  glass: 'rgba(255,255,255,0.98)',
  glassLow: 'rgba(255,255,255,0.96)',
  glassHighlight: 'rgba(255,255,255,0.95)',
  glassLine: 'rgba(26,25,23,0.08)',
  // Selected chip / active tab underline, and the text on it.
  selected: '#EC6A55',
  onSelected: '#ffffff',
  danger: '#D64555',
  dangerSoft: 'rgba(214,69,85,0.12)',
  // Active states (menu icons, links): coral. accentFill: a clean light grey
  // for avatars and icon circles.
  accent: '#EC6A55',
  accentFill: '#F1F1F3',
  // A light coral wash: the selected tab's pill, event and tip icon circles.
  accentWash: '#FDECE7',
  // Colourful icon tints (fill + icon), so lists aren't grey: events,
  // live, tips/outcomes, people.
  tintPeach: '#FFE1CC',
  onTintPeach: '#E0601F',
  tintGreen: '#D3F2DE',
  onTintGreen: '#15803D',
  tintAmber: '#FDE8B4',
  onTintAmber: '#B26A00',
  tintViolet: '#E7DFFF',
  onTintViolet: '#6A45E0',
  white: '#ffffff',
  // Concentric halo behind the Go Live ring, lightest to deepest.
  tint: '#F0ECE6',
  tint2: '#E8E2DA',
  tintLine: '#D4CCC1',
  track: '#D9D2C8',
  progressTrack: '#ECE7E0',
  // Conversations, on a white wallpaper: my messages on soft sand with dark text.
  bubbleMe: '#EADCCB',
  onBubbleMe: '#1A1917',
  // Theirs: light grey, so it stands out on the white chat wallpaper.
  bubbleThem: '#F2F2F4',
  bubbleThemLine: '#E9E9EC',
  chatGround: '#FFFFFF',
};

export type ThemeColors = typeof sunriseColors;

// White cards on a cool grey-blue ground, with navy blue as the one accent and
// blue outlines on secondary buttons: the familiar professional-network look.
// Same roles as Sunrise; only the hue of the greys and the accent change. The
// Olga agent keeps its warm apricot glow, so it stays recognisable.
export const harborColors: ThemeColors = {
  bg: '#F3F6FA',
  bgClear: 'rgba(243,246,250,0)',
  surface: '#FFFFFF',
  surface2: '#E8EEF5', // Cool grey: date blocks, inputs, pill base
  text: '#0F1B2D', // A navy near-black
  muted: '#546377',
  line: '#DCE3EC',
  brand: '#0B52A3',
  onBrand: '#FFFFFF',
  brand2: '#BFCBDB',
  outline: '#0B52A3',
  brandSoft: '#DCE7F5',
  accentSoft: '#EAF0F8',
  ink: '#0B52A3',
  onInk: '#FFFFFF',
  positive: '#147A3A',
  positiveSoft: '#E3F2E8',
  liveFill: '#16A34A',
  amber: '#B8975A',
  amberSoft: '#F4ECDC',
  amberText: '#6B5220',
  charcoal: '#0B52A3',
  onCharcoal: '#FFFFFF',
  cardFrom: '#1B2A44',
  cardTo: '#0D1626',
  champagne: '#E3CBA4',
  glow: '#E08A4F',
  glowSoft: '#FBEADC',
  glowRing: '#F2C9A6',
  glowRing2: '#D9C9E8',
  orbHalo: '#8EB8EA',
  // Mid blue into navy: the Go Live gradient in cool tones.
  liveFrom: '#2A7BCB',
  liveTo: '#0B52A3',
  onLive: '#FFFFFF',
  glowTop: '#E3EDF8',
  glowTopClear: 'rgba(227,237,248,0)',
  glass: 'rgba(255,255,255,0.98)',
  glassLow: 'rgba(255,255,255,0.96)',
  glassHighlight: 'rgba(255,255,255,0.95)',
  glassLine: 'rgba(15,27,45,0.08)',
  selected: '#0B52A3',
  onSelected: '#ffffff',
  danger: '#D64555',
  dangerSoft: 'rgba(214,69,85,0.12)',
  accent: '#0B52A3',
  accentFill: '#EDF1F6',
  accentWash: '#DDE9F7',
  tintPeach: '#FFE1CC',
  onTintPeach: '#E0601F',
  tintGreen: '#D3F2DE',
  onTintGreen: '#15803D',
  tintAmber: '#FDE8B4',
  onTintAmber: '#B26A00',
  tintViolet: '#E7DFFF',
  onTintViolet: '#6A45E0',
  white: '#ffffff',
  tint: '#E8EEF5',
  tint2: '#DCE5F0',
  tintLine: '#C5D1E0',
  track: '#CBD6E4',
  progressTrack: '#E1E9F2',
  bubbleMe: '#D6E6F8',
  onBubbleMe: '#0F1B2D',
  bubbleThem: '#F0F2F5',
  bubbleThemLine: '#E3E7EC',
  chatGround: '#FFFFFF',
};

// Deep navy with champagne gold as the one accent. The accent is light, so
// everything that sits on a gold fill uses dark text (the "on" colours).
export const midnightColors: ThemeColors = {
  bg: '#0B1220',
  bgClear: 'rgba(11,18,32,0)', // The ground, fully transparent (fades into it)
  surface: '#111A2B',
  surface2: '#192438',
  text: '#EEF2F8',
  muted: '#9AA8BE',
  line: '#243049',
  brand: '#E3B66B',
  onBrand: '#101624',
  brand2: '#3A4968',
  outline: '#E3B66B',
  brandSoft: '#222D44',
  accentSoft: '#18233A',
  ink: '#E3B66B',
  onInk: '#101624',
  positive: '#34D399',
  positiveSoft: '#10281F',
  liveFill: '#16A34A',
  amber: '#F2C98A',
  amberSoft: '#33280F',
  amberText: '#F2C98A',
  charcoal: '#E3B66B',
  onCharcoal: '#101624',
  cardFrom: '#22304C',
  cardTo: '#121B2E',
  champagne: '#E3CBA4',
  glow: '#F0A46C',
  glowSoft: '#3A2A1E',
  glowRing: '#6E4A30',
  glowRing2: '#4A3F5A',
  orbHalo: '#E3B66B',
  liveFrom: '#EBC27A',
  liveTo: '#D69A45',
  onLive: '#101624',
  glowTop: 'rgba(80,125,205,0.20)',
  glowTopClear: 'rgba(80,125,205,0)',
  glass: 'rgba(24,34,54,0.92)',
  glassLow: 'rgba(17,26,43,0.88)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  glassLine: 'rgba(255,255,255,0.10)',
  selected: '#E3B66B',
  onSelected: '#101624',
  danger: '#ff7a86',
  dangerSoft: 'rgba(255,122,134,0.16)',
  accent: '#E3B66B',
  accentFill: 'rgba(255,255,255,0.1)',
  accentWash: 'rgba(227,182,107,0.18)',
  tintPeach: 'rgba(240,138,79,0.2)',
  onTintPeach: '#F5A877',
  tintGreen: 'rgba(52,211,153,0.16)',
  onTintGreen: '#34D399',
  tintAmber: 'rgba(242,201,138,0.18)',
  onTintAmber: '#F2C98A',
  tintViolet: 'rgba(155,123,255,0.2)',
  onTintViolet: '#B9A4FF',
  white: '#ffffff',
  tint: '#152036',
  tint2: '#1C2942',
  tintLine: '#33425F',
  track: '#34425C',
  progressTrack: '#222E46',
  bubbleMe: '#2B3A57',
  onBubbleMe: '#EEF2F8',
  bubbleThem: '#192438',
  bubbleThemLine: '#243049',
  chatGround: '#0E1626',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};
