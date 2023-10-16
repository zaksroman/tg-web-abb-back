const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const app = express()

const HOST = '45.140.179.236'
const PORT = 8000

const token = '6476733091:AAGjoUeCRXN8GIQT8jMwvZkxYaXfVsWUxUk';
const webAppUrl = 'https://silly-bubblegum-7266f3.netlify.app'

const bot = new TelegramBot(token, {polling: true});

app.use(express.json())
app.use(cors())

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text

    if (text === '/start') {
        await bot.sendMessage(chatId, 'Ниже появятся кнопка, заполни форму', {
            reply_markup: {
                InlineKeyboardButton: [
                    [{text: 'Заполни форму', web_app: {url: webAppUrl + '/form'}}]
                ]
            }
        })

        // await bot.sendMessage(chatId, 'Заходи в наш интернет магазин по кнопке ниже', {
        //     reply_markup: {
        //         inline_keyboard: [
        //             [{text: 'Сделать заказ', web_app: {url: webAppUrl}}]
        //         ]
        //     }
        // })
    }

    if (msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg?.web_app_data?.data)

            await bot.sendMessage(chatId, 'Спасибо за обратную связь!')
            await bot.sendMessage(chatId, 'Ваше имя: ' + data?.fio)
            await bot.sendMessage(chatId, 'Ваш номер телефона: ' + data?.number)
            await bot.sendMessage(chatId, 'Ваш город: ' + data?.city)
            await bot.sendMessage(chatId, 'Ваша улица: ' + data?.street)

            setTimeout(async ()=> {
                await bot.sendMessage(chatId,'Всю информацию вы получите в этом чате')
            }, 2000)
        } catch (e) {
        }
    }
});


app.post('/web-data', async (req, res) => {
    const {queryId, products = [], totalPrice} = req.body

    try {
        await bot.answerWebAppQuery(queryId, {
            type: 'article',
            id: queryId,
            title: 'Успешная покупка',
            input_message_content: {
                message_text: `Поздравяю с успешной покупкой, вы купили на сумму ${totalPrice}, ${products.map(item => item.title).join(', ')} `
            }
        })
        return res.status(200).json({})
    } catch (e) {
        return res.status(500).json({})
    }
})

// https
//     .createServer(
//         {
//             key: fs.readFileSync('./key.pem'),
//             cert: fs.readFileSync('./cert.pem'),
//         },
//     app
//     )
//     .listen(port, host, function () {
//         console.log(
//             `Server listens https://${HOST}:${PORT}`
//         );
//     });

app.listen(PORT, ()=> console.log('server started on PORT ' + PORT))