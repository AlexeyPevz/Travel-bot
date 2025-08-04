import axios from 'axios';
import { aiLogger } from '../utils/logger';
import { aiRequestDuration, aiRequestTotal, aiTokensUsed, aiFallbackAttempts, trackAsyncOperation } from '../monitoring/metrics';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const YANDEX_GPT_API_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

// Free models available on OpenRouter
const FREE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'huggingface/zephyr-7b-beta:free',
  'openchat/openchat-3.5:free',
  'gryphe/mythomist-7b:free',
  'nousresearch/nous-capybara-7b:free'
];

// AI Provider configuration
interface AIProvider {
  name: string;
  enabled: boolean;
  models?: string[];
  apiKey?: string;
  endpoint?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TourPreferences {
  vacationType?: string;
  countries?: string[];
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  peopleCount?: number;
  priorities?: Record<string, number>;
  freeText?: string;
}

/**
 * Детальный промпт для анализа туристических запросов
 */
const TOUR_ANALYSIS_PROMPT = `Ты - профессиональный AI-ассистент туристического агентства с многолетним опытом подбора туров.

ТВОЯ ЗАДАЧА:
Проанализировать текстовое сообщение клиента и извлечь все параметры для поиска идеального тура.

ВАЖНЫЕ ПРАВИЛА:
1. Извлекай ВСЕ упомянутые параметры, даже косвенные упоминания
2. Интерпретируй пожелания клиента, учитывая контекст и скрытые потребности
3. Если клиент упоминает характеристики отеля - преобразуй их в приоритеты
4. Учитывай сезонность и особенности направлений
5. При упоминании бюджета "на человека" или "на двоих" - правильно интерпретируй

ПАРАМЕТРЫ ДЛЯ ИЗВЛЕЧЕНИЯ:
- vacationType: тип отдыха
  * beach - пляжный (море, пляж, купание, загорать)
  * active - активный (спорт, горы, лыжи, дайвинг, серфинг)
  * cultural - культурный (экскурсии, достопримечательности, музеи)
  * relaxing - спокойный (спа, релакс, тишина, уединение)
  * family - семейный (с детьми, аквапарк, анимация)
  * romantic - романтический (медовый месяц, для пары)
  * adventure - приключения (джунгли, сафари, экстрим)

- countries: массив стран (полные названия на русском)
  * Распознавай синонимы: ОАЭ/Эмираты/Дубай, Тайланд/Таиланд
  * При упоминании города определяй страну

- budget: бюджет в рублях (всегда число)
  * "150к", "150 тыс", "150000" = 150000
  * Учитывай контекст: "на двоих", "с человека"

- startDate/endDate: даты в формате YYYY-MM-DD
  * "в июне", "летом" - определяй конкретные даты
  * "на майские" = примерно 1-10 мая
  * "новый год" = 29 декабря - 8 января

- duration: длительность в днях
  * "неделя" = 7, "две недели" = 14
  * "на выходные" = 2-3
  * "10 ночей" = 11 дней

- peopleCount: количество человек
  * "вдвоем", "с мужем/женой" = 2
  * "с двумя детьми" = минимум 3

- priorities: веса важности параметров (0-10)
  * starRating: звездность отеля
    - "хороший отель", "5 звезд" = 8-10
    - "неважно где жить" = 2-3
  * beachLine: близость к морю
    - "первая линия", "у моря" = 10
    - "недалеко от моря" = 6-7
  * mealType: тип питания
    - "все включено", "чтобы не думать о еде" = 9-10
    - "только завтраки" = 3-4
  * hotelRating: рейтинг отеля
    - "по отзывам хороший", "популярный" = 8-9
  * priceValue: соотношение цена/качество
    - "бюджетно", "недорого" = 9-10
    - "цена не важна" = 2-3
  * roomQuality: качество номеров
    - "хороший номер", "с видом на море" = 8-9
  * location: расположение
    - "в центре", "рядом с..." = 8-9
  * familyFriendly: для семей с детьми
    - "с детьми", "детский клуб" = 9-10
  * adults: только для взрослых
    - "без детей", "тихий" = 9-10
  * animation: анимация и развлечения
    - "весело", "дискотеки" = 8-9
    - "тихо", "спокойно" = 1-2

ПРИМЕРЫ АНАЛИЗА:

Запрос: "Хочу в Турцию на море, отель 5 звезд с хорошим питанием, первая линия. Бюджет до 200 тысяч на двоих на неделю в июне."
Ответ: {
  "vacationType": "beach",
  "countries": ["Турция"],
  "budget": 200000,
  "startDate": "2024-06-01",
  "endDate": "2024-06-08",
  "duration": 7,
  "peopleCount": 2,
  "priorities": {
    "starRating": 10,
    "beachLine": 10,
    "mealType": 9,
    "hotelRating": 7,
    "priceValue": 6,
    "roomQuality": 7,
    "location": 6,
    "familyFriendly": 5,
    "adults": 5
  }
}

Запрос: "Хочется куда-нибудь слетать отдохнуть недорого"
Ответ: {
  "vacationType": "relaxing",
  "budget": 100000,
  "peopleCount": 2,
  "priorities": {
    "starRating": 5,
    "beachLine": 5,
    "mealType": 5,
    "hotelRating": 5,
    "priceValue": 10,
    "roomQuality": 4,
    "location": 5,
    "familyFriendly": 5,
    "adults": 5
  }
}

ВСЕГДА возвращай валидный JSON объект.`;

/**
 * Пытается получить ответ от AI провайдера с fallback механизмом
 */
async function tryAIProvider(
  messages: ChatMessage[],
  provider: AIProvider,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: any;
  } = {}
): Promise<string | null> {
  if (!provider.enabled) {
    return null;
  }

  try {
    if (provider.name === 'openrouter' && provider.apiKey) {
      // Пробуем каждую модель из списка
      for (const model of (provider.models || FREE_MODELS)) {
        try {
          aiLogger.info(`Trying OpenRouter with model: ${model}`);
          
          const response = await trackAsyncOperation(
            aiRequestDuration,
            { provider: 'openrouter', model, operation: options.operation || 'chat', status: 'pending' },
            async () => {
              const res = await axios.post(
                OPENROUTER_API_URL,
                {
                  model,
                  messages,
                  temperature: options.temperature || 0.3,
                  max_tokens: options.maxTokens || 500,
                  ...(options.responseFormat && { response_format: options.responseFormat })
                },
                {
                  headers: {
                    'Authorization': `Bearer ${provider.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.APP_URL || 'https://travel-bot.com',
                    'X-Title': 'AI Travel Agent Bot'
                  },
                  timeout: 15000 // 15 секунд таймаут
                }
              );
              
              // Track tokens if available
              if (res.data.usage) {
                aiTokensUsed.inc(
                  { provider: 'openrouter', model, type: 'prompt' },
                  res.data.usage.prompt_tokens || 0
                );
                aiTokensUsed.inc(
                  { provider: 'openrouter', model, type: 'completion' },
                  res.data.usage.completion_tokens || 0
                );
              }
              
              return res;
            }
          );

          const content = response.data.choices[0]?.message?.content;
          if (content) {
            aiLogger.info(`Successfully got response from OpenRouter model: ${model}`);
            aiRequestTotal.inc({
              provider: 'openrouter',
              model,
              operation: options.operation || 'chat',
              status: 'success'
            });
            return content;
          }
        } catch (modelError: any) {
          aiLogger.warn(`Failed with model ${model}: ${modelError.message}`);
          aiRequestTotal.inc({
            provider: 'openrouter',
            model,
            operation: options.operation || 'chat',
            status: 'error'
          });
          
          // Track fallback attempt if not the last model
          const modelIndex = (provider.models || FREE_MODELS).indexOf(model);
          if (modelIndex < (provider.models || FREE_MODELS).length - 1) {
            aiFallbackAttempts.inc({
              from_provider: `openrouter:${model}`,
              to_provider: `openrouter:${(provider.models || FREE_MODELS)[modelIndex + 1]}`,
              reason: modelError.response?.status || 'error'
            });
          }
          
          continue; // Пробуем следующую модель
        }
      }
    } else if (provider.name === 'yandexgpt' && provider.apiKey) {
      aiLogger.info('Trying YandexGPT as fallback');
      
      const response = await trackAsyncOperation(
        aiRequestDuration,
        { provider: 'yandexgpt', model: 'yandexgpt-lite', operation: options.operation || 'chat', status: 'pending' },
        async () => {
          const res = await axios.post(
            YANDEX_GPT_API_URL,
            {
              modelUri: `gpt://${provider.apiKey}/yandexgpt-lite`,
              completionOptions: {
                stream: false,
                temperature: options.temperature || 0.3,
                maxTokens: options.maxTokens || 500
              },
              messages: messages.map(msg => ({
                role: msg.role,
                text: msg.content
              }))
            },
            {
              headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            }
          );
          
          // Track tokens if available
          if (res.data.result?.usage) {
            aiTokensUsed.inc(
              { provider: 'yandexgpt', model: 'yandexgpt-lite', type: 'prompt' },
              res.data.result.usage.inputTextTokens || 0
            );
            aiTokensUsed.inc(
              { provider: 'yandexgpt', model: 'yandexgpt-lite', type: 'completion' },
              res.data.result.usage.completionTokens || 0
            );
          }
          
          return res;
        }
      );

      const content = response.data.result?.alternatives?.[0]?.message?.text;
      if (content) {
        aiLogger.info('Successfully got response from YandexGPT');
        aiRequestTotal.inc({
          provider: 'yandexgpt',
          model: 'yandexgpt-lite',
          operation: options.operation || 'chat',
          status: 'success'
        });
        return content;
      }
    }
  } catch (error: any) {
    aiLogger.error(`Error with ${provider.name}:`, error.message);
  }

  return null;
}

/**
 * Анализ текстового запроса пользователя для извлечения параметров тура
 * с fallback цепочкой: OpenRouter (бесплатные модели) -> YandexGPT -> базовый парсинг
 */
export async function analyzeTourRequest(userMessage: string): Promise<TourPreferences> {
  const providers: AIProvider[] = [
    {
      name: 'openrouter',
      enabled: !!process.env.OPENROUTER_API_KEY,
      apiKey: process.env.OPENROUTER_API_KEY,
      models: FREE_MODELS // Пробуем все бесплатные модели
    },
    {
      name: 'yandexgpt',
      enabled: !!process.env.YANDEX_GPT_API_KEY,
      apiKey: process.env.YANDEX_GPT_API_KEY
    }
  ];

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: TOUR_ANALYSIS_PROMPT
    },
    {
      role: 'user',
      content: userMessage
    }
  ];

  // Пробуем каждого провайдера по очереди
  for (const provider of providers) {
    const result = await tryAIProvider(messages, provider, {
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
      operation: 'tour_analysis'
    });

    if (result) {
      try {
        const parsed = JSON.parse(result);
        aiLogger.info(`Successfully parsed tour request using ${provider.name}`);
        
        // Track fallback if not the first provider
        const providerIndex = providers.indexOf(provider);
        if (providerIndex > 0) {
          aiFallbackAttempts.inc({
            from_provider: providers[providerIndex - 1].name,
            to_provider: provider.name,
            reason: 'previous_failed'
          });
        }
        
        return parsed;
      } catch (parseError) {
        aiLogger.error(`Failed to parse JSON from ${provider.name}:`, parseError);
        continue;
      }
    }
  }

  // Если все AI провайдеры не сработали, используем базовый парсинг
  aiLogger.warn('All AI providers failed, using basic text parsing');
  return parseBasicTourRequest(userMessage);
}

/**
 * Базовый парсинг текста без AI
 */
function parseBasicTourRequest(text: string): TourPreferences {
  const lowerText = text.toLowerCase();
  const result: TourPreferences = {
    freeText: text
  };

  // Извлечение стран
  const countries = [];
  const countryPatterns = {
    'турция': 'Турция',
    'турци': 'Турция',
    'египет': 'Египет',
    'египт': 'Египет',
    'таиланд': 'Таиланд',
    'тайланд': 'Таиланд',
    'оаэ': 'ОАЭ',
    'дубай': 'ОАЭ',
    'кипр': 'Кипр',
    'греция': 'Греция',
    'греци': 'Греция',
    'испания': 'Испания',
    'испани': 'Испания',
    'италия': 'Италия',
    'итали': 'Италия'
  };

  for (const [pattern, country] of Object.entries(countryPatterns)) {
    if (lowerText.includes(pattern)) {
      countries.push(country);
    }
  }
  if (countries.length > 0) {
    result.countries = [...new Set(countries)];
  }

  // Извлечение бюджета
  const budgetMatch = text.match(/(\d+)\s*(?:тыс|тысяч|к|000)/);
  if (budgetMatch) {
    result.budget = parseInt(budgetMatch[1]) * 1000;
  } else {
    const directBudgetMatch = text.match(/(\d{5,7})/);
    if (directBudgetMatch) {
      result.budget = parseInt(directBudgetMatch[1]);
    }
  }

  // Извлечение количества человек
  const peopleMatch = text.match(/на\s+(\d+)\s+(?:человек|чел|персон)/i);
  if (peopleMatch) {
    result.peopleCount = parseInt(peopleMatch[1]);
  } else if (lowerText.includes('двоих') || lowerText.includes('вдвоем')) {
    result.peopleCount = 2;
  } else if (lowerText.includes('троих') || lowerText.includes('втроем')) {
    result.peopleCount = 3;
  } else if (lowerText.includes('четверых') || lowerText.includes('вчетвером')) {
    result.peopleCount = 4;
  } else {
    // Попробуем найти паттерн "2 человека", "3 человека" и т.д.
    const simplePeopleMatch = text.match(/(\d+)\s+человек/i);
    if (simplePeopleMatch) {
      result.peopleCount = parseInt(simplePeopleMatch[1]);
    }
  }

  // Извлечение дат
  const monthNames: Record<string, number> = {
    'января': 0, 'январь': 0,
    'февраля': 1, 'февраль': 1,
    'марта': 2, 'март': 2,
    'апреля': 3, 'апрель': 3,
    'мая': 4, 'май': 4,
    'июня': 5, 'июнь': 5,
    'июля': 6, 'июль': 6,
    'августа': 7, 'август': 7,
    'сентября': 8, 'сентябрь': 8,
    'октября': 9, 'октябрь': 9,
    'ноября': 10, 'ноябрь': 10,
    'декабря': 11, 'декабрь': 11
  };

  // Паттерн для дат вида "с 15 июля по 25 июля"
  const dateRangeMatch = text.match(/с\s+(\d{1,2})\s+(\w+)\s+по\s+(\d{1,2})\s+(\w+)/i);
  if (dateRangeMatch) {
    const startDay = parseInt(dateRangeMatch[1]);
    const startMonth = monthNames[dateRangeMatch[2].toLowerCase()];
    const endDay = parseInt(dateRangeMatch[3]);
    const endMonth = monthNames[dateRangeMatch[4].toLowerCase()];
    
    if (startMonth !== undefined && endMonth !== undefined) {
      const currentYear = new Date().getFullYear();
      result.startDate = new Date(currentYear, startMonth, startDay);
      result.endDate = new Date(currentYear, endMonth, endDay);
      
      // Если даты в прошлом, добавляем год
      if (result.startDate < new Date()) {
        result.startDate.setFullYear(currentYear + 1);
        result.endDate.setFullYear(currentYear + 1);
      }
    }
  }

  // Определение типа отдыха
  if (lowerText.includes('море') || lowerText.includes('пляж') || lowerText.includes('купа')) {
    result.vacationType = 'beach';
  } else if (lowerText.includes('экскурс') || lowerText.includes('достопримечател')) {
    result.vacationType = 'cultural';
  } else if (lowerText.includes('актив') || lowerText.includes('спорт')) {
    result.vacationType = 'active';
  }

  // Базовые приоритеты на основе ключевых слов
  const priorities: Record<string, number> = {
    starRating: 5,
    beachLine: 5,
    mealType: 5,
    price: 7,
    hotelRating: 5
  };

  // Звездность
  const starsMatch = text.match(/(\d)\s*(?:звезд|★|\*)/);
  if (starsMatch) {
    const stars = parseInt(starsMatch[1]);
    priorities.starRating = stars >= 4 ? 8 : 5;
  }

  // Линия пляжа
  if (lowerText.includes('первая линия') || lowerText.includes('1 линия')) {
    priorities.beachLine = 10;
  } else if (lowerText.includes('вторая линия') || lowerText.includes('2 линия')) {
    priorities.beachLine = 6;
  }

  // Тип питания
  if (lowerText.includes('все включено') || lowerText.includes('all inclusive') || lowerText.includes('олл инклюзив')) {
    priorities.mealType = 9;
  } else if (lowerText.includes('полупансион') || lowerText.includes('завтрак и ужин')) {
    priorities.mealType = 6;
  }

  // Цена
  if (lowerText.includes('бюджет') || lowerText.includes('недорого') || lowerText.includes('эконом')) {
    priorities.price = 9;
  }

  result.priorities = priorities;

  return result;
}

/**
 * Промпт для анализа соответствия тура
 */
const TOUR_MATCH_ANALYSIS_PROMPT = `Ты - опытный турагент с 15-летним стажем. Твоя задача - объяснить клиенту, насколько конкретный тур соответствует его запросу.

ПРАВИЛА:
1. Будь честным - укажи как плюсы, так и минусы
2. Используй простой и понятный язык
3. Фокусируйся на ключевых параметрах важных для клиента
4. Давай конкретные рекомендации
5. Ответ должен быть 2-3 предложения

ПРИМЕРЫ ХОРОШИХ ОТВЕТОВ:
- "Отличный выбор для пляжного отдыха: 5*, первая линия, все включено. Единственный минус - цена немного выше бюджета (на 10%), но качество того стоит."
- "Тур идеально подходит по цене и питанию, но отель 3* может не соответствовать ожиданиям по уровню сервиса. Рекомендую рассмотреть, если готовы к компромиссу."
- "Превосходное соответствие всем критериям: Турция, первая линия, в рамках бюджета. Отель получает отличные отзывы за детскую анимацию."`;

/**
 * Расчет соответствия тура профилю пользователя с учетом весов
 */
export async function calculateTourMatchScore(
  tour: any,
  preferences: TourPreferences,
  priorities: Record<string, number>
): Promise<{ score: number; details: Record<string, number>; analysis: string }> {
  // Базовый расчет без AI
  const details: Record<string, number> = {};
  let totalWeight = 0;
  let weightedScore = 0;

  // Соответствие по звездности
  if (tour.starRating && priorities.starRating) {
    const starScore = tour.starRating >= 4 ? 100 : (tour.starRating / 5) * 100;
    details.starRating = starScore;
    weightedScore += starScore * priorities.starRating;
    totalWeight += priorities.starRating;
  }

  // Соответствие по линии пляжа
  if (tour.beachLine && priorities.beachLine) {
    const beachScore = tour.beachLine === 1 ? 100 : (tour.beachLine === 2 ? 70 : 40);
    details.beachLine = beachScore;
    weightedScore += beachScore * priorities.beachLine;
    totalWeight += priorities.beachLine;
  }

  // Соответствие по цене
  if (preferences.budget && priorities.price) {
    const priceRatio = tour.price / preferences.budget;
    const priceScore = priceRatio <= 1 ? (1 - priceRatio) * 100 + 50 : Math.max(0, 100 - (priceRatio - 1) * 100);
    details.price = priceScore;
    weightedScore += priceScore * priorities.price;
    totalWeight += priorities.price;
  }

  // Соответствие по типу питания
  if (tour.mealType && priorities.mealType) {
    const mealScore = tour.mealType.toLowerCase().includes('все включено') || 
                      tour.mealType.toLowerCase().includes('all inclusive') || 
                      tour.mealType.toLowerCase().includes('ai') ? 100 : 
                      tour.mealType.toLowerCase().includes('полупансион') ? 70 : 
                      tour.mealType.toLowerCase().includes('завтрак') ? 50 : 30;
    details.mealType = mealScore;
    weightedScore += mealScore * priorities.mealType;
    totalWeight += priorities.mealType;
  }

  // Соответствие по рейтингу отеля
  if (tour.hotelRating && priorities.hotelRating) {
    const ratingScore = (tour.hotelRating / 10) * 100;
    details.hotelRating = ratingScore;
    weightedScore += ratingScore * priorities.hotelRating;
    totalWeight += priorities.hotelRating;
  }

  // Соответствие по стране
  if (preferences.countries && tour.country) {
    const locationWeight = priorities.location || 10;
    const locationScore = preferences.countries.some(country => 
      tour.country.toLowerCase().includes(country.toLowerCase()) ||
      country.toLowerCase().includes(tour.country.toLowerCase())
    ) ? 100 : 0;
    details.location = locationScore;
    weightedScore += locationScore * locationWeight;
    totalWeight += locationWeight;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

  // Генерация анализа с помощью AI
  let analysis = `Тур соответствует вашим критериям на ${finalScore}%.`;
  
  const providers: AIProvider[] = [
    {
      name: 'openrouter',
      enabled: !!process.env.OPENROUTER_API_KEY,
      apiKey: process.env.OPENROUTER_API_KEY,
      models: FREE_MODELS
    },
    {
      name: 'yandexgpt',
      enabled: !!process.env.YANDEX_GPT_API_KEY,
      apiKey: process.env.YANDEX_GPT_API_KEY
    }
  ];

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: TOUR_MATCH_ANALYSIS_PROMPT
    },
    {
      role: 'user',
      content: `Тур: ${tour.title || 'Без названия'}
Страна: ${tour.country}
Отель: ${tour.hotelName}, ${tour.starRating}*
Линия пляжа: ${tour.beachLine || 'не указана'}
Питание: ${tour.mealType}
Цена: ${tour.price}₽
Рейтинг отеля: ${tour.hotelRating || 'нет данных'}/10

Запрос клиента:
- Страны: ${preferences.countries?.join(', ') || 'любая'}
- Бюджет: ${preferences.budget || 'не указан'}₽
- Тип отдыха: ${preferences.vacationType || 'любой'}
- Важные параметры: ${Object.entries(priorities)
  .filter(([_, v]) => v > 7)
  .map(([k, v]) => `${k}(${v}/10)`)
  .join(', ')}

Оценка соответствия: ${finalScore}%
Детали: ${JSON.stringify(details)}`
    }
  ];

  // Пробуем получить анализ от AI
  for (const provider of providers) {
    const result = await tryAIProvider(messages, provider, {
      temperature: 0.7,
      maxTokens: 150
    });

    if (result) {
      analysis = result;
      aiLogger.info(`Generated tour analysis using ${provider.name}`);
      break;
    }
  }

  return { score: finalScore, details, analysis };
}