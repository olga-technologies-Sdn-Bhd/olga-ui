import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  size?: number;
  color: string;
  // Off: the dot waits at the opening, outside the ring. Live: it has stepped
  // into the middle. State comes from the dot's position, never its colour.
  live?: boolean;
  // Dot colour; defaults to the ring colour (single-colour mark).
  dotColor?: string;
};

// Board 11, the Go Live mark: a ring (r=8, stroke 2 on a 24 grid) with a 50°
// opening at 1:30 and a dot (r=2.6). Never rotate it: with the gap at 12
// o'clock it reads as a power button. Only for Go Live.
const CENTER = 12;
const RADIUS = 8;
const GAP_DEG = 50;
const GAP_AT_DEG = 45; // 1:30, measured clockwise from 12 o'clock

function point(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

// The ring runs clockwise from the end of the gap round to its start.
const start = point(GAP_AT_DEG + GAP_DEG / 2, RADIUS);
const end = point(GAP_AT_DEG - GAP_DEG / 2, RADIUS);
const RING = `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 1 1 ${end.x} ${end.y}`;
const OUTSIDE = point(GAP_AT_DEG, RADIUS + 2.4);

export function GoLiveMark({ size = 24, color, live, dotColor }: Props) {
  const dot = live ? { x: CENTER, y: CENTER } : OUTSIDE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={RING} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Circle cx={dot.x} cy={dot.y} r={2.6} fill={dotColor ?? color} />
    </Svg>
  );
}
