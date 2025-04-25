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

  /**
   * Sends a progress message with a loading animation
   * that updates every 2 seconds
   * @async
   * @param {number} chatId - The Telegram chat ID
   * @param {string} text - The message text to show
   * @return {Promise<void>}
   * the loading animation
   */
  async sendProgressMessage(chatId: number, text: string): Promise<() => void> {
    const loadingIcons = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
    let currentIconIndex = 0;

    // Send initial message with first loading icon
    const response = await this.bot.sendMessage({
      chat_id: chatId,
      text: `${text} ${loadingIcons[0]}`,
    });

    // Store message ID for updating
    const messageId = response.message_id;

    // Set interval to update the loading icon
    const intervalId = setInterval(async () => {
      currentIconIndex = (currentIconIndex + 1) % loadingIcons.length;
      await this.bot.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: `${text} ${loadingIcons[currentIconIndex]}`,
      }).catch((error) => {
        console.error("Error updating progress message:", error);
      });
    }, 2000);

    // Return function to stop the animation
    return () => {
      clearInterval(intervalId);
      this.bot.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: `${text} ✅`,
      }).catch((error) => {
        console.error("Error finalizing progress message:", error);
      });
    };
  }
}
