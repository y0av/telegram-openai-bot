import {onRequest} from "firebase-functions/v2/https";
import {config} from "./config";
import {TelegramBotService} from "./services/telegramBot";

exports.botfunction = onRequest(async (request, response) => {
  try {
    const {botToken, openaiApiKey} = config;

    if (!botToken) {
      throw new Error("BOT_TOKEN environment variable is not set");
    }

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const botService = new TelegramBotService(botToken, openaiApiKey);
    await botService.handleMessage(request.body);
  } catch (error: unknown) {
    console.error("Error processing message");
    console.log(error instanceof Error ? error.toString() : String(error));
  }

  response.send("OK");
});
