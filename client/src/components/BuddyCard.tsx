import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BuddyCardProps {
  match: {
    requestId: number;
    userId: string;
    name: string;
    destination: string;
    startDate?: string | Date;
    endDate?: string | Date;
    budget?: number;
    description?: string;
    compatibilityScore: number;
  };
  onContactSuccess: () => void;
}

const BuddyCard = ({ match, onContactSuccess }: BuddyCardProps) => {
  const { toast } = useToast();

  // Format dates
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const startDateStr = formatDate(match.startDate);
  const endDateStr = formatDate(match.endDate);
  const dateRange = startDateStr && endDateStr ? `${startDateStr}-${endDateStr}` : '';

  // Handle contact request
  const handleContact = async () => {
    try {
      // Accept match
      await apiRequest('POST', '/api/poputchik/accept', {
        requestId: match.requestId
      });
      
      toast({
        title: "Контакт установлен",
        description: `Вы установили контакт с ${match.name}. Проверьте сообщения в Telegram`,
      });
      
      onContactSuccess();
    } catch (error) {
      console.error('Error contacting buddy:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось установить контакт",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-md p-4 mb-4 flex">
      <div className="flex-shrink-0 mr-3">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-telegram-lightgray text-xl font-medium">
            {match.name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h3 className="font-medium">{match.name}</h3>
          <div className="flex items-center bg-green-100 text-status-success px-2 py-1 rounded text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            <span>{match.compatibilityScore}% совпадение</span>
          </div>
        </div>
        
        <div className="flex flex-wrap text-sm text-telegram-midgray mt-1 mb-2">
          <div className="mr-4 mb-1 flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            <span>{match.destination}</span>
          </div>
          {dateRange && (
            <div className="mr-4 mb-1 flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              <span>{dateRange}</span>
            </div>
          )}
        </div>
        
        {match.description && (
          <p className="text-sm text-telegram-midgray mb-3">{match.description}</p>
        )}
        
        <Button 
          className="bg-telegram-blue hover:bg-blue-600 text-white"
          onClick={handleContact}
        >
          Связаться
        </Button>
      </div>
    </Card>
  );
};

export default BuddyCard;
