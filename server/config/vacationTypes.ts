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
export const vacationTypes = [
  {
    key: 'beach',
    name: '🏖 Пляжный отдых',
    description: 'Море, солнце, пляж'
  },
  {
    key: 'active',
    name: '🏃 Активный отдых',
    description: 'Спорт, походы, приключения'
  },
  {
    key: 'cultural',
    name: '🏛 Культурный туризм',
    description: 'Экскурсии, музеи, достопримечательности'
  },
  {
    key: 'relaxing',
    name: '🧘 Спокойный отдых',
    description: 'СПА, релаксация, уединение'
  },
  {
    key: 'family',
    name: '👨‍👩‍👧‍👦 Семейный отдых',
    description: 'Отдых с детьми, анимация, детские клубы'
  },
  {
    key: 'romantic',
    name: '💑 Романтический отдых',
    description: 'Для пар, медовый месяц'
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