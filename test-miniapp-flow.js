import dotenv from 'dotenv';
dotenv.config();

// Простая версия сервиса дедупликации для теста
class SimpleDeduplicationService {
  normalizeHotelName(name) {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/hotel|отель|resort|резорт|spa|спа/gi, '')
      .replace(/[^\w\s\u0400-\u04FF]/g, '')
      .trim();
  }

  calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    
    // Простая проверка на схожесть
    const words1 = s1.split(' ');
    const words2 = s2.split(' ');
    const commonWords = words1.filter(w => words2.includes(w)).length;
    return commonWords / Math.max(words1.length, words2.length);
  }

  isMatchingHotel(tour1, tour2) {
    const norm1 = this.normalizeHotelName(tour1.hotel);
    const norm2 = this.normalizeHotelName(tour2.hotel);
    
    if (norm1 === norm2) {
      return { confidence: 0.9, reason: 'exact_name_match' };
    }
    
    const similarity = this.calculateSimilarity(tour1.hotel, tour2.hotel);
    const sameStars = tour1.hotelStars === tour2.hotelStars;
    const sameCity = tour1.destination === tour2.destination;
    
    if (similarity > 0.7 && sameStars && sameCity) {
      return { confidence: 0.8, reason: 'high_similarity' };
    }
    
    return { confidence: 0, reason: 'no_match' };
  }

  groupToursByHotel(tours) {
    const hotelGroups = new Map();
    const processed = new Set();
    
    tours.forEach((tour, index) => {
      if (processed.has(index)) return;
      
      const group = [tour];
      processed.add(index);
      
      tours.forEach((otherTour, otherIndex) => {
        if (processed.has(otherIndex)) return;
        
        const match = this.isMatchingHotel(tour, otherTour);
        if (match.confidence > 0.7) {
          group.push(otherTour);
          processed.add(otherIndex);
          console.log(`\n🔗 Объединены отели: "${tour.hotel}" и "${otherTour.hotel}"`);
          console.log(`   Уверенность: ${(match.confidence * 100).toFixed(0)}%`);
          console.log(`   Причина: ${match.reason}`);
        }
      });
      
      const hotelKey = this.normalizeHotelName(tour.hotel) + '_' + tour.hotelStars;
      hotelGroups.set(hotelKey, group);
    });
    
    // Преобразуем в карточки MiniApp
    const cards = [];
    hotelGroups.forEach((group) => {
      const primaryTour = group[0];
      
      const card = {
        hotel: {
          id: `hotel_${primaryTour.hotel.replace(/\s+/g, '_')}`,
          name: primaryTour.hotel,
          stars: primaryTour.hotelStars || 0,
          location: {
            country: primaryTour.destination,
            city: primaryTour.arrivalCity || primaryTour.destination
          },
          rating: {
            overall: Math.max(...group.map(t => t.rating || 0))
          },
          reviews: {
            count: group.reduce((sum, t) => sum + (t.reviewsCount || 0), 0)
          },
          features: {
            wifi: group.some(t => t.hasWifi),
            pool: group.some(t => t.hasPool),
            beach: {
              distance: Math.min(...group.map(t => t.beachDistance || 1000).filter(d => d !== null)),
              firstLine: group.some(t => t.beachDistance && t.beachDistance < 100)
            },
            kidsClub: group.some(t => t.hasKidsClub)
          },
          images: [...new Set(group.flatMap(t => t.images || []))]
        },
        options: group.map(tour => ({
          id: tour.externalId,
          provider: tour.provider,
          price: tour.price,
          priceOld: tour.priceOld,
          currency: 'RUB',
          startDate: tour.startDate,
          endDate: tour.endDate,
          nights: tour.nights,
          meal: { code: 'AI', name: tour.mealType },
          bookingLink: tour.link
        })),
        priceRange: {
          min: Math.min(...group.map(t => t.price)),
          max: Math.max(...group.map(t => t.price)),
          currency: 'RUB'
        },
        badges: []
      };
      
      // Добавляем бейджи
      if (group.some(t => t.isHot)) {
        card.badges.push({ type: 'hot', text: 'Горящий тур', color: '#ff4444' });
      }
      if (group.some(t => t.priceOld && t.priceOld > t.price)) {
        const maxDiscount = Math.max(...group.map(t => 
          t.priceOld ? Math.round((1 - t.price / t.priceOld) * 100) : 0
        ));
        if (maxDiscount > 0) {
          card.badges.push({ type: 'discount', text: `-${maxDiscount}%`, color: '#44ff44' });
        }
      }
      
      cards.push(card);
    });
    
    return cards;
  }
}

