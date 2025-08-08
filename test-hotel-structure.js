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

async function analyzeHotelStructure() {
  try {
    // Используем дату через 2 недели (22 августа 2025)
    const searchParams = {
      from_city: 'Moscow',
      to_country: 'TR',
      nights: 7,
      adults: 2,
      start_date: '22.08.2025'
    };
    
    console.log('🔍 Запускаем поиск...\n');
    
    // Запускаем поиск
    const enqueueResponse = await axios.post(
      'https://api.level.travel/search/enqueue',
      searchParams,
      { headers }
    );
    
    const requestId = enqueueResponse.data.request_id;
    console.log('Request ID:', requestId);
    
    // Ждем немного
    console.log('Ожидаем 5 секунд...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Получаем отели
    const hotelsResponse = await axios.get(
      `https://api.level.travel/search/get_grouped_hotels?request_id=${requestId}`,
      { headers }
    );
    
    console.log('📊 Анализ структуры ответа:\n');
    console.log('Ключи верхнего уровня:', Object.keys(hotelsResponse.data));
    console.log('Количество отелей:', hotelsResponse.data.hotels?.length || 0);
    
    if (hotelsResponse.data.hotels && hotelsResponse.data.hotels.length > 0) {
      const firstHotel = hotelsResponse.data.hotels[0];
      
      console.log('\n📱 Структура первого отеля:');
      console.log('Тип данных:', typeof firstHotel);
      
      if (typeof firstHotel === 'object') {
        console.log('Ключи объекта отеля:', Object.keys(firstHotel));
        
        // Выводим полную структуру первого отеля
        console.log('\nПолные данные первого отеля:');
        console.log(JSON.stringify(firstHotel, null, 2));
        
        // Проверяем вложенные структуры
        if (firstHotel.variants) {
          console.log('\n🏷️ Структура вариантов (variants):');
          console.log('Количество вариантов:', firstHotel.variants.length);
          if (firstHotel.variants[0]) {
            console.log('Первый вариант:', JSON.stringify(firstHotel.variants[0], null, 2));
          }
        }
        
        // Формируем правильную партнерскую ссылку
        console.log('\n🔗 Формирование партнерской ссылки:');
        
        // Ищем ID отеля в разных местах
        const hotelId = firstHotel.hotel_id || firstHotel.id || firstHotel.variants?.[0]?.hotel_id;
        const hotelName = firstHotel.hotel_name || firstHotel.name || firstHotel.variants?.[0]?.hotel_name;
        const price = firstHotel.min_price || firstHotel.variants?.[0]?.price;
        
        console.log('ID отеля:', hotelId);
        console.log('Название:', hotelName);
        console.log('Цена:', price);
        
        if (hotelId) {
          const partnerLink = `${affiliateUrl}&hotel_id=${hotelId}&marker=${partnerId}&start_date=22.08.2025&nights=7&adults=2`;
          console.log('Партнерская ссылка:', partnerLink);
        }
      }
    }
    
    // Также проверим структуру отфильтрованных отелей
    if (hotelsResponse.data.filtered_hotels) {
      console.log('\n📊 Есть также filtered_hotels:');
      console.log('Количество:', hotelsResponse.data.filtered_hotels.length);
      if (hotelsResponse.data.filtered_hotels[0]) {
        console.log('Структура:', Object.keys(hotelsResponse.data.filtered_hotels[0]));
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.log('Детали:', error.response.data);
    }
  }
}

analyzeHotelStructure();