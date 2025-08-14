import OpenAI from 'openai';
import logger from '../utils/logger';
import { SearchRequest, TravelPriorities, PriorityWeights, RoomPreferences } from '@shared/schema-v2';

// Инициализация OpenRouter клиента
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'https://ai-travel-agent.com',
    'X-Title': 'AI Travel Agent',
  }
});

// Модель для использования
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-haiku';

export interface ParsedTravelRequest {
  // Основные параметры
  destinations?: string[];
  dateType: 'fixed' | 'flexible' | 'anytime';
  startDate?: Date;
  endDate?: Date;
  flexibleMonth?: string;
  duration?: number;
  
  // Бюджет
  budget?: number;
  budgetType?: 'total' | 'perPerson';
  currency?: string;
  
  // Путешественники
  adults?: number;
  children?: number;
  childrenAges?: number[];
  
  // Предпочтения по номерам
  roomPreferences?: RoomPreferences;
  
  // Требования
  requirements?: string[];
  
  // Предполагаемые приоритеты на основе текста
  suggestedPriorities?: Partial<PriorityWeights>;
  
  // Недостающие параметры
  missingRequired: string[];
  missingOptional: string[];
  
  // Уточняющие вопросы
  clarificationQuestions: string[];
  
  // Уверенность AI в парсинге (0-1)
  confidence: number;
}

export interface AIResponse {
  parsedRequest?: ParsedTravelRequest;
  message: string;
  requiresUserInput: boolean;
  suggestedActions?: string[];
}

/**
 * Парсит текстовый запрос пользователя и извлекает параметры поиска
 */
export async function parseTravelRequest(
  userText: string,
  userProfile?: any,
  previousContext?: any
): Promise<ParsedTravelRequest> {
  try {
    const systemPrompt = `Ты - эксперт по путешествиям. Твоя задача - извлечь из текста пользователя все параметры для поиска тура.

ВАЖНЫЕ ПРАВИЛА:
1. Извлекай ВСЕ упомянутые параметры
2. Определи тип дат: fixed (конкретные даты), flexible (гибкий месяц), anytime (когда угодно)
3. Если упомянут общий бюджет на всех - budgetType: "total", если на человека - "perPerson"
4. Определи недостающие ОБЯЗАТЕЛЬНЫЕ параметры: город вылета (если не в профиле), количество взрослых
5. Определи недостающие ОПЦИОНАЛЬНЫЕ параметры: точные даты, бюджет, тип пляжа, звездность
6. Сформулируй уточняющие вопросы на русском языке
7. На основе текста предположи важность разных параметров (0-10)
8. Извлекай предпочтения по номерам (количество комнат, вид из окна, тип номера)

ПРЕДПОЧТЕНИЯ ПО НОМЕРАМ:
- Тип номера: стандарт, люкс, вилла, апартаменты, семейный
- Вид: море, боковой вид на море, бассейн, сад, горы
- Количество комнат/спален
- Тип кроватей: двуспальная, раздельные, king-size
- Дополнительно: балкон, кухня, смежные номера, тихий номер

ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ:
- Направление (хотя бы одна страна)
- Город вылета (или взять из профиля)
- Количество взрослых

Профиль пользователя: ${JSON.stringify(userProfile || {})}
Предыдущий контекст: ${JSON.stringify(previousContext || {})}`;

    const userPrompt = `Проанализируй запрос: "${userText}"

Верни JSON в формате:
{
  "destinations": ["страна1", "страна2"],
  "dateType": "fixed|flexible|anytime",
  "startDate": "2024-08-01",
  "endDate": "2024-08-08", 
  "flexibleMonth": "август",
  "duration": 7,
  "budget": 150000,
  "budgetType": "total|perPerson",
  "currency": "RUB",
  "adults": 2,
  "children": 1,
  "childrenAges": [5],
  "roomPreferences": {
    "roomsCount": 2,
    "roomType": "family|villa|suite|standard",
    "viewPreference": "sea|pool|garden",
    "viewImportance": 8,
    "bedsConfiguration": {
      "doubleBeds": 1,
      "singleBeds": 2
    },
    "separateBeds": false,
    "balcony": true,
    "quietRoom": true,
    "connectingRooms": true,
    "specialRequests": ["детская кроватка"]
  },
  "requirements": ["all_inclusive", "sand_beach", "animation"],
  "suggestedPriorities": {
    "price": 7,
    "starRating": 6,
    "beachLine": 8,
    "mealType": 9,
    "familyFriendly": 9,
    "activities": 8,
    "roomQuality": 7
  },
  "missingRequired": ["departureCity"],
  "missingOptional": ["hotelStars", "beachType"],
  "clarificationQuestions": [
    "Из какого города планируете вылет?",
    "Важен ли вид из номера?"
  ],
  "confidence": 0.85
}`;

    const completion = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(response) as ParsedTravelRequest;
    
    // Конвертируем даты из строк в Date объекты
    if (parsed.startDate) {
      parsed.startDate = new Date(parsed.startDate);
    }
    if (parsed.endDate) {
      parsed.endDate = new Date(parsed.endDate);
    }

    // Добавляем дефолтные значения
    parsed.dateType = parsed.dateType || 'flexible';
    parsed.budgetType = parsed.budgetType || 'total';
    parsed.currency = parsed.currency || 'RUB';
    parsed.missingRequired = parsed.missingRequired || [];
    parsed.missingOptional = parsed.missingOptional || [];
    parsed.clarificationQuestions = parsed.clarificationQuestions || [];
    parsed.confidence = parsed.confidence || 0.5;

    logger.info('AI parsed travel request', { 
      userText: userText.substring(0, 100),
      confidence: parsed.confidence,
      missingParams: parsed.missingRequired.length + parsed.missingOptional.length,
      hasRoomPrefs: !!parsed.roomPreferences
    });

    return parsed;
  } catch (error) {
    logger.error('Error parsing travel request', error);
    
    // Fallback на базовый парсинг
    return {
      dateType: 'flexible',
      missingRequired: ['destination', 'departureCity'],
      missingOptional: ['budget', 'dates', 'roomPreferences'],
      clarificationQuestions: [
        'Куда хотите поехать?',
        'Из какого города вылет?',
        'На какие даты планируете поездку?',
        'Какой у вас бюджет?',
        'Какой тип номера предпочитаете?'
      ],
      confidence: 0
    };
  }
}

