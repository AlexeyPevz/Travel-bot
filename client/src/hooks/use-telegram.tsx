import { useState, useEffect } from 'react';
import { 
  getTelegramWebApp, 
  isRunningInTelegram,
  getTelegramUser,
  WebAppUser,
  initTelegramWebApp
} from '../lib/telegramWebApp';
import { apiRequest } from '@/lib/queryClient';

/**
 * Hook to check if app is running inside Telegram and get user data
 * @returns Telegram WebApp state and user data
 */
export function useTelegram() {
  const [inTelegram, setInTelegram] = useState<boolean | null>(null);
  const [user, setUser] = useState<WebAppUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Initialize Telegram WebApp
    initTelegramWebApp();
    
    // Check if app is running inside Telegram
    const isTelegram = isRunningInTelegram();
    setInTelegram(isTelegram);
    
    // Get user data if running inside Telegram
    (async () => {
      if (isTelegram) {
        const telegramUser = getTelegramUser();
        setUser(telegramUser);
        // Perform Telegram auth to obtain JWT tokens
        try {
          const webApp = getTelegramWebApp();
          const initData = webApp?.initData || '';
          if (initData) {
            const res = await apiRequest('POST', '/api/auth/telegram', { initData });
            const body = await res.json();
            if ((body as any)?.accessToken) {
              localStorage.setItem('accessToken', (body as any).accessToken);
            }
          }
        } catch {
          // ignore auth errors
        }
      }
      setIsReady(true);
    })();
  }, []);
  
  return {
    inTelegram,
    user,
    userId: user?.id.toString() || null,
    isReady,
  };
}