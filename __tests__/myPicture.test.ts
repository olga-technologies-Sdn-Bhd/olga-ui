const mockCore = {
  getMyProfile: jest.fn(),
  uploadProfilePicture: jest.fn(),
  deleteProfilePicture: jest.fn(),
};
jest.mock('../src/api/core', () => ({ coreApi: mockCore }));
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));

let mod: typeof import('../src/profile/myPicture');
let ApiError: typeof import('../src/api/client').ApiError;
let picker: { launchCamera: jest.Mock; launchImageLibrary: jest.Mock };

const profile = (status: string | null, url: string | null, etag = '"1"') => ({
  member_id: 'm1',
  etag,
  profile_image_status: status,
  profile_image_url: url,
});
const URL1 = '/v1/members/m1/profile-picture?size=thumbnail';
const file = { uri: 'file:///photo.jpg', name: 'profile.jpg', type: 'image/jpeg' };
const tick = (ms: number) => jest.advanceTimersByTimeAsync(ms);

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  Object.values(mockCore).forEach((fn) => fn.mockReset());
  mod = require('../src/profile/myPicture');
  ApiError = require('../src/api/client').ApiError;
  picker = require('react-native-image-picker');
  picker.launchCamera.mockReset();
  picker.launchImageLibrary.mockReset();
  mockCore.getMyProfile.mockResolvedValue(profile(null, null));
  await mod.loadMyPicture('m1');
});

afterEach(() => jest.useRealTimers());

