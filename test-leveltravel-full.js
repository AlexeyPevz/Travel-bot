import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LEVELTRAVEL_API_KEY;
const partnerId = process.env.LEVEL_TRAVEL_PARTNER;

console.log('🔑 API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');
console.log('🤝 Partner ID:', partnerId || 'NOT SET');
console.log('---\n');

async function testLevelTravelAPI() {
  const headers = {
    'Authorization': `Token token="${apiKey}"`,
    'Accept': 'application/vnd.leveltravel.v3',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Тест references/departures - города вылета
    console.log('1️⃣ Тестируем получение городов вылета...');
    const departuresResponse = await axios.get(
      'https://api.level.travel/references/departures',
      { headers, validateStatus: () => true }
    );
    
    console.log('Статус:', departuresResponse.status);
    if (departuresResponse.status === 200) {
      const cities = departuresResponse.data.slice(0, 5);
      console.log('Примеры городов вылета:');
      cities.forEach(city => {
        console.log(`  - ${city.name_ru} (${city.iata})`);
      });
    } else {
      console.log('Ошибка:', departuresResponse.data);
    }
    console.log('---\n');

    // 2. Тест references/countries - страны
    console.log('2️⃣ Тестируем получение списка стран...');
    const countriesResponse = await axios.get(
      'https://api.level.travel/references/countries', 
      { headers, validateStatus: () => true }
    );
    
    console.log('Статус:', countriesResponse.status);
    if (countriesResponse.status === 200) {
      const countries = countriesResponse.data.slice(0, 5);
      console.log('Примеры стран:');
      countries.forEach(country => {
        console.log(`  - ${country.name_ru} (${country.iso2})`);
      });
    }
    console.log('---\n');

    // 3. Тест поиска туров
    console.log('3️⃣ Тестируем поиск туров (Турция, 7 ночей)...');
    
    // Сначала запускаем поиск
    const searchParams = {
      from_city: 'Moscow',
      to_country: 'TR',
      nights: 7,
      adults: 2,
      start_date: '25.01.2025'
    };
    
    console.log('Параметры поиска:', searchParams);
    
    const enqueueResponse = await axios.post(
      'https://api.level.travel/search/enqueue',
      searchParams,
      { headers, validateStatus: () => true }
    );
    
    console.log('Статус запуска поиска:', enqueueResponse.status);
    
    if (enqueueResponse.status === 200 && enqueueResponse.data.success) {
      const requestId = enqueueResponse.data.request_id;
      console.log('ID поиска:', requestId);
      
      // Ждем 3 секунды
      console.log('Ожидаем результаты поиска...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Проверяем статус
      const statusResponse = await axios.get(
        `https://api.level.travel/search/status?request_id=${requestId}`,
        { headers, validateStatus: () => true }
      );
      
      console.log('Статус поиска:', statusResponse.data);
      
      // Получаем отели
      if (statusResponse.data.status === 'finished') {
        const hotelsResponse = await axios.get(
          `https://api.level.travel/search/get_grouped_hotels?request_id=${requestId}`,
          { headers, validateStatus: () => true }
        );
        
        if (hotelsResponse.status === 200 && hotelsResponse.data.hotels) {
          console.log(`Найдено отелей: ${hotelsResponse.data.hotels.length}`);
          
          // Показываем первый отель
          const firstHotel = hotelsResponse.data.hotels[0];
          if (firstHotel) {
            console.log('\nПример отеля:');
            console.log(`  Название: ${firstHotel.name}`);
            console.log(`  Звезды: ${firstHotel.stars}⭐`);
            console.log(`  Цена от: ${firstHotel.min_price} ₽`);
            console.log(`  Рейтинг: ${firstHotel.rating || 'нет'}`);
            console.log(`  ID: ${firstHotel.id}`);
            
            // Формируем партнерскую ссылку
            const affiliateUrl = process.env.LEVEL_TRAVEL_AFFILIATE_URL || 'https://level.travel';
            const marker = process.env.LEVEL_TRAVEL_MARKER || partnerId;
            
            console.log('\n🔗 Партнерская ссылка:');
            if (affiliateUrl.includes('level.tpx.lt')) {
              console.log(`${affiliateUrl}&hotel_id=${firstHotel.id}&marker=${marker}`);
            } else {
              console.log(`https://level.travel/hotels/${firstHotel.id}?partner_id=${partnerId}`);
            }
          }
        }
      }
    } else {
      console.log('Ошибка при запуске поиска:', enqueueResponse.data);
    }
    console.log('---\n');

    // 4. Тест hot tours - горящие туры
    console.log('4️⃣ Тестируем получение горящих туров...');
    const hotToursResponse = await axios.get(
      'https://api.level.travel/hot_tours',
      { 
        headers, 
        params: {
          from_city: 'Moscow',
          to_country: 'TR',
          nights_from: 7,
          nights_to: 10,
          adults: 2,
          limit: 5
        },
        validateStatus: () => true 
      }
    );
    
    console.log('Статус:', hotToursResponse.status);
    if (hotToursResponse.status === 200 && hotToursResponse.data.hot_tours) {
      console.log(`Найдено горящих туров: ${hotToursResponse.data.hot_tours.length}`);
      const firstHot = hotToursResponse.data.hot_tours[0];
      if (firstHot) {
        console.log('\nПример горящего тура:');
        console.log(`  Отель: ${firstHot.hotel_name}`);
        console.log(`  Цена: ${firstHot.price} ₽`);
        console.log(`  Скидка: ${firstHot.discount}%`);
        console.log(`  Дата: ${firstHot.date}`);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

// Запускаем тесты
testLevelTravelAPI();