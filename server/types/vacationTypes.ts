/**
 * Типы отдыха и их параметры
 */

export enum VacationType {
  BEACH = 'beach',
  SKI = 'ski',
  EXCURSION = 'excursion',
  ACTIVE = 'active',
  WELLNESS = 'wellness',
  CRUISE = 'cruise',
  ECO = 'eco',
  BUSINESS = 'business',
  ROMANTIC = 'romantic',
  FAMILY = 'family',
  ADVENTURE = 'adventure',
  CULTURAL = 'cultural'
}

/**
 * Базовые параметры для всех типов отдыха
 */
export interface BaseParameters {
  price: number;           // Важность цены (1-10)
  location: number;        // Удобство расположения
  hotelRating: number;     // Рейтинг отеля
  userReviews: number;     // Отзывы пользователей
  safety: number;          // Безопасность
}

/**
 * Параметры для пляжного отдыха
 */
export interface BeachParameters extends BaseParameters {
  beachLine: number;       // Линия пляжа (1 - первая, 10 - дальше)
  beachQuality: number;    // Качество пляжа (песок, галька)
  waterTemperature: number; // Температура воды
  seaDistance: number;     // Расстояние до моря
  sunnyDays: number;       // Количество солнечных дней
  waterActivities: number; // Водные развлечения
  beachInfrastructure: number; // Инфраструктура пляжа
}

/**
 * Параметры для горнолыжного отдыха
 */
export interface SkiParameters extends BaseParameters {
  slopeDistance: number;   // Расстояние до подъемника
  slopeVariety: number;    // Разнообразие трасс
  snowQuality: number;     // Качество снега
  altitudeRange: number;   // Перепад высот
  skiPassPrice: number;    // Стоимость ски-пасса
  equipmentRental: number; // Прокат снаряжения
  apresSkiLife: number;    // Апре-ски жизнь
  beginnerFriendly: number; // Подходит для новичков
  seasonLength: number;    // Длина сезона
}

/**
 * Параметры для экскурсионного отдыха
 */
export interface ExcursionParameters extends BaseParameters {
  sightseeingDistance: number;  // Близость достопримечательностей
  historicalValue: number;      // Историческая ценность
  culturalRichness: number;     // Культурное богатство
  guidedTours: number;          // Качество экскурсий
  transportAccessibility: number; // Транспортная доступность
  localCuisine: number;         // Местная кухня
  museumsDensity: number;       // Количество музеев
  photoOpportunities: number;   // Фотогеничность мест
}

/**
 * Параметры для активного отдыха
 */
export interface ActiveParameters extends BaseParameters {
  adventureActivities: number;  // Экстремальные развлечения
  fitnessCenter: number;        // Спортзал/фитнес
  hikingTrails: number;         // Пешие маршруты
  bikeRoutes: number;           // Велосипедные маршруты
  waterSports: number;          // Водные виды спорта
  equipmentQuality: number;     // Качество снаряжения
  guidedAdventures: number;     // Организованные приключения
  difficultyLevels: number;     // Разнообразие сложности
}

/**
 * Параметры для велнес-отдыха
 */
export interface WellnessParameters extends BaseParameters {
  spaQuality: number;           // Качество СПА
  thermalSprings: number;       // Термальные источники
  medicalServices: number;      // Медицинские услуги
  dietaryOptions: number;       // Диетическое питание
  quietness: number;            // Тишина и спокойствие
  yogaMeditation: number;       // Йога и медитация
  detoxPrograms: number;        // Детокс-программы
  beautyTreatments: number;     // Косметические процедуры
}

/**
 * Параметры для круизов
 */
export interface CruiseParameters extends BaseParameters {
  shipSize: number;             // Размер корабля
  cabinComfort: number;         // Комфорт каюты
  routeInterest: number;        // Интересность маршрута
  onboardEntertainment: number; // Развлечения на борту
  diningOptions: number;        // Варианты питания
  portExcursions: number;       // Экскурсии в портах
  seaSickness: number;          // Защита от укачивания
  dressCode: number;            // Строгость дресс-кода
}

/**
 * Параметры для семейного отдыха
 */
export interface FamilyParameters extends BaseParameters {
  kidsClub: number;             // Детский клуб
  familyRooms: number;          // Семейные номера
  childrenMenu: number;         // Детское меню
  babysitting: number;          // Услуги няни
  kidsEntertainment: number;    // Детские развлечения
  poolSafety: number;           // Безопасность бассейнов
  playgrounds: number;          // Игровые площадки
  familyActivities: number;     // Семейные активности
  strollerAccessibility: number; // Доступность для колясок
}

/**
 * Карта соответствия типов отдыха и их параметров
 */
