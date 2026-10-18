import { LucideIcon } from 'lucide-react-native';
import { Dialog, DialogTone } from './Dialog';

type Props = {
  visible: boolean;
  icon?: LucideIcon;
  // warning: amber icon (e.g. offensive text); info: blue icon (e.g. a permission).
  tone?: DialogTone;
  title: string;
  message: string;
  // The safe choice: the navy button on top.
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  // Back button or a tap outside: same as the safe choice.
  onDismiss: () => void;
};

// A two-choice popup drawn by the app's one Dialog.
export function ConfirmDialog({ visible, icon, tone = 'warning', title, message, primaryLabel, onPrimary, secondaryLabel, onSecondary, onDismiss }: Props) {
  return (
    <Dialog
      visible={visible}
      icon={icon}
      tone={tone}
      title={title}
      message={message}
      actions={[
        { label: primaryLabel, onPress: onPrimary, kind: 'primary' },
        { label: secondaryLabel, onPress: onSecondary, kind: 'secondary' },
      ]}
      onDismiss={onDismiss}
    />
  );
}
