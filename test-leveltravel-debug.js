import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.LEVELTRAVEL_API_KEY;
const headers = {
  'Authorization': `Token token="${apiKey}"`,
  'Accept': 'application/vnd.leveltravel.v3',
  'Content-Type': 'application/json'
};

async function debugAPI() {
  try {
    // 1. Проверяем структуру ответа departures
    console.log('🔍 Проверяем структуру /references/departures...\n');
    const departuresResponse = await axios.get(
      'https://api.level.travel/references/departures',
      { headers, validateStatus: () => true }
    );
    
    console.log('Статус:', departuresResponse.status);
    console.log('Тип данных:', typeof departuresResponse.data);
    console.log('Ключи ответа:', Object.keys(departuresResponse.data));
    console.log('Первые 500 символов:', JSON.stringify(departuresResponse.data).substring(0, 500));
    
    // Если это объект с массивом внутри
    if (departuresResponse.data.departures) {
      console.log('\n✅ Найден массив departures');
      console.log('Количество:', departuresResponse.data.departures.length);
      console.log('Первый элемент:', departuresResponse.data.departures[0]);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 2. Проверяем поиск туров
    console.log('🔍 Проверяем структуру поиска туров...\n');
    
    const searchParams = {
      from_city: 'Moscow',
      to_country: 'TR', 
      nights: 7,
      adults: 2,
      start_date: '01.02.2025'
    };
    
    console.log('Параметры:', JSON.stringify(searchParams, null, 2));
    
    const enqueueResponse = await axios.post(
      'https://api.level.travel/search/enqueue',
      searchParams,
      { headers, validateStatus: () => true }
    );
    
    console.log('\nОтвет на запуск поиска:');
    console.log('Статус:', enqueueResponse.status);
    console.log('Данные:', JSON.stringify(enqueueResponse.data, null, 2));
    
    if (enqueueResponse.data.request_id) {
      const requestId = enqueueResponse.data.request_id;
      
      // Ждем немного
      console.log('\nЖдем 2 секунды...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Проверяем статус
      const statusUrl = `https://api.level.travel/search/status?request_id=${requestId}`;
      console.log('\nПроверяем статус:', statusUrl);
      
      const statusResponse = await axios.get(statusUrl, { headers, validateStatus: () => true });
      console.log('Статус поиска:', JSON.stringify(statusResponse.data, null, 2));
      
      // Пробуем получить отели
      const hotelsUrl = `https://api.level.travel/search/get_grouped_hotels?request_id=${requestId}`;
      console.log('\nПробуем получить отели:', hotelsUrl);
      
      const hotelsResponse = await axios.get(hotelsUrl, { headers, validateStatus: () => true });
      console.log('Статус:', hotelsResponse.status);
      console.log('Ключи ответа:', Object.keys(hotelsResponse.data));
      
      if (hotelsResponse.data.hotels && hotelsResponse.data.hotels.length > 0) {
        console.log('Количество отелей:', hotelsResponse.data.hotels.length);
        console.log('\nПервый отель:');
        console.log(JSON.stringify(hotelsResponse.data.hotels[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.response) {
      console.log('Статус:', error.response.status);
      console.log('Данные:', error.response.data);
    }
  }
}

debugAPI();