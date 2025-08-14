import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import GroupCard from '@/components/GroupCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getTelegramUser, initTelegramWebApp } from '@/lib/telegramWebApp';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Info, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function GroupsPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

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

  // Fetch user groups
  const { 
    data: groupsData, 
    isLoading: isGroupsLoading, 
    isError: isGroupsError,
    error: groupsError,
    refetch: refetchGroups
  } = useQuery({
    queryKey: userId ? [`/api/groups/${userId}`] : null,
    enabled: !!userId,
  });

  // Handle error
  useEffect(() => {
    if (isGroupsError) {
      toast({
        title: "Ошибка загрузки групп",
        description: groupsError?.message || "Не удалось загрузить данные групп",
        variant: "destructive"
      });
    }
  }, [isGroupsError, groupsError, toast]);

  // Handle start group
  const handleStartGroup = () => {
    toast({
      title: "Создание группы",
      description: "Для создания группы добавьте бота в групповой чат и используйте команду /groupsetup",
    });
  };

  // Handle invite to group
  const handleInviteToGroup = (chatId: string) => {
    // Create invite link for the bot
    setInviteUrl(`https://t.me/AITourAgentBot?startgroup=${chatId}`);
    setIsDialogOpen(true);
  };

  // Handle copy invite link
  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Ссылка скопирована",
      description: "Ссылка-приглашение скопирована в буфер обмена"
    });
    setIsDialogOpen(false);
  };

  // Show loading state
  if (isProfileLoading || isGroupsLoading) {
    return (
      <div className="min-h-screen bg-telegram-light">
        <Header title="Групповые поездки" showBackButton={true} />
        <Navigation activeTab="groups" />
        
        <main className="p-4">
          <div className="py-6 flex justify-center">
            <Loader2 className="w-8 h-8 text-telegram-blue animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  // Get groups list
  const groups = groupsData?.groups || [];
  const hasGroups = groups.length > 0;

  return (
    <div className="min-h-screen bg-telegram-light pb-16">
      <Header title="Групповые поездки" showBackButton={true} />
      <Navigation activeTab="groups" />

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Групповые поездки</h2>
          <Button 
            className="text-sm bg-telegram-blue text-white py-2 px-3 rounded-lg flex items-center"
            onClick={handleStartGroup}
          >
            <Plus className="h-4 w-4 mr-1" />
            Создать
          </Button>
        </div>

        {hasGroups && (
          <div className="mb-6">
            {groups.map((group) => (
              <GroupCard 
                key={group.id} 
                group={group} 
                onInvite={handleInviteToGroup} 
              />
            ))}
          </div>
        )}

        {/* How to Create Group Info Card */}
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <h3 className="text-telegram-blue font-medium mb-2">Как создать групповую поездку?</h3>
            <ol className="list-decimal ml-5 text-sm text-telegram-midgray space-y-2">
              <li>Добавьте бота @AITourAgent в групповой чат</li>
              <li>Отправьте команду /groupsetup</li>
              <li>Каждый участник заполнит свою анкету</li>
              <li>Бот создаст общий профиль и будет искать подходящие туры для всей компании</li>
            </ol>
          </CardContent>
        </Card>

        {/* Invite Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Пригласить в группу</DialogTitle>
            </DialogHeader>
            <div className="flex items-center space-x-2">
              <Input
                value={inviteUrl}
                readOnly
                className="flex-1"
              />
              <Button onClick={handleCopyInvite}>
                Копировать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
