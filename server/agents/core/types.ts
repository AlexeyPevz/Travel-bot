/**
 * Базовые типы для многоагентной AI системы
 */

/**
 * Типы агентов
 */
export enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  SEARCH = 'search',
  PLANNER = 'planner',
  NEGOTIATOR = 'negotiator',
  CONCIERGE = 'concierge',
  ANALYTICS = 'analytics',
  WEATHER = 'weather',
  PRICING = 'pricing',
  SUPPORT = 'support'
}

/**
 * Статус агента
 */
export enum AgentStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  WAITING = 'waiting',
  ERROR = 'error',
  OFFLINE = 'offline'
}

/**
 * Приоритет задачи
 */
export enum TaskPriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 20
}

/**
 * Базовый вход для агента
 */
export interface AgentInput {
  taskId: string;
  type: string;
  data: any;
  context?: AgentContext;
  priority?: TaskPriority;
}

/**
 * Базовый выход агента
 */
export interface AgentOutput {
  taskId: string;
  agentId: string;
  success: boolean;
  data?: any;
  error?: AgentError;
  metadata?: AgentMetadata;
}

/**
 * Контекст выполнения агента
 */
export interface AgentContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  locale?: string;
  timeZone?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
}

/**
 * Ошибка агента
 */
export interface AgentError {
  code: string;
  message: string;
  details?: any;
  recoverable?: boolean;
}

/**
 * Метаданные агента
 */
export interface AgentMetadata {
  processingTime: number;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
  };
  dependencies?: string[];
  version?: string;
}

/**
 * Задача для выполнения
 */
export interface Task {
  id: string;
  type: string;
  priority: TaskPriority;
  data: any;
  constraints?: TaskConstraints;
  dependencies?: string[];
  createdAt: Date;
  deadline?: Date;
}

/**
 * Ограничения задачи
 */
export interface TaskConstraints {
  maxProcessingTime?: number;
  requiredAgents?: string[];
  excludedAgents?: string[];
  resourceLimits?: {
    cpu?: number;
    memory?: number;
  };
}

/**
 * Результат выполнения задачи
 */
export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'partial';
  results: AgentOutput[];
  aggregatedData?: any;
  executionTime: number;
}

/**
 * Сообщение между агентами
 */
export interface AgentMessage {
  id: string;
  from: string;
  to: string | string[];
  type: MessageType;
  payload: any;
  timestamp: Date;
  replyTo?: string;
  expiry?: Date;
}

/**
 * Типы сообщений
 */
export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  COMMAND = 'command',
  QUERY = 'query',
  NOTIFICATION = 'notification'
}

/**
 * Состояние агента
 */
export interface AgentState {
  status: AgentStatus;
  currentTasks: string[];
  completedTasks: number;
  failedTasks: number;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

/**
 * Память агента
 */
export interface AgentMemory {
  shortTerm: Map<string, any>;
  longTerm: Map<string, any>;
  
  get(key: string, type?: 'short' | 'long'): any;
  set(key: string, value: any, type?: 'short' | 'long', ttl?: number): void;
  delete(key: string, type?: 'short' | 'long'): void;
  clear(type?: 'short' | 'long'): void;
}

/**
 * Возможности агента
 */
export interface AgentCapability {
  name: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
  constraints?: any;
}

/**
 * Конфигурация агента
 */
export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  version: string;
  capabilities: string[];
  priority: number;
  maxConcurrentTasks?: number;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  resources?: ResourceRequirements;
  dependencies?: AgentDependency[];
}

/**
 * Политика повторных попыток
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Требования к ресурсам
 */
export interface ResourceRequirements {
  cpu?: {
    min: number;
    max: number;
  };
  memory?: {
    min: number;
    max: number;
  };
  gpu?: boolean;
}

/**
 * Зависимость агента
 */
export interface AgentDependency {
  agentId: string;
  version?: string;
  optional?: boolean;
}

/**
 * Метрики агента
 */
export interface AgentMetrics {
  agentId: string;
  taskCount: {
    total: number;
    successful: number;
    failed: number;
    inProgress: number;
  };
  performance: {
    averageProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
  };
  availability: number;
  lastUpdated: Date;
}

/**
 * События агента
 */
export interface AgentEvent {
  id: string;
  agentId: string;
  type: AgentEventType;
  data: any;
  timestamp: Date;
}

/**
 * Типы событий агента
 */
export enum AgentEventType {
  STARTED = 'started',
  STOPPED = 'stopped',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  ERROR = 'error',
  WARNING = 'warning',
  STATE_CHANGED = 'state_changed'
}

/**
 * Интерфейс для специализированных входов агентов
 */

// Search Agent
export interface SearchAgentInput extends AgentInput {
  type: 'text_analysis' | 'tour_search' | 'provider_search';
  data: {
    query?: string;
    filters?: any;
    providers?: string[];
    userProfile?: any;
  };
}

// Planner Agent  
export interface PlannerAgentInput extends AgentInput {
  type: 'route_planning' | 'itinerary_optimization';
  data: {
    destinations: string[];
    dates: {
      start: Date;
      end: Date;
    };
    preferences?: any;
    constraints?: any;
    optimizationCriteria?: string[];
  };
}

// Negotiator Agent
export interface NegotiatorAgentInput extends AgentInput {
  type: 'price_negotiation' | 'bulk_discount' | 'special_offer';
  data: {
    provider: string;
    items: any[];
    quantity?: number;
    targetPrice?: number;
    context?: any;
  };
}

// Concierge Agent
export interface ConciergeAgentInput extends AgentInput {
  type: 'emergency' | 'recommendation' | 'problem' | 'proactive';
  data: {
    tripId?: string;
    issue?: string;
    location?: any;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  };
}

// Analytics Agent
export interface AnalyticsAgentInput extends AgentInput {
  type: 'user_analysis' | 'trend_analysis' | 'price_prediction';
  data: {
    userId?: string;
    destination?: string;
    dates?: any;
    historicalData?: any;
  };
}