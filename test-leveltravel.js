// Тестовый скрипт для проверки API Level.Travel
import axios from 'axios';

async function testLevelTravelAPI() {
  try {
    // Прочитаем переменную окружения из process.env
    const apiKey = process.env.LEVELTRAVEL_API_KEY;
    
    if (!apiKey) {
      console.error('Level.Travel API key not found in environment variables');
      return false;
    }
    
    console.log('API Key available. Testing connection...');
    
    // 1. Тест простого справочного запроса
    console.log('\n\n--- Testing departures endpoint ---');
    const departuresResponse = await axios.get('https://api.level.travel/references/departures', {
      headers: {
        'Authorization': `Token token="${apiKey}"`,
        'Accept': 'application/vnd.leveltravel.v3'
      },
      validateStatus: () => true // Принимаем любой статус
    });
    
    console.log(`Status: ${departuresResponse.status}`);
    console.log('Response data:', JSON.stringify(departuresResponse.data).substring(0, 500) + '...');
    
    // 2. Тест запроса на города/направления
    console.log('\n\n--- Testing destinations endpoint ---');
    const destinationsResponse = await axios.get('https://api.level.travel/references/destinations', {
      headers: {
        'Authorization': `Token token="${apiKey}"`,
        'Accept': 'application/vnd.leveltravel.v3'
      },
      validateStatus: () => true
    });
    
    console.log(`Status: ${destinationsResponse.status}`);
    console.log('Response data:', JSON.stringify(destinationsResponse.data).substring(0, 500) + '...');
    
    // 3. Тест запроса к API аэропортов
    console.log('\n\n--- Testing airports endpoint ---');
    const airportsResponse = await axios.get('https://api.level.travel/references/airports', {
      headers: {
        'Authorization': `Token token="${apiKey}"`,
        'Accept': 'application/vnd.leveltravel.v3'
      },
      validateStatus: () => true
    });
    
    console.log(`Status: ${airportsResponse.status}`);
    console.log('Response data:', JSON.stringify(airportsResponse.data).substring(0, 500) + '...');
    
    console.log('\n--- Test summary ---');
    console.log(`Departures endpoint: ${departuresResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Destinations endpoint: ${destinationsResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Airports endpoint: ${airportsResponse.status === 200 ? 'SUCCESS' : 'FAILED'}`);
    
  } catch (error) {
    console.error('Error during API testing:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Запускаем тест
testLevelTravelAPI();