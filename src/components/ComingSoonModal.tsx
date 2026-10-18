import { LucideIcon, Sparkles } from 'lucide-react-native';
import { Dialog } from './Dialog';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: LucideIcon;
};

// "Coming soon" for a feature that isn't built yet, drawn by the app's one Dialog.
export function ComingSoonModal({
  visible,
  onClose,
  title = 'Coming soon!',
  message = "We're building this next. Check back shortly.",
  icon = Sparkles,
}: Props) {
  return <Dialog visible={visible} icon={icon} title={title} message={message} actions={[{ label: 'Got it', onPress: onClose }]} onDismiss={onClose} />;
}
