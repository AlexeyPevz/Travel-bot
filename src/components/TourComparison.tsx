import React from 'react';
import { MiniAppTourCard, MiniAppTourOption } from '../../server/types/miniapp';
import { formatPrice, formatMealType, formatDate } from '../utils/format';

interface TourComparisonProps {
  tours: MiniAppTourCard[];
  onClose: () => void;
  onSelect: (tour: MiniAppTourCard, option: MiniAppTourOption) => void;
}

export function TourComparison({ tours, onClose, onSelect }: TourComparisonProps) {
  if (tours.length === 0) return null;

  // Собираем все уникальные характеристики для сравнения
  const allProviders = new Set<string>();
  const allMealTypes = new Set<string>();
  const allFeatures = new Set<string>();
  
  tours.forEach(tour => {
    tour.options.forEach(option => {
      allProviders.add(option.provider);
      allMealTypes.add(option.meal.code);
    });
    
    // Собираем особенности отелей
    if (tour.hotel.features.wifi) allFeatures.add('wifi');
    if (tour.hotel.features.pool) allFeatures.add('pool');
    if (tour.hotel.features.beach.firstLine) allFeatures.add('beachFirstLine');
    if (tour.hotel.features.kidsClub) allFeatures.add('kidsClub');
    if (tour.hotel.features.fitness) allFeatures.add('fitness');
    if (tour.hotel.features.spa) allFeatures.add('spa');
  });

  const featureNames: Record<string, string> = {
    'wifi': 'Wi-Fi',
    'pool': 'Бассейн',
    'beachFirstLine': 'Первая линия',
    'kidsClub': 'Детский клуб',
    'fitness': 'Фитнес',
    'spa': 'СПА'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Сравнение туров ({tours.length})</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Содержимое */}
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-700 w-48">Характеристики</th>
                  {tours.map((tour, idx) => (
                    <th key={idx} className="p-4 text-left">
                      <div className="space-y-2">
                        <img
                          src={tour.hotel.images[0]?.medium || '/placeholder-hotel.jpg'}
                          alt={tour.hotel.name}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <h3 className="font-semibold text-lg">{tour.hotel.name}</h3>
                        <div className="flex items-center gap-2">
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
                          {tour.hotel.rating.overall > 0 && (
                            <span className="text-sm font-medium text-green-600">
                              {tour.hotel.rating.overall.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Локация */}
                <tr className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-700">Расположение</td>
                  {tours.map((tour, idx) => (
                    <td key={idx} className="p-4">
                      <div className="space-y-1">
                        <p>{tour.hotel.location.city}, {tour.hotel.location.country}</p>
                        {tour.hotel.location.distances.beach && (
                          <p className="text-sm text-gray-500">
                            {tour.hotel.location.distances.beach}м до пляжа
                          </p>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Цены */}
                <tr className="hover:bg-gray-50 bg-blue-50">
                  <td className="p-4 font-medium text-gray-700">Цена (от)</td>
                  {tours.map((tour, idx) => (
                    <td key={idx} className="p-4">
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatPrice(tour.priceRange.min)}
                        </div>
                        {tour.priceRange.min !== tour.priceRange.max && (
                          <p className="text-sm text-gray-500">
                            до {formatPrice(tour.priceRange.max)}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Вариантов: {tour.options.length}
                        </p>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Питание */}
                <tr className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-700">Типы питания</td>
                  {tours.map((tour, idx) => {
                    const mealTypes = [...new Set(tour.options.map(opt => opt.meal.code))];
                    return (
                      <td key={idx} className="p-4">
                        <div className="space-y-1">
                          {mealTypes.map(meal => (
                            <span key={meal} className="block text-sm">
                              {formatMealType(meal)}
                            </span>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Даты */}
                <tr className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-700">Даты вылета</td>
                  {tours.map((tour, idx) => {
                    const dates = [...new Set(tour.options.map(opt => 
                      new Date(opt.startDate).toLocaleDateString('ru-RU')
                    ))].slice(0, 3);
                    return (
                      <td key={idx} className="p-4">
                        <div className="space-y-1">
                          {dates.map(date => (
                            <span key={date} className="block text-sm">{date}</span>
                          ))}
                          {tour.options.length > 3 && (
                            <span className="text-sm text-gray-500">
                              и еще {tour.options.length - 3}...
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Удобства */}
                <tr className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-700">Удобства</td>
                  {tours.map((tour, idx) => (
                    <td key={idx} className="p-4">
                      <div className="space-y-2">
                        {Array.from(allFeatures).map(feature => {
                          let hasFeature = false;
                          switch(feature) {
                            case 'wifi': hasFeature = !!tour.hotel.features.wifi; break;
                            case 'pool': hasFeature = !!tour.hotel.features.pool; break;
                            case 'beachFirstLine': hasFeature = tour.hotel.features.beach.firstLine; break;
                            case 'kidsClub': hasFeature = !!tour.hotel.features.kidsClub; break;
                            case 'fitness': hasFeature = !!tour.hotel.features.fitness; break;
                            case 'spa': hasFeature = !!tour.hotel.features.spa; break;
                          }
                          
                          return (
                            <div key={feature} className="flex items-center gap-2">
                              {hasFeature ? (
                                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              <span className="text-sm">{featureNames[feature]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Особенности */}
                <tr className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-700">Особенности</td>
                  {tours.map((tour, idx) => (
                    <td key={idx} className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {tour.hotel.description.highlights?.map((highlight, hidx) => (
                          <span key={hidx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Теги */}
                <tr className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-700">Категории</td>
                  {tours.map((tour, idx) => (
                    <td key={idx} className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {tour.hotel.tags?.map((tag, tidx) => (
                          <span key={tidx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Действия */}
                <tr>
                  <td className="p-4"></td>
                  {tours.map((tour, idx) => (
                    <td key={idx} className="p-4">
                      <button
                        onClick={() => onSelect(tour, tour.bestPrice || tour.options[0])}
                        className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Выбрать этот отель
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}