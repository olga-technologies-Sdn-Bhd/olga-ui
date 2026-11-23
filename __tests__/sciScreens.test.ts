import { ApiError, NETWORK_ERROR } from '../src/api/client';
import type { PrimaryIntentPreview, SciContact } from '../src/api/types';
import { businessesFrom, chooseBusiness } from '../src/sci/business';
import { buildIntentSet, cleanIntentText, cleanTags, expiresAt, INTENT_TEXT_MAX, intentProblem, MAX_TAGS, newIntentIds, previewProblem } from '../src/sci/intents';
import {
  appendPage,
  bandLabel,
  countOrNull,
  displayScore,
  formatCount,
  humanize,
  isHistory,
  isRecalculating,
  lifecycleLabel,
  reachOutName,
  refreshFirstPage,
} from '../src/sci/score';

const contact = (id: string, over: Partial<SciContact> = {}): SciContact => ({
  link_id: id,
  label: id,
  lifecycle_state: 'CONNECTED',
  score: 50,
  band: 'NETWORK',
  is_estimated: false,
  counts_in_sci: true,
  counts_in_potential: false,
  projection_state: 'READY',
  outcome_points: 0,
  tie_strength: 0,
  projection_version: 1,
  as_of: '2026-11-22T10:00:00Z',
  ...over,
});

describe('score', () => {
  it('rounds the server score to a whole number and copes with none', () => {
    expect(displayScore(81.6)).toBe(82);
    expect(displayScore(30)).toBe(30);
    expect(displayScore(null)).toBeNull();
    expect(displayScore(undefined)).toBeNull();
    expect(displayScore(Number.NaN)).toBeNull();
  });

  it('words the server band and never works one out', () => {
    expect(bandLabel('REPOSITORY')).toBe('Repository');
    expect(bandLabel('WAITLIST')).toBe('Waitlist');
    expect(bandLabel('NETWORK')).toBe('Network');
    expect(bandLabel('SOMETHING_NEW')).toBeNull();
  });

  it('words lifecycle states, and unknown ones without crashing', () => {
    expect(lifecycleLabel('REQUEST_PENDING')).toBe('Request pending');
    expect(lifecycleLabel('CONNECTED')).toBe('Connected');
    expect(lifecycleLabel('SOMETHING_NEW')).toBe('Something new');
    expect(humanize('')).toBe('');
  });

  it('treats removed and frozen people as history', () => {
    expect(isHistory(contact('a'))).toBe(false);
    expect(isHistory(contact('a', { lifecycle_state: 'REMOVED' }))).toBe(true);
    expect(isHistory(contact('a', { frozen_at: '2026-11-01T00:00:00Z' }))).toBe(true);
  });

  it('shows big counts in full', () => {
    expect(formatCount(1742)).toBe('1,742');
    expect(formatCount(2600)).toBe('2,600');
  });

  it('is recalculating until the server says READY', () => {
    expect(isRecalculating(null)).toBe(false);
    expect(isRecalculating({ projection_status: 'READY' })).toBe(false);
    expect(isRecalculating({ projection_status: 'RECALCULATING' })).toBe(true);
  });

  it('reads a count only when it is a number', () => {
    expect(countOrNull(12)).toBe(12);
    expect(countOrNull(undefined)).toBeNull();
    expect(countOrNull('12')).toBeNull();
    expect(countOrNull(null)).toBeNull();
  });
});

describe('SCI pages', () => {
  it('adds new people at the end and never shows one twice', () => {
    const next = appendPage([contact('a'), contact('b')], [contact('b', { score: 90 }), contact('c')]);
    expect(next.map((c) => c.link_id)).toEqual(['a', 'b', 'c']);
    expect(next[1].score).toBe(90);
  });

  it('puts a fresh first page first and keeps people loaded from later pages', () => {
    const next = refreshFirstPage([contact('a'), contact('b'), contact('z')], [contact('b', { score: 80 }), contact('a', { score: 70 })]);
    expect(next.map((c) => c.link_id)).toEqual(['b', 'a', 'z']);
  });

  it('names a reach-out person from the contact list, else generically', () => {
    expect(reachOutName({ link_id: 'a' }, [contact('a', { label: 'Priya' })])).toBe('Priya');
    expect(reachOutName({ link_id: 'x' }, [contact('a')])).toBe('Someone you know');
  });
});