describe('upload', () => {
  it('sends the file with the current profile version, then waits until the picture is ready', async () => {
    mockCore.getMyProfile.mockResolvedValue(profile(null, null, '"3"'));
    mockCore.uploadProfilePicture.mockResolvedValue({ image_id: 'img_1', status: 'PENDING', etag: '"4"' });
    await mod.uploadMyPicture(file);

    const [sent, ifMatch, options] = mockCore.uploadProfilePicture.mock.calls[0];
    expect(sent).toBe(file);
    expect(ifMatch).toBe('"3"');
    expect(typeof options.idempotencyKey).toBe('string');
    expect(mod.getMyPicture()).toMatchObject({ busy: 'processing', preview: file.uri });

    mockCore.getMyProfile.mockResolvedValueOnce(profile('PROCESSING', null, '"4"'));
    await tick(2500);
    expect(mod.getMyPicture().busy).toBe('processing');

    mockCore.getMyProfile.mockResolvedValue(profile('READY', URL1, '"5"'));
    await tick(2500);
    expect(mod.getMyPicture()).toMatchObject({ busy: null, preview: null, hasPicture: true, version: '"5"', error: null });
  });

  it('retries a lost request with the same idempotency key', async () => {
    mockCore.uploadProfilePicture
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'))
      .mockResolvedValue({ image_id: 'img_1', status: 'PENDING', etag: '"2"' });
    const done = mod.uploadMyPicture(file);
    await tick(1000);
    await done;

    const keys = mockCore.uploadProfilePicture.mock.calls.map(([, , o]) => o.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('reads the profile again after a version conflict and tries once more as a new action', async () => {
    mockCore.getMyProfile.mockResolvedValueOnce(profile(null, null, '"1"')).mockResolvedValue(profile(null, null, '"2"'));
    mockCore.uploadProfilePicture
      .mockRejectedValueOnce(new ApiError(409, 'RESOURCE_VERSION_CONFLICT', 'changed'))
      .mockResolvedValue({ image_id: 'img_1', status: 'PENDING', etag: '"3"' });
    await mod.uploadMyPicture(file);

    const [first, second] = mockCore.uploadProfilePicture.mock.calls;
    expect(first[1]).toBe('"1"');
    expect(second[1]).toBe('"2"');
    expect(first[2].idempotencyKey).not.toBe(second[2].idempotencyKey);
  });

  it('keeps the earlier picture and says so when the new one is rejected', async () => {
    mockCore.getMyProfile.mockResolvedValue(profile('READY', URL1, '"1"'));
    await mod.loadMyPicture('m1');
    mockCore.uploadProfilePicture.mockResolvedValue({ image_id: 'img_2', status: 'PENDING', etag: '"2"' });
    await mod.uploadMyPicture(file);

    mockCore.getMyProfile.mockResolvedValue(profile('REJECTED', URL1, '"3"'));
    await tick(2500);
    const after = mod.getMyPicture();
    expect(after.busy).toBeNull();
    expect(after.preview).toBeNull();
    expect(after.hasPicture).toBe(true);
    expect(after.error).toMatch(/different one/);
    const calls = mockCore.getMyProfile.mock.calls.length;
    await tick(10000);
    expect(mockCore.getMyProfile.mock.calls.length).toBe(calls); // stopped asking
  });

  it('stops asking after a minute and says the photo is still being prepared', async () => {
    mockCore.uploadProfilePicture.mockResolvedValue({ image_id: 'img_1', status: 'PENDING', etag: '"2"' });
    mockCore.getMyProfile.mockResolvedValue(profile('PROCESSING', null, '"2"'));
    await mod.uploadMyPicture(file);
    await tick(70000);

    expect(mod.getMyPicture()).toMatchObject({ busy: null, slow: true });
    const calls = mockCore.getMyProfile.mock.calls.length;
    expect(calls).toBeLessThan(40);
    await tick(30000);
    expect(mockCore.getMyProfile.mock.calls.length).toBe(calls);
  });

  it('does not send a photo over 5 MB', async () => {
    await mod.uploadMyPicture(file, 6 * 1024 * 1024);
    expect(mockCore.uploadProfilePicture).not.toHaveBeenCalled();
    expect(mod.getMyPicture().error).toMatch(/5 MB/);
  });

  it('shows a plain message when the upload fails', async () => {
    mockCore.uploadProfilePicture.mockRejectedValue(new ApiError(415, 'PROFILE_IMAGE_TYPE_INVALID', 'type'));
    await mod.uploadMyPicture(file);
    expect(mod.getMyPicture()).toMatchObject({ busy: null, preview: null, error: 'Use a JPEG, PNG or WebP photo.' });
  });
});

describe('remove', () => {
  it('deletes with the current version and drops the picture', async () => {
    mockCore.getMyProfile.mockResolvedValue(profile('READY', URL1, '"7"'));
    await mod.loadMyPicture('m1');
    expect(mod.getMyPicture().hasPicture).toBe(true);
    mockCore.deleteProfilePicture.mockResolvedValue(profile('DELETED', null, '"8"'));
    await mod.removeMyPicture();

    expect(mockCore.deleteProfilePicture.mock.calls[0][0]).toBe('"7"');
    expect(mod.getMyPicture()).toMatchObject({ hasPicture: false, busy: null, preview: null, version: '"8"' });
  });
});

describe('picking', () => {
  it('uploads the chosen photo as profile.jpg', async () => {
    picker.launchImageLibrary.mockResolvedValue({ assets: [{ uri: 'file:///a.heic', type: 'image/heic', fileSize: 1000 }] });
    mockCore.uploadProfilePicture.mockResolvedValue({ image_id: 'img_1', status: 'PENDING', etag: '"2"' });
    await mod.pickMyPicture('library');
    expect(mockCore.uploadProfilePicture.mock.calls[0][0]).toEqual({ uri: 'file:///a.heic', name: 'profile.jpg', type: 'image/jpeg' });
  });

  it('does nothing when the member cancels', async () => {
    picker.launchCamera.mockResolvedValue({ didCancel: true });
    await mod.pickMyPicture('camera');
    expect(mockCore.uploadProfilePicture).not.toHaveBeenCalled();
    expect(mod.getMyPicture().error).toBeNull();
  });

  it('asks for camera access in Settings when it was refused', async () => {
    picker.launchCamera.mockResolvedValue({ errorCode: 'permission' });
    await mod.pickMyPicture('camera');
    expect(mod.getMyPicture().error).toMatch(/camera access in Settings/);
  });
});

describe('members without a picture', () => {
  it('is not asked again for a few minutes after the server said none', () => {
    mod.markPictureMissing('m9');
    expect(mod.pictureIsMissing('m9')).toBe(true);
    jest.setSystemTime(Date.now() + 6 * 60 * 1000);
    expect(mod.pictureIsMissing('m9')).toBe(false);
  });

  it('forgets the previous member on sign-out', () => {
    mod.resetMyPicture();
    expect(mod.getMyPicture()).toMatchObject({ memberId: null, hasPicture: false });
  });
});
