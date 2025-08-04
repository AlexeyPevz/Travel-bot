import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import WatchlistCard from '@/components/WatchlistCard';
import WatchlistForm from '@/components/WatchlistForm';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser, initTelegramWebApp } from '@/lib/telegramWebApp';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Heart, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Watchlist } from '@shared/schema';

export default function WatchlistPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);

  // Initialize Telegram WebApp
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Check if user has a profile
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: userId ? [`/api/profile/${userId}`] : null,
    enabled: !!userId,
  });

  // Redirect to profile page if no profile
  useEffect(() => {
    if (!isProfileLoading && !profile && userId) {
      navigate('/profile');
    }
  }, [isProfileLoading, profile, userId, navigate]);

  // Fetch watchlists
  const { 
    data: watchlistsData, 
    isLoading: isWatchlistsLoading, 
    isError: isWatchlistsError,
    error: watchlistsError,
    refetch: refetchWatchlists
  } = useQuery({
    queryKey: userId ? [`/api/watchlists/${userId}`] : null,
    enabled: !!userId,
  });

  // Handle error
  useEffect(() => {
    if (isWatchlistsError) {
      toast({
        title: "Ошибка загрузки желаний",
        description: watchlistsError?.message || "Не удалось загрузить список желаний",
        variant: "destructive"
      });
    }
  }, [isWatchlistsError, watchlistsError, toast]);

  // Handle add watchlist
  const handleAddWatchlist = () => {
    setEditingWatchlist(null);
    setIsFormOpen(true);
  };

  // Handle edit watchlist
  const handleEditWatchlist = (watchlist: Watchlist) => {
    setEditingWatchlist(watchlist);
    setIsFormOpen(true);
  };

  // Handle form success
  const handleFormSuccess = () => {
    setIsFormOpen(false);
    refetchWatchlists();
    toast({
      title: editingWatchlist ? "Желание обновлено" : "Желание добавлено",
      description: editingWatchlist ? "Ваше желание успешно обновлено" : "Ваше желание успешно добавлено",
    });
  };

  // Show loading state
  if (isProfileLoading || isWatchlistsLoading) {
    return (
      <div className="min-h-screen bg-telegram-light">
        <Header title="Мои желания" showBackButton={true} />
        <Navigation activeTab="watchlist" />
        
        <main className="p-4">
          <div className="py-6 flex justify-center">
            <Loader2 className="w-8 h-8 text-telegram-blue animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  // Check if there are watchlists
  const watchlists = watchlistsData?.watchlists || [];
  const hasWatchlists = watchlists.length > 0;

  return (
    <div className="min-h-screen bg-telegram-light pb-16">
      <Header title="Мои желания" showBackButton={true} />
      <Navigation activeTab="watchlist" />

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Мои желания</h2>
          <Button 
            onClick={handleAddWatchlist}
            className="text-sm bg-telegram-blue text-white py-2 px-3 rounded-lg flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>

        {!hasWatchlists && (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-full mb-4">
              <Heart className="h-8 w-8 text-telegram-lightgray" />
            </div>
            <h3 className="text-lg font-medium mb-2">У вас пока нет желаний</h3>
            <p className="text-telegram-midgray mb-4">Добавьте страны и направления, о которых вы мечтаете, и мы будем следить за выгодными предложениями</p>
            <Button 
              onClick={handleAddWatchlist}
              className="bg-telegram-blue hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition duration-200"
            >
              Добавить желание
            </Button>
          </div>
        )}

        {hasWatchlists && (
          <div className="space-y-4">
            {watchlists.map((watchlist: Watchlist) => (
              <WatchlistCard 
                key={watchlist.id} 
                watchlist={watchlist} 
                onEdit={() => handleEditWatchlist(watchlist)}
                onRefresh={refetchWatchlists}
              />
            ))}
          </div>
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingWatchlist ? "Редактировать желание" : "Добавить новое желание"}
              </DialogTitle>
            </DialogHeader>
            <WatchlistForm 
              userId={userId || ""}
              existingWatchlist={editingWatchlist}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
