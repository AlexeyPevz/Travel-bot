import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tour } from '@shared/schema';
import { MapPin, Star, Calendar, Utensils, Heart, ThumbsUp } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser } from '@/lib/telegramWebApp';

interface TourCardProps {
  tour: Tour;
  onSelect: () => void;
}

const TourCard = ({ tour, onSelect }: TourCardProps) => {
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();

  // Format dates
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const startDateStr = formatDate(tour.startDate);
  const endDateStr = formatDate(tour.endDate);
  const dateRange = startDateStr && endDateStr ? `${startDateStr}-${endDateStr}` : '';

  // Handle booking
  const handleBooking = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!userId) {
      toast({
        title: "Ошибка",
        description: "Для бронирования необходимо авторизоваться",
        variant: "destructive"
      });
      return;
    }
    
    // Open booking link in new tab
    if (tour.link) {
      window.open(tour.link, '_blank');
      
      // Record booking in database
      apiRequest('POST', '/api/booking', {
        userId,
        tourId: tour.id,
        price: tour.price,
        status: 'pending'
      }).catch((error) => {
        console.error('Error recording booking:', error);
      });
    }
  };

  // Handle save to watchlist
  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!userId) {
      toast({
        title: "Ошибка",
        description: "Для сохранения необходимо авторизоваться",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Тур сохранен",
      description: "Тур добавлен в список желаний"
    });
  };

  return (
    <Card className="bg-white rounded-lg shadow-md overflow-hidden mb-4 hover:shadow-lg transition-shadow duration-200 cursor-pointer" onClick={onSelect}>
      {/* Улучшаем отображение изображений с более надежной обработкой ошибок */}
      <div className="relative w-full h-48 bg-gray-200 overflow-hidden">
        {tour.image ? (
          <img 
            src={tour.image} 
            alt={tour.title} 
            className="w-full h-full object-cover transition-opacity duration-300"
            onError={(e) => {
              console.log(`Ошибка загрузки изображения: ${tour.image}`);
              // При ошибке загрузки заменяем на резервное изображение
              e.currentTarget.onerror = null; // Предотвращаем бесконечную рекурсию
              
              // Проверяем, если ссылка начинается с http:// (без s), меняем на https://
              if (tour.image?.startsWith('http://')) {
                console.log(`Преобразование http в https: ${tour.image}`);
                e.currentTarget.src = tour.image.replace('http://', 'https://');
                return;
              }
              
              // Используем предвычисленное значение для запроса, избегая проблем с кодировкой
              const destQuery = encodeURIComponent(tour.destination).replace(/%20/g, '+');
              const hotelQuery = encodeURIComponent(tour.hotel).replace(/%20/g, '+');
              
              // Добавляем случайность в URL, чтобы избежать кэширования браузером
              const randomSeed = Math.floor(Math.random() * 1000);
              console.log(`Использование запасного изображения Unsplash для ${tour.hotel}`);
              
              // Настраиваем запасное изображение с параметрами отеля и направления
              e.currentTarget.src = `https://source.unsplash.com/random/800x600?hotel,resort,${destQuery},${hotelQuery}&sig=${randomSeed}`;
            }}
            loading="lazy" // Добавляем ленивую загрузку для оптимизации
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <p>Изображение недоступно</p>
          </div>
        )}
        
        {/* Добавляем градиентное затемнение снизу для лучшей читаемости текста на светлых изображениях */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent"></div>
        
        {/* Бейдж провайдера */}
        <div className="absolute top-2 right-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-md shadow-sm">
          {tour.provider}
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-medium">{tour.title}</h3>
          <div className={`flex items-center ${tour.matchScore && tour.matchScore >= 85 ? 'bg-status-success' : tour.matchScore && tour.matchScore >= 70 ? 'bg-yellow-500' : 'bg-blue-500'} text-white px-2 py-1 rounded text-xs`}>
            <Star className="w-3 h-3 mr-1" />
            <span>{tour.matchScore ? `${tour.matchScore}% соответствие` : 'Новый'}</span>
          </div>
        </div>
        
        <div className="flex items-center text-sm mb-2">
          <MapPin className="text-telegram-blue w-4 h-4 mr-1" />
          <span>{tour.destination}</span>
          <span className="mx-2">•</span>
          <Star className="text-yellow-400 w-4 h-4 mr-1" />
          <span>{tour.hotelStars || 4} звезд</span>
          {tour.rating && (
            <>
              <span className="mx-2">•</span>
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded flex items-center">
                <ThumbsUp className="w-3 h-3 mr-1" />
                {tour.rating}/5
              </span>
            </>
          )}
        </div>
        
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm flex items-center">
            <Calendar className="text-telegram-midgray w-4 h-4 mr-1" />
            <span>{tour.nights} ночей {dateRange ? `(${dateRange})` : ''}</span>
          </div>
          <div className="text-sm flex items-center">
            <Utensils className="text-telegram-midgray w-4 h-4 mr-1" />
            <span>{tour.mealType || 'Питание не указано'}</span>
          </div>
        </div>
        
        <div className="flex items-baseline justify-between mb-3">
          {tour.priceOld && tour.priceOld > tour.price && (
            <div className="text-sm text-telegram-midgray line-through">
              {tour.priceOld.toLocaleString()} ₽
            </div>
          )}
          <div className={`text-xl font-bold text-telegram-blue ${tour.priceOld ? 'ml-auto' : ''}`}>
            {tour.price.toLocaleString()} ₽
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            className="flex-1 bg-telegram-blue hover:bg-blue-600 text-white"
            onClick={onSelect}
          >
            Подробнее
          </Button>
          <Button 
            className="flex-shrink-0 bg-status-success hover:bg-green-600 text-white"
            onClick={handleBooking}
          >
            Бронировать
          </Button>
          <Button 
            variant="outline"
            className="flex-shrink-0 border border-gray-300 hover:bg-gray-100 text-telegram-darkgray p-0 w-10"
            onClick={handleSave}
          >
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TourCard;
