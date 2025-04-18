
import {onRequest} from "firebase-functions/v2/https";
import {TelegramBot} from "typescript-telegram-bot-api";

exports.botfunction = onRequest(async (request, response) => {
  try {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("BOT_TOKEN environment variable is not set");
    }
    const bot = new TelegramBot({botToken: token});

    const {body} = request;

    if (body.message) {
      const {chat: {id}, text} = body.message;

      if (text && text === "/test") {
        bot.sendMessage({chat_id: id, text: "Test message"});
      } else if (text && text === "/time") {
        const now = new Date();
        const timeString = now.toLocaleString();
        await bot.sendMessage({
          chat_id: id,
          text: "Current time: " + timeString,
        });
      } else {
        const message = "⚠️ Sorry, \"" + text + "\" is not a" +
                " recognized command.";
        await bot.sendMessage({
          chat_id: id,
          text: message});
      }
    }
  } catch (error: unknown) {
    console.error("Error sending message");
    console.log(error instanceof Error ? error.toString() : String(error));
  }
  response.send("OK");
});
