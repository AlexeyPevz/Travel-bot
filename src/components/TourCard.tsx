import React, { useState } from 'react';
import { MiniAppTourCard, MiniAppTourOption } from '../../server/types/miniapp';
import { formatPrice } from '../utils/format';

interface TourCardProps {
  tour: MiniAppTourCard;
  onSelect?: (tour: MiniAppTourCard, option: MiniAppTourOption) => void;
  onCompare?: (tour: MiniAppTourCard) => void;
  isComparing?: boolean;
}

export function TourCard({ tour, onSelect, onCompare, isComparing }: TourCardProps) {
  const [selectedOption, setSelectedOption] = useState<string>(
    tour.recommended?.id || tour.bestPrice?.id || tour.options[0].id
  );
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const currentOption = tour.options.find(opt => opt.id === selectedOption) || tour.options[0];
  const hasMultipleOptions = tour.options.length > 1;
  const hasDiscount = currentOption.priceOld && currentOption.priceOld > currentOption.price;
  const discountPercent = hasDiscount 
    ? Math.round((1 - currentOption.price / currentOption.priceOld!) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      {/* Изображение отеля с навигацией */}
      <div className="relative h-64 group">
        <img
          src={tour.hotel.images[imageIndex]?.large || '/placeholder-hotel.jpg'}
          alt={tour.hotel.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-hotel.jpg';
          }}
        />
        
        {/* Бейджи */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {tour.badges?.map((badge, idx) => (
            <span
              key={idx}
              className="px-3 py-1 text-xs font-semibold text-white rounded-full"
              style={{ backgroundColor: badge.color || '#333' }}
            >
              {badge.text}
            </span>
          ))}
        </div>

        {/* Навигация по изображениям */}
        {tour.hotel.images.length > 1 && (
          <>
            <button
              onClick={() => setImageIndex((prev) => 
                prev === 0 ? tour.hotel.images.length - 1 : prev - 1
              )}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setImageIndex((prev) => 
                (prev + 1) % tour.hotel.images.length
              )}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {tour.hotel.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === imageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Кнопка добавления в сравнение */}
        {onCompare && (
          <button
            onClick={() => onCompare(tour)}
            className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
              isComparing 
                ? 'bg-blue-500 text-white' 
                : 'bg-white/80 text-gray-700 hover:bg-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
              />
            </svg>
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Заголовок и рейтинг */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {tour.hotel.name}
            </h3>
            <div className="flex items-center gap-3">
              {/* Звезды */}
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${
                      i < tour.hotel.stars ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              
              {/* Рейтинг */}
              {tour.hotel.rating.overall > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-green-600">
                    {tour.hotel.rating.overall.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({tour.hotel.reviews.count} отзывов)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Локация и особенности */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
            {tour.hotel.location.city}, {tour.hotel.location.country}
          </div>
          
          {/* Ключевые особенности */}
          <div className="flex flex-wrap gap-2">
            {tour.hotel.description.highlights?.slice(0, 3).map((highlight, idx) => (
              <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {highlight}
              </span>
            ))}
          </div>
        </div>

        {/* Варианты туров */}
        <div className="border-t pt-4">
          {/* Выбор провайдера если их несколько */}
          {hasMultipleOptions && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  Доступно вариантов: {tour.options.length}
                </span>
                <button
                  onClick={() => setShowAllOptions(!showAllOptions)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showAllOptions ? 'Скрыть' : 'Показать все'}
                </button>
              </div>
              
              {showAllOptions && (
                <div className="space-y-2 mb-3">
                  {tour.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedOption(option.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedOption === option.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm font-medium">{option.provider}</span>
                          {option.id === tour.bestPrice?.id && (
                            <span className="ml-2 text-xs text-green-600 font-semibold">
                              Лучшая цена
                            </span>
                          )}
                          {option.id === tour.recommended?.id && (
                            <span className="ml-2 text-xs text-blue-600 font-semibold">
                              Рекомендуем
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {option.priceOld && (
                            <span className="text-sm text-gray-400 line-through">
                              {formatPrice(option.priceOld)}
                            </span>
                          )}
                          <span className="ml-2 text-lg font-bold text-gray-900">
                            {formatPrice(option.price)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {option.meal.name} • {option.nights} ночей
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Информация о выбранном варианте */}
          <div className="space-y-3">
            {/* Даты и продолжительность */}
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
              {new Date(currentOption.startDate).toLocaleDateString('ru-RU')} - 
              {new Date(currentOption.endDate).toLocaleDateString('ru-RU')} 
              ({currentOption.nights} ночей)
            </div>

            {/* Тип питания и номера */}
            <div className="flex gap-4 text-sm">
              <span className="text-gray-600">
                <span className="font-medium">{currentOption.meal.name}</span>
              </span>
              <span className="text-gray-600">
                <span className="font-medium">{currentOption.room.name}</span>
              </span>
            </div>

            {/* Цена */}
            <div className="flex items-center justify-between">
              <div>
                {hasDiscount && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg text-gray-400 line-through">
                      {formatPrice(currentOption.priceOld!)}
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      -{discountPercent}%
                    </span>
                  </div>
                )}
                <div className="text-2xl font-bold text-gray-900">
                  {formatPrice(currentOption.price)}
                </div>
                <div className="text-sm text-gray-500">
                  за {currentOption.nights} ночей на двоих
                </div>
              </div>

              <button
                onClick={() => onSelect?.(tour, currentOption)}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Подробнее
              </button>
            </div>

            {/* Что включено */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {currentOption.priceIncludes.map((item, idx) => (
                <span key={idx} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                  ✓ {item}
                </span>
              ))}
              {currentOption.instantConfirm && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  ⚡ Моментальное подтверждение
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}