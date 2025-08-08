/**
 * Утилиты для парсинга пользовательского ввода
 */

/**
 * Парсинг даты из текста
 */
export function parseDate(text: string): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Словарь месяцев
  const months: Record<string, number> = {
    'январь': 0, 'января': 0, 'янв': 0,
    'февраль': 1, 'февраля': 1, 'фев': 1,
    'март': 2, 'марта': 2, 'мар': 2,
    'апрель': 3, 'апреля': 3, 'апр': 3,
    'май': 4, 'мая': 4,
    'июнь': 5, 'июня': 5, 'июн': 5,
    'июль': 6, 'июля': 6, 'июл': 6,
    'август': 7, 'августа': 7, 'авг': 7,
    'сентябрь': 8, 'сентября': 8, 'сен': 8, 'сент': 8,
    'октябрь': 9, 'октября': 9, 'окт': 9,
    'ноябрь': 10, 'ноября': 10, 'ноя': 10,
    'декабрь': 11, 'декабря': 11, 'дек': 11
  };
  
  const lowerText = text.toLowerCase();
  
  // Попытка найти конкретные даты (15-25 августа)
  const rangeMatch = lowerText.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*([а-я]+)/);
  if (rangeMatch) {
    const startDay = parseInt(rangeMatch[1]);
    const endDay = parseInt(rangeMatch[2]);
    const monthName = rangeMatch[3];
    const month = months[monthName];
    
    if (month !== undefined) {
      let year = currentYear;
      // Если месяц уже прошел, берем следующий год
      if (month < currentMonth || (month === currentMonth && startDay < now.getDate())) {
        year++;
      }
      
      return {
        startDate: new Date(year, month, startDay),
        endDate: new Date(year, month, endDay)
      };
    }
  }
  
  // Попытка найти месяц
  for (const [monthName, monthIndex] of Object.entries(months)) {
    if (lowerText.includes(monthName)) {
      let year = currentYear;
      // Если месяц уже прошел, берем следующий год
      if (monthIndex < currentMonth) {
        year++;
      }
      
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0); // Последний день месяца
      
      return { startDate, endDate };
    }
  }
  
  // Относительные даты
  if (lowerText.includes('лет') && (lowerText.includes('это') || lowerText.includes('текущ'))) {
    return {
      startDate: new Date(currentYear, 5, 1), // Июнь
      endDate: new Date(currentYear, 8, 30)   // Сентябрь
    };
  }
  
  if (lowerText.includes('зим')) {
    return {
      startDate: new Date(currentYear, 11, 1),     // Декабрь
      endDate: new Date(currentYear + 1, 2, 31)    // Март
    };
  }
  
  return { startDate: null, endDate: null };
}

/**
 * Парсинг длительности из текста
 */
export function parseDuration(text: string): number | null {
  const lowerText = text.toLowerCase();
  
  // Прямое указание числа
  const numberMatch = text.match(/(\d+)/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }
  
  // Словесные обозначения
  if (lowerText.includes('недел')) {
    return 7;
  }
  if (lowerText.includes('две недел')) {
    return 14;
  }
  if (lowerText.includes('10 дн') || lowerText.includes('десять дн')) {
    return 10;
  }
  
  return null;
}

/**
 * Парсинг бюджета из текста
 */
export function parseBudget(text: string): number | null {
  const lowerText = text.toLowerCase();
  
  // Убираем пробелы и нечисловые символы кроме цифр
  const cleanText = text.replace(/[^\d]/g, '');
  
  // Прямое число
  const directNumber = parseInt(cleanText);
  if (directNumber && directNumber > 0) {
    return directNumber;
  }
  
  // Поиск чисел с "тысяч" или "тыс"
  const thousandMatch = lowerText.match(/(\d+)\s*(тыс|тысяч)/);
  if (thousandMatch) {
    return parseInt(thousandMatch[1]) * 1000;
  }
  
  // Поиск чисел с "к" (100к = 100000)
  const kMatch = lowerText.match(/(\d+)\s*к/);
  if (kMatch) {
    return parseInt(kMatch[1]) * 1000;
  }
  
  return null;
}

/**
 * Парсинг количества путешественников
 */
export function parseTravelers(text: string): {
  adults: number;
  children: number;
  childrenAges?: number[];
} {
  const lowerText = text.toLowerCase();
  
  // Поиск взрослых
  const adultsMatch = lowerText.match(/(\d+)\s*взросл/);
  const adults = adultsMatch ? parseInt(adultsMatch[1]) : 2;
  
  // Поиск детей
  const childrenMatch = lowerText.match(/(\d+)\s*(?:реб|дет)/);
  const children = childrenMatch ? parseInt(childrenMatch[1]) : 0;
  
  // Поиск возрастов детей
  const agesMatches = Array.from(lowerText.matchAll(/(?:реб\w*|дет\w*)\s+(\d+)\s*лет/g));
  const childrenAges = agesMatches.map(m => parseInt(m[1]));
  
  return {
    adults,
    children,
    childrenAges: childrenAges.length > 0 ? childrenAges : undefined
  };
}

/**
 * Извлечение стран из текста
 */
export function parseCountries(text: string): string[] {
  const countries = text
    .split(/[,，、;]/)
    .map(c => c.trim())
    .filter(c => c.length > 0)
    .map(c => {
      // Нормализация названий стран
      const normalized = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
      
      // Словарь синонимов
      const synonyms: Record<string, string> = {
        'турция': 'Турция',
        'египет': 'Египет',
        'оаэ': 'ОАЭ',
        'эмираты': 'ОАЭ',
        'тайланд': 'Таиланд',
        'таиланд': 'Таиланд',
        'греция': 'Греция',
        'кипр': 'Кипр',
        'испания': 'Испания',
        'италия': 'Италия',
        'франция': 'Франция',
        'черногория': 'Черногория',
        'хорватия': 'Хорватия',
        'болгария': 'Болгария',
        'грузия': 'Грузия',
        'армения': 'Армения',
        'вьетнам': 'Вьетнам',
        'индия': 'Индия',
        'шри-ланка': 'Шри-Ланка',
        'мальдивы': 'Мальдивы',
        'сейшелы': 'Сейшелы',
        'куба': 'Куба',
        'доминикана': 'Доминикана',
        'мексика': 'Мексика',
        'бали': 'Индонезия',
        'индонезия': 'Индонезия'
      };
      
      return synonyms[normalized.toLowerCase()] || normalized;
    });
  
  // Удаляем дубликаты
  return [...new Set(countries)];
}