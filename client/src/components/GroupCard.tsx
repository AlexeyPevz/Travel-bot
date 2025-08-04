import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, MapPin, CheckCircle, UserPlus } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface GroupPriorities {
  hotelStars?: number;
  beachLine?: number;
  allInclusive?: number;
  reviews?: number;
  renovation?: number;
  animation?: number;
}

interface GroupCardProps {
  group: {
    id: number;
    chatId: string;
    name: string;
    members: string[];
    destination?: string;
    priorities?: GroupPriorities;
    active?: boolean;
  };
  onInvite: (chatId: string) => void;
}

const GroupCard = ({ group, onInvite }: GroupCardProps) => {
  const { toast } = useToast();
  const [_, navigate] = useLocation();

  // Handle open group
  const handleOpenGroup = () => {
    navigate(`/groups/${group.chatId}`);
  };

  // Handle invite
  const handleInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInvite(group.chatId);
  };

  // Map priorities to labels if priorities exist
  const getPriorityLabels = () => {
    if (!group.priorities) return [];
    
    const labels = [];
    
    if (group.priorities.beachLine && group.priorities.beachLine >= 7) {
      labels.push("Первая линия");
    }
    
    if (group.priorities.allInclusive && group.priorities.allInclusive >= 7) {
      labels.push("Всё включено");
    }
    
    if (group.priorities.hotelStars && group.priorities.hotelStars >= 4) {
      labels.push("4-5 звезд");
    }
    
    if (group.priorities.reviews && group.priorities.reviews >= 7) {
      labels.push("Высокие отзывы");
    }
    
    return labels;
  };

  const priorityLabels = getPriorityLabels();

  return (
    <Card className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-medium">{group.name}</h3>
          <div className="flex items-center text-status-success text-sm">
            <CheckCircle className="w-4 h-4 mr-1" />
            <span>Активный</span>
          </div>
        </div>
        
        <div className="flex items-center text-sm mb-3">
          <Users className="text-telegram-blue w-4 h-4 mr-1" />
          <span>{group.members.length} участника</span>
          
          {group.destination && (
            <>
              <span className="mx-2">•</span>
              <MapPin className="text-telegram-midgray w-4 h-4" />
              <span>{group.destination}</span>
            </>
          )}
        </div>
        
        {priorityLabels.length > 0 && (
          <div className="bg-gray-50 p-3 rounded-lg mb-3">
            <div className="text-sm text-telegram-midgray mb-2">Общие приоритеты:</div>
            <div className="flex flex-wrap gap-2">
              {priorityLabels.map((label, index) => (
                <span key={index} className="bg-gray-200 text-telegram-darkgray text-xs px-2 py-1 rounded-full">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex space-x-2">
          <Button 
            className="flex-1 bg-telegram-blue hover:bg-blue-600 text-white"
            onClick={handleOpenGroup}
          >
            Открыть
          </Button>
          <Button 
            variant="outline"
            className="flex-shrink-0 border border-gray-300 hover:bg-gray-100 text-telegram-darkgray p-0 w-10"
            onClick={handleInvite}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupCard;
