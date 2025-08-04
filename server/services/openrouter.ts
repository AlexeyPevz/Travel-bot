import axios from 'axios';
import { aiLogger } from '../utils/logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free models available on OpenRouter
const FREE_MODELS = [
  'mistralai/mistral-7b-instruct:free',
  'huggingface/zephyr-7b-beta:free',
  'openchat/openchat-3.5:free',
  'gryphe/mythomist-7b:free',
  'nousresearch/nous-capybara-7b:free'
];

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
 * Анализ текстового запроса пользователя для извлечения параметров тура
 */
export async function analyzeTourRequest(userMessage: string): Promise<TourPreferences> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    aiLogger.warn('OpenRouter API key not found, using basic text parsing');
    return parseBasicTourRequest(userMessage);
  }

  try {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Ты - помощник по подбору туров. Проанализируй сообщение пользователя и извлеки параметры для поиска тура.
        Верни JSON объект со следующими полями (если информация есть в сообщении):
        - vacationType: тип отдыха (beach, active, cultural, relaxing, family)
        - countries: массив стран
        - budget: бюджет в рублях
        - startDate: дата начала в формате YYYY-MM-DD
        - endDate: дата окончания в формате YYYY-MM-DD
        - duration: длительность в днях
        - peopleCount: количество человек
        - priorities: объект с приоритетами (starRating, beachLine, mealType, price) от 0 до 10
        
        Примеры:
        "Хочу на море в Турцию, 4 звезды, первая линия, все включено, бюджет 150000 на двоих" ->
        {
          "vacationType": "beach",
          "countries": ["Турция"],
          "budget": 150000,
          "peopleCount": 2,
          "priorities": {
            "starRating": 7,
            "beachLine": 10,
            "mealType": 9,
            "price": 7
          }
        }`
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: FREE_MODELS[0], // Use the first free model
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'https://travel-bot.com',
          'X-Title': 'AI Travel Agent Bot'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    aiLogger.error('Error analyzing tour request with OpenRouter:', error);
  }

  // Fallback to basic parsing
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
  if (lowerText.includes('двоих') || lowerText.includes('вдвоем')) {
    result.peopleCount = 2;
  } else if (lowerText.includes('троих') || lowerText.includes('втроем')) {
    result.peopleCount = 3;
  } else if (lowerText.includes('четверых') || lowerText.includes('вчетвером')) {
    result.peopleCount = 4;
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
 * Расчет соответствия тура профилю пользователя с учетом весов
 */
export async function calculateTourMatchScore(
  tour: any,
  preferences: TourPreferences,
  priorities: Record<string, number>
): Promise<{ score: number; details: Record<string, number>; analysis: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
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
    const mealScore = tour.mealType.includes('all') || tour.mealType.includes('ai') ? 100 : 60;
    details.mealType = mealScore;
    weightedScore += mealScore * priorities.mealType;
    totalWeight += priorities.mealType;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 50;

  // Генерация анализа с помощью AI если доступен ключ
  let analysis = `Тур соответствует вашим критериям на ${finalScore}%.`;
  
  if (apiKey) {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Ты - эксперт по турам. Кратко объясни, почему этот тур подходит или не подходит пользователю (1-2 предложения).'
        },
        {
          role: 'user',
          content: `Тур: ${tour.title}, ${tour.starRating}*, ${tour.mealType}, ${tour.price}₽
          Предпочтения: ${JSON.stringify(preferences)}
          Оценка соответствия: ${finalScore}%`
        }
      ];

      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: FREE_MODELS[0],
          messages,
          temperature: 0.7,
          max_tokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      analysis = response.data.choices[0]?.message?.content || analysis;
    } catch (error) {
      aiLogger.error('Error generating AI analysis:', error);
    }
  }

  return { score: finalScore, details, analysis };
}