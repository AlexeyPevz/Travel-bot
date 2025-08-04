import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { API_VERSIONS } from '../middleware/apiVersion';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Travel Bot API',
      version: API_VERSIONS.v1,
      description: 'AI-powered travel assistant API for finding and monitoring tours',
      contact: {
        name: 'API Support',
        email: 'support@travelbot.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `${process.env.APP_URL || 'http://localhost:5000'}/api/v1`,
        description: 'API v1',
      },
      {
        url: `${process.env.APP_URL || 'http://localhost:5000'}/api/v2`,
        description: 'API v2 (Future)',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code',
            },
            correlationId: {
              type: 'string',
              description: 'Request correlation ID for tracking',
            },
          },
        },
        Profile: {
          type: 'object',
          required: ['userId', 'username', 'name', 'travelStyle'],
          properties: {
            id: {
              type: 'integer',
              description: 'Profile ID',
            },
            userId: {
              type: 'string',
              description: 'Telegram user ID',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            name: {
              type: 'string',
              description: 'Display name',
            },
            travelStyle: {
              type: 'string',
              enum: ['budget', 'comfort', 'luxury'],
              description: 'Preferred travel style',
            },
            interests: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Travel interests',
            },
            budget: {
              type: 'object',
              properties: {
                min: {
                  type: 'number',
                  description: 'Minimum budget',
                },
                max: {
                  type: 'number',
                  description: 'Maximum budget',
                },
              },
            },
            preferences: {
              type: 'object',
              description: 'Additional preferences',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        TourSearchRequest: {
          type: 'object',
          required: ['destination', 'startDate', 'endDate', 'adults'],
          properties: {
            destination: {
              type: 'string',
              description: 'Destination country or city',
              example: 'Турция',
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Tour start date',
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'Tour end date',
            },
            adults: {
              type: 'integer',
              minimum: 1,
              description: 'Number of adults',
            },
            children: {
              type: 'integer',
              minimum: 0,
              default: 0,
              description: 'Number of children',
            },
            budget: {
              type: 'object',
              properties: {
                min: {
                  type: 'number',
                  description: 'Minimum budget per person',
                },
                max: {
                  type: 'number',
                  description: 'Maximum budget per person',
                },
              },
            },
          },
        },
        Tour: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Tour ID',
            },
            title: {
              type: 'string',
              description: 'Tour title',
            },
            description: {
              type: 'string',
              description: 'Tour description',
            },
            destination: {
              type: 'string',
              description: 'Destination',
            },
            hotelName: {
              type: 'string',
              description: 'Hotel name',
            },
            hotelRating: {
              type: 'number',
              description: 'Hotel rating (1-5)',
            },
            price: {
              type: 'number',
              description: 'Price per person',
            },
            currency: {
              type: 'string',
              default: 'RUB',
              description: 'Price currency',
            },
            startDate: {
              type: 'string',
              format: 'date',
            },
            endDate: {
              type: 'string',
              format: 'date',
            },
            nights: {
              type: 'integer',
              description: 'Number of nights',
            },
            mealType: {
              type: 'string',
              description: 'Meal plan',
            },
            includes: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'What is included',
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Tour images URLs',
            },
            bookingUrl: {
              type: 'string',
              description: 'Booking URL',
            },
            matchScore: {
              type: 'number',
              description: 'Match score (0-100)',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Profile',
        description: 'User profile management',
      },
      {
        name: 'Tours',
        description: 'Tour search and management',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Groups',
        description: 'Group travel management',
      },
    ],
  },
  apis: ['./server/routes/v1/*.ts', './server/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export function setupSwagger(app: Express) {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Travel Bot API Documentation',
  };

  // Serve Swagger documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Serve OpenAPI spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Redirect root /docs to /api/docs
  app.get('/docs', (req, res) => {
    res.redirect('/api/docs');
  });
}