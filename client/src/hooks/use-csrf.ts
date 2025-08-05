import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CsrfTokenResponse {
  csrfToken: string;
}

/**
 * Хук для получения и использования CSRF токена
 */
export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Получаем CSRF токен с сервера
  const { data, isLoading, error } = useQuery<CsrfTokenResponse>({
    queryKey: ['csrf-token'],
    queryFn: async () => {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      
      return response.json();
    },
    staleTime: 1000 * 60 * 10, // 10 минут
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.csrfToken) {
      setCsrfToken(data.csrfToken);
    }
  }, [data]);

  /**
   * Добавляет CSRF токен к заголовкам запроса
   */
  const addCsrfHeader = (headers: HeadersInit = {}): HeadersInit => {
    if (!csrfToken) return headers;

    if (headers instanceof Headers) {
      headers.set('X-CSRF-Token', csrfToken);
      return headers;
    }

    return {
      ...headers,
      'X-CSRF-Token': csrfToken,
    };
  };

  /**
   * Обертка для fetch с автоматическим добавлением CSRF токена
   */
  const secureFetch = async (url: string, options: RequestInit = {}) => {
    const { headers = {}, ...restOptions } = options;
    
    // Добавляем CSRF токен только для изменяющих запросов
    const method = options.method?.toUpperCase() || 'GET';
    const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    
    const finalHeaders = needsCsrf ? addCsrfHeader(headers) : headers;
    
    return fetch(url, {
      ...restOptions,
      headers: finalHeaders,
      credentials: 'include', // Важно для CSRF cookies
    });
  };

  return {
    csrfToken,
    isLoading,
    error,
    addCsrfHeader,
    secureFetch,
  };
}

/**
 * HOC для добавления CSRF токена к axios или другим HTTP клиентам
 */
export function withCsrfToken(csrfToken: string | null) {
  return (config: any) => {
    if (!csrfToken) return config;
    
    const method = config.method?.toUpperCase() || 'GET';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      config.headers = {
        ...config.headers,
        'X-CSRF-Token': csrfToken,
      };
    }
    
    return config;
  };
}