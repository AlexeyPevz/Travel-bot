/**
 * Базовый абстрактный класс для всех AI агентов
 */

import {
  AgentConfig,
  AgentContext,
  AgentError,
  AgentEvent,
  AgentEventType,
  AgentInput,
  AgentMemory,
  AgentMessage,
  AgentMetadata,
  AgentMetrics,
  AgentOutput,
  AgentState,
  AgentStatus,
  AgentType,
  MessageType,
  Task,
  TaskPriority
} from './types';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Реализация памяти агента
 */
class DefaultAgentMemory implements AgentMemory {
  shortTerm: Map<string, { value: any; expiry?: Date }> = new Map();
  longTerm: Map<string, { value: any; expiry?: Date }> = new Map();
  
  get(key: string, type: 'short' | 'long' = 'short'): any {
    const storage = type === 'short' ? this.shortTerm : this.longTerm;
    const item = storage.get(key);
    
    if (!item) return undefined;
    
    // Проверяем срок действия
    if (item.expiry && item.expiry < new Date()) {
      storage.delete(key);
      return undefined;
    }
    
    return item.value;
  }
  
  set(key: string, value: any, type: 'short' | 'long' = 'short', ttl?: number): void {
    const storage = type === 'short' ? this.shortTerm : this.longTerm;
    const expiry = ttl ? new Date(Date.now() + ttl * 1000) : undefined;
    
    storage.set(key, { value, expiry });
  }
  
  delete(key: string, type: 'short' | 'long' = 'short'): void {
    const storage = type === 'short' ? this.shortTerm : this.longTerm;
    storage.delete(key);
  }
  
  clear(type?: 'short' | 'long'): void {
    if (!type || type === 'short') {
      this.shortTerm.clear();
    }
    if (!type || type === 'long') {
      this.longTerm.clear();
    }
  }
}

/**
 * Базовый класс для всех агентов
 */
export abstract class BaseAgent extends EventEmitter {
  // Обязательные свойства для реализации
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly type: AgentType;
  abstract readonly capabilities: string[];
  abstract readonly priority: number;
  
  // Конфигурация
  protected config: AgentConfig;
  
  // Состояние
  protected state: AgentState;
  protected memory: AgentMemory;
  protected metrics: AgentMetrics;
  
  // Очередь задач
  private taskQueue: Task[] = [];
  private processingTasks: Map<string, Task> = new Map();
  
  // Коммуникация
  private messageBus?: any; // Будет инжектироваться
  private messageHandlers: Map<MessageType, Function> = new Map();
  
  constructor(config?: Partial<AgentConfig>) {
    super();
    
    // Инициализация конфигурации
    this.config = {
      id: this.id,
      name: this.name,
      type: this.type,
      version: '1.0.0',
      capabilities: this.capabilities,
      priority: this.priority,
      maxConcurrentTasks: 5,
      timeout: 30000,
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2
      },
      ...config
    };
    
    // Инициализация состояния
    this.state = {
      status: AgentStatus.IDLE,
      currentTasks: [],
      completedTasks: 0,
      failedTasks: 0,
      lastActivity: new Date()
    };
    
    // Инициализация памяти
    this.memory = new DefaultAgentMemory();
    
    // Инициализация метрик
    this.metrics = {
      agentId: this.id,
      taskCount: {
        total: 0,
        successful: 0,
        failed: 0,
        inProgress: 0
      },
      performance: {
        averageProcessingTime: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0
      },
      resources: {
        cpuUsage: 0,
        memoryUsage: 0
      },
      availability: 100,
      lastUpdated: new Date()
    };
    
