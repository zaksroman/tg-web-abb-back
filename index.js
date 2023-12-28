const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const app = express()

const PORT = 8000
const forumChatId = -1002105194325
const supportChatId = '379906514'

const token = '6476733091:AAGjoUeCRXN8GIQT8jMwvZkxYaXfVsWUxUk';
const webAppUrl = 'https://silly-bubblegum-7266f3.netlify.app'

const bot = new TelegramBot(token, {polling: true});
const userToTopic = []

app.use(express.json())
app.use(cors())

bot.on('message', async (msg) => {
    const botChatId = msg.chat.id;
    const text = msg.text
    const userId = msg.from.id;
    const userName = `${msg.from.first_name} ${msg.from.last_name}` || msg.from.username ||  `User_${userId}`;
    const userBD = msg.message_thread_id
        ? userToTopic.find(el => el.message_thread_id === msg.message_thread_id)
        : userToTopic.find(el => el.id === userId)

    if (text === '/start') {
        await bot.sendMessage(botChatId, 'Добро пожаловать в магазин)', {
            reply_markup: {
                keyboard: [
                    [{text: 'Магазин', web_app: {url: webAppUrl}}]
                ],
                resize_keyboard: true,
                one_time_keyboard: false
            }
        })

        await bot.sendMessage(botChatId, 'Нажмите на кнопку справа в поле ввода, чтоб вызвать магазин или начать набор текста')

        if (!userToTopic.find(el => el.id === msg.from.id)) {

            const newTopic = `${msg.from.first_name} ${msg.from.last_name} @${msg.from.username} User_ID:${userId}`
            const topicId = await bot.createForumTopic(forumChatId, userName)
            await bot.sendMessage(forumChatId,  newTopic, {message_thread_id: topicId.message_thread_id})

            const user = {
                id: msg.from.id,
                chatId: msg.chat.id,
                message_thread_id: topicId.message_thread_id,
                messages: []
            }
            userToTopic.push(user)
        }
    }

    /// user message //////////
    if (msg.chat?.id !== forumChatId && !msg.from.is_bot && text !== '/start') {
        try {
            await bot.copyMessage(forumChatId, botChatId, msg.message_id, {
                message_thread_id: userBD?.message_thread_id
            })
        } catch (e) {
            console.error(e)
        }
    }

    /// admin message ////////
    if ( msg.chat?.id === forumChatId && !!msg.message_thread_id === true && !msg.from.is_bot ) {
        try {
            await bot.copyMessage(userBD?.chatId, forumChatId, msg.message_id)
        }
        catch (e) {
            console.error(e)
        }
    }

    /// обработка данных заказа
    if (msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg?.web_app_data?.data)
            await bot.sendMessage(botChatId, 'Список ваших товаров и ваши данные TEST')
            // await bot.sendMessage(chatId, 'Ваше имя: ' + data?.fio)

            setTimeout(async ()=> {
                await bot.sendMessage(botChatId,'Всю информацию вы получите в этом чате')
            }, 500)
        } catch (e) {
        }
    }
});

app.listen(PORT, ()=> console.log('server started on PORT ' + PORT))






