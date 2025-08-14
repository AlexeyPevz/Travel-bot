import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import TourCard from '@/components/TourCard';
import TourDetails from '@/components/TourDetails';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser, initTelegramWebApp } from '@/lib/telegramWebApp';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, RefreshCw, Filter, ArrowDown, SortDesc, Star, DollarSign, HotelIcon, Trophy } from 'lucide-react';
import { Tour } from '@shared/schema';

export default function ToursPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();
  const [selectedTourId, setSelectedTourId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Sorting state
  type SortOption = 'match' | 'price' | 'stars' | 'rating';
  const [sortBy, setSortBy] = useState<SortOption>('match');
  
  // Sort options with labels and icons
  const sortOptions = [
    { value: 'match', label: 'По соответствию', icon: Trophy },
    { value: 'price', label: 'По цене', icon: DollarSign },
    { value: 'stars', label: 'По звездам', icon: Star },
    { value: 'rating', label: 'По рейтингу', icon: HotelIcon },
  ];

  // Initialize Telegram WebApp
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Check if user has a profile
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: userId ? [`/api/v1/profile/${userId}`] : null,
    enabled: !!userId,
  });

  // Redirect to profile page if no profile
  useEffect(() => {
    if (!isProfileLoading && !profile && userId) {
      navigate('/profile');
    }
  }, [isProfileLoading, profile, userId, navigate]);

  // Fetch tours
  const { 
    data: toursData, 
    isLoading: isToursLoading, 
    isError: isToursError,
    error: toursError,
    refetch: refetchTours
  } = useQuery({
    queryKey: userId ? [`/api/tours?userId=${userId}&sortBy=${sortBy}`] : null,
    enabled: !!userId && !!profile,
  });

  // Handle error
  useEffect(() => {
    if (isToursError) {
      const errorData = (toursError as any)?.response?.data || {};
      const errorMessage = errorData.message || toursError?.message || "Не удалось загрузить данные туров";
      const provider = errorData.provider || "неизвестный провайдер";
      
      toast({
        title: "Ошибка загрузки туров",
        description: `${errorMessage} (${provider})`,
        variant: "destructive"
      });
    }
  }, [isToursError, toursError, toast]);

  // Handle refresh
  const handleRefresh = () => {
    refetchTours();
    toast({
      title: "Обновление туров",
      description: "Список туров обновляется...",
    });
  };

  // Handle tour selection
  const handleTourSelect = (tourId: number) => {
    setSelectedTourId(tourId);
    setIsDetailsOpen(true);
  };

  // Handle close details
  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
  };

  // Handle find travel buddy
  const handleFindTravelBuddy = () => {
    navigate('/travel-buddy');
  };

  // Show loading state
  if (isProfileLoading || (isToursLoading && !toursData)) {
    return (
      <div className="min-h-screen bg-telegram-light">
        <Header title="Подборка туров" showBackButton={true} />
        <Navigation activeTab="tours" />
        
        <main className="p-4">
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-telegram-blue animate-spin mb-4" />
            <p className="text-telegram-midgray">Подбираем лучшие туры по вашим предпочтениям...</p>
          </div>
        </main>
      </div>
    );
  }

  // Check if there are tours
  const tours = toursData?.tours || [];
  const hasTours = tours.length > 0;

  return (
    <div className="min-h-screen bg-telegram-light pb-16">
      <Header title="Подборка туров" showBackButton={true} />
      <Navigation activeTab="tours" />

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Подборка туров</h2>
          <div className="flex space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline"
                  size="sm"
                  className="text-telegram-blue text-sm flex items-center"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  {sortOptions.find(opt => opt.value === sortBy)?.label || 'Сортировка'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {sortOptions.map((option) => (
                  <DropdownMenuItem 
                    key={option.value} 
                    onClick={() => setSortBy(option.value as SortOption)}
                    className={sortBy === option.value ? "bg-blue-50" : ""}
                  >
                    <option.icon className="h-4 w-4 mr-2" />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="ghost"
              size="sm"
              className="text-telegram-blue text-sm flex items-center"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Обновить
            </Button>
          </div>
        </div>

        {isToursLoading && (
          <div className="py-4 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-telegram-blue animate-spin" />
          </div>
        )}

        {!isToursLoading && !hasTours && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mb-4">
              <Search className="h-8 w-8 text-telegram-lightgray" />
            </div>
            <h3 className="text-lg font-medium mb-2">Не нашли подходящих туров</h3>
            <p className="text-telegram-midgray mb-4">Попробуйте изменить параметры поиска или найти попутчика для совместной поездки</p>
            <div className="flex space-x-3">
              <Button 
                className="bg-telegram-blue hover:bg-blue-600 text-white"
                onClick={() => navigate('/profile')}
              >
                Изменить запрос
              </Button>
              <Button 
                variant="outline"
                className="border-telegram-blue text-telegram-blue hover:bg-blue-50"
                onClick={handleFindTravelBuddy}
              >
                Найти попутчика
              </Button>
            </div>
          </div>
        )}

        {hasTours && (
          <div className="space-y-4">
            {tours.map((tour: Tour, index: number) => (
              <TourCard 
                key={`${tour.provider}-${tour.externalId || tour.id || index}`}
                tour={tour} 
                onSelect={() => handleTourSelect(tour.id)} 
              />
            ))}
          </div>
        )}

        {selectedTourId && (
          <TourDetails 
            isOpen={isDetailsOpen} 
            tourId={selectedTourId} 
            onClose={handleCloseDetails}
          />
        )}
      </main>
    </div>
  );
}