/**
 * Генерирует умный ответ пользователю
 */
export async function generateResponse(
  parsedRequest: ParsedTravelRequest,
  searchResults?: any[],
  action?: 'clarify' | 'confirm' | 'results'
): Promise<AIResponse> {
  try {
    let systemPrompt = '';
    let userPrompt = '';

    switch (action) {
      case 'clarify':
        systemPrompt = `Ты - дружелюбный ассистент по подбору туров. 
        Нужно вежливо запросить недостающую информацию.
        Используй эмодзи для дружелюбности.
        Задавай не более 2-3 вопросов за раз.`;
        
        userPrompt = `У меня есть следующая информация о запросе:
        ${JSON.stringify(parsedRequest, null, 2)}
        
        Сформулируй сообщение с уточняющими вопросами.`;
        break;

      case 'confirm':
        systemPrompt = `Подтверди параметры поиска в дружелюбной форме.
        Покажи все важные параметры.
        Предложи начать поиск или изменить что-то.`;
        
        userPrompt = `Параметры поиска:
        ${JSON.stringify(parsedRequest, null, 2)}
        
        Сформулируй подтверждение.`;
        break;

      case 'results':
        systemPrompt = `Ты - эксперт по турам. Проанализируй результаты и дай рекомендации.
        Выдели 2-3 лучших варианта с обоснованием.
        Учитывай приоритеты пользователя.`;
        
        userPrompt = `Запрос пользователя:
        ${JSON.stringify(parsedRequest, null, 2)}
        
        Найденные туры:
        ${JSON.stringify(searchResults?.slice(0, 10), null, 2)}
        
        Дай рекомендации.`;
        break;
    }

    const completion = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const message = completion.choices[0]?.message?.content || 'Давайте подберем для вас идеальный тур!';
    
    return {
      parsedRequest,
      message,
      requiresUserInput: action === 'clarify',
      suggestedActions: action === 'confirm' ? ['🔍 Начать поиск', '✏️ Изменить параметры'] : undefined
    };
  } catch (error) {
    logger.error('Error generating AI response', error);
    
    return {
      message: 'Давайте уточним параметры вашего путешествия.',
      requiresUserInput: true
    };
  }
}

