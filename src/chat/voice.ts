import { useSyncExternalStore } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Sound, { AudioEncoderAndroidType, createSound, OutputFormatAndroidType, type AudioSet } from 'react-native-nitro-sound';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { MAX_VOICE_MS, type LocalFile } from './attachments';

// Voice notes: AAC in an .m4a (MPEG-4) file on both platforms, which is what
// Core accepts (audio/mp4). Recording uses the library's shared instance;
// playback its own, one note at a time across the app.

const AUDIO: AudioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AVFormatIDKeyIOS: 'aac',
  AVModeIOS: 'spokenAudio',
  AudioSamplingRate: 44100,
  AudioEncodingBitRate: 64000,
  AudioChannels: 1,
};

const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);
const toPath = (uri: string) => uri.replace(/^file:\/\//, '');

export async function askMicrophone() {
  if (Platform.OS !== 'android') return true; // iOS asks on the first recording
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

let recording = false;
let startedAt = 0;
let elapsed = 0;

// onTick: milliseconds recorded so far. Stops itself at 2 minutes (onLimit).
export async function startRecording(onTick: (ms: number) => void, onLimit: () => void) {
  if (recording) return;
  recording = true;
  startedAt = Date.now();
  elapsed = 0;
  Sound.setSubscriptionDuration(0.2);
  Sound.addRecordBackListener((e) => {
    elapsed = e.currentPosition;
    onTick(e.currentPosition);
    if (e.currentPosition >= MAX_VOICE_MS) onLimit();
  });
  try {
    await Sound.startRecorder(undefined, AUDIO, false);
  } catch (e) {
    recording = false;
    Sound.removeRecordBackListener();
    throw e;
  }
}

// The finished note, or null if it was too short to keep (a tap).
export async function stopRecording(): Promise<LocalFile | null> {
  if (!recording) return null;
  recording = false;
  Sound.removeRecordBackListener();
  const path = await Sound.stopRecorder();
  const durationMs = Math.min(Math.max(elapsed, Date.now() - startedAt), MAX_VOICE_MS);
  const uri = toFileUri(path);
  if (durationMs < 1000) {
    ReactNativeBlobUtil.fs.unlink(toPath(uri)).catch(() => {});
    return null;
  }
  const stat = await ReactNativeBlobUtil.fs.stat(toPath(uri)).catch(() => null);
  return { uri, name: 'voice.m4a', type: 'audio/mp4', size: stat ? Number(stat.size) : undefined, durationMs };
}

export async function cancelRecording() {
  if (!recording) return;
  recording = false;
  Sound.removeRecordBackListener();
  const path = await Sound.stopRecorder().catch(() => null);
  if (path) ReactNativeBlobUtil.fs.unlink(toPath(path)).catch(() => {});
}

// Playback: which note is loaded, and where it is.
export type Playback = { uri: string | null; playing: boolean; positionMs: number; durationMs: number };

const player = createSound();
let playback: Playback = { uri: null, playing: false, positionMs: 0, durationMs: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<Playback>) => {
  playback = { ...playback, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

player.setSubscriptionDuration(0.1);
player.addPlayBackListener((e) => set({ positionMs: e.currentPosition, durationMs: e.duration || playback.durationMs }));
player.addPlaybackEndListener(() => set({ playing: false, positionMs: 0 }));

// Play, pause or resume this note; another note playing stops first.
export async function togglePlay(uri: string) {
  try {
    if (playback.uri === uri) {
      if (playback.playing) {
        await player.pausePlayer();
        set({ playing: false });
      } else if (playback.positionMs > 0) {
        await player.resumePlayer();
        set({ playing: true });
      } else {
        set({ playing: true });
        await player.startPlayer(uri);
      }
      return;
    }
    if (playback.uri) await player.stopPlayer().catch(() => {});
    set({ uri, playing: true, positionMs: 0, durationMs: 0 });
    await player.startPlayer(uri);
  } catch {
    set({ playing: false });
  }
}

export async function stopPlayback() {
  if (!playback.uri) return;
  await player.stopPlayer().catch(() => {});
  set({ uri: null, playing: false, positionMs: 0, durationMs: 0 });
}

const NONE: Playback = { uri: null, playing: false, positionMs: 0, durationMs: 0 };

// This note's playback state (idle unless it's the one loaded).
export function usePlayback(uri: string | null): Playback {
  return useSyncExternalStore(subscribe, () => (uri && playback.uri === uri ? playback : NONE));
}
