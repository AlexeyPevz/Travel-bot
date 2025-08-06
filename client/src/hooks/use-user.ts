import { useState, useEffect } from 'react';
import { useTelegram } from './use-telegram';

interface User {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
  photoUrl?: string;
}

export function useUser() {
  const { user: telegramUser, isReady } = useTelegram();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isReady && telegramUser) {
      setUser({
        id: telegramUser.id.toString(),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        languageCode: telegramUser.language_code,
        isPremium: telegramUser.is_premium,
        photoUrl: telegramUser.photo_url,
      });
      setIsLoading(false);
    } else if (isReady && !telegramUser) {
      // For development/testing without Telegram
      setUser({
        id: 'test-user',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        languageCode: 'en',
        isPremium: false,
      });
      setIsLoading(false);
    }
  }, [telegramUser, isReady]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}