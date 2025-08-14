import { PriorityWeights } from '../../shared/schema-v2';

export const defaultPriorityProfiles = [
  {
    name: "Пляжный отдых",
    description: "Идеально для любителей моря и солнца",
    isDefault: true,
    weights: {
      price: 7,
      starRating: 6,
      beachLine: 10,
      mealType: 8,
      location: 5,
      reviews: 7,
      familyFriendly: 5,
      activities: 4,
      quietness: 6
    } as PriorityWeights
  },
  {
    name: "Семейный отдых",
    description: "Оптимально для отдыха с детьми",
    isDefault: true,
    weights: {
      price: 6,
      starRating: 8,
      beachLine: 7,
      mealType: 9,
      location: 7,
      reviews: 8,
      familyFriendly: 10,
      activities: 9,
      quietness: 4
    } as PriorityWeights
  },
  {
    name: "Активный отдых",
    description: "Для любителей развлечений и активностей",
    isDefault: true,
    weights: {
      price: 5,
      starRating: 7,
      beachLine: 5,
      mealType: 6,
      location: 9,
      reviews: 7,
      familyFriendly: 3,
      activities: 10,
      quietness: 2
    } as PriorityWeights
  },
  {
    name: "Спокойный отдых",
    description: "Для тех, кто ценит тишину и покой",
    isDefault: true,
    weights: {
      price: 6,
      starRating: 8,
      beachLine: 8,
      mealType: 7,
      location: 4,
      reviews: 8,
      familyFriendly: 2,
      activities: 2,
      quietness: 10
    } as PriorityWeights
  },
  {
    name: "Экономичный отдых",
    description: "Максимум впечатлений за разумные деньги",
    isDefault: true,
    weights: {
      price: 10,
      starRating: 4,
      beachLine: 6,
      mealType: 7,
      location: 5,
      reviews: 8,
      familyFriendly: 5,
      activities: 5,
      quietness: 5
    } as PriorityWeights
  },
  {
    name: "Люксовый отдых",
    description: "Только лучшее - без компромиссов",
    isDefault: true,
    weights: {
      price: 2,
      starRating: 10,
      beachLine: 9,
      mealType: 10,
      location: 8,
      reviews: 9,
      familyFriendly: 5,
      activities: 7,
      quietness: 8
    } as PriorityWeights
  },
  {
    name: "Романтический отдых",
    description: "Идеально для пар",
    isDefault: true,
    weights: {
      price: 5,
      starRating: 8,
      beachLine: 9,
      mealType: 8,
      location: 7,
      reviews: 8,
      familyFriendly: 1,
      activities: 5,
      quietness: 9
    } as PriorityWeights
  }
];