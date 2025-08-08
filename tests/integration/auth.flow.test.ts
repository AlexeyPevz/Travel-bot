import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { app, server } from '../../server/index';
import { db } from '../../db';
import { profiles } from '@shared/schema';
import { generateTelegramAuthData } from '../helpers/telegram';
import { eq } from 'drizzle-orm';

describe('Authentication Flow', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Ждем запуска сервера
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Очистка тестовых данных
    if (testUserId) {
      await db.delete(profiles).where(eq(profiles.userId, testUserId));
    }
    server.close();
  });

  beforeEach(() => {
    testUserId = `test_user_${Date.now()}`;
  });

  describe('Telegram WebApp Authentication', () => {
    it('should authenticate new user via Telegram WebApp', async () => {
      // Генерируем валидные данные Telegram
      const telegramData = generateTelegramAuthData({
        id: parseInt(testUserId.replace('test_user_', '')),
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      });

      const response = await request(app)
        .post('/api/auth/telegram')
        .send({ initData: telegramData })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(testUserId);
    });

    it('should authenticate existing user', async () => {
      // Создаем пользователя
      await db.insert(profiles).values({
        userId: testUserId,
        name: 'Existing User',
      });

      const telegramData = generateTelegramAuthData({
        id: parseInt(testUserId.replace('test_user_', '')),
        first_name: 'Existing',
        last_name: 'User',
        username: 'existinguser',
      });

      const response = await request(app)
        .post('/api/auth/telegram')
        .send({ initData: telegramData })
        .expect(200);

      expect(response.body.user.name).toBe('Existing User');
    });

    it('should reject invalid Telegram data', async () => {
      const response = await request(app)
        .post('/api/auth/telegram')
        .send({ initData: 'invalid_data' })
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('JWT Token Flow', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Получаем токены
      const telegramData = generateTelegramAuthData({
        id: parseInt(testUserId.replace('test_user_', '')),
        first_name: 'Test',
        last_name: 'User',
      });

      const authResponse = await request(app)
        .post('/api/auth/telegram')
        .send({ initData: telegramData });

      accessToken = authResponse.body.accessToken;
      refreshToken = authResponse.body.refreshToken;
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.userId).toBe(testUserId);
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/profile')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).not.toBe(accessToken);
    });

    it('should logout user', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Токен должен быть отозван
      await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('CSRF Protection', () => {
    let csrfToken: string;
    let cookies: string[];

    beforeEach(async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app)
        .get('/api/csrf-token')
        .expect(200);

      csrfToken = csrfResponse.body.csrfToken;
      cookies = csrfResponse.headers['set-cookie'];
    });

    it('should accept POST with valid CSRF token', async () => {
      const response = await request(app)
        .post('/api/profile')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Test User' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject POST without CSRF token', async () => {
      await request(app)
        .post('/api/profile')
        .set('Cookie', cookies)
        .send({ name: 'Test User' })
        .expect(403);
    });

    it('should reject POST with invalid CSRF token', async () => {
      await request(app)
        .post('/api/profile')
        .set('Cookie', cookies)
        .set('X-CSRF-Token', 'invalid_token')
        .send({ name: 'Test User' })
        .expect(403);
    });
  });

  describe('Session Management', () => {
    it('should maintain session across requests', async () => {
      const telegramData = generateTelegramAuthData({
        id: parseInt(testUserId.replace('test_user_', '')),
        username: 'sessionuser',
      });

      // Первый запрос - аутентификация
      const authResponse = await request(app)
        .post('/api/auth/telegram')
        .send({ initData: telegramData });

      const { accessToken } = authResponse.body;

      // Второй запрос - обновление профиля
      await request(app)
        .put('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      // Третий запрос - проверка обновления
      const profileResponse = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.name).toBe('Updated Name');
    });

    it('should handle concurrent sessions', async () => {
      const telegramData = generateTelegramAuthData({
        id: parseInt(testUserId.replace('test_user_', '')),
      });

      // Создаем две сессии
      const [session1, session2] = await Promise.all([
        request(app).post('/api/auth/telegram').send({ initData: telegramData }),
        request(app).post('/api/auth/telegram').send({ initData: telegramData }),
      ]);

      // Обе сессии должны быть валидными
      await Promise.all([
        request(app)
          .get('/api/profile')
          .set('Authorization', `Bearer ${session1.body.accessToken}`)
          .expect(200),
        request(app)
          .get('/api/profile')
          .set('Authorization', `Bearer ${session2.body.accessToken}`)
          .expect(200),
      ]);
    });
  });
});