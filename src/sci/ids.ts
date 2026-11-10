// IDs the app makes for the Social Capital Index (SCI): venture_, intent_set_,
// intent_, contact_, link_, batch_. Core and NLP want them stable, unique and
// at most 64 characters, e.g. venture_01JQ8J2M7X6JBY6Y3H1S6D2P9R.
//
// Same shape as a ULID: 10 characters of time, then 16 random ones, so newer
// IDs sort after older ones. Math.random is enough: these only need to be
// unique, not unguessable (Hermes has no crypto.randomUUID either).

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const MAX_LENGTH = 64;

export function newId(prefix: string, now = Date.now()): string {
  let time = '';
  let ms = now;
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[ms % 32] + time;
    ms = Math.floor(ms / 32);
  }
  let random = '';
  for (let i = 0; i < 16; i++) random += ALPHABET[Math.floor(Math.random() * 32)];
  const id = `${prefix}_${time}${random}`;
  if (id.length > MAX_LENGTH) throw new Error(`ID prefix too long: ${prefix}`);
  return id;
}
