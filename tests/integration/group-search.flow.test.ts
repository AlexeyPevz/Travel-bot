import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { app, server } from '../../server/index';
import { db } from '../../db';
import { profiles, groupProfiles, groupTourVotes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateTestUser } from '../helpers/auth';

describe('Group Tour Search Flow', () => {
  let user1: { userId: string; accessToken: string };
  let user2: { userId: string; accessToken: string };
  let user3: { userId: string; accessToken: string };
  let groupChatId: string;
  let groupId: number;
  
  beforeAll(async () => {
    // Ждем запуска сервера
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Создаем трех тестовых пользователей
    user1 = await authenticateTestUser(app, 'user1');
    user2 = await authenticateTestUser(app, 'user2');
    user3 = await authenticateTestUser(app, 'user3');
    
    groupChatId = `test_group_${Date.now()}`;
  });

  afterAll(async () => {
    // Очистка тестовых данных
    if (groupId) {
      await db.delete(groupTourVotes).where(eq(groupTourVotes.groupId, groupId));
      await db.delete(groupProfiles).where(eq(groupProfiles.id, groupId));
    }
    
    await db.delete(profiles).where(eq(profiles.userId, user1.userId));
    await db.delete(profiles).where(eq(profiles.userId, user2.userId));
    await db.delete(profiles).where(eq(profiles.userId, user3.userId));
    
    server.close();
  });

  describe('Group Creation and Management', () => {
    it('should create a group for tour search', async () => {
      const response = await request(app)
        .post('/api/group/create')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .send({
          chatId: groupChatId,
          chatTitle: 'Test Travel Group',
          memberIds: [user1.userId, user2.userId, user3.userId]
        })
        .expect(200);

      expect(response.body.group).toMatchObject({
        chatId: groupChatId,
        chatTitle: 'Test Travel Group',
        memberIds: expect.arrayContaining([user1.userId, user2.userId, user3.userId]),
        isActive: true
      });

      groupId = response.body.group.id;
    });

    it('should update group members', async () => {
      const response = await request(app)
        .put(`/api/group/${groupChatId}/members`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .send({
          memberIds: [user1.userId, user2.userId] // Удаляем user3
        })
        .expect(200);

      expect(response.body.group.memberIds).toHaveLength(2);
      expect(response.body.group.memberIds).not.toContain(user3.userId);
    });
  });

  describe('Group Profile Aggregation', () => {
    beforeEach(async () => {
      // Создаем профили для всех участников с разными предпочтениями
      await db.insert(profiles).values([
        {
          userId: user1.userId,
          name: 'User 1',
          destination: 'Турция',
          countries: ['турция', 'египет'],
          budget: 100000,
          budgetPerPerson: true,
          peopleCount: 1,
          priorities: {
            starRating: 10,
            beachLine: 8,
            mealType: 6,
            priceValue: 7
          }
        },
        {
          userId: user2.userId,
          name: 'User 2',
          destination: 'Египет',
          countries: ['египет', 'турция'],
          budget: 150000,
          budgetPerPerson: true,
          peopleCount: 1,
          priorities: {
            starRating: 7,
            beachLine: 10,
            mealType: 8,
            priceValue: 9
          }
        },
        {
          userId: user3.userId,
          name: 'User 3',
          destination: 'Турция',
          countries: ['турция'],
          budget: 120000,
          budgetPerPerson: true,
          peopleCount: 1,
          priorities: {
            starRating: 8,
            beachLine: 9,
            mealType: 10,
            priceValue: 8
          }
        }
      ]);
    });

    it('should aggregate group profiles correctly', async () => {
      const response = await request(app)
        .post(`/api/group/${groupChatId}/aggregate`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      const aggregated = response.body.aggregatedProfile;
      
      // Страны должны объединяться
      expect(aggregated.countries).toContain('турция');
      expect(aggregated.countries).toContain('египет');
      
      // Бюджет должен суммироваться
      expect(aggregated.budget).toBeGreaterThanOrEqual(350000); // Минимум сумма всех
      
      // Приоритеты должны усредняться
      expect(aggregated.priorities.starRating).toBeCloseTo(8.3, 1); // (10+7+8)/3
      expect(aggregated.priorities.beachLine).toBeCloseTo(9, 1);     // (8+10+9)/3
      expect(aggregated.priorities.mealType).toBeCloseTo(8, 1);      // (6+8+10)/3
    });

    it('should handle missing profiles gracefully', async () => {
      // Удаляем профиль одного пользователя
      await db.delete(profiles).where(eq(profiles.userId, user3.userId));

      const response = await request(app)
        .post(`/api/group/${groupChatId}/aggregate`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      // Должен агрегировать только существующие профили
      expect(response.body.aggregatedProfile).toBeDefined();
      expect(response.body.aggregatedProfile.budget).toBeGreaterThanOrEqual(250000);
    });
  });

  describe('Group Tour Search', () => {
    it('should search tours for the group', async () => {
      // Сначала агрегируем профили
      await request(app)
        .post(`/api/group/${groupChatId}/aggregate`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      // Затем ищем туры
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({
          groupId: groupChatId
        })
        .expect(200);

      expect(response.body.tours).toBeDefined();
      expect(Array.isArray(response.body.tours)).toBe(true);
      
      if (response.body.tours.length > 0) {
        // Туры должны соответствовать групповым критериям
        const tour = response.body.tours[0];
        expect(['турция', 'египет']).toContain(tour.country.toLowerCase());
      }
    });

    it('should respect group budget constraints', async () => {
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({
          groupId: groupChatId,
          maxPrice: 400000 // Групповой бюджет
        })
        .expect(200);

      response.body.tours.forEach(tour => {
        expect(tour.price).toBeLessThanOrEqual(400000);
      });
    });
  });

  describe('Group Tour Voting', () => {
    let tourId: number;

    beforeEach(async () => {
      // Получаем тур для голосования
      const searchResponse = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({ groupId: groupChatId })
        .expect(200);

      if (searchResponse.body.tours.length > 0) {
        tourId = searchResponse.body.tours[0].id;
      }
    });

    it('should allow members to vote for tours', async () => {
      if (!tourId) {
        console.log('No tours found for voting test');
        return;
      }

      // User1 голосует "за"
      await request(app)
        .post('/api/group/vote')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .send({
          groupId: groupChatId,
          tourId,
          vote: 'yes',
          comment: 'Отличный отель!'
        })
        .expect(200);

      // User2 голосует "против"
      await request(app)
        .post('/api/group/vote')
        .set('Authorization', `Bearer ${user2.accessToken}`)
        .send({
          groupId: groupChatId,
          tourId,
          vote: 'no',
          comment: 'Слишком дорого'
        })
        .expect(200);

      // User3 голосует "может быть"
      await request(app)
        .post('/api/group/vote')
        .set('Authorization', `Bearer ${user3.accessToken}`)
        .send({
          groupId: groupChatId,
          tourId,
          vote: 'maybe',
          comment: 'Нужно подумать'
        })
        .expect(200);
    });

    it('should get voting results', async () => {
      if (!tourId) return;

      const response = await request(app)
        .get(`/api/group/${groupChatId}/votes/${tourId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      expect(response.body.votes).toHaveLength(3);
      expect(response.body.summary).toMatchObject({
        yes: 1,
        no: 1,
        maybe: 1,
        total: 3
      });
    });

    it('should allow vote changes', async () => {
      if (!tourId) return;

      // User1 меняет голос с "yes" на "maybe"
      await request(app)
        .post('/api/group/vote')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .send({
          groupId: groupChatId,
          tourId,
          vote: 'maybe',
          comment: 'Передумал, нужно обсудить'
        })
        .expect(200);

      const response = await request(app)
        .get(`/api/group/${groupChatId}/votes/${tourId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      expect(response.body.summary.maybe).toBe(2);
      expect(response.body.summary.yes).toBe(0);
    });
  });

  describe('Group Recommendations', () => {
    it('should get personalized recommendations for group', async () => {
      const response = await request(app)
        .get(`/api/group/${groupChatId}/recommendations`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      expect(response.body.tours).toBeDefined();
      
      if (response.body.tours.length > 0) {
        // Рекомендации должны учитывать групповые предпочтения
        const tour = response.body.tours[0];
        expect(tour.matchScore).toBeGreaterThan(70); // Высокое соответствие группе
      }
    });

    it('should filter recommendations by votes', async () => {
      const response = await request(app)
        .get(`/api/group/${groupChatId}/recommendations`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({
          minVotesYes: 2 // Минимум 2 голоса "за"
        })
        .expect(200);

      // Должны вернуться только туры с достаточным количеством голосов
      // или новые туры без голосов
      expect(response.body.tours).toBeDefined();
    });
  });

  describe('Group Notifications', () => {
    it('should notify group about new matching tours', async () => {
      // Этот тест проверяет что endpoint существует
      // Реальные уведомления отправляются через Telegram Bot API
      const response = await request(app)
        .post(`/api/group/${groupChatId}/notify`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .send({
          message: 'Найдены новые туры!',
          tourIds: [1, 2, 3]
        })
        .expect(200);

      expect(response.body.notified).toBe(true);
    });
  });

  describe('Group Deactivation', () => {
    it('should deactivate group search', async () => {
      const response = await request(app)
        .delete(`/api/group/${groupChatId}`)
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);

      expect(response.body.group.isActive).toBe(false);
    });

    it('should not search tours for inactive group', async () => {
      const response = await request(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .query({ groupId: groupChatId })
        .expect(400);

      expect(response.body.error.message).toContain('inactive');
    });
  });
});