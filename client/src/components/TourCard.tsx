import React from 'react';
import { motion } from 'framer-motion';
import { Star, MapPin, Calendar, Users, Utensils, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TourCardProps {
  tour: {
    id: number;
    hotelName: string;
    country: string;
    region?: string;
    starRating: number;
    mealType: string;
    price: number;
    nights: number;
    beachLine?: number;
    roomType?: string;
    tourOperator?: string;
    link?: string;
    imageUrl?: string;
    matchScore?: number;
  };
  onVote?: () => void;
  onBook?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  index?: number;
}

const mealTypeIcons: Record<string, string> = {
  'ai': '🍽️ All Inclusive',
  'uai': '🍾 Ultra All Inclusive',
  'fb': '🍳 Полный пансион',
  'hb': '🥐 Полупансион',
  'bb': '☕ Только завтрак',
  'ro': '🏠 Без питания'
};

export default function TourCard({
  tour,
  onVote,
  onBook,
  isFavorite = false,
  onToggleFavorite,
  index = 0
}: TourCardProps) {
  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.4, 0, 0.2, 1]
      }
    },
    hover: {
      y: -5,
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      transition: {
        duration: 0.2
      }
    }
  };

  const imageVariants = {
    hover: {
      scale: 1.05,
      transition: {
        duration: 0.3
      }
    }
  };

  const heartVariants = {
    tap: {
      scale: [1, 1.3, 1],
      transition: {
        duration: 0.3
      }
    }
  };

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      layout
    >
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden">
        <motion.img
          src={tour.imageUrl || `https://source.unsplash.com/800x600/?hotel,${tour.country}`}
          alt={tour.hotelName}
          className="w-full h-full object-cover"
          variants={imageVariants}
        />
        
        {/* Match Score Badge */}
        {tour.matchScore && (
          <motion.div
            className="absolute top-3 left-3"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Badge className="bg-green-500 text-white">
              {tour.matchScore}% совпадение
            </Badge>
          </motion.div>
        )}

        {/* Favorite Button */}
        <motion.button
          className="absolute top-3 right-3 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full backdrop-blur-sm"
          whileTap="tap"
          variants={heartVariants}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.();
          }}
        >
          <Heart
            className={cn(
              "w-5 h-5 transition-colors",
              isFavorite ? "fill-red-500 text-red-500" : "text-gray-600 dark:text-gray-400"
            )}
          />
        </motion.button>

        {/* Beach Line Badge */}
        {tour.beachLine && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-blue-500 text-white">
              {tour.beachLine} линия пляжа
            </Badge>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-5">
        {/* Hotel Name & Rating */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tour.hotelName}
            </h3>
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-4 h-4",
                    i < tour.starRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 dark:text-gray-600"
                  )}
                />
              ))}
            </div>
          </div>
          {tour.tourOperator && (
            <Badge variant="outline" className="text-xs">
              {tour.tourOperator}
            </Badge>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
          <MapPin className="w-4 h-4" />
          <span>{tour.country}{tour.region ? `, ${tour.region}` : ''}</span>
        </div>

        {/* Tour Details */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {tour.nights} ночей
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Utensils className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {mealTypeIcons[tour.mealType] || tour.mealType}
            </span>
          </div>
        </div>

        {/* Room Type */}
        {tour.roomType && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tour.roomType}
          </p>
        )}

        {/* Price */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {tour.price.toLocaleString('ru-RU')} ₽
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              за {tour.nights} ночей
            </p>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {Math.round(tour.price / tour.nights).toLocaleString('ru-RU')} ₽/ночь
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {onVote && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onVote}
            >
              <Users className="w-4 h-4 mr-1" />
              Голосовать
            </Button>
          )}
          
          <Button
            size="sm"
            className="flex-1 bg-telegram-blue hover:bg-telegram-blue/90"
            onClick={onBook || (() => window.open(tour.link, '_blank'))}
          >
            Подробнее
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
