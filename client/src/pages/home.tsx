import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import { getTelegramUser, initTelegramWebApp } from '@/lib/telegramWebApp';
import { useQuery } from '@tanstack/react-query';

export default function Home() {
  const [_, setLocation] = useLocation();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();

  // Initialize Telegram WebApp
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Check if user has a profile
  const { data: profile, isLoading } = useQuery({
    queryKey: userId ? [`/api/profile/${userId}`] : null,
    enabled: !!userId,
  });

  // Redirect to profile page if no profile
  useEffect(() => {
    if (!isLoading && !profile && userId) {
      setLocation('/profile');
    }
  }, [isLoading, profile, userId, setLocation]);

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  return (
    <div className="min-h-screen bg-telegram-light pb-16">
      <Header title="AI-турагент" showBackButton={false} />
      <Navigation activeTab="home" />

      <main className="p-4">
        <h1 className="text-2xl font-bold text-telegram-darkgray mb-4">Добро пожаловать в AI-турагент</h1>
        
        <p className="text-telegram-midgray mb-6">
          Мы поможем вам найти идеальный отпуск, соответствующий вашим предпочтениям.
        </p>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <Card className="overflow-hidden shadow-md">
            <div className="h-48 bg-telegram-blue flex items-center justify-center text-white">
              <div className="text-center p-4">
                <h2 className="text-xl font-bold mb-2">Найдите идеальный тур</h2>
                <p className="text-sm">Мы подберем лучшие варианты по вашим предпочтениям</p>
              </div>
            </div>
            <CardContent className="p-4">
              <Button 
                className="w-full bg-telegram-blue hover:bg-blue-600 text-white"
                onClick={() => handleNavigate('/tours')}
              >
                Смотреть туры
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="overflow-hidden shadow-md">
            <div className="h-32 bg-green-600 flex items-center justify-center text-white">
              <div className="text-center p-3">
                <h3 className="font-bold">Создать желание</h3>
              </div>
            </div>
            <CardContent className="p-3">
              <Button 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleNavigate('/watchlist')}
                size="sm"
              >
                Мои желания
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden shadow-md">
            <div className="h-32 bg-purple-600 flex items-center justify-center text-white">
              <div className="text-center p-3">
                <h3 className="font-bold">Найти попутчика</h3>
              </div>
            </div>
            <CardContent className="p-3">
              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => handleNavigate('/travel-buddy')}
                size="sm"
              >
                Попутчики
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="overflow-hidden shadow-md">
            <div className="h-24 bg-amber-600 flex items-center justify-center text-white">
              <div className="text-center p-4">
                <h3 className="font-bold">Групповая поездка</h3>
              </div>
            </div>
            <CardContent className="p-4">
              <Button 
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => handleNavigate('/groups')}
              >
                Создать группу
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
