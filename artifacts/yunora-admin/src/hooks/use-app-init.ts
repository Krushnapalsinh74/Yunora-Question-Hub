import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import { useThemeStore } from '@/hooks/use-theme';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export function useAppInit() {
  const theme = useThemeStore((s) => s.theme);
  
  useEffect(() => {
    // Setup API client auth token getter
    setAuthTokenGetter(() => {
      const state = useAuthStore.getState();
      return state.token;
    });
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
}
