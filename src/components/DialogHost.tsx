import { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Dialog, DialogAction, DialogTone } from './Dialog';

// The app's replacement for Alert.alert (which ESLint blocks): the same call
// shape, drawn as Ol-ga's own Dialog by the one <DialogHost /> in App.tsx.
// Works from anywhere, including contexts outside a screen.
//
//   showDialog('Log out?', 'You can sign back in…', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Log out', style: 'destructive', onPress: logOut },
//   ], { icon: LogOut });
//
// Order on screen: the safe choice is the navy button on top. With a
// destructive button, Cancel is the navy one; otherwise the main action is,
// and Cancel sits below it. Tapping outside or Back counts as Cancel.
export type DialogButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type DialogOptions = { icon?: LucideIcon; tone?: DialogTone };

type Request = { id: number; title: string; message?: string; buttons: DialogButton[]; options: DialogOptions };

let listener: ((r: Request) => void) | null = null;
let nextId = 1;
const waiting: Request[] = [];

export function showDialog(title: string, message?: string, buttons: DialogButton[] = [{ text: 'OK' }], options: DialogOptions = {}) {
  const request = { id: nextId++, title, message, buttons, options };
  if (listener) listener(request);
  else waiting.push(request);
}

function toActions(buttons: DialogButton[], close: (then?: () => void) => void): DialogAction[] {
  const cancel = buttons.filter((b) => b.style === 'cancel');
  const destructive = buttons.filter((b) => b.style === 'destructive');
  const other = buttons.filter((b) => b.style !== 'cancel' && b.style !== 'destructive');
  const ordered = destructive.length ? [...cancel, ...other, ...destructive] : [...other, ...destructive, ...cancel];
  return ordered.map((b, i) => ({
    label: b.text,
    kind: b.style === 'destructive' ? 'destructive' : i === 0 ? 'primary' : 'secondary',
    onPress: () => close(b.onPress),
  }));
}

export function DialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);

  useEffect(() => {
    listener = (r) => setQueue((q) => [...q, r]);
    if (waiting.length) setQueue((q) => [...q, ...waiting.splice(0)]);
    return () => {
      listener = null;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  // Close first, then run the button's action (it may open the next dialog).
  const close = (then?: () => void) => {
    setQueue((q) => q.slice(1));
    then?.();
  };
  const cancel = current.buttons.find((b) => b.style === 'cancel');

  return (
    <Dialog
      key={current.id}
      visible
      icon={current.options.icon}
      tone={current.options.tone}
      title={current.title}
      message={current.message}
      actions={toActions(current.buttons, close)}
      onDismiss={() => close(cancel?.onPress)}
    />
  );
}
