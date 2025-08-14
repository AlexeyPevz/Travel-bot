import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import TravelBuddyForm from '@/components/TravelBuddyForm';
import BuddyCard from '@/components/BuddyCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser, initTelegramWebApp } from '@/lib/telegramWebApp';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function TravelBuddyPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [showMatches, setShowMatches] = useState(false);

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

  // Fetch user's active poputchik requests
  const { 
    data: requestsData, 
    isLoading: isRequestsLoading, 
    refetch: refetchRequests 
  } = useQuery({
    queryKey: userId ? [`/api/poputchik/${userId}`] : null,
    enabled: !!userId,
  });

  // Fetch matches for active request
  const { 
    data: matchesData, 
    isLoading: isMatchesLoading,
    refetch: refetchMatches
  } = useQuery({
    queryKey: activeRequestId ? [`/api/poputchik-matches/${activeRequestId}`] : null,
    enabled: !!activeRequestId && showMatches,
  });

  // Handle successful request creation
  const handleRequestSuccess = () => {
    refetchRequests();
    toast({
      title: "Запрос создан",
      description: "Начинаем поиск попутчиков, подходящих по вашим параметрам",
    });
  };

  // Handle viewing matches
  const handleViewMatches = (requestId: number) => {
    setActiveRequestId(requestId);
    setShowMatches(true);
  };

  // Handle back to form
  const handleBackToForm = () => {
    setShowMatches(false);
  };

  // Handle successful contact
  const handleContactSuccess = () => {
    refetchMatches();
  };

  // Show loading state
  if (isProfileLoading) {
    return (
      <div className="min-h-screen bg-telegram-light">
        <Header title="Поиск попутчиков" showBackButton={true} />
        
        <main className="p-4">
          <div className="py-6 flex justify-center">
            <Loader2 className="w-8 h-8 text-telegram-blue animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  // Check for active requests
  const requests = requestsData?.requests || [];
  const hasActiveRequests = requests.length > 0;
  
  // Check for matches
  const matches = matchesData?.matches || [];
  const hasMatches = matches.length > 0;

  return (
    <div className="min-h-screen bg-telegram-light pb-16">
      <Header title="Поиск попутчиков" showBackButton={true} />

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Поиск попутчиков</h2>
          {showMatches && (
            <Button 
              variant="ghost"
              size="sm"
              className="text-telegram-blue text-sm flex items-center"
              onClick={handleBackToForm}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              К запросам
            </Button>
          )}
        </div>

        {!showMatches && (
          <>
            {hasActiveRequests && (
              <div className="mb-6">
                <h3 className="text-base font-medium mb-3">Ваши активные запросы</h3>
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="bg-white rounded-lg shadow-md p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{request.destination}</h4>
                        <span className="text-status-success text-sm">Активный</span>
                      </div>
                      <div className="text-sm text-telegram-midgray mb-3">
                        {request.description || 'Без описания'}
                      </div>
                      <Button 
                        onClick={() => handleViewMatches(request.id)}
                        className="w-full bg-telegram-blue text-white"
                      >
                        Просмотреть совпадения
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <TravelBuddyForm 
              userId={userId || ""} 
              onSuccess={handleRequestSuccess} 
            />
          </>
        )}

        {showMatches && (
          <div>
            <h3 className="font-medium mb-3">Подходящие попутчики</h3>
            
            {isMatchesLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-8 h-8 text-telegram-blue animate-spin" />
              </div>
            ) : hasMatches ? (
              <div className="space-y-4">
                {matches.map((match) => (
                  <BuddyCard 
                    key={match.requestId} 
                    match={match} 
                    onContactSuccess={handleContactSuccess}
                  />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-telegram-midgray">Пока не найдено подходящих попутчиков</p>
                <p className="text-sm text-telegram-midgray mt-2">Мы сообщим, когда найдутся совпадения</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