describe('primary intent', () => {
  const preview: PrimaryIntentPreview = {
    canonical_tags: ['malaysia', 'manufacturing'],
    tag_fingerprint: 'f'.repeat(64),
    previewed_at: '2026-11-22T10:00:00Z',
    preview_text: 'You offer: ...',
  };

  it('cleans the text and enforces the 4,000 limit', () => {
    expect(cleanIntentText('  We   sell   packaging ')).toBe('We sell packaging');
    expect(cleanIntentText('   ')).toBeNull();
    expect(cleanIntentText('a'.repeat(INTENT_TEXT_MAX))).toHaveLength(INTENT_TEXT_MAX);
    expect(cleanIntentText('a'.repeat(INTENT_TEXT_MAX + 1))).toBeNull();
  });

  it('cleans tags: no blanks, no repeats in any case, at most 50', () => {
    expect(cleanTags([' Malaysia ', 'malaysia', '', '  ', 'Manufacturing'])).toEqual(['Malaysia', 'Manufacturing']);
    expect(cleanTags(Array.from({ length: 60 }, (_, i) => `tag${i}`))).toHaveLength(MAX_TAGS);
    expect(cleanTags(['x'.repeat(100)])[0]).toHaveLength(64);
  });

  it('expires a year after sending, in UTC with no fractions', () => {
    expect(expiresAt(Date.UTC(2026, 10, 22, 10, 0, 0, 123))).toBe('2027-11-22T10:00:00Z');
  });

  it('saves exactly what was previewed, with tags in structured_intent', () => {
    const ids = newIntentIds();
    const set = buildIntentSet('venture_x', 'offer', 'want', preview, ids, Date.UTC(2026, 10, 22, 10, 0, 0));
    expect(set.structured_intent).toEqual({ tags: preview.canonical_tags });
    expect(set.tags).toEqual(preview.canonical_tags);
    expect(set.tag_fingerprint).toBe(preview.tag_fingerprint);
    expect(set.previewed_at).toBe(preview.previewed_at);
    expect(set.expires_at).toBe('2027-11-22T10:00:00Z');
    expect(set.intent_set_id).toMatch(/^intentset_/);
    expect(set.offer_intent_id).toBe(ids.offer_intent_id);
  });

  it('keeps the offer and want IDs and makes a new set ID every save', () => {
    const ids = newIntentIds();
    const a = buildIntentSet('v', 'o', 'w', preview, ids);
    const b = buildIntentSet('v', 'o', 'w', preview, ids);
    expect(a.offer_intent_id).toBe(b.offer_intent_id);
    expect(a.want_intent_id).toBe(b.want_intent_id);
    expect(a.intent_set_id).not.toBe(b.intent_set_id);
    expect(ids.offer_intent_id).toMatch(/^intent_offer_/);
    expect(ids.want_intent_id).toMatch(/^intent_want_/);
  });

  it('tells the member the current intent is kept when the tags changed too recently', () => {
    expect(intentProblem(new ApiError(409, 'RESOURCE_STATE_CONFLICT', 'x'))).toMatch(/current offer and want are unchanged/);
  });

  it('words other problems without repeating the server', () => {
    expect(intentProblem(new ApiError(400, 'X', 'secret'))).toBe('Please check what you wrote and try again.');
    expect(intentProblem(new ApiError(0, NETWORK_ERROR, 'x'))).toMatch(/reach Ol-ga/);
    expect(intentProblem(new ApiError(500, 'X', 'secret detail'))).not.toMatch(/secret/);
    expect(previewProblem(new ApiError(400, 'X', 'secret'))).not.toMatch(/secret/);
  });
});

describe('businesses from Core', () => {
  it('reads a bare list or an items list, and skips ones that are not active', () => {
    const rows = [
      { venture_id: 'v1', name: 'One', status: 'ACTIVE' },
      { venture_id: 'v2', name: 'Two', status: 'ARCHIVED' },
      { venture_id: '', name: 'No id' },
      'junk',
    ];
    expect(businessesFrom(rows)).toEqual([{ venture_id: 'v1', name: 'One' }]);
    expect(businessesFrom({ items: rows })).toEqual([{ venture_id: 'v1', name: 'One' }]);
    expect(businessesFrom(null)).toEqual([]);
    expect(businessesFrom({ nope: 1 })).toEqual([]);
  });

  it('keeps the saved business when Core still has it, else uses Core, else what is saved', () => {
    const a = { venture_id: 'a', name: 'A' };
    const b = { venture_id: 'b', name: 'B' };
    expect(chooseBusiness(b, [a, b])).toBe(b);
    expect(chooseBusiness(null, [a])).toBe(a);
    expect(chooseBusiness(a, [])).toBe(a);
    expect(chooseBusiness(null, [])).toBeNull();
  });
});