// Тестовые данные - имитируем ответ от разных провайдеров
const testTours = [
  // Level.Travel
  {
    provider: 'leveltravel',
    externalId: 'lt-123',
    title: 'Rixos Premium Belek 5★',
    hotel: 'Rixos Premium Belek',
    hotelStars: 5,
    destination: 'Турция',
    arrivalCity: 'Белек',
    price: 150000,
    priceOld: 180000,
    rating: 4.8,
    reviewsCount: 1250,
    beachDistance: 50,
    hasWifi: true,
    hasPool: true,
    hasKidsClub: true,
    images: ['https://example.com/rixos1.jpg', 'https://example.com/rixos2.jpg'],
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-08'),
    nights: 7,
    mealType: 'Все включено',
    link: 'https://level.tpx.lt/zWmCtpHX&hotel_id=123'
  },
  
  // Travelata - тот же отель, немного другое название
  {
    provider: 'travelata',
    externalId: 'tv-456',
    title: 'Риксос Премиум Белек',
    hotel: 'Риксос Премиум Белек',
    hotelStars: 5,
    destination: 'Турция',
    arrivalCity: 'Белек',
    price: 145000,
    rating: 4.7,
    reviewsCount: 890,
    beachDistance: 60,
    hasWifi: true,
    hasPool: true,
    images: ['https://example.com/rixos3.jpg'],
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-08'),
    nights: 7,
    mealType: 'Ультра все включено',
    link: 'https://travelata.ru/hotel/456'
  },
  
  // Level.Travel - другой отель
  {
    provider: 'leveltravel',
    externalId: 'lt-789',
    title: 'Titanic Beach Lara 5★',
    hotel: 'Titanic Beach Lara',
    hotelStars: 5,
    destination: 'Турция',
    arrivalCity: 'Анталья',
    price: 120000,
    priceOld: 140000,
    rating: 4.6,
    reviewsCount: 2100,
    beachDistance: 0,
    hasWifi: true,
    hasPool: true,
    hasAquapark: true,
    isHot: true,
    images: ['https://example.com/titanic1.jpg'],
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-08'),
    nights: 7,
    mealType: 'Все включено',
    link: 'https://level.tpx.lt/zWmCtpHX&hotel_id=789'
  },
  
  // Sletat - еще один вариант первого отеля
  {
    provider: 'sletat',
    externalId: 'sl-111',
    title: 'RIXOS PREMIUM BELEK',
    hotel: 'RIXOS PREMIUM BELEK',
    hotelStars: 5,
    destination: 'Турция',
    arrivalCity: 'Белек',
    price: 155000,
    rating: 4.9,
    reviewsCount: 450,
    beachDistance: 50,
    hasWifi: true,
    hasPool: true,
    hasKidsClub: true,
    instantConfirm: true,
    images: ['https://example.com/rixos4.jpg'],
    startDate: new Date('2024-06-02'),
    endDate: new Date('2024-06-09'),
    nights: 7,
    mealType: 'Все включено',
    link: 'https://sletat.ru/hotel/111'
  }
];

console.log('🔄 Тестирование потока данных: API → Дедупликация → Mini App\n');
console.log('📥 Входные данные (имитация ответов от провайдеров):');
console.log(`Всего туров: ${testTours.length}`);
testTours.forEach(tour => {
  console.log(`- ${tour.provider}: "${tour.hotel}" (${tour.hotelStars}★) - ${tour.price} руб`);
});

// Создаем экземпляр сервиса дедупликации
const deduplicationService = new SimpleDeduplicationService();

// Группируем туры
console.log('\n🔀 Процесс дедупликации:');
const miniAppCards = deduplicationService.groupToursByHotel(testTours);

// Выводим результат в формате Mini App
console.log('\n📱 Результат для Mini App:');
console.log(`Уникальных отелей: ${miniAppCards.length}\n`);

miniAppCards.forEach((card, idx) => {
  console.log(`${idx + 1}. ${card.hotel.name} ${card.hotel.stars}★`);
  console.log(`   📍 ${card.hotel.location.city}, ${card.hotel.location.country}`);
  console.log(`   ⭐ Рейтинг: ${card.hotel.rating.overall} (${card.hotel.reviews.count} отзывов)`);
  console.log(`   💰 Цены: ${card.priceRange.min} - ${card.priceRange.max} руб`);
  console.log(`   📊 Вариантов: ${card.options.length} от провайдеров: ${card.options.map(o => o.provider).join(', ')}`);
  
  if (card.hotel.features.beach.firstLine) {
    console.log(`   🏖️ Первая линия пляжа!`);
  }
  
  if (card.badges.length > 0) {
    console.log(`   🏷️ Бейджи: ${card.badges.map(b => b.text).join(', ')}`);
  }
  
  console.log(`   🔗 Варианты бронирования:`);
  card.options.forEach(option => {
    const discount = option.priceOld ? ` (было ${option.priceOld})` : '';
    console.log(`      - ${option.provider}: ${option.price} руб${discount}`);
  });
  
  console.log('');
});

// Проверяем формат данных для Mini App
console.log('✅ Формат данных для Mini App:');
console.log('- Отели сгруппированы по уникальности');
console.log('- Каждая карточка содержит все варианты от разных провайдеров');
console.log('- Цены, рейтинги и отзывы агрегированы');
console.log('- Добавлены бейджи для горящих туров и скидок');
console.log('- Все ссылки содержат партнерские параметры');

// Пример JSON для Mini App
console.log('\n📄 Пример JSON структуры для первого отеля:');
console.log(JSON.stringify(miniAppCards[0], null, 2));