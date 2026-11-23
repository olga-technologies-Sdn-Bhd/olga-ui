import { ApiError, NETWORK_ERROR } from '../src/api/client';
import { attemptSignature, buildInviteAttempt, deviceContactsFrom, INVITE_BATCH_MAX, phoneForImport } from '../src/sci/contacts';
import { acceptProblem, inviteMessage, inviteProblem } from '../src/sci/invitations';
import { inviteTokenFromLink, inviteUrl, isInviteToken } from '../src/sci/inviteLink';

const TOKEN = 'ab'.repeat(32);
const withBase = { linkScheme: 'olgaapp', inviteLinkBase: 'https://app.example.com' };
const noBase = { linkScheme: 'olgaapp' };

describe('invitation links', () => {
  it('uses the app scheme until a host is set, then the host', () => {
    expect(inviteUrl(TOKEN, noBase)).toBe(`olgaapp://invitations/${TOKEN}`);
    expect(inviteUrl(TOKEN, withBase)).toBe(`https://app.example.com/i#${TOKEN}`);
  });

  it('reads the token from either kind of link', () => {
    expect(inviteTokenFromLink(`olgaapp://invitations/${TOKEN}`, withBase)).toBe(TOKEN);
    expect(inviteTokenFromLink(`https://app.example.com/invitations/${TOKEN}/?x=1`, withBase)).toBe(TOKEN);
    expect(inviteTokenFromLink(`https://app.example.com/invitations/${TOKEN}`, noBase)).toBeNull();
  });

  it('ignores anything that is not exactly 64 hex characters on our own links', () => {
    expect(inviteTokenFromLink(null, noBase)).toBeNull();
    expect(inviteTokenFromLink('olgaapp://invitations/abc', noBase)).toBeNull();
    expect(inviteTokenFromLink(`olgaapp://invitations/${TOKEN}0`, noBase)).toBeNull();
    expect(inviteTokenFromLink(`olgaapp://invitations/${'zz'.repeat(32)}`, noBase)).toBeNull();
    expect(inviteTokenFromLink(`olgaapp://event/${TOKEN}`, noBase)).toBeNull();
    expect(inviteTokenFromLink(`https://evil.example.com/invitations/${TOKEN}`, withBase)).toBeNull();
    expect(isInviteToken(TOKEN)).toBe(true);
    expect(isInviteToken('nope')).toBe(false);
  });

  it('puts the link in the message', () => {
    expect(inviteMessage('olgaapp://x')).toContain('olgaapp://x');
  });
});

describe('contacts from the phone', () => {
  it('turns 00 into + and needs a country code', () => {
    expect(phoneForImport('0044 20 7946 0958')).toBe('+442079460958');
    expect(phoneForImport('+91 98855 54624')).toBe('+919885554624');
    expect(phoneForImport('98855 54624')).toBeNull();
  });

  it('keeps people with an email or a usable phone, sorted by name', () => {
    const people = deviceContactsFrom([
      { recordID: '1', displayName: 'Zed', emailAddresses: [{ email: ' zed@example.com ' }], phoneNumbers: [] },
      { recordID: '2', displayName: 'Amy', emailAddresses: [], phoneNumbers: [{ number: '12345' }, { number: '+919885554624' }] },
      { recordID: '3', displayName: 'No way to reach', emailAddresses: [{ email: 'not an email' }], phoneNumbers: [{ number: '12345' }] },
      { recordID: '4', displayName: null, givenName: 'Bo', familyName: 'Li', emailAddresses: [{ email: 'bo@example.com' }] },
    ]);
    expect(people.map((p) => p.name)).toEqual(['Amy', 'Bo Li', 'Zed']);
    expect(people[0]).toMatchObject({ email: null, phone: '+919885554624' });
    expect(people[2].email).toBe('zed@example.com');
  });
});