    // Регистрация обработчиков сообщений
    this.registerMessageHandlers();
  }
  
  /**
   * Основной метод обработки - должен быть реализован в наследниках
   */
  abstract async process(input: AgentInput): Promise<AgentOutput>;
  
  /**
   * Проверка, может ли агент обработать задачу
   */
  abstract async canHandle(task: Task): Promise<boolean>;
  
  /**
   * Инициализация агента
   */
  async initialize(): Promise<void> {
    this.emit('event', {
      type: AgentEventType.STARTED,
      agentId: this.id,
      timestamp: new Date()
    });
    
    this.state.status = AgentStatus.IDLE;
    console.log(`[${this.name}] Agent initialized`);
  }
  
  /**
   * Остановка агента
   */
  async shutdown(): Promise<void> {
    // Ждем завершения текущих задач
    await this.waitForTasksCompletion();
    
    this.state.status = AgentStatus.OFFLINE;
    
    this.emit('event', {
      type: AgentEventType.STOPPED,
      agentId: this.id,
      timestamp: new Date()
    });
    
    console.log(`[${this.name}] Agent shut down`);
  }
  
  /**
   * Добавление задачи в очередь
   */
  async enqueueTask(task: Task): Promise<void> {
    // Проверяем, можем ли обработать
    const canHandle = await this.canHandle(task);
    if (!canHandle) {
      throw new Error(`Agent ${this.name} cannot handle task type: ${task.type}`);
    }
    
    // Добавляем в очередь с учетом приоритета
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    // Пытаемся обработать
    this.processNextTask();
  }
  
  /**
   * Обработка следующей задачи из очереди
   */
  private async processNextTask(): Promise<void> {
    // Проверяем лимиты
    if (this.processingTasks.size >= (this.config.maxConcurrentTasks || 5)) {
      return;
    }
    
    // Берем следующую задачу
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }
    
    // Начинаем обработку
    this.processingTasks.set(task.id, task);
    this.state.currentTasks.push(task.id);
    this.state.status = AgentStatus.PROCESSING;
    
    try {
      // Emit событие начала
      this.emit('event', {
        type: AgentEventType.TASK_STARTED,
        agentId: this.id,
        data: { taskId: task.id },
        timestamp: new Date()
      });
      
      const startTime = Date.now();
      
      // Создаем вход для агента
      const input: AgentInput = {
        taskId: task.id,
        type: task.type,
        data: task.data,
        priority: task.priority
      };
      
      // Обрабатываем с таймаутом
      const output = await this.processWithTimeout(input, this.config.timeout || 30000);
      
      // Обновляем метрики
      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      
      // Emit событие завершения
      this.emit('event', {
        type: AgentEventType.TASK_COMPLETED,
        agentId: this.id,
        data: { taskId: task.id, output },
        timestamp: new Date()
      });
      
      this.state.completedTasks++;
      
    } catch (error) {
      // Обработка ошибки
      this.handleTaskError(task, error as Error);
      
    } finally {
      // Очистка
      this.processingTasks.delete(task.id);
      this.state.currentTasks = this.state.currentTasks.filter(id => id !== task.id);
      
      // Обновляем статус
      if (this.processingTasks.size === 0 && this.taskQueue.length === 0) {
        this.state.status = AgentStatus.IDLE;
      }
      
      // Обрабатываем следующую задачу
      this.processNextTask();
    }
  }
  
  /**
   * Обработка с таймаутом
   */
  private async processWithTimeout(input: AgentInput, timeout: number): Promise<AgentOutput> {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task ${input.taskId} timed out after ${timeout}ms`));
      }, timeout);
      
      try {
        const result = await this.process(input);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  
  /**
   * Обработка ошибки задачи
   */
  private handleTaskError(task: Task, error: Error): void {
    console.error(`[${this.name}] Task ${task.id} failed:`, error);
    
    this.state.failedTasks++;
    this.updateMetrics(false, 0);
    
    // Emit событие ошибки
    this.emit('event', {
      type: AgentEventType.TASK_FAILED,
      agentId: this.id,
      data: {
        taskId: task.id,
        error: {
          code: 'TASK_FAILED',
          message: error.message,
          details: error
        }
      },
      timestamp: new Date()
    });
  }
  
  /**
   * Ожидание завершения всех задач
   */
  private async waitForTasksCompletion(timeout: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (this.processingTasks.size > 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for tasks completion');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  /**
   * Коммуникация с другими агентами
   */
  async communicate(targetAgent: string, message: any): Promise<any> {
    if (!this.messageBus) {
      throw new Error('Message bus not initialized');
    }
    
    const agentMessage: AgentMessage = {
      id: uuidv4(),
      from: this.id,
      to: targetAgent,
      type: MessageType.REQUEST,
      payload: message,
      timestamp: new Date()
    };
    
    return await this.messageBus.sendDirect(this.id, targetAgent, agentMessage);
  }
  
  /**
   * Широковещательное сообщение
   */
  async broadcast(message: any): Promise<void> {
    if (!this.messageBus) {
      throw new Error('Message bus not initialized');
    }
    
    const agentMessage: AgentMessage = {
      id: uuidv4(),
      from: this.id,
      to: '*',
      type: MessageType.EVENT,
      payload: message,
      timestamp: new Date()
    };
    
    await this.messageBus.publish(agentMessage);
  }
  
  /**
   * Обработка входящего сообщения
   */
  async handleMessage(message: AgentMessage): Promise<any> {
    const handler = this.messageHandlers.get(message.type);
    
    if (!handler) {
      console.warn(`[${this.name}] No handler for message type: ${message.type}`);
      return null;
    }
    
    return await handler.call(this, message);
  }
  
  /**
   * Регистрация обработчиков сообщений
   */
  protected registerMessageHandlers(): void {
    // Базовые обработчики
    this.messageHandlers.set(MessageType.REQUEST, this.handleRequest.bind(this));
    this.messageHandlers.set(MessageType.QUERY, this.handleQuery.bind(this));
    this.messageHandlers.set(MessageType.COMMAND, this.handleCommand.bind(this));
  }
  
  /**
   * Обработка запроса
   */
  protected async handleRequest(message: AgentMessage): Promise<any> {
    // Переопределить в наследниках
    return null;
  }
  
  /**
   * Обработка запроса информации
   */
  protected async handleQuery(message: AgentMessage): Promise<any> {
    const { query } = message.payload;
    
    switch (query) {
      case 'status':
        return this.getStatus();
      case 'metrics':
        return this.getMetrics();
      case 'capabilities':
        return this.capabilities;
      default:
        return null;
    }
  }
  
  /**
   * Обработка команды
   */
  protected async handleCommand(message: AgentMessage): Promise<any> {
    const { command } = message.payload;
    
    switch (command) {
      case 'reset_metrics':
        this.resetMetrics();
        return { success: true };
      case 'clear_memory':
        this.memory.clear();
        return { success: true };
      default:
        return { success: false, error: 'Unknown command' };
    }
  }
  
  /**
   * Получение текущего статуса
   */
  getStatus(): AgentState {
    return { ...this.state };
  }
  
  /**
   * Получение метрик
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Обновление метрик
   */
  protected updateMetrics(success: boolean, processingTime: number): void {
    this.metrics.taskCount.total++;
    
    if (success) {
      this.metrics.taskCount.successful++;
    } else {
      this.metrics.taskCount.failed++;
    }
    
    // Обновляем среднее время обработки
    if (success && processingTime > 0) {
      const currentAvg = this.metrics.performance.averageProcessingTime;
      const totalTasks = this.metrics.taskCount.successful;
      this.metrics.performance.averageProcessingTime = 
        (currentAvg * (totalTasks - 1) + processingTime) / totalTasks;
    }
    
    // Обновляем доступность
    this.metrics.availability = 
      (this.metrics.taskCount.successful / this.metrics.taskCount.total) * 100;
    
    this.metrics.lastUpdated = new Date();
  }
  
  /**
   * Сброс метрик
   */
  protected resetMetrics(): void {
    this.metrics = {
      agentId: this.id,
      taskCount: {
        total: 0,
        successful: 0,
        failed: 0,
        inProgress: 0
      },
      performance: {
        averageProcessingTime: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0
      },
      resources: {
        cpuUsage: 0,
        memoryUsage: 0
      },
      availability: 100,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Установка шины сообщений
   */
  setMessageBus(messageBus: any): void {
    this.messageBus = messageBus;
  }
  
  /**
   * Логирование
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
    }
  }
}