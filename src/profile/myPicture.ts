import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { launchCamera, launchImageLibrary, type ImagePickerResponse, type Asset } from 'react-native-image-picker';
import { ApiError, isTransient, newIdempotencyKey, withRetries } from '../api/client';
import { coreApi, type PictureFile } from '../api/core';
import type { Profile, ProfileImageStatus } from '../api/types';

// The signed-in member's own profile picture, shared by every screen that shows
// it (account header, Home, Chat...). A picture is checked and resized by a
// worker after the upload, so the flow is: upload -> read the profile every few
// seconds until READY or REJECTED. Until then the picture already on the
// server (if any) keeps showing everywhere.

export const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const POLL_EVERY_MS = 2500;
const POLL_FOR_MS = 60000;

export type PictureBusy = 'uploading' | 'processing' | 'removing' | null;

export type MyPictureState = {
  memberId: string | null;
  // The server has a ready picture for this member.
  hasPicture: boolean;
  // Profile etag at the last read: changes with the profile, so it is what
  // keeps an old copy of a replaced picture from showing.
  version: string | null;
  status: ProfileImageStatus | null;
  // The file just chosen, shown on the account screen while it is processed.
  preview: string | null;
  busy: PictureBusy;
  // Plain-language message for the last failure; null when all is well.
  error: string | null;
  // Polling gave up before the worker finished: it will show up later.
  slow: boolean;
};

const EMPTY: MyPictureState = {
  memberId: null,
  hasPicture: false,
  version: null,
  status: null,
  preview: null,
  busy: null,
  error: null,
  slow: false,
};

let state: MyPictureState = EMPTY;
const listeners = new Set<() => void>();

function set(patch: Partial<MyPictureState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const getMyPicture = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// A picture request that failed (404: none, or hidden) is not asked again for
// a while, so a long list of members does not repeat the same failing calls.
const MISSING_FOR_MS = 5 * 60 * 1000;
const missing = new Map<string, number>();
export const markPictureMissing = (memberId: string) => missing.set(memberId, Date.now());
export const pictureIsMissing = (memberId: string) => {
  const at = missing.get(memberId);
  if (at === undefined) return false;
  if (Date.now() - at > MISSING_FOR_MS) {
    missing.delete(memberId);
    return false;
  }
  return true;
};

function applyProfile(profile: Profile) {
  const status = profile.profile_image_status ?? null;
  const hasPicture = Boolean(profile.profile_image_url) && status !== 'DELETED';
  if (hasPicture) missing.delete(profile.member_id);
  set({ hasPicture, status, version: profile.etag || null });
}

let polling = 0;
let loading: Promise<void> | null = null;

// Reads the member's profile once (shared by every caller at the same time).
export function loadMyPicture(memberId: string) {
  if (state.memberId !== memberId) {
    polling += 1; // stops a poll that belongs to the previous member
    set({ ...EMPTY, memberId });
  }
  if (!loading) {
    loading = coreApi
      .getMyProfile()
      .then((profile) => {
        if (profile.member_id === state.memberId) applyProfile(profile);
      })
      .catch(() => {})
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

// Sign-out: nothing of the previous member stays in memory.
export function resetMyPicture() {
  polling += 1;
  set({ ...EMPTY });
}

let foregroundWatch = false;
function watchForeground() {
  if (foregroundWatch) return;
  foregroundWatch = true;
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && state.memberId && !state.busy) loadMyPicture(state.memberId);
  });
}

// What to tell the member when a picture call fails.
export function pictureErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'PROFILE_IMAGE_SIZE_INVALID':
      case 'PAYLOAD_TOO_LARGE':
        return 'That photo is too large. Pick one under 5 MB.';
      case 'PROFILE_IMAGE_TYPE_INVALID':
        return 'Use a JPEG, PNG or WebP photo.';
      case 'PROFILE_IMAGE_REQUIRED':
        return 'Choose a photo first.';
    }
    if (error.status === 0 || isTransient(error)) return 'Couldn’t reach Ol-ga. Check your connection and try again.';
  }
  return 'Something went wrong with your photo. Please try again.';
}

const needsFreshEtag = (e: unknown) =>
  e instanceof ApiError && (e.code === 'RESOURCE_VERSION_CONFLICT' || e.code === 'IF_MATCH_REQUIRED');

