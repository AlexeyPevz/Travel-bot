import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LEVELTRAVEL_API_KEY;
const partnerId = process.env.LEVEL_TRAVEL_PARTNER;
const affiliateUrl = process.env.LEVEL_TRAVEL_AFFILIATE_URL;

console.log('🔐 Конфигурация:');
console.log('API Key:', apiKey ? '✅ Установлен' : '❌ Отсутствует');
console.log('Partner ID:', partnerId || 'Не установлен');
console.log('Affiliate URL:', affiliateUrl || 'Не установлена');
console.log('---\n');

const headers = {
  'Authorization': `Token token="${apiKey}"`,
  'Accept': 'application/vnd.leveltravel.v3',
  'Content-Type': 'application/json'
};

async function testCompleteFlow() {
  try {
    // 1. Поиск туров
    console.log('🔍 Запускаем поиск туров...');
    
    const searchParams = {
      from_city: 'Moscow',
      to_country: 'TR',
      nights: 7,
      adults: 2,
      start_date: '25.08.2025' // Через 2+ недели от текущей даты
    };
    
    const enqueueResponse = await axios.post(
      'https://api.level.travel/search/enqueue',
      searchParams,
      { headers }
    );
    
    if (!enqueueResponse.data.request_id) {
      throw new Error('Не получен ID поиска');
    }
    
    const requestId = enqueueResponse.data.request_id;
    console.log('✅ Поиск запущен, ID:', requestId);
    
    // 2. Ожидание результатов
    console.log('\n⏳ Ожидаем результаты (до 10 секунд)...');
    let hotels = null;
    
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await axios.get(
        `https://api.level.travel/search/status?request_id=${requestId}`,
        { headers }
      );
      
      console.log(`Попытка ${i + 1}: завершенность ${statusResponse.data.completeness}%`);
      
      if (statusResponse.data.completeness >= 70) {
        const hotelsResponse = await axios.get(
          `https://api.level.travel/search/get_grouped_hotels?request_id=${requestId}`,
          { headers }
        );
        
        if (hotelsResponse.data.hotels && hotelsResponse.data.hotels.length > 0) {
          hotels = hotelsResponse.data.hotels;
          break;
        }
      }
    }
    
    if (!hotels || hotels.length === 0) {
      console.log('❌ Отели не найдены');
      return;
    }
    
    console.log(`\n✅ Найдено отелей: ${hotels.length}`);
    
    // 3. Анализ структуры для mini app
    const firstHotel = hotels[0];
    const hotelInfo = firstHotel.hotel;
    
    console.log('\n📱 Данные для отображения в mini app:');
    console.log({
      id: hotelInfo.id,
      name: hotelInfo.name,
      stars: hotelInfo.stars,
      rating: hotelInfo.rating,
      price: firstHotel.min_price,
      city: hotelInfo.city,
      features: {
        wifi: hotelInfo.features?.wi_fi,
        pool: hotelInfo.features?.pool,
        kidsClub: hotelInfo.features?.kids_club,
        beach: {
          distance: hotelInfo.features?.beach_distance,
          type: hotelInfo.features?.beach_type,
          surface: hotelInfo.features?.beach_surface
        }
      },
      images: hotelInfo.images?.slice(0, 3).map(img => img.x500)
    });
    
    // 4. Формирование партнерских ссылок
    console.log('\n💰 Партнерские ссылки для первых 3 отелей:\n');
    
    hotels.slice(0, 3).forEach((hotel, index) => {
      const hotelData = hotel.hotel;
      
      // Способ 1: Через партнерскую ссылку из .env
      let partnerLink;
      if (affiliateUrl && affiliateUrl.includes('level.tpx.lt')) {
        partnerLink = `${affiliateUrl}&hotel_id=${hotelData.id}&marker=${partnerId}&start_date=25.08.2025&nights=7&adults=2`;
      } else {
        // Способ 2: Стандартная ссылка с partner_id
        partnerLink = `https://level.travel/hotels/${hotelData.id}?partner_id=${partnerId}&start_date=25.08.2025&nights=7&adults=2`;
      }
      
      console.log(`${index + 1}. ${hotelData.name} ${hotelData.stars}⭐`);
      console.log(`   💰 ${hotel.min_price.toLocaleString('ru-RU')} ₽`);
      console.log(`   🔗 ${partnerLink}`);
      console.log('');
    });
    
    // 5. Тест корректности ссылки
    console.log('🧪 Проверяем корректность партнерской ссылки...');
    const testLink = `${affiliateUrl}&hotel_id=${hotelInfo.id}&marker=${partnerId}`;
    console.log('Сформированная ссылка:', testLink);
    console.log('Содержит marker:', testLink.includes('marker=627387') ? '✅' : '❌');
    console.log('Содержит hotel_id:', testLink.includes('hotel_id=') ? '✅' : '❌');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.log('Детали:', error.response.data);
    }
  }
}

testCompleteFlow();