
# a telegram bot for image generation using openAI image-1 hosted as a serverless firebase function

 
## Requirements

[node.js](https://nodejs.org/en/download)

[firebase cli](https://firebase.google.com/docs/cli/) (```npm install -g firebase-tools```)

[curl](https://curl.se/download.html)

an openai verified account and an openai token.

## Setup

### clone repo
star this repo ⭐
```
git clone https://github.com/y0av/telegram-openai-bot.git
```

### BotFather
send ```/newbot``` to [BotFather](https://telegram.me/BotFather)
and copy the token

### .env
create an .env file inside functions/bot
```
BOT_TOKEN=<bot token from BotFather>
```

### firebase
[create a new firebase project](https://console.firebase.google.com/u/0/)
upgrade your project to Blaze plan using a google billing account

in your project folder
copy the ```firebase.json``` file aside 
```
firebase init
```
- initialize firebase functions
- choose existing project
- dont recreate package.json file

then move back the ```firebase.json``` file instead of the one created by firebase init cmd


#### deploy to firebase

navigate to bot directory
```
cd function
cd bot
```
fix lint issues with
```
npx eslint --fix --ext .ts .
```
navigate back to main firebase directory
```
cd ..
cd ..
firebase deploy
```
when the deploy is successful, you will get a link to the newly created function.
copy this link

### Set bot's webhook url
now you need to tell telegram that your bot is using a webhook.
this will make telegram call your https function every time your bot is triggered
you only need to do it once
you can do it using curl like so:
```
curl -X POST https://api.telegram.org/bot<YOUR BOT TOKEN>/setWebhook -H "Content-type: application/json" -d '{"url": "<YOUR FUNCTION URL>"}'
```