// Runs a picture write with the profile's current etag. A write needs the
// latest etag; if someone changed the profile meanwhile, read it again and
// try once more as a new action (new key). Network failures are retried with
// the same key, so the server never applies the same picture twice.
async function writeWithEtag<T>(write: (etag: string, key: string, timeoutMs: number) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const { etag } = await coreApi.getMyProfile();
    const key = newIdempotencyKey();
    try {
      return await withRetries((timeoutMs) => write(etag, key, timeoutMs));
    } catch (e) {
      if (attempt === 0 && needsFreshEtag(e)) continue;
      throw e;
    }
  }
}

async function watchProcessing(memberId: string) {
  const run = ++polling;
  const deadline = Date.now() + POLL_FOR_MS;
  while (run === polling && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_EVERY_MS));
    if (run !== polling) return;
    try {
      const profile = await coreApi.getMyProfile();
      if (run !== polling) return;
      const status = profile.profile_image_status ?? null;
      if (status === 'PENDING' || status === 'PROCESSING') {
        set({ status });
        continue;
      }
      applyProfile(profile);
      if (status === 'REJECTED') {
        set({ busy: null, preview: null, error: 'We couldn’t use that photo. Please try a different one.' });
      } else {
        set({ busy: null, preview: null, error: null, slow: false });
      }
      return;
    } catch {
      // a missed answer is fine: ask again until the time is up
    }
  }
  if (run === polling && state.memberId === memberId) set({ busy: null, slow: true });
}

export async function uploadMyPicture(file: PictureFile, size?: number) {
  const memberId = state.memberId;
  if (!memberId || state.busy) return;
  if (size != null && size > MAX_BYTES) {
    set({ error: 'That photo is too large. Pick one under 5 MB.' });
    return;
  }
  set({ busy: 'uploading', preview: file.uri, error: null, slow: false });
  try {
    const res = await writeWithEtag((etag, key, timeoutMs) =>
      coreApi.uploadProfilePicture(file, etag, { idempotencyKey: key, timeoutMs })
    );
    set({ busy: 'processing', status: res.status, version: res.etag || state.version });
    if (res.status === 'READY') {
      await loadMyPicture(memberId);
      set({ busy: null, preview: null });
      return;
    }
    watchProcessing(memberId);
  } catch (e) {
    set({ busy: null, preview: null, error: pictureErrorMessage(e) });
  }
}

export async function removeMyPicture() {
  if (!state.memberId || state.busy) return;
  set({ busy: 'removing', error: null, slow: false });
  try {
    const profile = await writeWithEtag((etag, key, timeoutMs) =>
      coreApi.deleteProfilePicture(etag, { idempotencyKey: key, timeoutMs })
    );
    polling += 1;
    applyProfile(profile);
    set({ busy: null, preview: null, hasPicture: false });
  } catch (e) {
    set({ busy: null, error: pictureErrorMessage(e) });
  }
}

export type PictureSource = 'camera' | 'library';

const PICKER = {
  mediaType: 'photo',
  selectionLimit: 1,
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
  includeBase64: false,
  // iPhone photos are HEIC: ask for JPEG, which the server accepts.
  assetRepresentationMode: 'compatible',
} as const;

function toFile(asset: Asset): PictureFile | null {
  if (!asset.uri) return null;
  const type = asset.type && ACCEPTED.includes(asset.type) ? asset.type : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return { uri: asset.uri, name: `profile.${ext}`, type };
}

// Opens the camera or the photo library and uploads what the member picks.
export async function pickMyPicture(source: PictureSource) {
  if (state.busy) return;
  let result: ImagePickerResponse;
  try {
    result = await (source === 'camera' ? launchCamera(PICKER) : launchImageLibrary(PICKER));
  } catch {
    set({ error: 'Couldn’t open your photos. Please try again.' });
    return;
  }
  if (result.didCancel) return;
  if (result.errorCode) {
    set({
      error:
        result.errorCode === 'permission'
          ? source === 'camera'
            ? 'Allow camera access in Settings to take a photo.'
            : 'Allow photo access in Settings to choose a photo.'
          : 'Couldn’t open your photos. Please try again.',
    });
    return;
  }
  const asset = result.assets?.[0];
  const file = asset && toFile(asset);
  if (!file) {
    set({ error: 'Couldn’t read that photo. Please try another.' });
    return;
  }
  await uploadMyPicture(file, asset.fileSize);
}

export function clearPictureError() {
  if (state.error) set({ error: null });
}

// For a screen that shows the member's own picture. Reads the profile once
// per member, and again when the app returns to the foreground.
export function useMyPicture(memberId: string | null): MyPictureState {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!memberId) {
      if (state.memberId) resetMyPicture();
      return;
    }
    watchForeground();
    if (state.memberId !== memberId) loadMyPicture(memberId);
  }, [memberId]);
  return memberId && current.memberId === memberId ? current : EMPTY;
}
