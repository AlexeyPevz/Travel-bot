import { ICommand } from './base';
import { StartCommand } from './start';
import { HelpCommand } from './help';
import { MyRequestsCommand } from './myrequests';
import { ReferralCommand } from './referral';
import { JoinCommand } from './join';
import { GroupSetupCommand } from './groupsetup';

/**
 * Регистр всех доступных команд
 */
export class CommandRegistry {
  private commands: Map<string, ICommand> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor() {
    this.registerCommands();
  }

  /**
   * Регистрация всех команд
   */
  private registerCommands(): void {
    const commands: ICommand[] = [
      new StartCommand(),
      new HelpCommand(),
      new MyRequestsCommand(),
      new ReferralCommand(),
      new JoinCommand(),
      new GroupSetupCommand(),
    ];

    commands.forEach(command => {
      this.commands.set(command.name, command);
      
      // Регистрируем алиасы если есть
      if (command.aliases) {
        command.aliases.forEach(alias => {
          this.aliases.set(alias, command.name);
        });
      }
    });
  }

  /**
   * Получить команду по имени
   */
  getCommand(name: string): ICommand | undefined {
    // Убираем слеш если есть
    const commandName = name.startsWith('/') ? name.substring(1) : name;
    
    // Сначала проверяем основное имя
    const command = this.commands.get(commandName);
    if (command) return command;
    
    // Проверяем алиасы
    const originalName = this.aliases.get(commandName);
    if (originalName) {
      return this.commands.get(originalName);
    }
    
    return undefined;
  }

  /**
   * Получить все команды
   */
  getAllCommands(): ICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Проверить, является ли текст командой
   */
  isCommand(text: string): boolean {
    if (!text.startsWith('/')) return false;
    
    const parts = text.split(' ');
    const commandName = parts[0].substring(1);
    
    return this.commands.has(commandName) || this.aliases.has(commandName);
  }

  /**
   * Извлечь параметры команды
   */
  extractParams(text: string): string[] {
    const parts = text.split(' ');
    return parts.slice(1);
  }
}

// Создаем единственный экземпляр регистра
export const commandRegistry = new CommandRegistry();

// Экспортируем все команды для удобства
export * from './base';
export * from './start';
export * from './help';
export * from './myrequests';
export * from './referral';
export * from './join';
export * from './groupsetup';
export * from './text';