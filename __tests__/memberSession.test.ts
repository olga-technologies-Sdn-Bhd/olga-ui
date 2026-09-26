import { ApiError, NETWORK_ERROR, withEtag } from '../src/api/client';
import type { MemberLookupResponse, Profile } from '../src/api/types';
import {
  activateMember,
  EMPTY_STORE,
  lookupExistingMember,
  MemberApi,
  MemberRecoveryUnavailableError,
  MemberStore,
  recoverExistingMember,
  refreshMember,
  resolveLogin,
  StoredMember,
} from '../src/auth/memberSession';

const member: StoredMember = { member_id: 'mem_1', etag: '"1"', display_name: 'Asha', phone: '+60123456789' };

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    member_id: 'mem_1',
    display_name: 'Asha Rao',
    profile_status: 'ACTIVE',
    visibility: 'MEMBERS',
    completeness_score: 100,
    etag: '"2"',
    updated_at: '2026-09-26T00:00:00Z',
    ...overrides,
  };
}

const notRegistered = new ApiError(404, 'MEMBER_NOT_REGISTERED', 'Member not registered', 'c-1');

function lookedUp(overrides: Partial<MemberLookupResponse> = {}): MemberLookupResponse {
  return { member_id: 'mem_9', display_name: 'Asha Rao', profile_status: 'ACTIVE', etag: '"5"', ...overrides };
}

type MockApi = MemberApi & { getMyProfile: jest.Mock; updateMyProfile: jest.Mock; lookupMember: jest.Mock };

// Lookup defaults to "not registered" so cached-member tests are unaffected.
function api(overrides: Partial<MemberApi> = {}): MockApi {
  return {
    getMyProfile: jest.fn(async () => profile()),
    updateMyProfile: jest.fn(async () => profile({ etag: '"3"' })),
    lookupMember: jest.fn(async () => {
      throw notRegistered;
    }),
    ...overrides,
  } as never;
}
const offline = new ApiError(0, NETWORK_ERROR, 'Network request failed');
const serverError = new ApiError(503, 'HTTP_503', 'Service Unavailable');

const storeWith = (m: StoredMember): MemberStore => ({ current: null, members: { 'asha@example.com': m } });

describe('resolveLogin', () => {
  it('new email (lookup 404 MEMBER_NOT_REGISTERED) -> sign-up needed, current set', async () => {
    const a = api();
    const result = await resolveLogin(EMPTY_STORE, 'New@Example.com', a);
    expect(a.lookupMember).toHaveBeenCalledWith('new@example.com');
    expect(result.member).toBeNull();
    expect(result.lookup).toEqual({ status: 'not_registered' });
    expect(result.store.current).toBe('new@example.com');
    expect(a.getMyProfile).not.toHaveBeenCalled();
  });

  it('nothing on device but lookup finds the member -> stored, straight in', async () => {
    const a = api({ lookupMember: jest.fn(async () => lookedUp()) });
    const result = await resolveLogin(EMPTY_STORE, 'Asha@Example.com', a);
    expect(result.member).toEqual({ member_id: 'mem_9', etag: '"5"', display_name: 'Asha Rao', profile_status: 'ACTIVE' });
    expect(result.store.members['asha@example.com'].member_id).toBe('mem_9');
    expect(result.store.current).toBe('asha@example.com');
  });

  it('cached member -> no lookup', async () => {
    const a = api();
    await resolveLogin(storeWith(member), 'asha@example.com', a);
    expect(a.lookupMember).not.toHaveBeenCalled();
  });

  it('existing member -> confirmed with the backend and refreshed', async () => {
    const a = api();
    const result = await resolveLogin(storeWith(member), ' Asha@Example.com ', a);
    expect(a.getMyProfile).toHaveBeenCalledWith('mem_1');
    expect(result.member).toMatchObject({ member_id: 'mem_1', etag: '"2"', display_name: 'Asha Rao', profile_status: 'ACTIVE' });
    expect(result.store.members['asha@example.com'].etag).toBe('"2"');
    expect(result.store.current).toBe('asha@example.com');
  });

  it('stale member (404 MEMBER_NOT_REGISTERED) -> removed, sign-up needed', async () => {
    const result = await resolveLogin(storeWith(member), 'asha@example.com', api({ getMyProfile: jest.fn(async () => { throw notRegistered; }) }));
    expect(result.member).toBeNull();
    expect(result.store.members['asha@example.com']).toBeUndefined();
  });

  it('stale member (404 PROFILE_NOT_FOUND) -> removed', async () => {
    const gone = new ApiError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    const result = await resolveLogin(storeWith(member), 'asha@example.com', api({ getMyProfile: jest.fn(async () => { throw gone; }) }));
    expect(result.member).toBeNull();
  });

  it.each([
    ['offline', offline],
    ['5xx', serverError],
  ])('%s -> keeps the cached member, never re-onboards', async (_label, error) => {
    const result = await resolveLogin(storeWith(member), 'asha@example.com', api({ getMyProfile: jest.fn(async () => { throw error; }) }));
    expect(result.member).toEqual(member);
    expect(result.store.members['asha@example.com']).toEqual(member);
  });

  it('keeps other stored members untouched', async () => {
    const other: StoredMember = { member_id: 'mem_2', etag: '"1"', display_name: 'Ben' };
    const store = { current: null, members: { 'asha@example.com': member, 'ben@example.com': other } };
    const result = await resolveLogin(store, 'asha@example.com', api({ getMyProfile: jest.fn(async () => { throw notRegistered; }) }));
    expect(result.store.members['ben@example.com']).toEqual(other);
  });
});

