import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';
import { closeTelegramWebApp } from '@/lib/telegramWebApp';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

const Header = ({ title, showBackButton = true, onBackClick }: HeaderProps) => {
  const [_, navigate] = useLocation();

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate('/');
    }
  };

  const handleClose = () => {
    closeTelegramWebApp();
  };

  return (
    <header className="bg-telegram-blue text-white p-4 flex items-center sticky top-0 z-10">
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 text-white hover:bg-blue-600"
          onClick={handleBack}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="text-xl font-medium flex-1 text-center">{title}</h1>
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:bg-blue-600"
        onClick={handleClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </Button>
    </header>
  );
};

export default Header;
