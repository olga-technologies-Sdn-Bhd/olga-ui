import { useEffect, useSyncExternalStore } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { CORE_API_URL } from '../config/env';
import { ApiError, apiErrorFrom, imageHeaders, NETWORK_ERROR, TIMEOUT } from '../api/client';
import type { ChatAttachment } from '../api/types';

// Chat attachments: a photo, a PDF or a voice note. Sending is two steps,
// upload (POST .../attachments, multipart `file`) then a FILE message with the
// returned file_asset_id. Files are served only after a malware scan, so a
// download can answer 409 ATTACHMENT_NOT_AVAILABLE for a while: shown as
// "Processing…", not an error.

export type AttachmentKind = 'image' | 'pdf' | 'voice';

// A file on this phone, ready to upload.
export type LocalFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
  durationMs?: number; // voice notes
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_MS = 2 * 60 * 1000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const UPLOAD_TIMEOUT_MS = 120000;

export function kindOf(mediaType: string): AttachmentKind {
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('audio/')) return 'voice';
  return 'pdf';
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "1:05" for a voice note's length or position.
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// What the list shows for a message with an attachment.
export function attachmentPreview(attachment: ChatAttachment) {
  switch (kindOf(attachment.media_type)) {
    case 'image':
      return '📷 Photo';
    case 'voice':
      return '🎤 Voice message';
    default:
      return `📄 ${attachment.file_name}`;
  }
}

// Plain-language text for an upload or FILE send that failed for good.
export function attachmentError(e: unknown) {
  const code = e instanceof ApiError ? e.code : '';
  if (code === 'ATTACHMENT_TYPE_INVALID') return 'This file type isn’t supported';
  if (code === 'ATTACHMENT_TOO_LONG') return 'Voice notes can be up to 2 minutes';
  if (code === 'ATTACHMENT_TOO_LARGE') return 'This file is too large';
  return null;
}

// Checked before uploading; the server checks again from the real bytes.
export function checkFile(file: LocalFile): string | null {
  const kind = kindOf(file.type);
  if (kind === 'voice') {
    if ((file.durationMs ?? 0) > MAX_VOICE_MS + 1000) return 'Voice notes can be up to 2 minutes';
    if ((file.size ?? 0) > MAX_VOICE_BYTES) return 'This voice note is too large';
    return null;
  }
  if (kind === 'image' && !IMAGE_TYPES.includes(file.type)) return 'This file type isn’t supported';
  if (kind === 'pdf' && file.type !== 'application/pdf') return 'This file type isn’t supported';
  if ((file.size ?? 0) > MAX_FILE_BYTES) return 'This file is too large. The limit is 10 MB';
  return null;
}

const PHOTO_PICKER = {
  mediaType: 'photo',
  selectionLimit: 1,
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.8,
  includeBase64: false,
  // iPhone photos are HEIC: ask for JPEG, which every phone can show.
  assetRepresentationMode: 'compatible',
} as const;

export type PickResult = { file: LocalFile } | { error: string } | null;

// Android asks for the camera at run time (iOS: the picker asks, with the
// Info.plist text).
async function askCamera() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

// Camera or library. null: the member cancelled.
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  const where = source === 'camera' ? 'the camera' : 'your photos';
  if (source === 'camera' && !(await askCamera().catch(() => false))) {
    return { error: 'Allow camera access in Settings to take a photo.' };
  }
  let result: ImagePickerResponse;
  try {
    result = await (source === 'camera' ? launchCamera(PHOTO_PICKER) : launchImageLibrary(PHOTO_PICKER));
  } catch {
    return { error: `Couldn’t open ${where}. Please try again.` };
  }
  if (result.didCancel) return null;
  if (result.errorCode) {
    if (result.errorCode === 'camera_unavailable') return { error: 'This phone’s camera isn’t available.' };
    if (result.errorCode !== 'permission') return { error: `Couldn’t open ${where}. Please try again.` };
    return { error: source === 'camera' ? 'Allow camera access in Settings to take a photo.' : 'Allow photo access in Settings to choose a photo.' };
  }
  const asset = result.assets?.[0];
  if (!asset?.uri) return { error: 'Couldn’t read that photo. Please try another.' };
  const type = asset.type && IMAGE_TYPES.includes(asset.type) ? asset.type : 'image/jpeg';
  return { file: { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type, size: asset.fileSize } };
}

export async function pickPdf(): Promise<PickResult> {
  try {
    const [picked] = await pick({ type: [types.pdf] });
    const name = picked.name ?? 'document.pdf';
    // A copy in the app's cache: the picked uri can lose its permission
    // before a retry, and the sender's bubble opens this copy.
    const [copy] = await keepLocalCopy({ files: [{ uri: picked.uri, fileName: name }], destination: 'cachesDirectory' });
    const uri = copy.status === 'success' ? copy.localUri : picked.uri;
    return { file: { uri, name, type: picked.type ?? 'application/pdf', size: picked.size ?? undefined } };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return null;
    return { error: 'Couldn’t open that file. Please try again.' };
  }
}

export type Uploaded = ChatAttachment;

