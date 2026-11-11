import { ApiError, NETWORK_ERROR } from '../src/api/client';
import type { SciContact } from '../src/api/types';
import { businessesFrom, chooseBusiness } from '../src/sci/business';
import { buildIntentSet, cleanIntentText, expiresAt, INTENT_TEXT_MAX, intentProblem, intentProgress } from '../src/sci/intents';
import { appendPage, displayScore, refreshFirstPage, roleLabel, scoreBand, scoringSettled } from '../src/sci/score';

const contact = (id: string, score = 50, stale = false): SciContact => ({
  link_id: id,
  label: id,
  score,
  relationship_role: 'CLIENT',
  competitor_overlay: false,
  is_stale: stale,
  origin_type: 'IMPORT',
  scored_at: '2026-11-04T10:42:00Z',
});

describe('score', () => {
  it('rounds the server score to a whole number', () => {
    expect(displayScore(81.6)).toBe(82);
    expect(displayScore(82)).toBe(82);
  });

  it('puts each score in its band, using the number shown', () => {
    expect(scoreBand(9.4)).toBeNull();
    expect(scoreBand(10)).toBe('Emerging');
    expect(scoreBand(24.4)).toBe('Emerging');
    expect(scoreBand(25)).toBe('Relevant');
    expect(scoreBand(49)).toBe('Relevant');
    expect(scoreBand(50)).toBe('Strong');
    expect(scoreBand(74)).toBe('Strong');
    expect(scoreBand(74.6)).toBe('Exact'); // shows 75
    expect(scoreBand(100)).toBe('Exact');
  });

  it('words a role for people', () => {
    expect(roleLabel('CLIENT')).toBe('Client');
    expect(roleLabel('KEY_SUPPLIER')).toBe('Key supplier');
    expect(roleLabel('')).toBe('');
  });
});

describe('SCI pages', () => {
  it('adds new people at the end and never shows one twice', () => {
    const next = appendPage([contact('a'), contact('b')], [contact('b', 90), contact('c')]);
    expect(next.map((c) => c.link_id)).toEqual(['a', 'b', 'c']);
    expect(next[1].score).toBe(90);
  });

  it('puts a fresh first page first and keeps people loaded from later pages', () => {
    const next = refreshFirstPage([contact('a'), contact('b'), contact('z')], [contact('b', 80), contact('a', 70)]);
    expect(next.map((c) => c.link_id)).toEqual(['b', 'a', 'z']);
  });

  it('is settled only when there is someone and nobody is updating', () => {
    expect(scoringSettled([])).toBe(false);
    expect(scoringSettled([contact('a'), contact('b', 40, true)])).toBe(false);
    expect(scoringSettled([contact('a'), contact('b')])).toBe(true);
  });
});

describe('intents', () => {
  it('cleans the text and enforces the length', () => {
    expect(cleanIntentText('  We   sell   packaging ')).toBe('We sell packaging');
    expect(cleanIntentText('   ')).toBeNull();
    expect(cleanIntentText('a'.repeat(INTENT_TEXT_MAX + 1))).toBeNull();
  });

  it('expires 90 days after sending, in UTC with no fractions', () => {
    expect(expiresAt(Date.UTC(2026, 10, 11, 10, 30, 0, 123))).toBe('2027-02-09T10:30:00Z');
  });

  it('builds a set with three new IDs, empty structured_intent and 90 days', () => {
    const now = Date.UTC(2026, 10, 11, 10, 30, 0);
    const a = buildIntentSet('venture_x', 'offer', 'want', now);
    const b = buildIntentSet('venture_x', 'offer', 'want', now);
    expect(a.structured_intent).toEqual({});
    expect(a.expires_at).toBe('2027-02-09T10:30:00Z');
    expect(a.intent_set_id).toMatch(/^intent_set_/);
    expect(a.offer_intent_id).not.toBe(a.want_intent_id);
    expect(new Set([a.intent_set_id, b.intent_set_id, a.offer_intent_id, b.offer_intent_id]).size).toBe(4);
  });

  it('is ready only when both are ready, and failed when either fails', () => {
    expect(intentProgress({ status: 'MATCH_READY' }, { status: 'MATCH_READY' })).toBe('ready');
    expect(intentProgress({ status: 'MATCH_READY' }, { status: 'PROCESSING' })).toBe('processing');
    expect(intentProgress({ status: 'FAILED' }, { status: 'PROCESSING' })).toBe('failed');
  });

  it('words problems without repeating the server', () => {
    expect(intentProblem(new ApiError(400, 'VENTURE_INTENT_SET_INVALID', 'secret'))).toBe('Please check what you wrote and try again.');
    expect(intentProblem(new ApiError(0, NETWORK_ERROR, 'x'))).toMatch(/reach Ol-ga/);
    expect(intentProblem(new ApiError(500, 'X', 'secret detail'))).not.toMatch(/secret/);
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
