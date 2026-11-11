import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// 2, 5, 10, then every 15 seconds: the guide's pace for waiting on scoring.
export const SCI_POLL_DELAYS_MS = [2000, 5000, 10000, 15000];
// Stop on its own after this long and leave a manual refresh.
export const SCI_POLL_MAX_MS = 3 * 60 * 1000;

type Options = {
  enabled: boolean;
  delaysMs?: number[];
  maxMs?: number;
};

// Runs `task` now and then again after each delay while the screen is in
// front and the app is in the foreground. The task returns true when there is
// nothing more to wait for. After maxMs it stops and `timedOut` is true;
// `refresh` starts a fresh round. Going to the background pauses it.
export function useBackoffPoll(task: () => Promise<boolean | void>, { enabled, delaysMs = SCI_POLL_DELAYS_MS, maxMs = SCI_POLL_MAX_MS }: Options) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [round, setRound] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled || !focused || !foreground) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let step = 0;
    setTimedOut(false);
    const tick = async () => {
      let done = false;
      try {
        done = (await taskRef.current()) === true;
      } catch {
        // A failed look is just tried again on the next turn.
      }
      if (cancelled || done) return;
      if (Date.now() - startedAt >= maxMs) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(tick, delaysMs[Math.min(step++, delaysMs.length - 1)]);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, focused, foreground, round, delaysMs, maxMs]);

  const refresh = useCallback(() => setRound((r) => r + 1), []);
  return { timedOut, refresh };
}
