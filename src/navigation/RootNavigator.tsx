import { useAuth } from '../context/AuthContext';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}