/**
 * Анализирует туры и генерирует персонализированные рекомендации
 */
export async function generateTourRecommendations(
  tours: any[],
  searchRequest: SearchRequest,
  priorities: TravelPriorities
): Promise<{
  recommendations: string[];
  bestMatches: number[]; // индексы лучших туров
  insights: string[];
}> {
  try {
    const systemPrompt = `Ты - эксперт по подбору туров. Проанализируй результаты поиска с учетом приоритетов пользователя.
    
    Приоритеты (0-10, где 10 - очень важно):
    ${JSON.stringify(priorities.weights, null, 2)}
    
    Твоя задача:
    1. Выбрать 3-4 лучших варианта
    2. Объяснить, почему они подходят
    3. Дать полезные инсайты`;

    const userPrompt = `Параметры поиска:
    Направление: ${searchRequest.destination?.join(', ')}
    Бюджет: ${searchRequest.budget} ${searchRequest.currency}
    Даты: ${searchRequest.startDate} - ${searchRequest.endDate}
    Состав: ${searchRequest.adults} взр., ${searchRequest.children} дет.
    
    Найденные туры (топ-10):
    ${tours.slice(0, 10).map((tour, idx) => 
      `${idx + 1}. ${tour.hotel} ${tour.hotelStars}⭐ - ${tour.price}₽
      Питание: ${tour.mealType}, Пляж: линия ${tour.beachLine || '?'}
      Рейтинг: ${tour.rating || '?'}/5`
    ).join('\n')}
    
    Дай рекомендации в формате JSON:
    {
      "recommendations": [
        "🌟 Лучшее соотношение цена/качество: ...",
        "👨‍👩‍👧 Идеально для семьи: ...",
        "🏖️ Лучший пляж: ..."
      ],
      "bestMatches": [0, 2, 5],
      "insights": [
        "В выбранные даты цены выше среднего на 15%",
        "Рекомендую обратить внимание на отели с аквапарком"
      ]
    }`;

    const completion = await openrouter.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No AI response');
    }

    return JSON.parse(response);
  } catch (error) {
    logger.error('Error generating tour recommendations', error);
    
    // Fallback рекомендации
    return {
      recommendations: [
        '🌟 Рекомендуем обратить внимание на первые три варианта',
        '💰 Цены соответствуют вашему бюджету',
        '📍 Все отели в популярных локациях'
      ],
      bestMatches: [0, 1, 2],
      insights: ['Используйте фильтры для уточнения поиска']
    };
  }
}

/**
 * Определяет тип отдыха по тексту запроса
 */
export async function detectTravelStyle(userText: string): Promise<string> {
  const keywords = {
    'Пляжный отдых': ['пляж', 'море', 'загорать', 'купаться', 'песок'],
    'Семейный отдых': ['дети', 'ребенок', 'семья', 'анимация', 'детский клуб', 'смежные номера'],
    'Активный отдых': ['экскурсии', 'активный', 'развлечения', 'дискотеки', 'спорт'],
    'Спокойный отдых': ['тихий', 'спокойный', 'уединенный', 'релакс', 'тишина', 'тихий номер'],
    'Экономичный отдых': ['бюджет', 'недорого', 'экономичный', 'дешевый'],
    'Люксовый отдых': ['люкс', 'премиум', 'vip', 'роскошный', 'элитный', 'вилла', 'suite'],
    'Романтический отдых': ['вдвоем', 'романтика', 'медовый месяц', 'годовщина', 'вид на море']
  };

  const lowerText = userText.toLowerCase();
  let bestMatch = 'Пляжный отдых';
  let maxScore = 0;

  for (const [style, words] of Object.entries(keywords)) {
    const score = words.filter(word => lowerText.includes(word)).length;
    if (score > maxScore) {
      maxScore = score;
      bestMatch = style;
    }
  }

  return bestMatch;
}