import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainTabParamList } from './types';

// For navigating from outside a screen (the Nearby banner).
export const navigationRef = createNavigationContainerRef<MainTabParamList>();
