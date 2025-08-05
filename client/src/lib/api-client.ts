/**
 * API клиент с поддержкой CSRF защиты
 */

interface ApiOptions extends RequestInit {
  skipCsrf?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private csrfToken: string | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Устанавливает CSRF токен для последующих запросов
   */
  setCsrfToken(token: string | null) {
    this.csrfToken = token;
  }

  /**
   * Выполняет HTTP запрос с автоматическим добавлением CSRF токена
   */
  async request<T = any>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<T> {
    const { skipCsrf = false, headers = {}, ...restOptions } = options;
    
    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method?.toUpperCase() || 'GET';
    
    // Определяем нужен ли CSRF токен
    const needsCsrf = !skipCsrf && 
                     !['GET', 'HEAD', 'OPTIONS'].includes(method) && 
                     this.csrfToken;

    // Подготавливаем заголовки
    const finalHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (needsCsrf && this.csrfToken) {
      (finalHeaders as any)['X-CSRF-Token'] = this.csrfToken;
    }

    // Добавляем JWT токен если есть
    const token = localStorage.getItem('accessToken');
    if (token) {
      (finalHeaders as any)['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...restOptions,
        headers: finalHeaders,
        credentials: 'include', // Важно для cookies
      });

      // Обработка ошибок
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new ApiError(
          errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      // Обработка пустых ответов
      if (response.status === 204) {
        return null as any;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  /**
   * GET запрос
   */
  async get<T = any>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST запрос
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: ApiOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT запрос
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: ApiOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE запрос
   */
  async delete<T = any>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH запрос
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: ApiOptions
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

/**
 * Класс для API ошибок
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Проверяет является ли ошибка ошибкой аутентификации
   */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Проверяет является ли ошибка ошибкой валидации
   */
  isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  /**
   * Проверяет является ли ошибка серверной ошибкой
   */
  isServerError(): boolean {
    return this.status >= 500;
  }
}

// Создаем и экспортируем singleton экземпляр
export const apiClient = new ApiClient('/api');

// Экспортируем класс для создания дополнительных экземпляров
export { ApiClient };