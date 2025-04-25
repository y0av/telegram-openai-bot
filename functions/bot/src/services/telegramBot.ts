/**
 * Service class for handling Telegram bot operations
 * with image generation capabilities.
 * Integrates with OpenAI's image generation APIs.
 */

import {TelegramBot} from "typescript-telegram-bot-api";

interface TelegramMessageBody {
  message?: {
    chat: {
      id: number;
    };
    text?: string;
    photo?: Array<{
      file_id: string;
    }>;
    caption?: string;
  };
}
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import sharp from "sharp";
import {TelegramSenderService} from "./telegramSender";

/**
 * @class TelegramBotService
 * @property {TelegramBot} bot - Instance of Telegram bot
 * @property {OpenAI} openai - Instance of OpenAI API client
 * @property {string} botToken - Telegram bot token
 */
export class TelegramBotService {
  private bot: TelegramBot;
  private openai: OpenAI;
  private botToken: string;
  private sender: TelegramSenderService;

  /**
 * Creates an instance of TelegramBotService.
 * @constructor
 * @param {string} botToken - The Telegram bot token for authentication
 * @param {string} openaiApiKey - The OpenAI API key for authentication
 */
  constructor(botToken: string, openaiApiKey: string) {
    this.bot = new TelegramBot({botToken});
    this.openai = new OpenAI({apiKey: openaiApiKey});
    this.botToken = botToken;
    this.sender = new TelegramSenderService(this.bot);
  }
  /**
 * Handles incoming Telegram messages and routes them to appropriate handlers.
 * @async
 * @param {any} body - The message body from Telegram
 * @return {Promise<void>}
 */
  async handleMessage(body: TelegramMessageBody): Promise<void> {
    if (!body.message) return;

    const {chat: {id}, text, photo, caption} = body.message;

    if (photo && caption) {
      await this.handlePhotoWithCaption(id, photo, caption);
    } else if (text && text.startsWith("/image1")) {
      await this.handleImage1Command(id, text);
    } else if (text && text.startsWith("/dalle3")) {
      await this.handleDalle3Command(id, text);
    } else if (text && text === "/test") {
      await this.sender.sendMessage(id, "Test OK");
    } else if (text && text === "/time") {
      const now = new Date();
      const timeString = now.toLocaleString();
      await this.sender.sendMessage(id, "Current time: " + timeString);
    } else {
      const message = "⚠️ Sorry, \"" + (text || "your message") +
        "\" is not a recognized command.";
      await this.sender.sendMessage(id, message);
    }
  }
  /**
 * Handles photos with captions by creating variations using OpenAI.
 * @private
 * @async
 * @param {number} chatId - The Telegram chat ID
 * @param {any[]} photo - Array of photo sizes from Telegram
 * @param {string} caption - The caption text for the photo
 * @return {Promise<void>}
 */
  private async handlePhotoWithCaption(
    chatId: number,
    photo: Array<{ file_id: string }>,
    caption: string): Promise<void> {
    const stopLoading = await this.sender.sendProgressMessage(
      chatId,
      "📸 Received your photo. Creating a variation..."
    );

    try {
      // Get file info for the largest photo
      const fileId = photo[photo.length - 1].file_id;
      const fileInfo = await this.bot.getFile({file_id: fileId});

      if (!fileInfo.file_path) {
        throw new Error("Could not get file path");
      }

      // Create temporary files
      const tempJpgPath = path.join(os.tmpdir(), `${fileId}.jpg`);

      // Download the file
      const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${fileInfo.file_path}`;
      const response = await axios({
        method: "GET",
        url: fileUrl,
        responseType: "stream",
      });

      // Save file to temp directory
      const writer = fs.createWriteStream(tempJpgPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on("finish", () => resolve());
        writer.on("error", reject);
      });

      // Resize image to ensure it's under 4MB without conversion to PNG
      await sharp(tempJpgPath)
        .resize({width: 1024, height: 1024, fit: "inside"})
        .jpeg({quality: 80})
        .toFile(tempJpgPath + ".resized");

      // Replace original with resized version
      fs.renameSync(tempJpgPath + ".resized", tempJpgPath);

      // Check file size
      const stats = fs.statSync(tempJpgPath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (fileSizeInMB >= 4) {
        throw new Error("Image is too large (must be less than 4MB)");
      }

      // Create edit with OpenAI using properly typed file
      const imageBuffer = fs.readFileSync(tempJpgPath);
      const result = await this.openai.images.edit({
        image: new File([imageBuffer], "image.jpg", {type: "image/jpeg"}),
        model: "gpt-image-1",
        prompt: caption,
      });

      // Stop the loading animation
      stopLoading();

      // Handle base64 response for gpt-image-1
      const imageData = result.data?.[0];

      if (imageData?.b64_json) {
        // Create a temporary file for the base64 image
        const tempOutputPath = path.join(os.tmpdir(), `${fileId}_output.png`);

        // Decode and save the base64 image
        const imageBuffer = Buffer.from(imageData.b64_json, "base64");
        fs.writeFileSync(tempOutputPath, imageBuffer);

        // Send back the generated image as a file
        await this.sender.sendPhoto(
          chatId,
          fs.createReadStream(tempOutputPath),
          "prompt: " + `"${caption}"`
        );

        // Clean up the temp file
        fs.unlinkSync(tempOutputPath);
      } else if (imageData?.url) {
        // Handle URL-based response (in case API changes or for other models)
        await this.sender.sendPhoto(
          chatId,
          imageData.url,
          "prompt: " + `"${caption}"`
        );
      } else {
        throw new Error("No image data received from OpenAI");
      }

      // Clean up temp files
      fs.unlinkSync(tempJpgPath);
    } catch (variationError) {
      // Stop the loading animation before showing error
      stopLoading();
      await this.sender.sendErrorMessage(
        chatId,
        "create a variation of your image",
        variationError
      );
    }
  }

  /**
 * Handles the /image1 command by generating images using OpenAI's GPT-4 Vision.
 * @private
 * @async
 * @param {number} chatId - The Telegram chat ID
 * @param {string} text - The command text including the prompt
 * @return {Promise<void>}
 */
  private async handleImage1Command(
    chatId: number,
    text: string
  ): Promise<void> {
    // Extract the prompt (everything after "/image1 ")
    const prompt = text.substring("/image1".length).trim();

    if (!prompt) {
      await this.sender.sendMessage(
        chatId,
        "⚠️ Please provide a prompt after /image1"
      );
      return;
    }

    const stopLoading = await this.sender.sendProgressMessage(
      chatId,
      "🎨 Generating image using image-1 with prompt: \"" + prompt + "\""
    );

    try {
      const response = await this.openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      // Stop the loading animation
      stopLoading();

      // Check if the response contains b64_json (for gpt-image-1)
      // or url (for dall-e-3)
      const imageData = response.data?.[0];

      if (imageData?.b64_json) {
        // Create a temporary file for the base64 image
        const tempImagePath = path.join(os.tmpdir(), `${Date.now()}.png`);

        // Decode and save the base64 image
        const imageBuffer = Buffer.from(imageData.b64_json, "base64");
        fs.writeFileSync(tempImagePath, imageBuffer);

        // Send the image file directly
        await this.sender.sendPhoto(
          chatId,
          fs.createReadStream(tempImagePath),
          "Here's your image-1 image for: \"" + prompt + "\""
        );

        // Clean up the temp file
        fs.unlinkSync(tempImagePath);
      } else if (imageData?.url) {
        // Handle URL-based response (for dall-e-3)
        await this.sender.sendPhoto(
          chatId,
          imageData.url,
          "Here's your image-1 image for: \"" + prompt + "\""
        );
      } else {
        throw new Error("No image data received from OpenAI");
      }
    } catch (generateError) {
      // Stop the loading animation before showing error
      stopLoading();
      await this.sender.sendErrorMessage(
        chatId,
        "generate the image",
        generateError
      );
    }
  }

  /**
 * Handles the /dalle3 command by generating images using OpenAI's DALL-E 3.
 * @private
 * @async
 * @param {number} chatId - The Telegram chat ID
 * @param {string} text - The command text including the prompt
 * @return {Promise<void>}
 */
  private async handleDalle3Command(
    chatId: number,
    text: string
  ): Promise<void> {
    // Extract the prompt (everything after "/dalle3")
    const prompt = text.substring("/dalle3".length).trim();

    if (!prompt) {
      await this.sender.sendMessage(
        chatId,
        "⚠️ Please provide a prompt after /dalle3"
      );
      return;
    }

    const stopLoading = await this.sender.sendProgressMessage(
      chatId,
      `🖼️ Generating image using dalle-3 with prompt: "${prompt}"`
    );

    try {
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      // Stop the loading animation
      stopLoading();

      const imageUrl = response.data?.[0]?.url;

      if (imageUrl) {
        await this.sender.sendPhoto(
          chatId,
          imageUrl,
          "Here's your dalle3 image for: \"" + prompt + "\""
        );
      } else {
        throw new Error("No image URL received from OpenAI");
      }
    } catch (generateError) {
      // Stop the loading animation before showing error
      stopLoading();
      await this.sender.sendErrorMessage(
        chatId,
        "generate the image",
        generateError
      );
    }
  }
}
