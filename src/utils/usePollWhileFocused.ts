import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// Runs `task` on focus and then every `intervalMs` while the screen is focused
// and the app is in the foreground (chat has no real-time channel yet).
// Coming back to the foreground runs it once straight away. Overlapping runs
// are skipped.
export function usePollWhileFocused(task: () => Promise<void> | void, intervalMs: number) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;
      let running = false;
      const run = async () => {
        if (running) return;
        running = true;
        try {
          await taskRef.current();
        } finally {
          running = false;
        }
      };
      const start = () => {
        if (timer) return;
        run();
        timer = setInterval(run, intervalMs);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      if (AppState.currentState === 'active') start();
      const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
      return () => {
        stop();
        sub.remove();
      };
    }, [intervalMs])
  );
}
