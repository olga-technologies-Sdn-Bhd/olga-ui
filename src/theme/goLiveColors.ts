import type { GoLiveColorKey } from '../context/PrefsContext';

// Board 15: the member's own Go Live disc colour. Personal and cosmetic: only
// they see it, and it never changes matching or what others see. No pure
// black; white text everywhere except ink on Pearl.
const GO_LIVE_COLORS: { key: GoLiveColorKey; label: string; fill: string; text: string }[] = [
  { key: 'charcoal', label: 'Charcoal', fill: '#3A3531', text: '#FFFFFF' },
  { key: 'green', label: 'Ol-ga green', fill: '#16A34A', text: '#FFFFFF' },
  { key: 'coral', label: 'Coral', fill: '#E5534B', text: '#FFFFFF' },
  { key: 'ocean', label: 'Ocean', fill: '#2563EB', text: '#FFFFFF' },
  { key: 'violet', label: 'Violet', fill: '#7C3AED', text: '#FFFFFF' },
  { key: 'pearl', label: 'Pearl', fill: '#FFFDF9', text: '#171310' },
];

// Charcoal follows the theme (graphite in dark mode); the hues are fixed.
export function goLiveColors(charcoal: string) {
  return GO_LIVE_COLORS.map((c) => (c.key === 'charcoal' ? { ...c, fill: charcoal } : c));
}

export function goLiveColor(key: GoLiveColorKey, charcoal: string) {
  const list = goLiveColors(charcoal);
  return list.find((c) => c.key === key) ?? list[0];
}
