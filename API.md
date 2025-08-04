# API Documentation

## Base URL
```
https://your-app-url.com/api
```

## Endpoints

### Profile Management

#### Get Profile
```http
GET /api/profile/:userId
```

Response:
```json
{
  "id": 1,
  "userId": "123456789",
  "name": "Иван",
  "vacationType": "beach",
  "countries": ["Турция", "Египет"],
  "budget": 150000,
  "priorities": {
    "starRating": 7,
    "beachLine": 10,
    "mealType": 8,
    "price": 6
  }
}
```

#### Create/Update Profile
```http
POST /api/profile
Content-Type: application/json

{
  "userId": "123456789",
  "name": "Иван",
  "vacationType": "beach",
  "countries": ["Турция"],
  "budget": 150000,
  "priorities": {
    "starRating": 7,
    "beachLine": 10,
    "mealType": 8,
    "price": 6
  }
}
```

### Text Analysis

#### Analyze Tour Request
```http
POST /api/analyze-request
Content-Type: application/json

{
  "message": "Хочу на море в Турцию, 4 звезды, первая линия, все включено, бюджет 150к на двоих",
  "userId": "123456789"
}
```

Response:
```json
{
  "vacationType": "beach",
  "countries": ["Турция"],
  "budget": 150000,
  "peopleCount": 2,
  "priorities": {
    "starRating": 7,
    "beachLine": 10,
    "mealType": 9,
    "price": 7
  }
}
```

### Tour Search

#### Search Tours
```http
GET /api/tours?userId=123456789
```

Response:
```json
[
  {
    "id": "LT123456",
    "title": "Rixos Premium Belek 5*",
    "country": "Турция",
    "resort": "Белек",
    "starRating": 5,
    "beachLine": 1,
    "mealType": "AI",
    "price": 145000,
    "matchScore": 92,
    "matchDetails": {
      "starRating": 100,
      "beachLine": 100,
      "mealType": 100,
      "price": 85
    },
    "aiAnalysis": "Отличное соответствие: 5*, первая линия, все включено в рамках бюджета"
  }
]
```

### Group Functions

#### Create Group
```http
POST /api/group/create
Content-Type: application/json

{
  "chatId": "-1001234567890",
  "chatTitle": "Поездка в Турцию 2024",
  "memberIds": ["123456789", "987654321"]
}
```

#### Vote for Tour
```http
POST /api/group/vote
Content-Type: application/json

{
  "groupId": 1,
  "tourId": 123,
  "userId": "123456789",
  "vote": "yes",
  "comment": "Отличный отель!"
}
```

Response:
```json
{
  "yes": 2,
  "no": 0,
  "maybe": 1
}
```

### Watchlists

#### Create Watchlist
```http
POST /api/watchlist
Content-Type: application/json

{
  "userId": "123456789",
  "title": "Мечта о Мальдивах",
  "countries": ["Мальдивы"],
  "budgetRange": {
    "min": 200000,
    "max": 300000
  },
  "priorities": {
    "beachLine": 10,
    "hotelRating": 9
  }
}
```

#### Get User Watchlists
```http
GET /api/watchlist/123456789
```

### Recommended Tours

#### Get Recommendations
```http
GET /api/tours/recommended/123456789
```

Returns tours that were found by monitoring system with high match scores.

## Error Responses

### 400 Bad Request
```json
{
  "error": "userId is required"
}
```

### 404 Not Found
```json
{
  "error": "Profile not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

Currently not implemented, but planned:
- 100 requests per minute per IP
- 1000 requests per hour per user

## Authentication

Currently uses Telegram user ID as authentication.
Future plans: JWT tokens with Telegram auth.