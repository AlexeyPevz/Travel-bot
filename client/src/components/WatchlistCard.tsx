import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Watchlist } from '@shared/schema';
import { Heart, Calendar, Clock, Wallet, Moon, CheckCircle, TimerOff, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface WatchlistCardProps {
  watchlist: Watchlist;
  onEdit: () => void;
  onRefresh: () => void;
}

const WatchlistCard = ({ watchlist, onEdit, onRefresh }: WatchlistCardProps) => {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  // Format dates and calculate days left
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Без срока';
    const deadlineDate = new Date(date);
    const today = new Date();
    
    // Calculate days left
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return 'Срок истек';
    }
    
    return `Осталось ${diffDays} дней`;
  };

  const deadlineInfo = watchlist.deadline ? formatDate(watchlist.deadline) : 'Без срока';
  const hasDeadlineSoon = watchlist.deadline && deadlineInfo.includes('Осталось') && 
    parseInt(deadlineInfo.split(' ')[1]) <= 7;

  // Handle activation/deactivation
  const handleStatusToggle = async () => {
    try {
      await apiRequest('PATCH', `/api/watchlist/${watchlist.id}`, {
        active: !watchlist.active
      });
      
      toast({
        title: watchlist.active ? "Желание приостановлено" : "Желание активировано",
        description: watchlist.active 
          ? "Поиск туров по этому желанию приостановлен" 
          : "Поиск туров по этому желанию активирован",
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error toggling watchlist status:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус",
        variant: "destructive"
      });
    }
  };

  // Handle activation for viewing tours
  const handleActivate = () => {
    navigate(`/tours?watchlist=${watchlist.id}`);
  };

  return (
    <Card className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-medium">{watchlist.destination}</h3>
          <div className={`flex items-center ${watchlist.active ? 'text-status-success' : 'text-telegram-midgray'} text-sm`}>
            {watchlist.active ? (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>Активный поиск</span>
              </>
            ) : (
              <>
                <TimerOff className="w-4 h-4 mr-1" />
                <span>Приостановлен</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap text-sm text-telegram-midgray mt-2 mb-3">
          <div className="mr-4 mb-1 flex items-center">
            <Wallet className="w-4 h-4 mr-1" />
            <span>{watchlist.budget ? `до ${watchlist.budget.toLocaleString()} ₽` : 'без ограничений'}</span>
          </div>
          <div className="mr-4 mb-1 flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>Когда угодно</span>
          </div>
          <div className="mr-4 mb-1 flex items-center">
            <Moon className="w-4 h-4 mr-1" />
            <span>{watchlist.tripDuration ? `${watchlist.tripDuration} ночей` : '7-10 ночей'}</span>
          </div>
        </div>
        
        {hasDeadlineSoon && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-telegram-midgray">
            <p className="flex items-center">
              <Clock className="w-4 h-4 mr-2 text-status-warning" />
              {deadlineInfo}
            </p>
          </div>
        )}
        
        <div className="flex space-x-2 mt-3">
          <Button 
            variant="outline"
            className="flex-1 border-telegram-blue text-telegram-blue hover:bg-blue-50"
            onClick={onEdit}
          >
            Изменить
          </Button>
          
          {watchlist.active ? (
            <Button 
              variant="outline"
              className="flex-1 border-red-500 text-red-500 hover:bg-red-50"
              onClick={handleStatusToggle}
            >
              Приостановить
            </Button>
          ) : (
            <Button 
              className="flex-1 bg-telegram-blue hover:bg-blue-600 text-white"
              onClick={handleActivate}
            >
              Активировать
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WatchlistCard;
