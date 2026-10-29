import { lagoonColors, midnightColors, sunriseColors, ThemeColors } from '../src/theme/colors';
import { DEFAULT_THEME, parseStoredTheme, THEMES, themeInfo } from '../src/theme/themes';

// WCAG contrast between two #rrggbb colours.
function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('themes', () => {
  it('has three looks, Sunrise first and the default', () => {
    expect(THEMES.map((t) => t.name)).toEqual(['sunrise', 'lagoon', 'midnight']);
    expect(DEFAULT_THEME).toBe('sunrise');
    expect(themeInfo('midnight').scheme).toBe('dark');
    expect(themeInfo('lagoon').scheme).toBe('light');
  });

  it('gives every look the same set of colours', () => {
    const keys = Object.keys(sunriseColors).sort();
    expect(Object.keys(lagoonColors).sort()).toEqual(keys);
    expect(Object.keys(midnightColors).sort()).toEqual(keys);
  });

  it('keeps what was saved by the old light/dark switch', () => {
    expect(parseStoredTheme('light')).toBe('sunrise');
    expect(parseStoredTheme('dark')).toBe('midnight');
    expect(parseStoredTheme('lagoon')).toBe('lagoon');
    expect(parseStoredTheme('purple')).toBeNull();
    expect(parseStoredTheme(undefined)).toBeNull();
  });
});

// Text and icons must stay readable on the fill they sit on, in every look.
describe.each(THEMES.map((t) => [t.name, t.colors] as [string, ThemeColors]))('%s colours are readable', (_name, c) => {
  it('body text on the ground and on cards', () => {
    expect(contrast(c.text, c.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.text, c.surface)).toBeGreaterThanOrEqual(7);
  });

  it('secondary text on the ground and on cards', () => {
    expect(contrast(c.muted, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.muted, c.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('text on the main buttons and fills', () => {
    expect(contrast(c.onBrand, c.brand)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.onInk, c.ink)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.onCharcoal, c.charcoal)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.onSelected, c.selected)).toBeGreaterThanOrEqual(3);
  });

  // Sunrise is the original look and sets the floor for these two; the other
  // looks are at or above it.
  it('text on the Go Live button, at both ends of its gradient', () => {
    expect(contrast(c.onLive, c.liveFrom)).toBeGreaterThanOrEqual(2.3);
    expect(contrast(c.onLive, c.liveTo)).toBeGreaterThanOrEqual(2.3);
  });

  it('the main colour stands out on the ground', () => {
    expect(contrast(c.accent, c.bg)).toBeGreaterThanOrEqual(2.9);
  });

  it('my chat messages', () => {
    expect(contrast(c.onBubbleMe, c.bubbleMe)).toBeGreaterThanOrEqual(7);
  });
});
