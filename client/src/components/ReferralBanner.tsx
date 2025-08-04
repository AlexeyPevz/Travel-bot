import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getTelegramUser } from '@/lib/telegramWebApp';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Copy, Check, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ReferralBanner = () => {
  const { toast } = useToast();
  const telegramUser = getTelegramUser();
  const userId = telegramUser?.id.toString();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Fetch referral data
  const { data: referralData, isLoading } = useQuery({
    queryKey: userId ? [`/api/referrals/${userId}`] : null,
    enabled: !!userId && isDialogOpen,
  });

  // Generate referral link
  const botUsername = 'AITourAgentBot'; // Replace with actual bot username
  const referralLink = userId ? `https://t.me/${botUsername}?start=ref_${userId}` : '';

  // Handle copy to clipboard
  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setIsCopied(true);
      
      toast({
        title: "Ссылка скопирована",
        description: "Реферальная ссылка скопирована в буфер обмена"
      });
      
      setTimeout(() => {
        setIsCopied(false);
      }, 3000);
    }
  };

  // Handle share
  const handleShare = () => {
    if (navigator.share && referralLink) {
      navigator.share({
        title: 'AI-турагент',
        text: 'Регистрируйся в AI-турагенте по моей ссылке и получи бонус 500 ₽! 🏝️',
        url: referralLink
      }).catch(err => {
        console.error('Error sharing:', err);
      });
    } else {
      handleCopy();
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white border-t border-gray-200 p-3 flex justify-between items-center z-10">
        <div className="flex-1">
          <div className="text-sm font-medium">Пригласите друзей</div>
          <div className="text-xs text-telegram-midgray">Получите скидку 500 ₽ за каждого</div>
        </div>
        <Button 
          className="bg-telegram-blue text-white text-sm"
          onClick={() => setIsDialogOpen(true)}
        >
          Пригласить
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Пригласите друзей</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <UserPlus className="w-16 h-16 text-telegram-blue mx-auto mb-2" />
              <p className="text-telegram-midgray">
                Поделитесь ссылкой с друзьями и получите бонус 500 ₽ за каждого приглашенного пользователя
              </p>
            </div>
            
            <div className="flex">
              <div className="flex-1 border border-r-0 rounded-l-md p-2 bg-gray-50 truncate overflow-hidden">
                <span className="text-sm">{referralLink}</span>
              </div>
              <Button
                variant="outline"
                className={`rounded-l-none ${isCopied ? 'bg-green-100 border-green-200' : ''}`}
                onClick={handleCopy}
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="w-6 h-6 text-telegram-blue animate-spin" />
              </div>
            ) : referralData && referralData.stats ? (
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm font-medium mb-2">Ваша статистика:</p>
                <p className="text-sm flex justify-between">
                  <span>Приглашено друзей:</span>
                  <span className="font-medium">{referralData.stats.count}</span>
                </p>
                <p className="text-sm flex justify-between">
                  <span>Общий бонус:</span>
                  <span className="font-medium">{referralData.stats.totalBonus} ₽</span>
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <Button 
              className="w-full bg-telegram-blue text-white"
              onClick={handleShare}
            >
              Поделиться ссылкой
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReferralBanner;
