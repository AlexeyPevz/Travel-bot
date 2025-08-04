import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  userId: string;
  name: string;
  destination: string;
  vacationType: string;
}

interface ProfileSelectorProps {
  onSelectProfile: (userId: string) => void;
  defaultUserId?: string;
}

export default function ProfileSelector({ onSelectProfile, defaultUserId }: ProfileSelectorProps) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(defaultUserId);

  // В режиме разработки используем фиксированный ID для тестирования
  const devModeUserId = process.env.NODE_ENV === 'development' ? '123456789' : null;
  const effectiveUserId = defaultUserId || devModeUserId;

  // Fetch current user's profile directly
  const { data, isLoading, isError } = useQuery({
    queryKey: effectiveUserId ? [`/api/profile/${effectiveUserId}`] : null,
    enabled: !!effectiveUserId,
  });

  // Создаем простой массив профилей из одного текущего профиля
  const profiles: Profile[] = data ? [
    {
      userId: data.userId,
      name: data.name || 'Без имени',
      destination: data.destination || 'Не указано',
      vacationType: data.vacationType || 'Не указано'
    }
  ] : [];

  // Handle when no profiles are found
  useEffect(() => {
    if (!isLoading && !isError && profiles.length === 0) {
      toast({
        title: "Профили не найдены",
        description: "Пожалуйста, создайте профиль через бота или используйте форму",
        variant: "destructive"
      });
    }
  }, [isLoading, isError, profiles, toast]);

  // When user selects a profile
  const handleSelect = (userId: string) => {
    setSelectedUserId(userId);
  };

  // When user confirms the selection
  const handleConfirm = () => {
    if (selectedUserId) {
      onSelectProfile(selectedUserId);
      toast({
        title: "Профиль выбран",
        description: "Загружаем данные выбранного профиля",
        variant: "default"
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center">
          <Loader2 className="h-8 w-8 text-telegram-blue animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500 mb-4">Ошибка при загрузке профилей</p>
          <Button 
            variant="default" 
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Попробовать снова
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-medium mb-4">Выберите профиль</h3>
        
        {profiles.length === 0 ? (
          <p className="text-telegram-midgray mb-4">Нет доступных профилей. Пожалуйста, создайте профиль через бота или используйте форму.</p>
        ) : (
          <>
            <div className="mb-4">
              <Select value={selectedUserId} onValueChange={handleSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите профиль" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.userId} value={profile.userId}>
                      {profile.name} ({profile.destination} - {profile.vacationType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="default" 
              onClick={handleConfirm}
              className="w-full mb-2"
              disabled={!selectedUserId}
            >
              Выбрать этот профиль
            </Button>
            
            <p className="text-xs text-telegram-midgray text-center mt-2">
              Если вы создали профиль через бота, он должен появиться в этом списке
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}