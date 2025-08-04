import React, { useState } from 'react';
import PrioritySlider from './PrioritySlider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface PrioritiesFormProps {
  userId: string;
  priorities: Record<string, number>;
}

const defaultPriorities = {
  starRating: 5,
  beachLine: 5,
  mealType: 5,
  price: 7,
  hotelRating: 5,
  location: 5,
  familyFriendly: 5
};

const priorityConfig = [
  {
    key: 'starRating',
    label: 'Звездность отеля',
    icon: '⭐',
    description: 'Насколько важна категория отеля (3*, 4*, 5*)'
  },
  {
    key: 'beachLine',
    label: 'Линия пляжа',
    icon: '🏖',
    description: 'Важность расположения отеля относительно моря'
  },
  {
    key: 'mealType',
    label: 'Тип питания',
    icon: '🍽',
    description: 'Важность системы питания (все включено, полупансион и т.д.)'
  },
  {
    key: 'price',
    label: 'Цена',
    icon: '💰',
    description: 'Насколько важна стоимость тура'
  },
  {
    key: 'hotelRating',
    label: 'Рейтинг отеля',
    icon: '📊',
    description: 'Важность отзывов и оценок других туристов'
  },
  {
    key: 'location',
    label: 'Расположение',
    icon: '📍',
    description: 'Важность удобного расположения отеля'
  },
  {
    key: 'familyFriendly',
    label: 'Для семей с детьми',
    icon: '👨‍👩‍👧‍👦',
    description: 'Важность инфраструктуры для детей'
  }
];

export default function PrioritiesForm({ userId, priorities: initialPriorities }: PrioritiesFormProps) {
  const { toast } = useToast();
  const [priorities, setPriorities] = useState<Record<string, number>>({
    ...defaultPriorities,
    ...initialPriorities
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, number>) => {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, priorities: data })
      });
      if (!response.ok) throw new Error('Failed to save priorities');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Настройки сохранены',
        description: 'Веса параметров успешно обновлены'
      });
    },
    onError: () => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive'
      });
    }
  });

  const handlePriorityChange = (key: string, value: number) => {
    setPriorities(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(priorities);
  };

  const handleReset = () => {
    setPriorities(defaultPriorities);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Настройка важности параметров</CardTitle>
          <CardDescription>
            Оцените важность каждого параметра от 0 до 10. Это поможет нам подобрать туры, 
            которые лучше всего соответствуют вашим предпочтениям.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {priorityConfig.map(({ key, label, icon, description }) => (
            <PrioritySlider
              key={key}
              label={label}
              icon={icon}
              value={priorities[key] || 5}
              onChange={(value) => handlePriorityChange(key, value)}
              description={description}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button 
          onClick={handleSave} 
          className="flex-1 bg-telegram-blue hover:bg-blue-600"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Сохранение...' : 'Сохранить настройки'}
        </Button>
        <Button 
          onClick={handleReset} 
          variant="outline"
          className="text-gray-600"
        >
          Сбросить
        </Button>
      </div>
    </div>
  );
}