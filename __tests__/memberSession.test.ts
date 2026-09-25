import { ApiError, NETWORK_ERROR } from '../src/api/client';
import type { Profile } from '../src/api/types';
import {
  activateMember,
  EMPTY_STORE,
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

function api(overrides: Partial<MemberApi> = {}): MemberApi & { getMyProfile: jest.Mock; updateMyProfile: jest.Mock } {
  return {
    getMyProfile: jest.fn(async () => profile()),
    updateMyProfile: jest.fn(async () => profile({ etag: '"3"' })),
    ...overrides,
  } as never;
}

const notRegistered = new ApiError(404, 'MEMBER_NOT_REGISTERED', 'Member not registered', 'c-1');
const offline = new ApiError(0, NETWORK_ERROR, 'Network request failed');
const serverError = new ApiError(503, 'HTTP_503', 'Service Unavailable');

const storeWith = (m: StoredMember): MemberStore => ({ current: null, members: { 'asha@example.com': m } });

describe('resolveLogin', () => {
  it('new email -> no member, sign-up needed, current set', async () => {
    const a = api();
    const result = await resolveLogin(EMPTY_STORE, 'New@Example.com', a);
    expect(result.member).toBeNull();
    expect(result.store.current).toBe('new@example.com');
    expect(a.getMyProfile).not.toHaveBeenCalled();
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

describe('recoverExistingMember', () => {
  it('is not supported by the backend yet and carries the correlation id', async () => {
    const conflict = new ApiError(409, 'MEMBER_IDENTITY_ALREADY_REGISTERED', 'Already registered', 'corr-9');
    await expect(recoverExistingMember('asha@example.com', conflict)).rejects.toMatchObject({
      name: 'MemberRecoveryUnavailableError',
      correlationId: 'corr-9',
    });
    await expect(recoverExistingMember('asha@example.com', conflict)).rejects.toBeInstanceOf(MemberRecoveryUnavailableError);
  });
});
