import { BaseCommand, CommandContext } from './base';
import { MESSAGES } from '../messages/templates';

/**
 * Команда /help - показать справку
 */
export class HelpCommand extends BaseCommand {
  name = 'help';
  description = 'Показать справку по боту';
  usage = '/help';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId } = ctx;

    try {
      await this.sendMessage(
        bot,
        chatId,
        MESSAGES.help.full,
        { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }
      );
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}