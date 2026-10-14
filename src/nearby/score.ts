import type { NearbyCard } from './types';

// An offline estimate of how well two people fit, from their texts alone. It
// only orders people until Ol-ga's own score (NLP score-pair) arrives.

const STOP = new Set(
  'the and for with our your their you are looking look want wants who that this from into about able help helping find finding meet meeting people someone company companies'.split(' ')
);

function words(text: string | undefined) {
  return new Set(
    (text ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ers|er|es|s)$/u, ''))
      .filter((w) => w.length > 2)
  );
}

// Share of a's words that b also has.
function covered(a: Set<string>, b: Set<string>) {
  if (a.size === 0) return 0;
  let hits = 0;
  a.forEach((w) => {
    if (b.has(w)) hits++;
  });
  return hits / a.size;
}

export function estimateScore(me: NearbyCard, them: NearbyCard) {
  const myWant = words(me.w);
  const theirWant = words(them.w);
  const myOffer = words(`${me.h} ${me.o ?? ''}`);
  const theirOffer = words(`${them.h} ${them.o ?? ''}`);
  // What I want against what they offer, and the other way round; people
  // after the same thing are worth meeting too, a little less so.
  const reciprocal = (covered(myWant, theirOffer) + covered(theirWant, myOffer)) / 2;
  const shared = Math.max(covered(myWant, theirWant), covered(theirWant, myWant)) * 0.8;
  const fit = Math.max(reciprocal, shared);
  return Math.min(0.95, 0.2 + fit * 0.75);
}
