// What a phone shares with Ol-ga phones near it while its member is available
// nearby. Never the name: that's revealed only when a Commit is accepted.
// Keys are short because a card must fit in 512 bytes.
export type NearbyCard = {
  v: 1;
  m: string; // member ID: opaque, needed so a Commit can be saved to Ol-ga later
  h: string; // headline (their role)
  r?: string; // role category
  w: string; // what they're looking for (intent)
  o?: string; // what they offer (headline and summary), for scoring
  i: string; // avatar initials, from the headline
  k?: string; // public chat key (X25519, base64): only connected members use it
};

export type NearbyPerson = {
  token: string; // their Bluetooth session code
  card: NearbyCard;
  rssi: number;
  lastSeenAt: number;
  score: number; // 0-1
  // estimate: worked out on this phone from the texts (works offline);
  // ol-ga: Ol-ga's matching (NLP score-pair), once either phone is online.
  scoreSource: 'estimate' | 'ol-ga';
};

export type NearbyRequestStatus = 'pending' | 'accepted' | 'declined';

// A Commit made over Bluetooth, kept on the phone until Ol-ga has it.
export type NearbyRequest = {
  id: string; // also the Idempotency-Key when it's saved to Ol-ga
  direction: 'out' | 'in';
  peer: NearbyCard;
  createdAt: number;
  status: NearbyRequestStatus;
  respondedAt?: number;
  peerName?: string; // once accepted
  // out: the Commit reached their phone; in: our answer reached theirs.
  delivered: boolean;
  // We've told them our name after an accept (out: sent; in: received).
  nameShared?: boolean;
  sync: {
    created?: boolean; // out: Ol-ga has the request
    serverRequestId?: string;
    decided?: boolean; // in: Ol-ga has our answer
    done?: boolean; // nothing left to save
    outcome?: 'connected' | 'already-connected' | 'not-allowed';
  };
};

// What phones write to each other's inbox.
export type NearbyMessage =
  | { v: 1; t: 'commit'; id: string; from: NearbyCard }
  | { v: 1; t: 'accept'; id: string; from: string; name?: string }
  | { v: 1; t: 'decline'; id: string; from: string }
  | { v: 1; t: 'name'; id: string; from: string; name: string };