export const VACATION_PARAMETERS = {
  [VacationType.BEACH]: [
    'beachLine',
    'beachQuality',
    'waterTemperature',
    'seaDistance',
    'sunnyDays',
    'waterActivities',
    'beachInfrastructure'
  ],
  [VacationType.SKI]: [
    'slopeDistance',
    'slopeVariety',
    'snowQuality',
    'altitudeRange',
    'skiPassPrice',
    'equipmentRental',
    'apresSkiLife',
    'beginnerFriendly',
    'seasonLength'
  ],
  [VacationType.EXCURSION]: [
    'sightseeingDistance',
    'historicalValue',
    'culturalRichness',
    'guidedTours',
    'transportAccessibility',
    'localCuisine',
    'museumsDensity',
    'photoOpportunities'
  ],
  [VacationType.ACTIVE]: [
    'adventureActivities',
    'fitnessCenter',
    'hikingTrails',
    'bikeRoutes',
    'waterSports',
    'equipmentQuality',
    'guidedAdventures',
    'difficultyLevels'
  ],
  [VacationType.WELLNESS]: [
    'spaQuality',
    'thermalSprings',
    'medicalServices',
    'dietaryOptions',
    'quietness',
    'yogaMeditation',
    'detoxPrograms',
    'beautyTreatments'
  ],
  [VacationType.CRUISE]: [
    'shipSize',
    'cabinComfort',
    'routeInterest',
    'onboardEntertainment',
    'diningOptions',
    'portExcursions',
    'seaSickness',
    'dressCode'
  ],
  [VacationType.FAMILY]: [
    'kidsClub',
    'familyRooms',
    'childrenMenu',
    'babysitting',
    'kidsEntertainment',
    'poolSafety',
    'playgrounds',
    'familyActivities',
    'strollerAccessibility'
  ]
};

/**
 * Веса параметров по умолчанию для каждого типа отдыха
 */
export const DEFAULT_WEIGHTS = {
  [VacationType.BEACH]: {
    // Базовые параметры
    price: 8,
    location: 6,
    hotelRating: 7,
    userReviews: 7,
    safety: 6,
    // Специфичные для пляжа
    beachLine: 9,
    beachQuality: 9,
    waterTemperature: 8,
    seaDistance: 10,
    sunnyDays: 7,
    waterActivities: 5,
    beachInfrastructure: 6
  },
  [VacationType.SKI]: {
    // Базовые параметры
    price: 7,
    location: 8,
    hotelRating: 6,
    userReviews: 7,
    safety: 8,
    // Специфичные для лыж
    slopeDistance: 10,
    slopeVariety: 9,
    snowQuality: 10,
    altitudeRange: 7,
    skiPassPrice: 8,
    equipmentRental: 6,
    apresSkiLife: 5,
    beginnerFriendly: 6,
    seasonLength: 7
  },
  [VacationType.EXCURSION]: {
    // Базовые параметры
    price: 7,
    location: 10,
    hotelRating: 5,
    userReviews: 7,
    safety: 8,
    // Специфичные для экскурсий
    sightseeingDistance: 10,
    historicalValue: 9,
    culturalRichness: 9,
    guidedTours: 8,
    transportAccessibility: 9,
    localCuisine: 6,
    museumsDensity: 7,
    photoOpportunities: 6
  },
  [VacationType.ACTIVE]: {
    // Базовые параметры
    price: 6,
    location: 7,
    hotelRating: 5,
    userReviews: 8,
    safety: 9,
    // Специфичные для активного отдыха
    adventureActivities: 10,
    fitnessCenter: 6,
    hikingTrails: 9,
    bikeRoutes: 7,
    waterSports: 8,
    equipmentQuality: 9,
    guidedAdventures: 8,
    difficultyLevels: 7
  },
  [VacationType.WELLNESS]: {
    // Базовые параметры
    price: 5,
    location: 6,
    hotelRating: 9,
    userReviews: 8,
    safety: 7,
    // Специфичные для велнеса
    spaQuality: 10,
    thermalSprings: 9,
    medicalServices: 8,
    dietaryOptions: 8,
    quietness: 10,
    yogaMeditation: 7,
    detoxPrograms: 6,
    beautyTreatments: 7
  },
  [VacationType.CRUISE]: {
    // Базовые параметры
    price: 8,
    location: 4,
    hotelRating: 0, // Не применимо
    userReviews: 8,
    safety: 9,
    // Специфичные для круизов
    shipSize: 6,
    cabinComfort: 9,
    routeInterest: 10,
    onboardEntertainment: 8,
    diningOptions: 8,
    portExcursions: 7,
    seaSickness: 5,
    dressCode: 4
  },
  [VacationType.FAMILY]: {
    // Базовые параметры
    price: 8,
    location: 7,
    hotelRating: 8,
    userReviews: 9,
    safety: 10,
    // Специфичные для семей
    kidsClub: 9,
    familyRooms: 10,
    childrenMenu: 8,
    babysitting: 6,
    kidsEntertainment: 9,
    poolSafety: 10,
    playgrounds: 7,
    familyActivities: 8,
    strollerAccessibility: 7
  }
};

/**
 * Описания типов отдыха для пользователя
 */
