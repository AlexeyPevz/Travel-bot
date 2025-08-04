import { useState, useEffect } from 'react';
import { 
  getTelegramWebApp, 
  isRunningInTelegram,
  getTelegramUser,
  WebAppUser,
  initTelegramWebApp
} from '../lib/telegramWebApp';

/**
 * Hook to check if app is running inside Telegram and get user data
 * @returns Telegram WebApp state and user data
 */
export function useTelegram() {
  const [inTelegram, setInTelegram] = useState<boolean | null>(null);
  const [user, setUser] = useState<WebAppUser | null>(null);
  
  useEffect(() => {
    // Initialize Telegram WebApp
    initTelegramWebApp();
    
    // Check if app is running inside Telegram
    const isTelegram = isRunningInTelegram();
    setInTelegram(isTelegram);
    
    // Get user data if running inside Telegram
    if (isTelegram) {
      const telegramUser = getTelegramUser();
      setUser(telegramUser);
    }
  }, []);
  
  return {
    inTelegram,
    user,
    userId: user?.id.toString() || null,
  };
}