// POST .../attachments with progress (0..1). XMLHttpRequest, since fetch has
// no upload progress. Same Idempotency-Key on every retry of one file.
export function uploadAttachment(
  conversationId: string,
  file: LocalFile,
  idempotencyKey: string,
  onProgress: (fraction: number) => void
): { done: Promise<Uploaded>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const done = new Promise<Uploaded>((resolve, reject) => {
    xhr.open('POST', `${CORE_API_URL}/v1/conversations/${encodeURIComponent(conversationId)}/attachments`);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Idempotency-Key', idempotencyKey);
    Object.entries(imageHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Uploaded);
        } catch {
          reject(new ApiError(xhr.status, 'HTTP_INVALID_BODY', 'Unreadable upload response'));
        }
        return;
      }
      reject(apiErrorFrom(xhr.status, '', xhr.responseText ?? '', xhr.getResponseHeader('X-Correlation-Id') ?? undefined));
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_ERROR, 'Network request failed'));
    xhr.ontimeout = () => reject(new ApiError(0, TIMEOUT, 'Upload timed out'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled'));
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    xhr.send(form);
  });
  return { done, abort: () => xhr.abort() };
}

// Files I sent from this phone, by file_asset_id: my own bubble shows the
// local copy instead of waiting for the download.
const sentFromHere = new Map<string, LocalFile>();
export const rememberSent = (fileAssetId: string, file: LocalFile) => sentFromHere.set(fileAssetId, file);

// Downloads, cached by file_asset_id for this app session (files stay in the
// cache folder; the OS may clear them).
export type Download =
  | { state: 'idle' | 'loading' | 'processing' | 'gone' | 'forbidden' | 'failed' }
  | { state: 'ready'; uri: string };

const downloads = new Map<string, Download>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
};

function setDownload(id: string, value: Download) {
  downloads.set(id, value);
  notify();
}

// The file's own name, made safe for the file system, so a viewer shows it.
function safeName(attachment: ChatAttachment) {
  const ext = EXTENSIONS[attachment.media_type] ?? 'bin';
  const base = attachment.file_name.replace(/[\\/:*?"<>|]/g, '_').trim() || `file.${ext}`;
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

// GET /v1/messages/{id}/attachment into the cache (one folder per file, the
// file under its own name). Safe to call repeatedly. Resolves with the
// file's uri when it's ready, else null.
export function download(messageId: string, attachment: ChatAttachment): Promise<string | null> {
  const id = attachment.file_asset_id;
  const local = sentFromHere.get(id);
  if (local) {
    setDownload(id, { state: 'ready', uri: local.uri });
    return Promise.resolve(local.uri);
  }
  const current = downloads.get(id);
  if (current?.state === 'ready') return Promise.resolve(current.uri);
  if (current?.state === 'gone') return Promise.resolve(null);
  const running = inFlight.get(id);
  if (running) return running;
  const folder = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/chat-${id}`;
  const path = `${folder}/${safeName(attachment)}`;
  const task = (async (): Promise<string | null> => {
    if (await ReactNativeBlobUtil.fs.exists(path)) {
      setDownload(id, { state: 'ready', uri: `file://${path}` });
      return `file://${path}`;
    }
    if (!(await ReactNativeBlobUtil.fs.exists(folder))) await ReactNativeBlobUtil.fs.mkdir(folder).catch(() => {});
    if (current?.state !== 'processing') setDownload(id, { state: 'loading' });
    try {
      const response = await ReactNativeBlobUtil.config({ path }).fetch(
        'GET',
        `${CORE_API_URL}/v1/messages/${encodeURIComponent(messageId)}/attachment`,
        imageHeaders()
      );
      const status = response.info().status;
      if (status === 200) {
        setDownload(id, { state: 'ready', uri: `file://${path}` });
        return `file://${path}`;
      }
      // The body went to the file: drop it, it's an error body.
      await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
      setDownload(id, { state: status === 409 ? 'processing' : status === 404 ? 'gone' : status === 403 ? 'forbidden' : 'failed' });
      return null;
    } catch {
      await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
      setDownload(id, { state: 'failed' });
      return null;
    }
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, task);
  return task;
}

// "Processing…" and failed downloads are asked again when the chat is
// reopened or refreshed.
export function retryDownloads() {
  let changed = false;
  downloads.forEach((d, id) => {
    if (d.state === 'processing' || d.state === 'failed' || d.state === 'forbidden') {
      downloads.delete(id);
      changed = true;
    }
  });
  if (changed) notify();
}

const IDLE: Download = { state: 'idle' };

// The download state of one attachment; `auto` starts it straight away
// (photos), otherwise call download() on tap (PDFs, voice notes).
export function useDownload(messageId: string | undefined, attachment: ChatAttachment | undefined, auto: boolean): Download {
  const value = useSyncExternalStore(subscribe, () => (attachment ? downloads.get(attachment.file_asset_id) ?? IDLE : IDLE));
  const id = attachment?.file_asset_id;
  const state = value.state;
  useEffect(() => {
    if (!messageId || !attachment) return;
    if (auto || sentFromHere.has(attachment.file_asset_id)) {
      if (state === 'idle') download(messageId, attachment);
    }
    // Re-run when a retry resets the state to idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId, id, auto, state]);
  return value;
}