describe('refreshMember activation retry', () => {
  it('retries a pending activation silently', async () => {
    const a = api();
    const result = await refreshMember({ ...member, needs_activation: true }, a);
    expect(a.updateMyProfile).toHaveBeenCalledWith('mem_1', { display_name: 'Asha Rao', visibility: 'MEMBERS' }, '"2"');
    expect(result).toMatchObject({ status: 'active', member: { needs_activation: false, etag: '"3"' } });
  });

  it('activates a DRAFT profile', async () => {
    const a = api({ getMyProfile: jest.fn(async () => profile({ profile_status: 'DRAFT' })) });
    await refreshMember(member, a);
    expect(a.updateMyProfile).toHaveBeenCalled();
  });

  it('does not PATCH an already active member', async () => {
    const a = api();
    await refreshMember(member, a);
    expect(a.updateMyProfile).not.toHaveBeenCalled();
  });
});

describe('activateMember', () => {
  it('success -> new etag, not pending', async () => {
    const result = await activateMember(member, api());
    expect(result).toMatchObject({ etag: '"3"', needs_activation: false, profile_status: 'ACTIVE' });
  });

  it('failure -> member kept and flagged, never throws', async () => {
    const result = await activateMember(member, api({ updateMyProfile: jest.fn(async () => { throw offline; }) }));
    expect(result).toEqual({ ...member, needs_activation: true });
  });
});

describe('lookupExistingMember', () => {
  it('found ACTIVE -> member, no PATCH', async () => {
    const a = api({ lookupMember: jest.fn(async () => lookedUp()) });
    const result = await lookupExistingMember('asha@example.com', a);
    expect(result).toMatchObject({ status: 'found', member: { member_id: 'mem_9', etag: '"5"' } });
    expect(a.updateMyProfile).not.toHaveBeenCalled();
  });

  it('found DRAFT -> activated with the server display_name and lookup etag', async () => {
    const a = api({ lookupMember: jest.fn(async () => lookedUp({ profile_status: 'DRAFT' })) });
    const result = await lookupExistingMember('asha@example.com', a);
    expect(a.updateMyProfile).toHaveBeenCalledWith('mem_9', { display_name: 'Asha Rao', visibility: 'MEMBERS' }, '"5"');
    expect(result).toMatchObject({ status: 'found', member: { etag: '"3"', needs_activation: false } });
  });

  it('found DRAFT but activation fails -> member kept, flagged for retry', async () => {
    const a = api({
      lookupMember: jest.fn(async () => lookedUp({ profile_status: 'DRAFT' })),
      updateMyProfile: jest.fn(async () => {
        throw offline;
      }),
    });
    const result = await lookupExistingMember('asha@example.com', a);
    expect(result).toMatchObject({ status: 'found', member: { member_id: 'mem_9', needs_activation: true } });
  });

  it('404 MEMBER_NOT_REGISTERED -> not_registered', async () => {
    expect(await lookupExistingMember('x@example.com', api())).toEqual({ status: 'not_registered' });
  });

  it.each([
    ['404 without a code (route missing)', new ApiError(404, 'HTTP_404', 'Not Found')],
    ['offline', offline],
    ['5xx', serverError],
  ])('%s -> unavailable, never a new user', async (_label, error) => {
    const a = api({
      lookupMember: jest.fn(async () => {
        throw error;
      }),
    });
    expect(await lookupExistingMember('x@example.com', a)).toMatchObject({ status: 'unavailable' });
  });

  it('unavailable during login -> falls back to sign-up without blocking', async () => {
    const a = api({
      lookupMember: jest.fn(async () => {
        throw offline;
      }),
    });
    const result = await resolveLogin(EMPTY_STORE, 'asha@example.com', a);
    expect(result.member).toBeNull();
    expect(result.lookup?.status).toBe('unavailable');
  });
});

describe('recoverExistingMember (409 on registration)', () => {
  const conflict = new ApiError(409, 'MEMBER_IDENTITY_ALREADY_REGISTERED', 'Already registered', 'corr-9');

  it('lookup finds the member -> returned as the server has it', async () => {
    const a = api({ lookupMember: jest.fn(async () => lookedUp()) });
    const recovered = await recoverExistingMember('asha@example.com', conflict, a);
    expect(recovered).toEqual({ member_id: 'mem_9', etag: '"5"', display_name: 'Asha Rao', profile_status: 'ACTIVE' });
    expect(a.updateMyProfile).not.toHaveBeenCalled();
  });

  it('lookup 404 (e.g. the conflict was the phone) -> unavailable error with the conflict correlation id', async () => {
    await expect(recoverExistingMember('asha@example.com', conflict, api())).rejects.toMatchObject({
      name: 'MemberRecoveryUnavailableError',
      correlationId: 'corr-9',
    });
  });

  it('lookup unavailable -> MemberRecoveryUnavailableError', async () => {
    const a = api({
      lookupMember: jest.fn(async () => {
        throw offline;
      }),
    });
    await expect(recoverExistingMember('asha@example.com', conflict, a)).rejects.toBeInstanceOf(
      MemberRecoveryUnavailableError
    );
  });
});

describe('withEtag', () => {
  type Body = { member_id: string; e_tag?: string };
  const headers = (etag?: string) => new Headers(etag ? { ETag: etag } : {});

  it('reads e_tag from the body and drops the wire field', () => {
    const result = withEtag({ data: { member_id: 'm', e_tag: '"7"' }, headers: headers('"8"') });
    expect(result).toEqual({ member_id: 'm', etag: '"7"' });
  });

  it('falls back to the ETag header when the body has no e_tag', () => {
    expect(withEtag<Body>({ data: { member_id: 'm' }, headers: headers('"8"') })).toEqual({ member_id: 'm', etag: '"8"' });
  });

  it('empty etag when neither is present', () => {
    expect(withEtag<Body>({ data: { member_id: 'm' }, headers: headers() }).etag).toBe('');
  });
});
