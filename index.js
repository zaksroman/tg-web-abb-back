const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const app = express()
const mongoose = require('mongoose');
const multer  = require('multer');
const fs = require("fs");
const Schema = mongoose.Schema

const PORT = 8000

/////variables////
const forumChatId = -1002105194325
const token = '6476733091:AAGjoUeCRXN8GIQT8jMwvZkxYaXfVsWUxUk';
const webAppUrl =  /*'https://silly-bubblegum-7266f3.netlify.app'*/ 'https://tg-bot-test.ru/'
const db = {
    username: 'admin',
    password: 'Rk1*48Kz',
    host: 'calecija.beget.app',
    database: 'admin'
}/*'mongodb://localhost:27017/learnBD'*/
const getDataApi = '/api/getProducts'
const postDataApi = '/api/postProduct'
const delDataApi = '/api/delProduct/:_id'
const editDataApi = '/api/editProduct'
/////////////////

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

////////////
const bot = new TelegramBot(token, {polling: true});
////////BD//////

mongoose
    .connect(
        `mongodb://${db.username}:${db.password}@${db.host}/${db.database}`
    )
    .then(() => {
    console.log('Подключение к MongoDB успешно!');
}).catch((error) => {
    console.error('Ошибка подключения к MongoDB:', error);
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads')
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}` )
    }
})

const upload = multer({ storage: storage })

const userDataSchema = new Schema({
    fromId: {
        type: Number,
        require: true,
    },
    chatId: {
        type: Number,
        require: true,
    },
    message_thread_id: {
        type: Number,
        require: true,
    },
    messages: {
        type: Array,
        require: true,
    },
})

const productSchema = new Schema({
    title: String,
    description: String,
    price: Number,
    images: Array,
    count: Number,
    createdAt: { type: Date, default: Date.now }
});

const userDataModel = mongoose.model('userDataModel', userDataSchema, 'pair_userbot_messages')
const productModel = mongoose.model('productModel',productSchema, 'products')

///API///
app.get(getDataApi, async (req, res) => {
    try {
        const products = await productModel.find().sort({ createdAt: -1 })
        res.json(products)
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
})

app.post(postDataApi, upload.array('images', 5), async (req, res) => {
    try {
        const {title, description, price} = req.body;
        const images = req.files.map(file => file.filename);

        const newProduct = new productModel({
            title: title,
            price: price,
            description: description,
            images: images,
        })

        const savedProduct = await newProduct.save();

        res.status(201).json(savedProduct)
    } catch (e) {
        res.status(400).json({ message: e.message })
    }
})

app.delete(delDataApi,  async (req, res) => {
    try {
        const deletedProduct = await productModel.findByIdAndDelete(req.params._id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Товар не найден" });
        }
        deletedProduct.images.forEach(image => {
            const imagePath = `uploads/${image}`;
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        })
        res.status(200).json({ message: "Товар успешно удален", deletedProduct });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put(`${editDataApi}/:_id`, upload.array('images', 5),async (req, res) => {
    try {
        const updatedProperties = req.body; // Получаем обновленные свойства товара из тела запроса

        const updatedProduct = await productModel.findOneAndUpdate(
            { _id: req.params._id },
            { $set: updatedProperties },
            { new: true }
        );

        res.status(200).json({ message: 'Товар успешно обновлен', updatedProduct });
    } catch (error) {
        console.error('Ошибка при обновлении товара:', error);
        res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

//////////MESSAGE///
bot.on('message', async (msg) => {
    const botChatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    const userName = `${msg.from.first_name} ${msg.from.last_name}` || msg.from.username ||  `User_${userId}`;

    const userBD = msg.message_thread_id
        ? await userDataModel.findOne({message_thread_id: msg.message_thread_id}).catch((error) => {
            console.error('Ошибка поиска userDataModel в MESSAGE', error)})
        : await userDataModel.findOne({fromId: userId}).catch((error) => {
            console.error('Ошибка поиска userDataModel в MESSAGE', error)})

    try {
        if (text === '/start') {
            const sendWelcome = await bot.sendMessage(botChatId, 'Добро пожаловать в магазин)', {
                reply_markup: {
                    keyboard: [
                        [{text: 'Магазин', web_app: {url: webAppUrl}}]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: false
                }
            })

            const sendInstruction = await bot.sendMessage(botChatId, 'Нажмите на кнопку справа в поле ввода, чтоб вызвать магазин или начать набор текста')

            const existingUserData = await userDataModel.findOne({ fromId: msg.from.id });
            if (!existingUserData) {
                const newTopic = `${msg.from.first_name} ${msg.from.last_name} @${msg.from.username} User_ID:${userId}`
                const topicId = await bot.createForumTopic(forumChatId, userName)
                await bot.sendMessage(forumChatId, newTopic, {message_thread_id: topicId.message_thread_id})

                const newUserData = new userDataModel({
                    fromId: msg.from.id,
                    chatId: msg.chat?.id,
                    message_thread_id: topicId.message_thread_id,
                    messages: []
                })

                await newUserData
                    .save()
                    .catch((error) => {
                    console.error('Ошибка при сохранении данных:', error);
                });

                await userDataModel.findOneAndUpdate(
                    {fromId: msg.from.id},
                    {$push: {messages: {$each: [
                                    {botMsg: sendWelcome.message_id},
                                    {botMsg: sendInstruction.message_id}
                                ]}}}
                )
            }
        }
    } catch (error) {
        if (error.response && error.response.statusCode === 403) {
            console.log(`Не удалось отправить сообщение. Пользователь заблокировал бота. User_ID:${userId}`);
        } else {
            console.error(error)
        }
    }

    const findPair = async (msg) =>{
        if (msg.reply_to_message?.from?.is_bot === true) {
            return await userBD?.messages?.find(el => el.botMsg === msg?.reply_to_message?.message_id).msg
        } else {
            return await userBD?.messages?.find(el => el.msg === msg?.reply_to_message?.message_id).botMsg
        }
    }

    const copyMessageToChat = async (userBD, fromChatId, toChatId, msg ) => {
        const copiedMsg = await bot.copyMessage(toChatId, fromChatId, msg.message_id, {
            message_thread_id: msg?.chat?.id !== forumChatId && userBD?.message_thread_id,
            reply_to_message_id:
                (msg?.reply_to_message?.message_id && msg?.reply_to_message?.message_id !== msg?.message_thread_id)
                && await findPair(msg)
        })
        await userDataModel.findOneAndUpdate(
            {fromId: userBD.fromId},
            {$push: {messages: {msg: msg.message_id, botMsg: copiedMsg.message_id}}}
        )
    }

    /// user message //////////
    if (msg.chat?.id !== forumChatId && !msg.from?.is_bot && text !== '/start' ) {
        try {
            await copyMessageToChat(userBD, botChatId, forumChatId, msg)
        } catch (e) {
            console.error(e)
        }
    }

    /// admin message ////////
    if ( msg.chat?.id === forumChatId && !!msg.message_thread_id === true && !msg.from.is_bot ) {
        try {
            await copyMessageToChat(userBD, forumChatId, userBD?.chatId, msg)
        } catch (e) {
            console.error(e)
        }
    }

    /// buy data
    if (msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg?.web_app_data?.data)
            await bot.sendMessage(botChatId, 'Список ваших покупочек и информация по ним TEST')
            await bot.sendMessage(forumChatId, '\u2757 Вся информация о заказе и пожеланиях клиента', {
                message_thread_id: userBD.message_thread_id
            })

            setTimeout(async ()=> {
                await bot.sendMessage(botChatId,'Всю информацию вы получите в этом чате')
            }, 500)
        } catch (e) {
        }
    }
});

/////////EDITMESSAGE/////////
bot.on('edited_message', async (editedMsg) => {
    if (editedMsg.from?.is_bot !== true) {
        const userId = editedMsg.from.id;

        const userBD = editedMsg.message_thread_id
            ? await userDataModel.findOne({message_thread_id: editedMsg.message_thread_id}).catch((error) => {
                console.error('Ошибка поиска userDataModel в EDITMESSAGE', error)})
            : await userDataModel.findOne({fromId: userId}).catch((error) => {
                console.error('Ошибка поиска userDataModel в EDITMESSAGE', error)})

        // console.log(editedMsg)

        const findPairToEdit = async (editedMsg) =>{
            return await userBD?.messages?.find(el => el.msg === editedMsg?.message_id).botMsg
        }

        const editMessageText = async (editedMsg, chatId) => {
            await  bot.editMessageText(editedMsg?.text, {
                message_id: await findPairToEdit(editedMsg),
                chat_id: chatId
            })
        }

        const editMessageCaption = async (editedMsg, chatId) => {
            await bot.editMessageCaption(editedMsg?.caption ,{
                message_id: await findPairToEdit(editedMsg),
                chat_id: chatId
            })
        }

        const editMessageMedia = async (editedMsg, chatId) => {
            const mediaType = editedMsg.media_group_id ? editedMsg.media_group_id.split('_')[0]
                : editedMsg.document ? 'document'
                    : editedMsg.photo ? 'photo'
                        : editedMsg.video ? 'video'
                            : editedMsg.animation ? 'animation'
                                : editedMsg.audio ? 'audio'
                                    : null

            await bot.editMessageMedia({ type: mediaType, media: editedMsg[mediaType][0].file_id }, {
                message_id: await findPairToEdit(editedMsg),
                chat_id: chatId
            });
        }


        /// admin message ///
        try {
            if (editedMsg?.chat?.id === forumChatId && !!editedMsg?.message_thread_id === true && !editedMsg?.from?.is_bot) {

                if (editedMsg?.text) {
                    await editMessageText(editedMsg, userBD?.chatId)
                }

                if (editedMsg?.caption) {
                    await editMessageCaption(editedMsg, userBD?.chatId)
                }

                if (editedMsg?.photo || editedMsg?.video || editedMsg?.animation || editedMsg?.audio || editedMsg?.document) {
                    await editMessageMedia(editedMsg, userBD?.chatId)
                }
            }
        } catch (e) {
            console.log(e)
        }

        /// user message //////////
        try {
            if (editedMsg.chat?.id !== forumChatId && !editedMsg.from?.is_bot) {

                if (editedMsg?.text) {
                    await editMessageText(editedMsg, forumChatId)
                }

                if (editedMsg?.caption) {
                    await editMessageCaption(editedMsg, forumChatId)
                }

                if (editedMsg?.photo || editedMsg?.video || editedMsg?.animation || editedMsg?.audio || editedMsg?.document) {
                    await editMessageMedia(editedMsg, forumChatId)
                }
            }
        } catch (e) {
            console.log(e)
        }
    }
})

app.listen(PORT, ()=> console.log('server started on PORT ' + PORT))






