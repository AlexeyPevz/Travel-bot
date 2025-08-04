// Define vacation types and their associated criteria
export interface VacationType {
  name: string;
  key: string;
  criteria: {
    key: string;
    label: string;
    description?: string;
  }[];
}

// Vacation types with their criteria
export const vacationTypes: VacationType[] = [
  {
    name: "Пляжный отдых",
    key: "beach",
    criteria: [
      { key: "beachLine", label: "Первая линия", description: "Важность расположения отеля рядом с пляжем" },
      { key: "allInclusive", label: "Питание (All Inclusive)", description: "Предпочтение питанию «все включено»" },
      { key: "renovation", label: "Реновация отеля", description: "Важность недавнего ремонта в отеле" },
      { key: "animation", label: "Анимация", description: "Наличие развлекательной программы в отеле" },
      { key: "reviews", label: "Отзывы", description: "Высокий рейтинг отеля по отзывам" },
      { key: "airportDistance", label: "Удаленность от аэропорта", description: "Предпочтение небольшому расстоянию от аэропорта" }
    ]
  },
  {
    name: "Горнолыжный отдых",
    key: "ski",
    criteria: [
      { key: "liftDistance", label: "Расстояние до подъемника", description: "Важность близкого расположения к подъемникам" },
      { key: "skiInSkiOut", label: "Ski-in/Ski-out", description: "Возможность спуска/подъема на лыжах прямо от отеля" },
      { key: "equipment", label: "Прокат снаряжения", description: "Наличие пункта проката лыжного снаряжения" },
      { key: "sauna", label: "Сауна/Баня", description: "Наличие сауны или бани на территории" },
      { key: "spa", label: "SPA-центр", description: "Наличие SPA-центра в отеле" },
      { key: "entertainment", label: "Развлечения", description: "Наличие развлекательной инфраструктуры" }
    ]
  },
  {
    name: "Экскурсионный тур",
    key: "excursion",
    criteria: [
      { key: "centerProximity", label: "Близость к центру", description: "Расположение отеля в центре города" },
      { key: "programIntensity", label: "Насыщенность программы", description: "Количество и качество экскурсий" },
      { key: "guideQuality", label: "Качество гида", description: "Важность профессионального русскоговорящего гида" },
      { key: "transportation", label: "Транспорт", description: "Комфортность транспорта для перемещений" },
      { key: "mealPlan", label: "Питание", description: "Варианты питания в туре" }
    ]
  },
  {
    name: "Отдых в тепле",
    key: "warm",
    criteria: [
      { key: "temperature", label: "Температура", description: "Предпочтительная температура воздуха" },
      { key: "cleanliness", label: "Чистота", description: "Уровень чистоты в отеле и на территории" },
      { key: "nature", label: "Природа", description: "Близость к природным достопримечательностям" },
      { key: "quietness", label: "Тишина", description: "Спокойная обстановка без шума" },
      { key: "serviceLevel", label: "Уровень сервиса", description: "Качество обслуживания" }
    ]
  },
  {
    name: "Семейный отдых",
    key: "family",
    criteria: [
      { key: "kidsZone", label: "Детская зона", description: "Наличие игровых площадок и детских клубов" },
      { key: "kidsMenu", label: "Детское питание", description: "Специальное меню для детей" },
      { key: "kidsAnimation", label: "Детская анимация", description: "Развлекательная программа для детей" },
      { key: "safety", label: "Безопасность", description: "Уровень безопасности для детей" },
      { key: "medicalService", label: "Медицинская помощь", description: "Доступность медицинских услуг" }
    ]
  },
  {
    name: "Уединенный отдых",
    key: "secluded",
    criteria: [
      { key: "privacy", label: "Приватность", description: "Уровень приватности и уединения" },
      { key: "crowdedness", label: "Малолюдность", description: "Отсутствие большого количества туристов" },
      { key: "naturalBeauty", label: "Природная красота", description: "Живописные природные окрестности" },
      { key: "tranquility", label: "Спокойствие", description: "Тихая и спокойная обстановка" },
      { key: "exclusivity", label: "Эксклюзивность", description: "Уникальность и особый статус места" }
    ]
  }
];

// Get vacation type by key
export function getVacationTypeByKey(key: string): VacationType | undefined {
  return vacationTypes.find(type => type.key === key);
}

// Get vacation type by name
export function getVacationTypeByName(name: string): VacationType | undefined {
  return vacationTypes.find(type => type.name === name);
}

// Get all vacation type keys
export function getAllVacationTypeKeys(): string[] {
  return vacationTypes.map(type => type.key);
}

// Get all vacation type names
export function getAllVacationTypeNames(): string[] {
  return vacationTypes.map(type => type.name);
}