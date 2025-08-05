import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { app, server } from '../../server/index';
import { db } from '../../db';
import { profiles, tours, tourMatches } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateTestUser } from '../helpers/auth';

describe('Tour Search Flow', () => {
  let testUserId: string;
  let accessToken: string;
  
  beforeAll(async () => {
    // Ждем запуска сервера
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Очистка тестовых данных
    if (testUserId) {
      await db.delete(tourMatches).where(eq(tourMatches.userId, testUserId));
      await db.delete(profiles).where(eq(profiles.userId, testUserId));
    }
    server.close();
  });

  beforeEach(async () => {
    // Создаем и аутентифицируем тестового пользователя
    const auth = await authenticateTestUser(app);
    testUserId = auth.userId;
    accessToken = auth.accessToken;
  });

  describe('Profile Creation and Update', () => {
    it('should create user profile with tour preferences', async () => {
      const profileData = {
        name: 'Test Traveler',
        vacationType: 'beach',
        countries: ['турция', 'египет'],
        destination: 'Турция',
        dateType: 'flexible',
        flexibleMonth: 'август',
        tripDuration: 7,
        budget: 150000,
        budgetPerPerson: true,
        peopleCount: 2,
        priorities: {
          starRating: 8,
          beachLine: 10,
          mealType: 7,
          hotelRating: 6,
          priceValue: 9
        }
      };

      const response = await request(app)
        .post('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileData)
        .expect(200);

      expect(response.body.profile).toMatchObject({
        userId: testUserId,
        name: 'Test Traveler',
        vacationType: 'beach',
        countries: ['турция', 'египет']
      });
    });

    it('should update existing profile', async () => {
      // Создаем профиль
      await db.insert(profiles).values({
        userId: testUserId,
        name: 'Old Name',
        budget: 100000
      });

      // Обновляем
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'New Name',
          budget: 200000
        })
        .expect(200);

      expect(response.body.profile.name).toBe('New Name');
      expect(response.body.profile.budget).toBe(200000);
    });
  });

  describe('Text Request Analysis', () => {
    it('should analyze natural language tour request', async () => {
      const response = await request(app)
        .post('/api/analyze-request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Хочу в Турцию на море, отель 5 звезд, все включено, бюджет 150 тысяч на двоих'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        destination: expect.stringContaining('Турция'),
        starRating: expect.any(Number),
        mealType: expect.stringContaining('все включено'),
        budget: expect.any(Number),
        peopleCount: 2
      });

      expect(response.body.starRating).toBeGreaterThanOrEqual(5);
      expect(response.body.budget).toBeGreaterThanOrEqual(140000);
      expect(response.body.budget).toBeLessThanOrEqual(160000);
    });

    it('should handle complex requests with dates', async () => {
      const response = await request(app)
        .post('/api/analyze-request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Ищу тур в Египет с 15 по 22 августа, первая линия, хороший риф для снорклинга'
        })
        .expect(200);

      expect(response.body.destination).toContain('Египет');
      expect(response.body.beachLine).toBe(1);
      expect(response.body.priorities).toHaveProperty('beachLine');
      expect(response.body.priorities.beachLine).toBeGreaterThan(7);
    });

    it('should fallback to basic parsing on AI failure', async () => {
      // Отправляем запрос который может вызвать ошибку AI
      const response = await request(app)
        .post('/api/analyze-request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          message: 'Турция 100000 руб'
        })
        .expect(200);

      // Даже при fallback должны извлечь базовую информацию
      expect(response.body.destination).toContain('Турция');
      expect(response.body.budget).toBe(100000);
    });
  });

  describe('Tour Search', () => {
    beforeEach(async () => {
      // Создаем профиль для поиска
      await db.insert(profiles).values({
        userId: testUserId,
        name: 'Tour Searcher',
        destination: 'Турция',
        countries: ['турция'],
        dateType: 'flexible',
        flexibleMonth: 'август',
        tripDuration: 7,
        budget: 150000,
        budgetPerPerson: true,
        peopleCount: 2,
        priorities: {
          starRating: 8,
          beachLine: 9,
          mealType: 7,
          priceValue: 8
        }
      });
    });

    it('should search tours based on profile', async () => {
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          userId: testUserId
        })
        .expect(200);

      expect(response.body).toHaveProperty('tours');
      expect(Array.isArray(response.body.tours)).toBe(true);
      
      if (response.body.tours.length > 0) {
        const tour = response.body.tours[0];
        expect(tour).toHaveProperty('hotelName');
        expect(tour).toHaveProperty('price');
        expect(tour).toHaveProperty('matchScore');
        expect(tour.country.toLowerCase()).toContain('турц');
      }
    });

    it('should filter tours by parameters', async () => {
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          userId: testUserId,
          minStars: 5,
          maxPrice: 200000,
          mealType: 'ai'
        })
        .expect(200);

      response.body.tours.forEach(tour => {
        expect(tour.starRating).toBeGreaterThanOrEqual(5);
        expect(tour.price).toBeLessThanOrEqual(200000);
        if (tour.mealType) {
          expect(tour.mealType.toLowerCase()).toContain('включено');
        }
      });
    });

    it('should calculate match scores correctly', async () => {
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ userId: testUserId })
        .expect(200);

      if (response.body.tours.length > 0) {
        // Туры должны быть отсортированы по matchScore
        for (let i = 1; i < response.body.tours.length; i++) {
          expect(response.body.tours[i-1].matchScore)
            .toBeGreaterThanOrEqual(response.body.tours[i].matchScore);
        }

        // Проверяем что matchScore в разумных пределах
        response.body.tours.forEach(tour => {
          expect(tour.matchScore).toBeGreaterThanOrEqual(0);
          expect(tour.matchScore).toBeLessThanOrEqual(100);
        });
      }
    });
  });

  describe('Recommended Tours', () => {
    it('should get personalized recommendations', async () => {
      // Создаем профиль с четкими предпочтениями
      await db.insert(profiles).values({
        userId: testUserId,
        destination: 'Турция',
        budget: 150000,
        priorities: {
          starRating: 10, // Очень важна звездность
          beachLine: 10,  // Очень важна первая линия
          priceValue: 3   // Цена не очень важна
        }
      });

      const response = await request(app)
        .get(`/api/tours/recommended/${testUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      if (response.body.tours.length > 0) {
        // Рекомендации должны учитывать приоритеты
        const topRecommendations = response.body.tours.slice(0, 5);
        topRecommendations.forEach(tour => {
          expect(tour.starRating).toBeGreaterThanOrEqual(4);
          expect(tour.beachLine).toBeLessThanOrEqual(2);
        });
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle search with missing profile gracefully', async () => {
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ userId: 'non_existent_user' })
        .expect(200);

      // Должен вернуть пустой массив или дефолтные туры
      expect(response.body).toHaveProperty('tours');
      expect(Array.isArray(response.body.tours)).toBe(true);
    });

    it('should handle invalid date ranges', async () => {
      await db.insert(profiles).values({
        userId: testUserId,
        destination: 'Турция',
        dateType: 'fixed',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-11-01'), // Конечная дата раньше начальной
      });

      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ userId: testUserId })
        .expect(200);

      // Должен обработать некорректные даты
      expect(response.body).toHaveProperty('tours');
    });

    it('should respect rate limits', async () => {
      // Делаем много запросов подряд
      const requests = Array(20).fill(null).map(() => 
        request(app)
          .get('/api/tours')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ userId: testUserId })
      );

      const responses = await Promise.all(requests);
      
      // Некоторые запросы должны быть ограничены
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Tour Search Performance', () => {
    it('should return results within acceptable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ userId: testUserId })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Поиск должен завершаться менее чем за 5 секунд
      expect(responseTime).toBeLessThan(5000);
    });

    it('should cache repeated searches', async () => {
      // Первый запрос
      const start1 = Date.now();
      await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ userId: testUserId, cacheKey: 'test_cache' })
        .expect(200);
      const time1 = Date.now() - start1;

      // Второй идентичный запрос (должен быть из кеша)
      const start2 = Date.now();
      await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ userId: testUserId, cacheKey: 'test_cache' })
        .expect(200);
      const time2 = Date.now() - start2;

      // Второй запрос должен быть значительно быстрее
      expect(time2).toBeLessThan(time1 / 2);
    });
  });
});