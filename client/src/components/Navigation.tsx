import React from 'react';
import { useLocation } from 'wouter';
import { User, Plane, Heart, Users } from 'lucide-react';

interface NavigationProps {
  activeTab: 'home' | 'profile' | 'tours' | 'watchlist' | 'groups';
}

const Navigation = ({ activeTab }: NavigationProps) => {
  const [_, navigate] = useLocation();

  const tabs = [
    {
      id: 'profile',
      label: 'Профиль',
      icon: User,
      path: '/profile'
    },
    {
      id: 'tours',
      label: 'Туры',
      icon: Plane,
      path: '/tours'
    },
    {
      id: 'watchlist',
      label: 'Желания',
      icon: Heart,
      path: '/watchlist'
    },
    {
      id: 'groups',
      label: 'Группы',
      icon: Users,
      path: '/groups'
    }
  ];

  const handleTabChange = (path: string) => {
    navigate(path);
  };

  return (
    <nav className="flex justify-around border-b border-gray-200 bg-white">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        
        return (
          <button 
            key={tab.id}
            className={`py-3 px-4 flex flex-col items-center text-sm font-medium ${
              isActive 
                ? 'text-telegram-blue border-b-2 border-telegram-blue' 
                : 'text-telegram-lightgray'
            }`}
            onClick={() => handleTabChange(tab.path)}
          >
            <Icon className={`mb-1 h-5 w-5 ${isActive ? 'text-telegram-blue' : 'text-telegram-lightgray'}`} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;
