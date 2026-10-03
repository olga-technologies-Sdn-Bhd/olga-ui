// A small on-phone check for abusive chat: it works offline and over
// Bluetooth, and nothing leaves the phone. It only nudges (warn before
// sending, hide what arrives behind "Tap to view"); reporting and blocking
// deal with real abuse, and Ol-ga's own moderation sees online messages.
//
// Whole words only (so "class" or "Scunthorpe" never match), after undoing
// common disguises: letters for symbols (@ss, sh1t), stretched letters
// (fuuuck) and starred letters (f*ck). Edit the lists here.

// English: insults, profanity used at someone, slurs, sexual harassment.
const ENGLISH = [
  'asshole', 'ass', 'arsehole', 'bastard', 'bitch', 'bitches', 'bullshit', 'cock', 'cunt', 'dick', 'dickhead',
  'douche', 'douchebag', 'fag', 'faggot', 'fuck', 'fucked', 'fucker', 'fucking', 'fuckoff', 'motherfucker',
  'idiot', 'moron', 'retard', 'retarded', 'nigger', 'nigga', 'pussy', 'shit', 'shithead', 'slut', 'whore',
  'twat', 'wanker', 'prick', 'scumbag', 'skank', 'dumbass', 'jackass', 'stfu', 'gtfo', 'kys', 'rape', 'rapist',
  'nude', 'nudes', 'sexy', 'boobs', 'horny',
];

// Malay: common insults and profanity.
const MALAY = [
  'babi', 'bodoh', 'bangang', 'bahalol', 'sial', 'celaka', 'pukimak', 'puki', 'pantat', 'lancau', 'butoh',
  'kimak', 'keparat', 'sundal', 'jalang', 'haram jadah', 'anjing', 'bangsat', 'kepala bapak', 'mampus',
];

// Threats, matched as phrases.
const PHRASES = [
  'kill you', 'kill yourself', 'i will kill', 'hurt you', 'beat you up', 'shut up', 'go to hell', 'die bitch',
  'send nudes', 'aku bunuh', 'bunuh kau', 'mati kau',
];

const SYMBOLS: Record<string, string> = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't' };

// "Sh1t" -> "shit", keeping "*" as an unknown letter.
function clean(word: string) {
  return [...word.toLowerCase()].map((ch) => SYMBOLS[ch] ?? ch).join('').replace(/[^a-z*]/g, '');
}

// "fuuuck" -> "fuck" (and "good" -> "god", which is why both forms are tried).
const squeeze = (word: string) => word.replace(/(.)\1+/g, '$1');

const WORDS = new Set([...ENGLISH, ...MALAY.filter((w) => !w.includes(' '))]);
const SQUEEZED = new Map([...WORDS].map((w) => [squeeze(w), w]));
const ALL_PHRASES = [...PHRASES, ...MALAY.filter((w) => w.includes(' '))];

function wordMatches(word: string) {
  if (!word) return false;
  if (word.includes('*')) {
    // f*ck, f**k: a star stands for one letter each.
    if (word.replace(/\*/g, '').length < 2) return false;
    const pattern = new RegExp(`^${word.replace(/\*/g, '[a-z]')}$`);
    for (const w of WORDS) if (pattern.test(w)) return true;
    return false;
  }
  // Squeezed only when a letter is really stretched (3+), so "as" never matches "ass".
  return WORDS.has(word) || (/(.)\1\1/.test(word) && SQUEEZED.has(squeeze(word)));
}

// true when the text looks abusive.
export function isOffensive(text: string) {
  const words = text.split(/\s+/).map(clean).filter(Boolean);
  if (words.some(wordMatches)) return true;
  const flat = ` ${words.join(' ')} `;
  return ALL_PHRASES.some((p) => flat.includes(` ${p} `));
}
