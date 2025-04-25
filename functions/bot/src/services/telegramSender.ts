/**
 * Service class for handling Telegram message sending operations.
 * Abstracts the sending operations from the main bot logic.
 */

import {TelegramBot} from "typescript-telegram-bot-api";
import {ReadStream} from "fs";

/**
 * @class TelegramSenderService
 * @property {TelegramBot} bot - Instance of Telegram bot
 */
export class TelegramSenderService {
  private bot: TelegramBot;

  /**
   * Creates an instance of TelegramSenderService.
   * @constructor
   * @param {TelegramBot} bot - The Telegram bot instance
   */
  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  /**
   * Sends a text message to a Telegram chat
   * @async
   * @param {number} chatId - The Telegram chat ID
   * @param {string} text - The message text to send
   * @return {Promise<void>}
   */
  async sendMessage(chatId: number, text: string): Promise<void> {
    await this.bot.sendMessage({chat_id: chatId, text});
  }

  /**
   * Sends a photo to a Telegram chat
   * @async
   * @param {number} chatId - The Telegram chat ID
   * @param {string | ReadStream} photo - The photo to send (URL or file stream)
   * @param {string} caption - Optional caption for the photo
   * @return {Promise<void>}
   */
  async sendPhoto(
    chatId: number,
    photo: string | ReadStream,
    caption?: string
  ): Promise<void> {
    await this.bot.sendPhoto({chat_id: chatId, photo, caption});
  }

  /**
   * Sends a standardized error message to a Telegram chat
   * @async
   * @param {number} chatId - The Telegram chat ID
   * @param {string} operation - The operation that failed
   * (e.g., "generating image")
   * @param {unknown} error - The error object or message
   * @return {Promise<void>}
   */
  async sendErrorMessage(
    chatId: number,
    operation: string,
    error: unknown
  ): Promise<void> {
    console.error(`Error ${operation}:`, error);
    await this.sendMessage(
      chatId,
      `❌ Sorry, I couldn't ${operation}. Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
