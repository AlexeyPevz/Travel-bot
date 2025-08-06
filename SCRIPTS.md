# Доступные npm скрипты

## Разработка
- `npm run dev` - Запуск сервера в режиме разработки с hot reload
- `npm run build` - Сборка проекта для продакшена
- `npm start` - Запуск собранного проекта (требует `npm run build`)

## База данных
- `npm run db:push` - Применить схему к базе данных (без миграций)
- `npm run db:generate` - Сгенерировать SQL миграции из изменений схемы
- `npm run db:migrate` - Применить миграции к базе данных
- `npm run db:migrate:create` - Создать новую миграцию
- `npm run db:migrate:drop` - Удалить последнюю миграцию
- `npm run db:studio` - Открыть Drizzle Studio для управления БД
- `npm run db:seed` - Заполнить БД тестовыми данными

## Тестирование
- `npm test` - Запуск unit тестов
- `npm run test:watch` - Запуск тестов в режиме наблюдения
- `npm run test:coverage` - Генерация отчета о покрытии кода
- `npm run test:integration` - Запуск интеграционных тестов
- `npm run test:integration:watch` - Интеграционные тесты с наблюдением
- `npm run test:integration:coverage` - Покрытие интеграционных тестов
- `npm run test:all` - Запуск всех тестов (unit + integration)

## Качество кода
- `npm run lint` - Проверка кода ESLint
- `npm run lint:fix` - Автоматическое исправление ошибок ESLint
- `npm run format` - Форматирование кода с Prettier
- `npm run format:check` - Проверка форматирования без изменений
- `npm run prepare` - Настройка Git хуков (выполняется автоматически после `npm install`)

## Последовательность для первого запуска

1. `npm install` - установка зависимостей
2. Настройка `.env` файла
3. `npm run db:push` - создание таблиц в БД
4. `npm run db:seed` - заполнение тестовыми данными (опционально)
5. `npm run dev` - запуск в режиме разработки