export const VACATION_TYPE_DESCRIPTIONS = {
  [VacationType.BEACH]: {
    title: '🏖️ Пляжный отдых',
    description: 'Море, солнце, песок. Идеально для расслабления и загара.',
    keywords: ['море', 'пляж', 'загар', 'купание', 'релакс']
  },
  [VacationType.SKI]: {
    title: '🎿 Горнолыжный отдых',
    description: 'Горы, снег, адреналин. Для любителей зимних видов спорта.',
    keywords: ['лыжи', 'сноуборд', 'горы', 'снег', 'зима']
  },
  [VacationType.EXCURSION]: {
    title: '🏛️ Экскурсионный туризм',
    description: 'История, культура, достопримечательности. Познавательный отдых.',
    keywords: ['экскурсии', 'музеи', 'история', 'культура', 'достопримечательности']
  },
  [VacationType.ACTIVE]: {
    title: '🏃 Активный отдых',
    description: 'Спорт, приключения, адреналин. Для любителей движения.',
    keywords: ['спорт', 'треккинг', 'велосипед', 'рафтинг', 'активность']
  },
  [VacationType.WELLNESS]: {
    title: '🧘 Велнес и СПА',
    description: 'Здоровье, красота, релаксация. Восстановление сил.',
    keywords: ['спа', 'массаж', 'йога', 'детокс', 'оздоровление']
  },
  [VacationType.CRUISE]: {
    title: '🚢 Круизы',
    description: 'Морские путешествия с комфортом. Несколько стран за одну поездку.',
    keywords: ['круиз', 'корабль', 'море', 'лайнер', 'каюта']
  },
  [VacationType.ECO]: {
    title: '🌿 Экотуризм',
    description: 'Природа, экология, аутентичность. Единение с природой.',
    keywords: ['природа', 'экология', 'глэмпинг', 'заповедник', 'дикая природа']
  },
  [VacationType.BUSINESS]: {
    title: '💼 Деловой туризм',
    description: 'Конференции, встречи, нетворкинг. Совмещение работы и отдыха.',
    keywords: ['бизнес', 'конференция', 'деловая поездка', 'MICE']
  },
  [VacationType.ROMANTIC]: {
    title: '💑 Романтический отдых',
    description: 'Для двоих. Уединение, романтика, особая атмосфера.',
    keywords: ['романтика', 'медовый месяц', 'для двоих', 'свадьба']
  },
  [VacationType.FAMILY]: {
    title: '👨‍👩‍👧‍👦 Семейный отдых',
    description: 'Для всей семьи. Детские клубы, анимация, безопасность.',
    keywords: ['семья', 'дети', 'детский клуб', 'анимация', 'семейный']
  },
  [VacationType.ADVENTURE]: {
    title: '🗺️ Приключенческий туризм',
    description: 'Экспедиции, открытия, неизведанное. Для искателей приключений.',
    keywords: ['приключения', 'экспедиция', 'джунгли', 'сафари', 'экстрим']
  },
  [VacationType.CULTURAL]: {
    title: '🎭 Культурный туризм',
    description: 'Искусство, традиции, фестивали. Погружение в культуру.',
    keywords: ['культура', 'искусство', 'фестиваль', 'традиции', 'театр']
  }
};

/**
 * Определение типа отдыха по ключевым словам
 */
export function detectVacationType(text: string): VacationType[] {
  const lowerText = text.toLowerCase();
  const detectedTypes: VacationType[] = [];
  
  Object.entries(VACATION_TYPE_DESCRIPTIONS).forEach(([type, info]) => {
    const hasKeyword = info.keywords.some(keyword => 
      lowerText.includes(keyword)
    );
    if (hasKeyword) {
      detectedTypes.push(type as VacationType);
    }
  });
  
  // Если ничего не найдено, возвращаем пляжный по умолчанию
  return detectedTypes.length > 0 ? detectedTypes : [VacationType.BEACH];
}

/**
 * Получение релевантных параметров для типов отдыха
 */
export function getRelevantParameters(vacationTypes: VacationType[]): string[] {
  const allParameters = new Set<string>();
  
  // Базовые параметры для всех типов
  ['price', 'location', 'hotelRating', 'userReviews', 'safety'].forEach(p => 
    allParameters.add(p)
  );
  
  // Специфичные параметры для каждого типа
  vacationTypes.forEach(type => {
    const typeParams = VACATION_PARAMETERS[type] || [];
    typeParams.forEach(p => allParameters.add(p));
  });
  
  return Array.from(allParameters);
}

/**
 * Получение весов для параметров на основе типов отдыха
 */
export function getParameterWeights(vacationTypes: VacationType[]): Record<string, number> {
  const weights: Record<string, number> = {};
  const relevantParams = getRelevantParameters(vacationTypes);
  
  // Для каждого параметра берем максимальный вес из всех типов
  relevantParams.forEach(param => {
    let maxWeight = 0;
    vacationTypes.forEach(type => {
      const typeWeights = DEFAULT_WEIGHTS[type] || {};
      if (typeWeights[param] > maxWeight) {
        maxWeight = typeWeights[param];
      }
    });
    weights[param] = maxWeight || 5; // По умолчанию 5
  });
  
  return weights;
}