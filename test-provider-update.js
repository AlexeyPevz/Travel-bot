import { fetchToursFromLevelTravel } from './server/providers/leveltravel.js';
import dotenv from 'dotenv';

dotenv.config();

async function testProvider() {
  try {
    console.log('🧪 Тестируем обновленный провайдер Level.Travel...\n');
    
    const params = {
      destination: 'Турция',
      departureCity: 'Москва',
      startDate: new Date('2025-08-22'),
      endDate: new Date('2025-08-29'),
      nights: 7,
      adults: 2,
      children: 0,
      budget: 200000
    };
    
    console.log('Параметры поиска:', params);
    console.log('\n⏳ Выполняем поиск...\n');
    
    const tours = await fetchToursFromLevelTravel(params);
    
    console.log(`✅ Найдено туров: ${tours.length}\n`);
    
    if (tours.length > 0) {
      console.log('📋 Первые 3 тура:\n');
      
      tours.slice(0, 3).forEach((tour, index) => {
        console.log(`${index + 1}. ${tour.title}`);
        console.log(`   📍 ${tour.destination}`);
        console.log(`   🏨 ${tour.hotel}`);
        console.log(`   ⭐ Звезды: ${tour.hotelStars}`);
        console.log(`   💰 Цена: ${tour.price.toLocaleString('ru-RU')} ₽`);
        console.log(`   📊 Рейтинг: ${tour.rating || 'нет'} (${tour.reviewsCount || 0} отзывов)`);
        console.log(`   🏖️ До пляжа: ${tour.beachDistance ? tour.beachDistance + 'м' : 'нет данных'}`);
        console.log(`   ✈️ До аэропорта: ${tour.airportDistance ? (tour.airportDistance / 1000).toFixed(1) + 'км' : 'нет данных'}`);
        console.log(`   🔗 Ссылка: ${tour.link}`);
        console.log(`   🎯 Соответствие: ${tour.matchScore}%`);
        console.log('');
      });
      
      // Проверяем структуру для mini app
      console.log('📱 Данные для отображения в mini app:');
      const firstTour = tours[0];
      console.log(JSON.stringify({
        id: firstTour.externalId,
        title: firstTour.title,
        price: firstTour.price,
        image: firstTour.image,
        features: {
          wifi: firstTour.hasWifi,
          pool: firstTour.hasPool,
          kidsClub: firstTour.hasKidsClub,
          fitness: firstTour.hasFitness,
          aquapark: firstTour.hasAquapark
        },
        location: {
          lat: firstTour.latitude,
          lng: firstTour.longitude
        },
        availability: {
          instant: firstTour.instantConfirm,
          status: firstTour.availability
        }
      }, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
  }
}

testProvider();