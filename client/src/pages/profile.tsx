import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import ProfileForm from '@/components/ProfileForm';
import ProfileSelector from '@/components/ProfileSelector';
import PrioritySlider from '@/components/PrioritySlider';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, Settings } from 'lucide-react';
import { useTelegram } from '@/hooks/use-telegram';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PrioritiesForm from '@/components/PrioritiesForm';

export default function ProfilePage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { inTelegram, userId: telegramUserId } = useTelegram();
  
  // В режиме разработки используем фиксированный ID
  const devModeUserId = process.env.NODE_ENV === 'development' ? '123456789' : null;
  const initialUserId = telegramUserId || devModeUserId || '123456789';
  
  // Используем initialUserId как начальное значение
  const [activeUserId, setActiveUserId] = useState<string>(initialUserId);

  // Check if user already has a profile
  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: [`/api/profile/${activeUserId}`],
    enabled: true,
    retry: 1,
  });
  
  // Handle profile selection
  const handleProfileSelect = (selectedUserId: string) => {
    setActiveUserId(selectedUserId);
    // Refetch profile with new userId
    setTimeout(() => {
      refetch();
    }, 100);
  };

  // Handle error
  useEffect(() => {
    if (isError) {
      toast({
        title: "Ошибка загрузки профиля",
        description: error?.message || "Не удалось загрузить данные профиля",
        variant: "destructive"
      });
    }
  }, [isError, error, toast]);

  const handleProfileSubmitSuccess = () => {
    toast({
      title: "Профиль сохранен",
      description: "Ваш профиль был успешно сохранен",
      variant: "default"
    });
    
    // Navigate to tours page after successful profile submission
    navigate('/tours');
  };

  // For development or when user detection is pending
  const isDev = process.env.NODE_ENV === 'development';
  const validUserId = activeUserId || (isDev ? '123456789' : null);
  
  // Show 'Open in Telegram' page only when we are sure we're not in Telegram and not in development mode
  if (!validUserId && inTelegram === false && !isDev) {
    return (
      <div className="min-h-screen bg-telegram-light">
        <Header title="Профиль" showBackButton={true} />
        <main className="p-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-telegram-midgray">
                Пожалуйста, откройте это приложение через Telegram.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  
  // If we're still detecting Telegram status, show a loading screen
  if (inTelegram === null && !isDev) {
    return (
      <div className="min-h-screen bg-telegram-light">
        <Header title="Профиль" showBackButton={true} />
        <main className="p-4 flex justify-center items-center flex-col">
          <Loader2 className="h-8 w-8 text-telegram-blue animate-spin mb-4" />
          <p className="text-telegram-midgray">
            Загрузка...
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-telegram-light pb-16">
      <Header title="Профиль" showBackButton={true} />
      <Navigation activeTab="profile" />

      <main className="p-4">
        <h2 className="text-lg font-medium mb-4">
          {profile ? "Редактирование профиля" : "Заполните анкету"}
        </h2>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-telegram-blue animate-spin" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Profile selector */}
            <ProfileSelector 
              onSelectProfile={handleProfileSelect} 
              defaultUserId={activeUserId}
            />
            
            <Tabs defaultValue="profile" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile">Профиль</TabsTrigger>
                <TabsTrigger value="priorities">
                  <Settings className="w-4 h-4 mr-2" />
                  Приоритеты
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="mt-4">
                <div className="mt-6">
                  <h3 className="text-md font-medium mb-3">Данные профиля</h3>
                  <ProfileForm 
                    existingProfile={profile} 
                    userId={activeUserId || ''}
                    onSuccess={handleProfileSubmitSuccess}
                  />
                </div>

                {profile && (
                  <div className="mt-6">
                    <Separator className="my-4" />
                    
                    <h3 className="text-sm font-medium mb-3">Другие действия</h3>
                    
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full text-telegram-blue border-telegram-blue hover:bg-blue-50"
                        onClick={() => navigate('/tours')}
                      >
                        Перейти к просмотру туров
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="w-full text-telegram-blue border-telegram-blue hover:bg-blue-50"
                        onClick={() => navigate('/watchlist')}
                      >
                        Управление желаниями
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="priorities" className="mt-4">
                <PrioritiesForm 
                  userId={activeUserId || ''}
                  priorities={profile?.priorities || {}}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
