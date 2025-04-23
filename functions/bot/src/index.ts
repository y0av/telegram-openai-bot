import {onRequest} from "firebase-functions/v2/https";
import {TelegramBot} from "typescript-telegram-bot-api";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import sharp from "sharp";

exports.botfunction = onRequest(async (request, response) => {
  try {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      throw new Error("BOT_TOKEN environment variable is not set");
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    const openai = new OpenAI({apiKey: openaiApiKey});

    const bot = new TelegramBot({botToken: token});

    const {body} = request;

    if (body.message) {
      const {chat: {id}, text, photo, caption} = body.message;

      if (photo && caption) {
        // User sent a photo with caption
        await bot.sendMessage({
          chat_id: id,
          text: "📸 Received your photo. Creating a variation...",
        });

        try {
          // Get file info for the largest photo
          const fileId = photo[photo.length - 1].file_id;
          const fileInfo = await bot.getFile({file_id: fileId});

          if (!fileInfo.file_path) {
            throw new Error("Could not get file path");
          }

          // Create temporary files
          const tempJpgPath = path.join(os.tmpdir(), `${fileId}.jpg`);
          const tempPngPath = path.join(os.tmpdir(), `${fileId}.png`);

          // Download the file
          const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
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

          // Convert image to PNG format using sharp
          await sharp(tempJpgPath)
            // Resize to ensure it's under 4MB
            .resize({width: 1024, height: 1024, fit: "inside"})
            .png({quality: 80})
            .toFile(tempPngPath);

          // Check file size
          const stats = fs.statSync(tempPngPath);
          const fileSizeInMB = stats.size / (1024 * 1024);
          if (fileSizeInMB >= 4) {
            throw new Error("Image is too large (must be less than 4MB)");
          }

          // Create edit with OpenAI using PNG
          const result = await openai.images.edit({
            image: fs.createReadStream(tempPngPath),
            model: "gpt-image-1",
            prompt: caption,
          });

          // Get the generated image URL
          const generatedImageUrl = result.data?.[0]?.url;

          if (generatedImageUrl) {
            // Send back the generated image
            await bot.sendPhoto({
              chat_id: id,
              photo: generatedImageUrl,
              caption: "Here's a variation of your image with the caption: " +
              `"${caption}"`,
            });
          } else {
            throw new Error("No image URL received from OpenAI");
          }

          // Clean up temp files
          fs.unlinkSync(tempJpgPath);
          fs.unlinkSync(tempPngPath);
        } catch (variationError) {
          console.error("Error creating image variation:", variationError);
          await bot.sendMessage({
            chat_id: id,
            text: "❌ Sorry, I couldn't create a" +
                  "variation of your image. Error: " +
                  (variationError instanceof Error ?
                    variationError.message :
                    String(variationError)),
          });
        }
      } else if (text && text.startsWith("/image1")) {
        // Extract the prompt (everything after "/image1 ")
        const prompt = text.substring("/image1".length).trim();

        if (!prompt) {
          await bot.sendMessage({
            chat_id: id,
            text: "⚠️ Please provide a prompt after /image1",
          });
          return;
        }

        await bot.sendMessage({
          chat_id: id,
          text: "🎨 Generating image using image-1 with prompt: \"" +
            prompt + "\"...",
        });

        try {
          const response = await openai.images.generate({
            model: "gpt-image-1",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
          });

          const imageUrl = response.data?.[0]?.url;

          if (imageUrl) {
            await bot.sendPhoto({
              chat_id: id,
              photo: imageUrl,
              caption: "Here's your image-1 image for: \"" + prompt + "\"",
            });
          } else {
            throw new Error("No image URL received from OpenAI");
          }
        } catch (generateError) {
          console.error("Error generating image:", generateError);
          await bot.sendMessage({
            chat_id: id,
            text: "❌ Sorry, I couldn't generate the image. Error: " +
                  (generateError instanceof Error ?
                    generateError.message :
                    String(generateError)),
          });
        }
      } else if (text && text.startsWith("/dalle3")) {
        // Extract the prompt (everything after "/generate")
        const prompt = text.substring("/dalle3".length).trim();

        if (!prompt) {
          await bot.sendMessage({
            chat_id: id,
            text: "⚠️ Please provide a prompt after /dalle3",
          });
          return;
        }

        await bot.sendMessage({
          chat_id: id,
          text: "🖼️ Generating image using dalle-3 with prompt: \"" +
            prompt + "\"...",
        });

        try {
          const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
          });

          const imageUrl = response.data?.[0]?.url;

          if (imageUrl) {
            await bot.sendPhoto({
              chat_id: id,
              photo: imageUrl,
              caption: "Here's your dalle3 image for: \"" + prompt + "\"",
            });
          } else {
            throw new Error("No image URL received from OpenAI");
          }
        } catch (generateError) {
          console.error("Error generating image:", generateError);
          await bot.sendMessage({
            chat_id: id,
            text: "❌ Sorry, I couldn't generate the image. Error: " +
                  (generateError instanceof Error ?
                    generateError.message :
                    String(generateError)),
          });
        }
      } else if (text && text === "/test") {
        bot.sendMessage({chat_id: id, text: "Test OK"});
      } else if (text && text === "/time") {
        const now = new Date();
        const timeString = now.toLocaleString();
        await bot.sendMessage({
          chat_id: id,
          text: "Current time: " + timeString,
        });
      } else {
        const message = "⚠️ Sorry, \"" + (text || "your message") +
                "\" is not a" +
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
