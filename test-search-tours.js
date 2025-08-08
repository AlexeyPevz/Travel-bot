import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LEVELTRAVEL_API_KEY;
const partnerId = process.env.LEVEL_TRAVEL_PARTNER;
const affiliateUrl = process.env.LEVEL_TRAVEL_AFFILIATE_URL;

const headers = {
  'Authorization': `Token token="${apiKey}"`,
  'Accept': 'application/vnd.leveltravel.v3',
  'Content-Type': 'application/json'
};

async function searchTours() {
  try {
    // Используем дату через месяц для лучших результатов
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const dateStr = futureDate.toLocaleDateString('ru-RU');
    
    console.log('🔍 Поиск туров в Турцию...\n');
    
    const searchParams = {
      from_city: 'Moscow',
      to_country: 'TR',
      nights: 7,
      adults: 2,
      start_date: dateStr
    };
    
    console.log('Параметры поиска:', searchParams);
    
    // Запускаем поиск
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
    
    // Ждем результаты
    console.log('\n⏳ Ожидаем результаты...');
    let attempts = 0;
    let searchComplete = false;
    let hotelsData = null;
    
    while (!searchComplete && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await axios.get(
        `https://api.level.travel/search/status?request_id=${requestId}`,
        { headers }
      );
      
      console.log(`Попытка ${attempts + 1}: завершенность ${statusResponse.data.completeness}%, найдено ${statusResponse.data.size} отелей`);
      
      if (statusResponse.data.completeness >= 80 || statusResponse.data.size > 0) {
        // Получаем отели
        const hotelsResponse = await axios.get(
          `https://api.level.travel/search/get_grouped_hotels?request_id=${requestId}`,
          { headers }
        );
        
        if (hotelsResponse.data.hotels && hotelsResponse.data.hotels.length > 0) {
          hotelsData = hotelsResponse.data;
          searchComplete = true;
        }
      }
      
      attempts++;
    }
    
    if (!hotelsData || !hotelsData.hotels || hotelsData.hotels.length === 0) {
      console.log('\n❌ Туры не найдены');
      return;
    }
    
    console.log(`\n✅ Найдено отелей: ${hotelsData.hotels.length}`);
    console.log('\n📋 Топ-5 отелей:\n');
    
    // Показываем первые 5 отелей
    hotelsData.hotels.slice(0, 5).forEach((hotel, index) => {
      console.log(`${index + 1}. ${hotel.name} ${hotel.stars}⭐`);
      console.log(`   📍 ${hotel.resort_name || hotel.city_name}`);
      console.log(`   💰 от ${hotel.min_price?.toLocaleString('ru-RU')} ₽`);
      console.log(`   📊 Рейтинг: ${hotel.rating || 'нет'}`);
      
      // Формируем партнерскую ссылку
      if (affiliateUrl && affiliateUrl.includes('level.tpx.lt')) {
        const link = `${affiliateUrl}&hotel_id=${hotel.id}&marker=${partnerId}&start_date=${dateStr}&nights=7&adults=2`;
        console.log(`   🔗 ${link}`);
      } else {
        console.log(`   🔗 https://level.travel/hotels/${hotel.id}?partner_id=${partnerId}`);
      }
      
      console.log('');
    });
    
    // Смотрим структуру первого отеля для mini app
    console.log('\n📱 Структура данных отеля для mini app:');
    const firstHotel = hotelsData.hotels[0];
    console.log(JSON.stringify({
      id: firstHotel.id,
      name: firstHotel.name,
      stars: firstHotel.stars,
      rating: firstHotel.rating,
      reviews_count: firstHotel.reviews_count,
      min_price: firstHotel.min_price,
      old_price: firstHotel.old_price,
      discount: firstHotel.discount,
      resort_name: firstHotel.resort_name,
      country_name: firstHotel.country_name,
      beach_line: firstHotel.beach_line,
      images: firstHotel.images?.slice(0, 3),
      amenities: firstHotel.amenities,
      description: firstHotel.description?.substring(0, 200) + '...'
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.log('Детали:', error.response.data);
    }
  }
}

searchTours();