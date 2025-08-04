import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { 
  ThumbsUp, MapPin, Star, Calendar, Utensils, Plane, 
  ChevronLeft, ChevronRight, Map, Wifi, Phone, 
  Bath, Sunset, Waves, Coffee, Check, Info
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser } from '@/lib/telegramWebApp';
import { Loader2 } from 'lucide-react';

interface TourDetailsProps {
  isOpen: boolean;
  tourId: number;
  onClose: () => void;
}

const TourDetails = ({ isOpen, tourId, onClose }: TourDetailsProps) => {
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();

  // Получение основной информации о туре
  const { data: tour, isLoading, isError } = useQuery({
    queryKey: [`tour-${tourId}`],
    enabled: isOpen && !!tourId,
    queryFn: async () => {
      console.log(`НОВЫЙ КОД: Запрашиваем детали тура с ID ${tourId}`);
      try {
        const url = `/api/tour/${tourId}`;
        console.log(`Запрос к: ${url}`);
        
        const response = await fetch(url);
        console.log(`Статус ответа: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Ошибка при загрузке тура: ${response.status}`, errorText);
          throw new Error(`Ошибка загрузки данных тура (${response.status}): ${errorText}`);
        }
        
        const tourData = await response.json();
        console.log('Получены данные тура:', tourData);
        return tourData;
      } catch (error) {
        console.error("Ошибка при загрузке данных тура:", error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 1000 * 60 * 5 // Кэшировать на 5 минут
  });
  
  // Получение дополнительной информации об отеле
  const { data: hotelResponse, isLoading: isLoadingHotel } = useQuery({
    queryKey: [`hotel-details-${tour?.externalId}`],
    enabled: isOpen && !!tour?.externalId,
    queryFn: async () => {
      console.log(`Запрашиваем подробную информацию об отеле с ID ${tour.externalId}`);
      try {
        const url = `/api/hotel/${tour.externalId}`;
        console.log(`Запрос к: ${url}`);
        
        const response = await fetch(url);
        console.log(`Статус ответа: ${response.status}`);
        
        if (!response.ok) {
          console.error(`Ошибка при загрузке информации об отеле: ${response.status}`);
          return { hotel: null, source: null, success: false };
        }
        
        const responseData = await response.json();
        console.log('Получены детальные данные отеля:', responseData);
        return responseData;
      } catch (error) {
        console.error("Ошибка при загрузке данных отеля:", error);
        return { hotel: null, source: null, success: false }; // Возвращаем структуру с указанием, что данные не получены
      }
    },
    retry: 1,
    staleTime: 1000 * 60 * 5 // Кэшировать на 5 минут
  });
  
  // Выделяем данные отеля из ответа API
  const hotelDetails = hotelResponse?.hotel;
  const hotelDataSource = hotelResponse?.source;

  // Состояние для фотогалереи
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Получаем массив фотографий отеля для галереи
  const hotelPhotos = React.useMemo(() => {
    console.log("ОБНОВЛЕННАЯ ЛОГИКА ОБРАБОТКИ ФОТОГРАФИЙ v2");
    
    // Массив для URL-строк изображений
    const photoUrls: string[] = [];
    
    // Функция для извлечения URL из различных форматов
    const extractUrl = (photo: any): string | null => {
      // Если фото - это строка, возвращаем ее
      if (typeof photo === 'string') {
        return photo;
      }
      
      // Если фото - это объект с URL
      if (photo && typeof photo === 'object') {
        // Пробуем получить url из любого возможного поля
        return photo.url || photo.link || photo.full || photo.preview || null;
      }
      
      return null;
    };
    
    // Обрабатываем массив фотографий, извлекая URL
    const processPhotoArray = (photoArray: any[]): string[] => {
      return photoArray
        .map(extractUrl)
        .filter((url): url is string => !!url && url.trim() !== '');
    };
    
    // 1. Проверяем photos у отеля
    if (hotelDetails?.photos) {
      console.log(`HotelDetails.photos:`, hotelDetails.photos);
      
      // Если photos - это массив
      if (Array.isArray(hotelDetails.photos)) {
        console.log(`Найдено ${hotelDetails.photos.length} фото в поле photos`);
        const urls = processPhotoArray(hotelDetails.photos);
        photoUrls.push(...urls);
        console.log(`Извлечено ${urls.length} URL из photos`);
      } 
      // Если photos - это строка, добавляем ее
      else if (typeof hotelDetails.photos === 'string') {
        photoUrls.push(hotelDetails.photos);
        console.log(`Добавлена строка photos как URL`);
      }
    }
    
    // 2. Проверяем наличие images у отеля
    if (hotelDetails?.images) {
      // Если images - это массив
      if (Array.isArray(hotelDetails.images)) {
        console.log(`Найдено ${hotelDetails.images.length} фото в поле images`);
        const urls = processPhotoArray(hotelDetails.images);
        photoUrls.push(...urls);
        console.log(`Извлечено ${urls.length} URL из images`);
      }
      // Если images - это строка, добавляем ее
      else if (typeof hotelDetails.images === 'string') {
        photoUrls.push(hotelDetails.images);
        console.log(`Добавлена строка images как URL`);
      }
    }
    
    // 3. Добавляем основное изображение тура, если оно есть
    if (tour?.image) {
      const imageUrl = typeof tour.image === 'string' 
        ? tour.image 
        : extractUrl(tour.image);
        
      if (imageUrl && !photoUrls.includes(imageUrl)) {
        console.log(`Добавляем основное изображение тура: ${imageUrl}`);
        photoUrls.unshift(imageUrl); // Добавляем в начало для приоритета
      }
    }
    
    // 4. Если фотографий нет, ищем в raw_data
    if (photoUrls.length === 0 && hotelDetails?.raw_data) {
      if (hotelDetails.raw_data.photos && Array.isArray(hotelDetails.raw_data.photos)) {
        const urls = processPhotoArray(hotelDetails.raw_data.photos);
        photoUrls.push(...urls);
        console.log(`Извлечено ${urls.length} URL из raw_data.photos`);
      }
      
      if (hotelDetails.raw_data.images && Array.isArray(hotelDetails.raw_data.images)) {
        const urls = processPhotoArray(hotelDetails.raw_data.images);
        photoUrls.push(...urls);
        console.log(`Извлечено ${urls.length} URL из raw_data.images`);
      }
      
      if (hotelDetails.raw_data.image) {
        const url = extractUrl(hotelDetails.raw_data.image);
        if (url) {
          photoUrls.push(url);
          console.log(`Добавлено изображение из raw_data.image: ${url}`);
        }
      }
    }
    
    // 5. Удаляем дубликаты и нормализуем URL
    const uniqueUrls = Array.from(new Set(photoUrls));
    
    // Проверяем и нормализуем URL
    const validatedUrls = uniqueUrls.map(url => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('/')) {
          return `https://img.cdn.level.travel${url}`;
        } else {
          return `https://img.cdn.level.travel/${url}`;
        }
      }
      return url;
    });
    
    console.log(`Итого обработано ${validatedUrls.length} фотографий`);
    
    // 6. Если фотографий нет, используем запасной вариант
    return validatedUrls.length > 0 
      ? validatedUrls 
      : (tour?.image ? [typeof tour.image === 'string' ? tour.image : ''] : []);
  }, [hotelDetails, tour]);

  // Навигация по фотогалерее
  const goToNextPhoto = () => {
    if (hotelPhotos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % hotelPhotos.length);
    }
  };

  const goToPrevPhoto = () => {
    if (hotelPhotos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev === 0 ? hotelPhotos.length - 1 : prev - 1));
    }
  };

  // Reset scroll position when modal opens
  useEffect(() => {
    if (isOpen) {
      const dialogContent = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (dialogContent) {
        dialogContent.scrollTop = 0;
      }
      // Сбрасываем индекс фото при каждом открытии
      setCurrentPhotoIndex(0);
    }
  }, [isOpen, tourId]);

  // Handle booking
  const handleBookNow = () => {
    if (!userId || !tour) {
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
      
      toast({
        title: "Переход к бронированию",
        description: "Открываем страницу для бронирования тура"
      });
    }
  };

  // Handle adding to comparison
  const handleAddToComparison = () => {
    toast({
      title: "Добавлено к сравнению",
      description: "Тур добавлен в список для сравнения"
    });
  };

  // Format dates
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ru-RU');
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 text-telegram-blue animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isError || !tour) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ошибка загрузки</DialogTitle>
          </DialogHeader>
          <p className="text-red-500">Не удалось загрузить информацию о туре</p>
          <Button onClick={onClose}>Закрыть</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Фотогалерея */}
        <div className="relative">
          <img 
            src={hotelPhotos.length > 0 ? hotelPhotos[currentPhotoIndex] : (tour.image || `https://source.unsplash.com/featured/?hotel,resort,${tour.destination}`)}
            alt={tour.title} 
            className="w-full h-64 object-cover"
          />
          
          {/* Индикатор количества фото */}
          {hotelPhotos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
              {currentPhotoIndex + 1} / {hotelPhotos.length}
            </div>
          )}
          
          {/* Кнопки навигации по галерее */}
          {hotelPhotos.length > 1 && (
            <>
              <Button 
                variant="ghost" 
                className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1 w-8 h-8 rounded-full bg-black bg-opacity-30 hover:bg-opacity-50 text-white"
                onClick={goToPrevPhoto}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button 
                variant="ghost" 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 w-8 h-8 rounded-full bg-black bg-opacity-30 hover:bg-opacity-50 text-white"
                onClick={goToNextPhoto}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}
          
          <DialogClose className="absolute top-3 right-3 bg-black bg-opacity-50 text-white w-8 h-8 rounded-full flex items-center justify-center" />
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <DialogTitle className="text-xl font-medium p-0">{tour.title}</DialogTitle>
            <div className={`flex items-center ${tour.matchScore && tour.matchScore >= 85 ? 'bg-status-success' : tour.matchScore && tour.matchScore >= 70 ? 'bg-yellow-500' : 'bg-blue-500'} text-white px-2 py-1 rounded text-xs`}>
              <Star className="w-3 h-3 mr-1" />
              <span>{tour.matchScore ? `${tour.matchScore}% соответствие` : 'Новый'}</span>
            </div>
          </div>
          
          <div className="flex items-center text-sm mb-3">
            <MapPin className="text-telegram-blue w-4 h-4 mr-1" />
            <span>{tour.destination}</span>
            <span className="mx-2">•</span>
            <Star className="text-yellow-400 w-4 h-4" />
            <span>{tour.hotelStars || 4} звезд</span>
          </div>
          
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-2">
              <TabsTrigger value="info">Детали</TabsTrigger>
              <TabsTrigger value="about">Об отеле</TabsTrigger>
              <TabsTrigger value="services">Сервисы</TabsTrigger>
            </TabsList>
            
            {/* Вкладка с основной информацией */}
            <TabsContent value="info" className="mt-0">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-sm">
                  <div className="text-telegram-midgray mb-1">Даты</div>
                  <div className="font-medium">
                    {formatDate(tour.startDate)}-{formatDate(tour.endDate)} 
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-telegram-midgray mb-1">Ночи</div>
                  <div className="font-medium">
                    {tour.nights} {tour.nights === 1 ? 'ночь' : tour.nights < 5 ? 'ночи' : 'ночей'}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-telegram-midgray mb-1">Питание</div>
                  <div className="font-medium">
                    {tour.mealType || 'Не указано'}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-telegram-midgray mb-1">Номер</div>
                  <div className="font-medium">
                    {tour.roomType || 'Стандартный'}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-telegram-midgray mb-1">Отзывы</div>
                  <div className="font-medium flex items-center">
                    <ThumbsUp className="text-green-500 w-4 h-4 mr-1" />
                    <span>
                      {tour.rating ? `${tour.rating}/5` : 'Нет данных'}
                      {tour.metadata?.reviews ? ` (${tour.metadata.reviews} отзывов)` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-telegram-midgray mb-1">Аэропорт</div>
                  <div className="font-medium flex items-center">
                    <Plane className="w-4 h-4 mr-1" />
                    <span>
                      {tour.metadata?.airport || 'Не указан'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Отображаем дополнительную информацию из метаданных отеля, если доступна */}
              {hotelDetails?.distance_to_beach && (
                <div className="flex items-center text-sm mb-2">
                  <Waves className="text-blue-500 w-4 h-4 mr-1" />
                  <span>До пляжа: {hotelDetails.distance_to_beach}</span>
                </div>
              )}
              
              {/* Информация о перелете */}
              {tour.metadata?.flight && (
                <div className="mb-3 mt-2 bg-gray-50 p-2 rounded">
                  <div className="text-sm font-medium mb-1">Перелет:</div>
                  <div className="text-xs flex items-center">
                    <Plane className="text-telegram-blue w-3 h-3 mr-1 rotate-45" />
                    <span>Туда: {tour.metadata.flight.departure_date || 'Не указано'}</span>
                  </div>
                  <div className="text-xs flex items-center mt-1">
                    <Plane className="text-telegram-blue w-3 h-3 mr-1 -rotate-45" />
                    <span>Обратно: {tour.metadata.flight.return_date || 'Не указано'}</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-baseline justify-between mb-4 mt-3">
                {tour.priceOld && tour.priceOld > tour.price && (
                  <div className="text-sm text-telegram-midgray line-through">
                    {tour.priceOld.toLocaleString()} ₽
                  </div>
                )}
                <div className={`text-2xl font-bold text-telegram-blue ${tour.priceOld ? 'ml-auto' : ''}`}>
                  {tour.price.toLocaleString()} ₽
                </div>
              </div>
            </TabsContent>
            
            {/* Вкладка с описанием отеля */}
            <TabsContent value="about" className="mt-0">
              <div className="mb-3">
                <h4 className="font-medium mb-2">Об отеле</h4>
                <p className="text-sm text-telegram-midgray">
                  {(hotelDetails?.description || tour.description || 'Описание отеля отсутствует.')}
                </p>
              </div>
              
              {/* Расположение */}
              <div className="mb-3">
                <h4 className="font-medium mb-2 flex items-center">
                  <Map className="text-telegram-blue w-4 h-4 mr-1" />
                  Расположение
                </h4>
                <div className="space-y-2 pl-1 text-sm">
                  {hotelDetails?.address && (
                    <div className="text-telegram-midgray">
                      {hotelDetails.address}
                    </div>
                  )}
                  
                  {/* Расстояния */}
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {hotelDetails?.beachDistance && (
                      <div className="flex items-center">
                        <Waves className="text-blue-500 w-4 h-4 mr-1" />
                        <span>До пляжа: {hotelDetails.beachDistance} м</span>
                      </div>
                    )}
                    
                    {hotelDetails?.cityDistance && (
                      <div className="flex items-center">
                        <MapPin className="text-indigo-500 w-4 h-4 mr-1" />
                        <span>До центра: {hotelDetails.cityDistance} м</span>
                      </div>
                    )}
                    
                    {hotelDetails?.airportDistance && (
                      <div className="flex items-center">
                        <Plane className="text-gray-500 w-4 h-4 mr-1" />
                        <span>До аэропорта: {hotelDetails.airportDistance} м</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Информация о строительстве */}
              {(hotelDetails?.constructionYear || hotelDetails?.renovationYear) && (
                <div className="mb-3">
                  <h4 className="font-medium mb-2">Информация о здании</h4>
                  <div className="grid grid-cols-1 gap-1 pl-1 text-sm">
                    {hotelDetails.constructionYear && (
                      <div className="flex items-center">
                        <span>Год постройки: {hotelDetails.constructionYear}</span>
                      </div>
                    )}
                    {hotelDetails.renovationYear && (
                      <div className="flex items-center">
                        <span>Последняя реновация: {hotelDetails.renovationYear}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Информация о перелете */}
              {(hotelDetails?.departureAirport || hotelDetails?.arrivalAirport || hotelDetails?.airline) && (
                <div className="mb-3">
                  <h4 className="font-medium mb-2 flex items-center">
                    <Plane className="text-telegram-blue w-4 h-4 mr-1" />
                    Информация о перелете
                  </h4>
                  <div className="grid grid-cols-1 gap-1 pl-1 text-sm">
                    {hotelDetails.departureAirport && (
                      <div className="flex items-start">
                        <span>Вылет из: {hotelDetails.departureCity ? `${hotelDetails.departureCity}, ` : ''}{hotelDetails.departureAirport}</span>
                      </div>
                    )}
                    {hotelDetails.arrivalAirport && (
                      <div className="flex items-start">
                        <span>Прилет в: {hotelDetails.arrivalCity ? `${hotelDetails.arrivalCity}, ` : ''}{hotelDetails.arrivalAirport}</span>
                      </div>
                    )}
                    {hotelDetails.airline && (
                      <div className="flex items-start">
                        <span>Авиакомпания: {hotelDetails.airline}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Особенности отеля */}
              {hotelDetails?.hotelFeatures && Object.keys(hotelDetails.hotelFeatures).length > 0 && (
                <div className="mb-3">
                  <h4 className="font-medium mb-2">Особенности отеля</h4>
                  <div className="grid grid-cols-1 gap-1 pl-1">
                    {Object.entries(hotelDetails.hotelFeatures)
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start text-sm">
                          <Check className="text-green-500 w-4 h-4 mr-1 mt-0.5" />
                          <span>{key}: {value}</span>
                        </div>
                      ))
                    }
                    {Object.keys(hotelDetails.hotelFeatures).length > 6 && (
                      <div className="text-xs text-telegram-blue mt-1">
                        + еще {Object.keys(hotelDetails.hotelFeatures).length - 6} особенностей
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Достопримечательности */}
              {hotelDetails?.attractions && Array.isArray(hotelDetails.attractions) && hotelDetails.attractions.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-medium mb-2">Достопримечательности поблизости</h4>
                  <div className="grid grid-cols-1 gap-1 pl-1">
                    {hotelDetails.attractions.slice(0, 5).map((attraction, i) => (
                      <div key={i} className="flex items-start text-sm">
                        <MapPin className="text-telegram-blue w-4 h-4 mr-1 mt-0.5" />
                        <span>{attraction}</span>
                      </div>
                    ))}
                    {hotelDetails.attractions.length > 5 && (
                      <div className="text-xs text-telegram-blue mt-1">
                        + еще {hotelDetails.attractions.length - 5} мест
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Источник данных */}
              {hotelDataSource && (
                <div className="text-xs text-telegram-midgray mt-4">
                  Источник данных: {hotelDataSource}
                </div>
              )}
            </TabsContent>
            
            {/* Вкладка с сервисами отеля */}
            <TabsContent value="services" className="mt-0">
              {/* Особенности номера */}
              {hotelDetails?.roomFeatures && Object.keys(hotelDetails.roomFeatures).length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Особенности номера</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(hotelDetails.roomFeatures).map(([key, value]) => (
                      <div key={key} className="flex items-center text-sm">
                        {key === 'wifi' || key === 'internet' ? (
                          <Wifi className="text-telegram-blue w-4 h-4 mr-1" />
                        ) : key === 'aircon' || key === 'conditioner' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 w-4 h-4 mr-1"><path d="M9.7 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3.3"/><path d="M21 15.2V17a2 2 0 0 1-2 2h-3.2"/><path d="m22 22-7-7"/><path d="M8 14a5 5 0 1 1 5 5"/></svg>
                        ) : key === 'tv' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 w-4 h-4 mr-1"><path d="M16 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Z"/><path d="M10 9h4"/><path d="M13 17v-4"/><path d="M7 21h10"/></svg>
                        ) : key === 'minibar' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 w-4 h-4 mr-1"><path d="M8 4h8"/><path d="M10 4 8 20"/><path d="m14 4 2 16"/><path d="M5 20h14"/></svg>
                        ) : key === 'safe' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 w-4 h-4 mr-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="M7 7h10"/><path d="M10 16h1"/><path d="M14 16h1"/><circle cx="12" cy="12" r="2"/></svg>
                        ) : key === 'balcony' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 w-4 h-4 mr-1"><path d="M4 12h16"/><path d="M4 6h16"/><path d="M7 12v6h10v-6"/></svg>
                        ) : (
                          <Check className="text-green-500 w-4 h-4 mr-1" />
                        )}
                        <span className="capitalize">{key.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Услуги отеля */}
              <div className="mb-3">
                <h4 className="font-medium mb-2">Услуги отеля</h4>
                
                {/* Отображаем услуги отеля из разных источников */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Если есть amenities, показываем их */}
                  {hotelDetails?.amenities && Array.isArray(hotelDetails.amenities) && hotelDetails.amenities.length > 0 ? (
                    hotelDetails.amenities.map((amenity: string, index: number) => (
                      <div key={`amenity-${index}`} className="flex items-center text-sm">
                        <Check className="text-green-500 w-4 h-4 mr-1" />
                        <span>{amenity}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      {/* Показываем стандартные услуги */}
                      <div className="flex items-center text-sm">
                        <Wifi className="text-telegram-blue w-4 h-4 mr-1" />
                        <span>Wi-Fi в лобби</span>
                      </div>
                      
                      {tour.mealType && (
                        <div className="flex items-center text-sm">
                          <Coffee className="text-telegram-blue w-4 h-4 mr-1" />
                          <span>{tour.mealType}</span>
                        </div>
                      )}
                      
                      {tour.beachLine && (
                        <div className="flex items-center text-sm">
                          <Waves className="text-blue-500 w-4 h-4 mr-1" />
                          <span>{tour.beachLine}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center text-sm">
                        <Bath className="text-telegram-blue w-4 h-4 mr-1" />
                        <span>Бассейн</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Детализация отеля */}
              {hotelDataSource === 'api' && (
                <div className="mt-4 text-xs text-telegram-blue">
                  <a href={hotelDetails?.public_url || hotelDetails?.site_url || tour.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                    <span>Подробнее на сайте Level.Travel</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <Separator className="my-3" />
          
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              className="flex-1 border-telegram-blue text-telegram-blue hover:bg-blue-50"
              onClick={handleAddToComparison}
            >
              Сравнить
            </Button>
            <Button 
              className="flex-1 bg-status-success hover:bg-green-600 text-white"
              onClick={handleBookNow}
            >
              Бронировать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TourDetails;