describe('optional details from the phone', () => {
  it('reads job title, company and the first city', () => {
    const [p] = deviceContactsFrom([
      {
        recordID: '1',
        displayName: 'Priya',
        emailAddresses: [{ email: 'priya@example.com' }],
        jobTitle: ' Operations   Director ',
        company: 'Example Manufacturing',
        postalAddresses: [{ city: '' }, { city: 'Kuala Lumpur' }],
      },
    ]);
    expect(p).toMatchObject({ jobTitle: 'Operations Director', company: 'Example Manufacturing', city: 'Kuala Lumpur' });
  });

  it('leaves them out when the phone has none', () => {
    const [p] = deviceContactsFrom([{ recordID: '1', displayName: 'Bo', emailAddresses: [{ email: 'bo@example.com' }] }]);
    expect(p).toMatchObject({ jobTitle: null, company: null, city: null });
  });
});

describe('an invite attempt', () => {
  const people = [
    { id: 'a', name: 'Amy', email: 'amy@example.com', phone: null, jobTitle: 'Director', company: 'Acme', city: 'Kuala Lumpur' },
    { id: 'b', name: 'Bo', email: null, phone: '+919885554624', jobTitle: null, company: null, city: null },
  ];

  it('makes IDs once: link IDs match the import and the batch', () => {
    const a = buildInviteAttempt('venture_x', people);
    expect(a.importRequest.contacts).toHaveLength(2);
    // Retention is the backend's policy, so it is never sent.
    expect(a.importRequest).not.toHaveProperty('retention_days');
    // Only the allowed fields go with a person.
    expect(a.importRequest.contacts[0]).toMatchObject({ label: 'Amy', job_title: 'Director', company: 'Acme', city: 'Kuala Lumpur' });
    expect(Object.keys(a.importRequest.contacts[0]).sort()).toEqual(
      ['city', 'company', 'contact_record_id', 'email', 'job_title', 'label', 'link_id', 'phone'].sort()
    );
    expect(a.batch.link_ids).toEqual(a.importRequest.contacts.map((c) => c.link_id));
    expect(a.batch).toMatchObject({ venture_id: 'venture_x', expires_in_days: 14 });
    expect(a.batch.link_ids.length).toBeLessThanOrEqual(INVITE_BATCH_MAX);
    expect(a.importKey).not.toBe(a.batchKey);
    expect(Object.values(a.names).sort()).toEqual(['Amy', 'Bo']);
  });

  it('leaves the business out of the batch when there is none', () => {
    expect(buildInviteAttempt(undefined, people).batch).not.toHaveProperty('venture_id');
  });

  it('is the same attempt for the same people in any order, and new for others', () => {
    expect(attemptSignature('v', people)).toBe(attemptSignature('v', [...people].reverse()));
    expect(attemptSignature('v', people)).not.toBe(attemptSignature('v', [people[0]]));
    expect(attemptSignature('v', people)).not.toBe(attemptSignature('w', people));
  });
});

describe('invitation problems', () => {
  it('starts over when the server cannot take the same request again', () => {
    expect(inviteProblem(new ApiError(409, 'CONTACT_LINK_ID_CONFLICT', 'x')).restart).toBe(true);
    expect(inviteProblem(new ApiError(400, 'INVITE_BATCH_INVALID', 'x')).restart).toBe(true);
    expect(inviteProblem(new ApiError(0, NETWORK_ERROR, 'x')).restart).toBe(false);
    expect(inviteProblem(new ApiError(0, NETWORK_ERROR, 'x')).message).toMatch(/reach Ol-ga/);
  });

  it('never repeats the server message', () => {
    expect(inviteProblem(new ApiError(500, 'X', 'secret detail')).message).not.toMatch(/secret/);
    expect(acceptProblem(new ApiError(500, 'X', 'secret detail')).message).not.toMatch(/secret/);
  });

  it('stops for an invitation that can never work, and lets a failed network try again', () => {
    expect(acceptProblem(new ApiError(400, 'INVITATION_TOKEN_INVALID', 'x')).final).toBe(true);
    expect(acceptProblem(new ApiError(404, 'INVITATION_NOT_FOUND', 'x')).final).toBe(true);
    expect(acceptProblem(new ApiError(400, 'INVITATION_SELF_ACCEPT_INVALID', 'x')).message).toMatch(/yourself/);
    expect(acceptProblem(new ApiError(503, 'HTTP_503', 'x')).final).toBe(false);
  });
});
