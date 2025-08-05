import request from 'supertest';
import { Application } from 'express';
import { generateTelegramAuthData, generateRandomUser } from './telegram';

interface AuthResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  user: any;
}

/**
 * Аутентифицирует тестового пользователя
 */
export async function authenticateTestUser(
  app: Application,
  userPrefix?: string
): Promise<AuthResult> {
  const user = generateRandomUser();
  
  if (userPrefix) {
    user.username = `${userPrefix}_${user.id}`;
  }
  
  const telegramData = generateTelegramAuthData(user);
  
  const response = await request(app)
    .post('/api/auth/telegram')
    .send({ initData: telegramData })
    .expect(200);
  
  return {
    userId: `test_user_${user.id}`,
    accessToken: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    user: response.body.user,
  };
}

/**
 * Создает заголовки с аутентификацией
 */
export function authHeaders(accessToken: string): { [key: string]: string } {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Обновляет access token используя refresh token
 */
export async function refreshAccessToken(
  app: Application,
  refreshToken: string
): Promise<string> {
  const response = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken })
    .expect(200);
  
  return response.body.accessToken;
}

/**
 * Выход пользователя
 */
export async function logoutUser(
  app: Application,
  accessToken: string
): Promise<void> {
  await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
}

/**
 * Проверяет что токен валиден
 */
export async function verifyToken(
  app: Application,
  accessToken: string
): Promise<boolean> {
  const response = await request(app)
    .get('/api/auth/verify')
    .set('Authorization', `Bearer ${accessToken}`);
  
  return response.status === 200 && response.body.valid === true;
}

/**
 * Создает несколько аутентифицированных пользователей
 */
export async function createAuthenticatedUsers(
  app: Application,
  count: number,
  prefix?: string
): Promise<AuthResult[]> {
  const users: AuthResult[] = [];
  
  for (let i = 0; i < count; i++) {
    const user = await authenticateTestUser(app, `${prefix || 'user'}_${i}`);
    users.push(user);
  }
  
  return users;
}

/**
 * Получает CSRF токен
 */
export async function getCsrfToken(app: Application): Promise<{
  token: string;
  cookies: string[];
}> {
  const response = await request(app)
    .get('/api/csrf-token')
    .expect(200);
  
  return {
    token: response.body.csrfToken,
    cookies: response.headers['set-cookie'],
  };
}

/**
 * Делает запрос с CSRF защитой
 */
export async function requestWithCsrf(
  app: Application,
  method: string,
  url: string,
  data?: any,
  accessToken?: string
): Promise<request.Response> {
  const { token, cookies } = await getCsrfToken(app);
  
  const req = request(app)[method.toLowerCase()](url)
    .set('Cookie', cookies)
    .set('X-CSRF-Token', token);
  
  if (accessToken) {
    req.set('Authorization', `Bearer ${accessToken}`);
  }
  
  if (data) {
    req.send(data);
  }
  
  return req;
}