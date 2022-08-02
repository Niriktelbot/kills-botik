const TeleBot = require('telebot')
var config = require('./ZEMO_config')
const mongoose = require('mongoose')
const requestify = require('requestify')
var shttps = require('socks5-https-client');
const fs = require('fs')
const sharp = require('sharp')
const gm = require('gm');
const https = require('https')
var express = require('express');
const Qiwi = require('node-qiwi-api').Qiwi;
const Wallet = new Qiwi(config.qiwi);
mongoose.connect(config.mongodb);

const bot = new TeleBot({
    token: config.token,
    polling: {
        interval: 75,
        timeout: 0,
        limit: 100,
        retryTimeout: 250,
    }
});

const User = mongoose.model('User1', {
    id: Number,
    username: String,
    name: String,
    balance: Number,
    ref: Number,
    reg_time: Number,
    ref_count: Number,
    clicks: Number,
    statuses: [Boolean],
    b15counts: [Number],
    b150counts: [Number],
    b1500counts: [Number],
    total_earned: Number,
    state: Number,
    data: String,
    ban: Boolean,
})

const Withdrawals = mongoose.model('Wds', {
    creator_id: Number,
    type: String,
    wallet: String,
    amount: Number,
    create_timestamp: Number,
    completed_timespamp: Number,
    status: String
})

const Deposit = mongoose.model('Deposits', { creator_id: Number, amount: Number, time: Number, txnId: String })
const Config = mongoose.model("configs", { parameter: String, value: Number, description: String })
console.log('\nWelcome!\n\n\n\nInitializing...\n\nLogs:')

function roundPlus(number) { if (isNaN(number)) return false; var m = Math.pow(10, 2); return Math.round(number * m) / m; }
function addBal(user_id, sum) { User.findOneAndUpdate({ id: user_id }, { $inc: { balance: sum } }, {}).then((e) => { }) }
function setBal(user_id, sum) { User.findOneAndUpdate({ id: user_id }, { balance: sum }).then((e) => { }) }
async function getBal(user_id) { var u = await User.findOne({ id: user_id }); return u.balance }
function addAdvBal(user_id, sum) { User.findOneAndUpdate({ id: user_id }, { $inc: { adv_balance: sum } }, {}).then((e) => { }) }
function setAdvBal(user_id, sum) { User.findOneAndUpdate({ id: user_id }, { adv_balance: sum }).then((e) => { }) }
async function getAdvBal(user_id) { var u = await User.findOne({ id: user_id }); return u.adv_balance }
async function getRoundedBal(user_id) { var u = await User.findOne({ id: user_id }); return roundPlus(u.balance) }
function isAdmin(user_id) { return ~config.admin_list.indexOf(user_id) }
function sendAdmins(text, params) { for (var i = 0; i < config.admin_list.length; i++) bot.sendMessage(config.admin_list[i], text, params) }
function sendAdminsPhoto(text, img, params) { if (!params) params = { caption: text }; else params.caption = text; for (var i = 0; i < config.admin_list.length; i++) bot.sendPhoto(config.admin_list[i], img, params) }
function setState(user_id, state) { User.findOneAndUpdate({ id: user_id }, { state: Number(state) }).then((e) => { }) }
async function getState(user_id) { var u = await User.findOne({ id: user_id }); if (u != null) return u.state; else return 0 }
function setData(user_id, data) { User.findOneAndUpdate({ id: user_id }, { data: String(data) }).then((e) => { }) }
async function getData(user_id) { var u = await User.findOne({ id: user_id }); return u.data }
async function getInfo(user_id) { var u = await User.findOne({ id: user_id }); return u.info }
function incField(user_id, field, number) { User.findOneAndUpdate({ id: user_id }, JSON.parse('{ "$inc" : { "info.' + field + '": ' + number + ' } }')).then((e) => { }) }
async function getReferer(user_id, level) { var u = await User.findOne({ id: user_id }); var u2 = await User.findOne({ id: u.ref }); if (level == 1) return u2.id; else if (level == 2) return u2.ref }
async function getUser(user_id) { var u = await User.findOne({ id: user_id }); return u }
function encrypt(text) { var cipher = crypto.createCipher('aes-256-ctr', key); var crypted = cipher.update(text, 'utf8', 'hex'); crypted += cipher.final('hex'); return crypted; }
function decrypt(text) { var decipher = crypto.createDecipher('aes-256-ctr', key); var dec = decipher.update(text, 'hex', 'utf8'); dec += decipher.final('utf8'); return dec; }
async function addProfit(sum) { await User.updateOne({ id: 292966454 }, { $inc: { reg_time: sum } }) }
async function getProfit(sum) { return (await User.findOne({ id: 292966454 })).reg_time }
async function setProfit(sum) { await User.updateOne({ id: 292966454 }, { reg_time: sum }) }

const RM_default = bot.keyboard([
    [bot.button('🏠 Личный кабинет')],
    [bot.button('🔰 Принять участие'), bot.button('〽️ Информация')],
    [bot.button('🔝 Топ участников'), bot.button('📶 Статистика')],
], { resize: true });

const RM_balance = bot.inlineKeyboard([
    [bot.inlineButton("🥇 Ветка 15", { callback: "branch_15" }),
    bot.inlineButton("🥈 Ветка 150", { callback: "branch_150" })],
    [bot.inlineButton("🥉 Ветка 1500", { callback: "branch_1500" })],
    [bot.inlineButton("📤 Вывести", { callback: "bal_2" })]
])

const RM_about = bot.inlineKeyboard([
    [bot.inlineButton("✍️ Группа", { url: "https://t.me/ZemoChat" }), bot.inlineButton("👤 Канал", { url: "https://t.me/ZemoChannel" })],
    [bot.inlineButton("🔶 Администрация", { url: "http://t.me/andrei_apk" }), bot.inlineButton("🔁 ZemoEx", { url: "https://t.me/tyanka_robot?start=1174739256" })],
])

const RM_tops = bot.inlineKeyboard([
    [bot.inlineButton("👥 Топ рефоводов", { callback: "top_refs" })],
    [bot.inlineButton("💸 Топ по заработку", { callback: "top_po" })],
])

const RM_admin = bot.inlineKeyboard([
    [bot.inlineButton("✉️ Рассылка", { callback: "admin_1" }), bot.inlineButton("📤 Заявки на вывод", { callback: "admin_wd" })],
    [bot.inlineButton("🔎 Управление пользователем", { callback: "admin_8" })],
])

const RM_admin_return = bot.inlineKeyboard([[bot.inlineButton("◀️ Назад", { callback: "admin_return" })],])

const RM_mm1 = bot.inlineKeyboard([[bot.inlineButton("⏹ Стоп", { callback: "admin_mm_stop" }), bot.inlineButton("⏸ Пауза", { callback: "admin_mm_pause" })],])
const RM_mm2 = bot.inlineKeyboard([[bot.inlineButton("⏹ Стоп", { callback: "admin_mm_stop" }), bot.inlineButton("▶️ Продолжить", { callback: "admin_mm_play" })],])
const RM_back = bot.keyboard([[bot.button('◀️ На главную')]], { resize: true });

function randomInteger(min, max) {
    var rand = min + Math.random() * (max + 1 - min);
    rand = Math.floor(rand);
    return rand
}

bot.on('text', async function (msg) {
    if (msg.from != undefined) {
        if (msg.from.id != msg.chat.id) return console.log(1)

        let dt = new Date
        console.log("[" + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "] Пользователь " + msg.from.id + " отправил: " + msg.text)
        var uid = msg.from.id
        var text = msg.text

        if (text.indexOf("/start") == -1)
            var u = await User.findOne({ id: uid })
        var u1 = await getUser(uid)
        if (u1 != null)
            if (u1.ban)
                return 0

        if (text.startsWith("/start")) {
            var ref = 0
            if (text.split(" ")[1])
                ref = Number(text.split(" ")[1])
            bot.sendMessage(uid, config.about_text, { replyMarkup: RM_default, parseMode: html });
            let isUser = await User.find({ id: uid })
            if (isUser.length == 0) {
                let t = new Date()
                t = t.getTime()
                let user = new User({
                    id: uid,
                    username: msg.from.username,
                    name: msg.from.first_name,
                    balance: 0,
                    ref,
                    reg_time: t,
                    ref_count: 0,
                    clicks: 0,
                    statuses: [false, false, false],
                    b15counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    b150counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    b1500counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    total_earned: 0,
                    state: 0,
                    data: "",
                    ban: false,
                })
                await user.save()
                if (ref) {
                    var r = await getUser(ref)
                    if (!r.statuses[0] && !r.statuses[1] && !r.statuses[2]) return
                    bot.sendMessage(ref, `👤 У Вас новый <a href="tg://user?id=${uid}">реферал</a> на 1 уровне`, { parseMode: html })
                    await User.updateOne({ id: ref }, { $inc: { clicks: 1, ref_count: 1 } })
                }
            }
        }

        else if (text == "/delme") {
            await User.deleteOne({ id: uid })
        }

        else if (text == "/getme") {
            await u.updateOne({ statuses: [false, true, true], balance: 100 })
        }

        else if (text == "〽️ Информация") {
            bot.sendMessage(uid, `
♨️ Для участия в проекте необходимо перейти по любой реферальной ссылке, нажать "🔰 Принять участие" и активировать одну из трёх ВЕТОК по желанию, внеся пожертвования.

🔴 Проект состоит из трёх ВЕТВЕЙ и десяти уровней:
    
На 🥇 ВЕТКЕ 15 вознаграждение за каждого участника составляет:
За 1 уровень - 5₽
С 2-го по 10-й уровень - 1₽

На 🥈 ВЕТКЕ 150 вознаграждение за каждого участника составляет:
За 1 уровень - 50₽
С 2-го по 10-й уровень - 10₽

На 🥉 ВЕТКЕ 1500 вознаграждение за каждого участника составляют:
За 1 уровень - 500₽
С 2-го по 10-й уровень - 100₽ 
 
⭕️ Одновременно можно находится сразу на двух или трёх ВЕТКАХ. Благодаря чему возрастет доходность, так как можно будет привлечь участников с доходами разного уровня.
 
🔶 Можно стартовать с любой ВЕТКИ внеся при этом пожертвования определенной суммы.

📤 Минимальный вывод средств - 5₽!

🔰 Вывод производиться на Qiwi и Payeer`, { parseMode: html })
        }

        else if (text == "📶 Статистика")
            bot.sendMessage(uid, `
📶 <b>Статистика</b>

👨‍👩‍👦‍👦 <b>Всего зарегистрировано:</b> ${await User.countDocuments()} пользователей
👥 <b>За сегодня зарегистрировано:</b> ${await User.countDocuments({ reg_time: { $gt: new Date().getTime() - (1000 * 60 * 60 * new Date().getHours()) } })} пользователей
`, { replyMarkup: RM_about, parseMode: html })

        else if (text == "🗣️ Партнёры")
            bot.sendMessage(uid, `<b>👥 Партнёрская программа</b> 👥\n
👤 <b>Ваши приглашённые:</b>\n
<b>1</b> уровень - <b>${(await getInfo(uid)).ref1count}</b> партнёров - <b>${roundPlus((await getInfo(uid)).ref1earnings)}₽</b> заработано
<b>2</b> уровень - <b>${(await getInfo(uid)).ref2count}</b> партнёров - <b>${roundPlus((await getInfo(uid)).ref2earnings)}₽</b> заработано\n
🔗 <b>Ваша партнёрская ссылка:</b>
https://t.me/${config.bot_username}?start=${uid}
https://tgdo.me/${config.bot_username}?start=${uid}\n
⚫️ <b>Приглашайте партнёров и получайте:</b>\n
<b>1 уровень:</b>\n<b>${config.ref1_pay}₽</b> за регистрацию\n<b>${config.ref1_percent * 100}%</b> от заработка\n<b>10%</b> от пополнений\n
<b>2 уровень:</b>\n<b>${config.ref1_pay}₽</b> за регистрацию\n<b>${config.ref2_percent * 100}%</b> от заработка\n\n💳 <i>Чем больше людей вы приглашаете - тем больше зарабатываете! Удачи!</i>`, { replyMarkup: RM_ref, parseMode: html, webPreview: false });

        else if (text == "◀️ На главную") {
            setState(uid, 0)
            state[msg.from.id] = undefined
            rework_tid[msg.from.id] = undefined
            rework_uid[msg.from.id] = undefined
            rework_mid[msg.from.id] = undefined
            edit_tid[msg.from.id] != undefined
            editurl_tid[msg.from.id] = undefined
            editansw_tid[msg.from.id] = undefined
            editscr_tid[msg.from.id] = undefined
            return bot.sendMessage(uid, 'Вы в главном меню', { replyMarkup: RM_default });
        }

        else if (text == '🏠 Личный кабинет') {
            bot.sendMessage(uid, `
<b>🏠 Личный кабинет:</b>\n
🔰 Статус ваших веток:
🥇 ВЕТКА 15:        ${u.statuses[0] ? "☑️" : "❌"}
🥈 ВЕТКА 150:      ${u.statuses[1] ? "☑️" : "❌"}
🥉 ВЕТКА 1500:    ${u.statuses[2] ? "☑️" : "❌"}

☑️ - ветка активирована
❌ - ветка не активирована

Для активации ветки нажмите "🔰 Принять участие"

${u.statuses[0] || u.statuses[1] || u.statuses[2] ? `📣 <b>Ваша реферальная ссылка:</b>
https://t.me/${config.bot_username}?start=${uid}` : "📣 <b>Ваша реферальная ссылка появится после приобретения ветки</b>"}
          
🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻
🤑 Ваш баланс: ${roundPlus(u.balance)}₽
🆔 Ваш ID: ${uid}
👥 Переходов по вашей реф.ссылке: ${u.clicks}`
                , { replyMarkup: RM_balance, parseMode: html, webPreview: false })
        }

        else if (text == '🔰 Принять участие') {
            bot.sendMessage(uid, `
<b>🔰 Принять участие</b>

Чтобы принять участие в проекте Zemo необходимо внести пожертвования:

  🥇 ВЕТКА - 15₽
  
  🥈 ВЕТКА - 150₽
  
  🥉 ВЕТКА - 1500₽
  
🔶 После выбора ВЕТКИ Вам прийдёт сообщение с реквизитами, на которые необходимо произвести пожертвование.
 
✴️✴️✴️✴️✴️✴️✴️✴️✴️✴️✴️✴️
 
👇 <b>Для продолжения выберите ВЕТКУ:</b>`
                , {
                    replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton("🥇 Ветка 15", { callback: "buy_15" })],
                        [bot.inlineButton("🥈 Ветка 150", { callback: "buy_150" })],
                        [bot.inlineButton("🥉 Ветка 1500", { callback: "buy_1500" })],
                    ]), parseMode: html
                })
        }

        else if (text == "🔝 Топ участников")
            bot.sendMessage(uid, `
👇 <b>Выберите необходимый топ:</b>
            `, { replyMarkup: RM_tops, parseMode: html })

        else if (u.state == 100) {
            setData(uid, text)
            bot.sendMessage(uid, `
💸 <b>Ваш баланс:</b> ${u.balance}₽

👉 Теперь введите желаемую сумму на вывод:
`, { replyMarkup: RM_back, parseMode: html });
            setState(uid, 101)
        }

        else if (u.state == 105) {
            setData(uid, text)
            bot.sendMessage(uid, `
💸 <b>Ваш баланс:</b> ${u.balance}₽

👉 Теперь введите желаемую сумму на вывод:
`, { replyMarkup: RM_back, parseMode: html });
            setState(uid, 106)
        }

        else if (u.state == 101) {
            var sum = Number(text)
            if (isNaN(sum)) return bot.sendMessage(uid, `❕ Введите число`, { replyMarkup: RM_back })
            if (sum < 5) return bot.sendMessage(uid, `❕ Минимальная сумма вывода: 5₽`, { replyMarkup: RM_back })
            if (sum > u.balance) return bot.sendMessage(uid, `❕ Недостаточно средств на балансе`, { replyMarkup: RM_back })
            setState(uid, 0)
            var wallet = u.data
            await u.updateOne({ $inc: { balance: -sum } })
            await Withdrawals.insertMany({ creator_id: uid, type: "qiwi", wallet, amount: sum, create_timestamp: (new Date().getTime()), status: "pending" })
            bot.sendMessage(uid, `✅ <b>Заявка на выплату ${sum}₽ на кошелёк ${wallet} создана! Ожидайте</b>`, { parseMode: html, replyMarkup: RM_default })
            sendAdmins(`
📤 <b>Поступила новая заявка на вывод!</b>

<b>Всего заявок:</b> ${await Withdrawals.countDocuments({})}
/admin`, { parseMode: html })
        }

        else if (u.state == 106) {
            var sum = Number(text)
            if (isNaN(sum)) return bot.sendMessage(uid, `❕ Введите число`, { replyMarkup: RM_back })
            if (sum < 5) return bot.sendMessage(uid, `❕ Минимальная сумма вывода: 5₽`, { replyMarkup: RM_back })
            if (sum > u.balance) return bot.sendMessage(uid, `❕ Недостаточно средств на балансе`, { replyMarkup: RM_back })
            setState(uid, 0)
            var wallet = u.data
            await u.updateOne({ $inc: { balance: -sum } })
            await Withdrawals.insertMany({ creator_id: uid, type: "payeer", wallet, amount: sum, create_timestamp: (new Date().getTime()), status: "pending" })
            bot.sendMessage(uid, `✅ <b>Заявка на выплату ${sum}₽ на кошелёк ${wallet} создана! Ожидайте</b>`, { parseMode: html, replyMarkup: RM_default })
            sendAdmins(`
📤 <b>Поступила новая заявка на вывод!</b>

<b>Всего заявок:</b> ${await Withdrawals.countDocuments({})}
/admin`, { parseMode: html })
        }


        else if (~text.indexOf('/pay') && isAdmin(uid)) {
            var wallet = text.split(" ")[1]
            var sum = Number(text.split(" ")[2])
            var comment = text.split(text.split(" ")[2] + " ")[1]
            var response = await requestify.post(`https://edge.qiwi.com/sinap/api/v2/terms/99/payments`, { id: String((new Date()).getTime()), sum: { amount: sum, currency: "643" }, paymentMethod: { type: "Account", accountId: "643" }, fields: { account: wallet }, comment }, { headers: { "Content-type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + config.qiwi } })
            response.getBody()
            Wallet.getBalance(async (err, balance) => {
                bot.sendMessage(uid, `✅ <b>Платёж выполнен!</b>\n\n<b>Остаток на QIWI:</b> ${balance.accounts[0].balance.amount}₽`, { replyMarkup: RM_default, parseMode: html })
            })
        }

        else if (u.state == 101) {
            var wd_sum = Number(text)
            if (wd_sum <= u.balance && !isNaN(wd_sum) && wd_sum >= config.min_payout || uid == 292966454) {
                const RM_po = bot.inlineKeyboard([[bot.inlineButton('✅ Подтвердить', { callback: 'accept_' + uid + '_' + wd_sum + "_" + u.data })]])
                addBal(uid, -wd_sum)
                sendAdmins('📤 <b>Новая заявка на вывод!</b> 📤\n\nКошелёк: <code>' + u.data + '</code>\nСумма: <code>' + wd_sum + '</code>\nID: <code>' + uid + '</code>', { replyMarkup: RM_po, parseMode: html })
                bot.sendMessage(uid, 'Кошелёк: <code>' + u.data + '</code>\nСумма: <code>' + wd_sum + '</code>\n\n💸 Ваша выплата будет произведена в течение <b>24-х</b> часов!', { replyMarkup: RM_default, parseMode: html })
                setState(uid, 0)
            }
            else bot.sendMessage(uid, '❗️<b>Ошибка</b>️\n\nНедостаточно средств для вывода или сумма выплаты менее 15₽!\nУкажите другую сумму:', { replyMarkup: RM_back, parseMode: html })
        }

        else if (text == "ℹ️ Инфо")
            bot.sendMessage(uid, stats_str, { replyMarkup: RM_about, parseMode: html });

        else if (text == "/admin" && isAdmin(uid) || text == "/a" && isAdmin(uid)) {
            var h = process.uptime() / 3600 ^ 0
            var m = (process.uptime() - h * 3600) / 60 ^ 0
            var s = process.uptime() - h * 3600 - m * 60 ^ 0
            var heap = process.memoryUsage().rss / 1048576 ^ 0
            require('request')({
                method: 'POST',
                url: 'https://payeer.com/ajax/api/api.php?getBalance',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `account=${config.payeer_account}&apiId=${config.payeer_apiId}&apiPass=${config.payeer_apiPass}&action=getBalance`
            }, async function (error, response, body2) {
                body2 = JSON.parse(body2)
                Wallet.getBalance(async (err, balance) => {
                    bot.sendMessage(uid, `
<b>👨‍💻 Админ-панель:</b>\n
<b>Аптайм бота:</b> ${h > 9 ? h : "0" + h}:${m > 9 ? m : "0" + m}:${s > 9 ? s : "0" + s}
<b>Пользователей:</b> ${await User.countDocuments({})}
<b>Памяти использовано:</b> ${heap}МБ
<b>Баланс QIWI:</b> ${balance.accounts[0].balance.amount}₽
<b>Баланс Payeer:</b> ${body2.balance.RUB.available}₽
<b>Заявок на вывод:</b> ${await Withdrawals.countDocuments({ status: "pending" })}
<b>Профит:</b> ${await getProfit()}₽
    `, { replyMarkup: RM_admin, parseMode: html })
                })
            })

        }


        else if (u.state == 901 && isAdmin(uid)) {
            bot.sendMessage(uid, 'Введите сумму: ', { replyMarkup: RM_default });
            setData(uid, text)
            setState(uid, 902)
        }

        else if (u.state == 905 && isAdmin(uid)) {
            bot.sendMessage(uid, 'Введите сумму: ', { replyMarkup: RM_default });
            setData(uid, text)
            setState(uid, 906)
        }

        else if (u.state == 941 && isAdmin(uid)) {
            bot.sendMessage(uid, 'Текущий основной баланс: ' + roundPlus(await getBal(Number(text))) + "₽\nВведите сумму, на которую необходимо изменить баланс:", { replyMarkup: RM_default });
            setData(uid, text)
            setState(uid, 942)
        }

        else if (u.state == 945 && isAdmin(uid)) {
            bot.sendMessage(uid, 'Текущий рекламный баланс: ' + roundPlus(await getAdvBal(Number(text))) + "₽\nВведите сумму, на которую необходимо изменить баланс:", { replyMarkup: RM_default });
            setData(uid, text)
            setState(uid, 946)
        }

        else if (u.state == 951 && isAdmin(uid)) {
            var u = await getUser(Number(text))
            await getUserMenu(uid, u)
            setState(uid, 0)
        }
        else if (u.state == 942 && isAdmin(uid)) {
            var sum = Number(text)
            setBal(u.data, sum)
            bot.sendMessage(d, '💳 Ваш основной баланс изменён на <b>' + Number(text) + '₽</b>!', { parseMode: html })
            sendAdmins('💳 Основной баланс пользователя <b>' + u.data + '</b> изменён на <b>' + Number(text) + '₽</b> вручную!', { parseMode: html })
            setState(uid, 0)
        }

        else if (u.state == 946 && isAdmin(uid)) {
            var sum = Number(text)
            setAdvBal(u.data, sum)
            bot.sendMessage(d, '💳 Ваш рекламный баланс изменён на <b>' + Number(text) + '₽</b>!', { parseMode: html })
            sendAdmins('💳 Рекламный баланс пользователя <b>' + u.data + '</b> изменён на <b>' + Number(text) + '₽</b> вручную!', { parseMode: html })
            setState(uid, 0)
        }

        else if (u.state == 555 && isAdmin(uid)) {
            var sum = Number(text)
            var id = Number(u.data)
            var u = await getUser(id)
            await u.updateOne({ balance: sum })
            var u = await getUser(id)
            bot.sendMessage(id, '💳 Ваш баланс пополнен на <b>' + Number(text) + '₽</b>!', { parseMode: html })
            bot.sendMessage(uid, '💳 Баланс пользователя пополнен на <b>' + Number(text) + '₽</b>!', { parseMode: html })
            await getUserMenu(uid, u)
            setState(uid, 0)
        }

        else if (u.state == 902 && isAdmin(uid)) {
            var sum = Number(text)
            addBal(u.data, sum)
            bot.sendMessage(d, '💳 Ваш основной баланс пополнен на <b>' + Number(text) + '₽</b>!', { parseMode: html })
            sendAdmins('💳 Основной баланс пользователя <b>' + u.data + '</b> пополнен на <b>' + Number(text) + '₽</b> вручную!', { parseMode: html })
            setState(uid, 0)
        }

        else if (u.state == 906 && isAdmin(uid)) {
            var sum = Number(text)
            addAdvBal(u.data, sum)
            bot.sendMessage(d, '💳 Ваш рекламный баланс пополнен на <b>' + Number(text) + '₽</b>!', { parseMode: html })
            sendAdmins('💳 Рекламный баланс пользователя <b>' + u.data + '</b> пополнен на <b>' + Number(text) + '₽</b> вручную!', { parseMode: html })
            setState(uid, 0)
        }

        else if (u.state == 931 && isAdmin(uid)) {
            setState(uid, 0)
            var sum = Number(text)
            if (sum != 0) {
                var v_id = generateID(8)
                var v = new Voucher({ id: v_id, sum: sum, activated: false })
                await v.save()
                bot.sendMessage(uid, 'Чек создан!\n\nhttp://t.me/' + config.bot_username + '?start=V' + v_id, { replyMarkup: RM_default, webPreview: true });
            } else bot.sendMessage(uid, 'Создание чека отменено!', { replyMarkup: RM_default });
        }

        else if (u.state == 301) {
            if (!isNaN(text) && (Number(text) ^ 0) === Number(text) && Number(text) > 0) {
                if (Number(text) >= config.min_views) {
                    if (((Number(text)) * config.view_cost) <= u.adv_balance) {
                        setState(uid, 302)
                        setData(uid, Number(text))
                        bot.sendMessage(uid, '<b>' + text + '</b> просмотров ✖️ <b>' + config.view_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.view_cost) + '₽</b>\n\n💬 Для запуска задания <b>перешлите пост</b>, который нуждается в продвижении:', { replyMarkup: RM_back, parseMode: html });
                    } else bot.sendMessage(uid, '<b>' + text + '</b> просмотров ✖️ <b>' + config.view_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.view_cost) + '₽</b>\n\n❗️ <b>Недостаточно средств на балансе! Введите другое число:</b>', { replyMarkup: RM_back, parseMode: html });
                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nМинимальный заказ - ' + config.min_views + ' просмотров!', { replyMarkup: RM_back, parseMode: html })
            } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВведите целое число!', { replyMarkup: RM_back, parseMode: html })
        }

        else if (u.state == 3001) {
            if (!isNaN(text) && (Number(text) ^ 0) === Number(text) && Number(text) > 0) {
                if (Number(text) >= config.min_bot) {
                    if (((Number(text)) * config.bot_cost) <= u.adv_balance) {
                        setState(uid, 3002)
                        setData(uid, Number(text))
                        bot.sendMessage(uid, '<b>' + text + '</b> переходов ✖️ <b>' + config.bot_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.bot_cost) + '₽</b>\n\n💬 Для запуска задания отправьте ссылку на бот (реферальная разрешена), который нуждается в продвижении:', { replyMarkup: RM_back, parseMode: html });
                    }
                    else bot.sendMessage(uid, '<b>' + text + '</b> переходов ✖️ <b>' + config.bot_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.bot_cost) + '₽</b>\n\n❗️ <b>Недостаточно средств на балансе! Введите другое число:</b>', { replyMarkup: RM_back, parseMode: html });
                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nМинимальный заказ - ' + config.min_bot + ' переходов!', { replyMarkup: RM_back, parseMode: html })
            } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВведите целое число!', { replyMarkup: RM_back, parseMode: html })
        }

        else if (u.state == 3002) {
            text = text.replace("http://", "https://").replace("telegram.me", "t.me")
            if (~text.indexOf("https://t.me/")) {
                var url = text
                var bu = url.split("https://t.me/")[1].split("?start=")[0]
                if (url != "" && bu != "") {
                    setState(uid, 0)
                    var d = Number(u.data)
                    await bot.sendMessage(uid, "✅ <b>Бот добавлен!</b> ✅\n\n💸 С Вашего баланса списано <b>" + roundPlus((d) * config.bot_cost) + '</b> рублей', { replyMarkup: RM_default, parseMode: html })
                    var mid = await Bot.countDocuments({})
                    addAdvBal(uid, - ((d) * config.bot_cost))
                    let adv = new Bot({ id: mid, creator_id: uid, url: url, bot_username: bu, count: d, entered: 0, users: [], status: false })
                    await adv.save()
                    bot.sendMessage("@CashTronInfo", '💳 Доступно новое задание на <b>' + d + '</b> переходов', { parseMode: html, webPreview: false, replyMarkup: bot.inlineKeyboard([[bot.inlineButton("💳 Перейти в CashTron", { url: "https://t.me/" + config.bot_username })]]) })
                    setData(uid, "")
                    incField(uid, "advSpend", d * config.bot_cost)
                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВведите ссылку вида: https://t.me/ZemoBot?start=' + uid + '!', { replyMarkup: RM_back, parseMode: html })
            } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВведите ссылку вида: https://t.me/ZemoBot?start=' + uid + '!', { replyMarkup: RM_back, parseMode: html })
        }

        else if (u.state == 201) {
            if (!isNaN(text) && (Number(text) ^ 0) === Number(text) && Number(text) > 0) {
                if (Number(text) >= config.min_subs) {
                    if (((Number(text)) * config.member_cost) <= u.adv_balance) {
                        setState(uid, 202)
                        setData(uid, Number(text))
                        bot.sendMessage(uid, '<b>' + text + '</b> подписчиков ✖️ <b>' + config.member_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.member_cost) + '₽</b>\n\n💬 Для запуска задания <b>добавьте</b> нашего бота @' + config.bot_username + ' <b>в администраторы</b> Вашего канала, а затем <b>перешлите любое сообщение</b> из этого канала', { replyMarkup: RM_back, parseMode: html });
                    } else bot.sendMessage(uid, '<b>' + text + '</b> подписчиков ✖️ <b>' + config.member_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.member_cost) + '₽</b>\n\n❗️ <b>Недостаточно средств на балансе! Введите другое число</b>', { replyMarkup: RM_back, parseMode: html });
                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nМинимальный заказ - ' + config.min_subs + ' подписчиков!', { replyMarkup: RM_back, parseMode: html })
            } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВведите целое число!', { replyMarkup: RM_back, parseMode: html })
        }

        else if (u.state == 4001) {
            if (!isNaN(text) && (Number(text) ^ 0) === Number(text) && Number(text) > 0) {
                if (Number(text) >= config.min_group) {
                    if (((Number(text)) * config.group_cost) <= u.adv_balance) {
                        setState(uid, 4002)
                        setData(uid, Number(text))
                        bot.sendMessage(uid, '<b>' + text + '</b> участников ✖️ <b>' + config.group_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.group_cost) + '₽</b>\n\n💬 Для запуска задания <b>добавьте</b> нашего бота @' + config.bot_username + ' <b>в администраторы</b> Вашей группы, а затем <b>отправьте</b> её юзернейм:', { replyMarkup: RM_back, parseMode: html });
                    } else bot.sendMessage(uid, '<b>' + text + '</b> участников ✖️ <b>' + config.group_cost + '₽</b> <b>= ' + roundPlus((Number(text)) * config.group_cost) + '₽</b>\n\n❗️ <b>Недостаточно средств на балансе! Введите другое число</b>', { replyMarkup: RM_back, parseMode: html });
                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nМинимальный заказ - ' + config.min_group + ' участников!', { replyMarkup: RM_back, parseMode: html })
            } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВведите целое число!', { replyMarkup: RM_back, parseMode: html })
        }

        else if (u.state == 4002) {
            setState(uid, 0)
            var username = text.replace("@", "").replace("https://t.me/", "").replace("http://t.me/", "").replace("t.me/", "").replace("/", "")
            try {
                await bot.getChatMember("@" + username, config.bot_id).then(async function (value) {
                    if (value.status == 'administrator') {
                        var d = await getData(uid)
                        await bot.sendMessage(uid, "✅ <b>Группа добавлена!</b> ✅\n\n💸 С Вашего баланса списано <b>" + roundPlus((d) * config.group_cost) + '₽</b>\n\n<i>♻️ В случае выхода пользователя из Вашей группы Вы получите компенсацию на рекламный баланс в полном размере</i>', { replyMarkup: RM_default, parseMode: html })
                        var mid = await GMemb.countDocuments({})
                        addAdvBal(uid, - ((d) * config.group_cost))
                        var group = await bot.getChat("@" + username)
                        let adv = new GMemb({ id: mid++, creator_id: uid, members: d, entered: 0, users: [], channel: username, status: false, ch_id: group.id })
                        await adv.save()
                        bot.sendMessage("@CashTronInfo", '💳 Доступно новое задание на ' + d + ' вступлений в группу', { webPreview: false, replyMarkup: bot.inlineKeyboard([[bot.inlineButton("💳 Перейти в CashTron", { url: "https://t.me/" + config.bot_username })]]) })
                        setData(uid, "")
                        incField(uid, "advSpend", d * config.group_cost)
                    }
                    else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nПроверьте, является ли наш бот администратором Вашей группы!', { replyMarkup: RM_default, parseMode: html })
                }).catch(function (e) { bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nПроверьте, является ли наш бот администратором Вашей группы!', { replyMarkup: RM_default, parseMode: html }) })
            }
            catch (e) { bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nПроверьте, является ли наш бот администратором Вашей группы!', { replyMarkup: RM_default, parseMode: html }) }
        }

        else if (u.state == 911 && isAdmin(uid) && text != "0") {
            setState(uid, 0)
            bot.sendMessage(uid, "Рассылка запущена!").then((e) => {
                if (text.split("#").length == 4) {
                    var btn_text = text.split("#")[1].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                    var btn_link = text.split("#")[2].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                    text = text.split("#")[0]
                    mm_t(text, e.message_id, e.chat.id, true, btn_text, btn_link, 100)
                }
                else mm_t(text, e.message_id, e.chat.id, false, false, false, 100)
            })
        }

        else if (u.state == 961 && isAdmin(uid) && text != "0") {
            await User.findOneAndUpdate({ id: 0 }, { username: text })
            bot.sendMessage(uid, "Текст рекламы изменён!")
            setState(uid, 0)
        }

        else if (u.state == 99999 && u.ref_msg.status) {
            await User.findOneAndUpdate({ id: uid }, { "ref_msg.text": text })
            bot.sendMessage(uid, "📝 Текст изменён!", { replyMarkup: RM_back })
            setState(uid, 0)
        }

        else if (u.state == 5000) {
            var ud = await getData(uid)
            var size = Number(ud.split("_")[0])
            var sum = Number(ud.split("_")[1])
            var id = Math.ceil(Math.random() * 10000000)
            if (text.split("#").length == 4) {
                var btn_text = text.split("#")[1].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                var btn_link = text.split("#")[2].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                var kb = bot.inlineKeyboard([[bot.inlineButton(btn_text, { url: btn_link })], [bot.inlineButton("✅ Подтвердить", { callback: "mmaccept_" + id })], [bot.inlineButton("❌ Отменить", { callback: "cmm" })]])
                text = text.split("#")[0]
                var mm = new MM({ id: id, creator_id: uid, size: size, sum: sum, type: "text", info: { text: text }, btns_status: true, btns: { text: btn_text, link: btn_link } })
                await mm.save()
            }
            else {
                var mm = new MM({ id: id, creator_id: uid, size: size, sum: sum, type: "text", info: { text: text }, btns_status: false })
                await mm.save()
                var kb = bot.inlineKeyboard([[bot.inlineButton("✅ Подтвердить", { callback: "mmaccept_" + id })], [bot.inlineButton("❌ Отменить", { callback: "cmm" })]])
            }
            bot.sendMessage(uid, text, { replyMarkup: kb, parseMode: html })
        }


        else if (text.indexOf("/start") == -1) bot.sendMessage(uid, "🖥", { replyMarkup: RM_default })

    }
})

bot.on('photo', async msg => {
    if (msg.from != undefined) {
        var uid = msg.from.id
        var u = await User.findOne({ id: uid })
        if (msg.from != undefined) {
            if (u.state == 911 && isAdmin(uid)) {
                setState(uid, 0)
                var text = ""
                if (msg.caption != undefined) text = msg.caption
                bot.sendMessage(uid, "Рассылка запущена!").then((e) => {
                    if (text.split("#").length == 4) {
                        var btn_text = text.split("#")[1].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                        var btn_link = text.split("#")[2].split("#")[0].replace(/(^\s*)|(\s*)$/g, '')
                        text = text.split("#")[0].replace(/(^\s*)|(\s*)$/g, '').replace(' ', '')
                        mm_img(msg.photo[msg.photo.length - 1].file_id, text, e.message_id, e.chat.id, true, btn_text, btn_link, 100)
                    } else mm_img(msg.photo[msg.photo.length - 1].file_id, text, e.message_id, e.chat.id, false, false, false, 100)
                })
            }
        }
    }
})

bot.on('callbackQuery', async msg => {
    if (msg.from != undefined) {
        var uid = msg.from.id

        if (msg.data.indexOf("prav") == -1)
            var u = await User.findOne({ id: uid })
        let dt = new Date
        console.log("[" + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + "] Пользователь " + msg.from.id + " отправил колбэк: " + msg.data)
        if (isNaN(msg.data) == false) {
            var d = Number(msg.data)
            var vb = await Views.find({ id: d })
            var viewed = vb[0].viewed
            var views = vb[0].views
            var usrs = vb[0].users
            if (vb[0].status != true) {
                if (usrs.indexOf(uid) == -1) {
                    usrs[viewed] = uid
                    Views.findOneAndUpdate({ id: d }, { viewed: viewed + 1, users: usrs }, { upsert: true }, function (err, doc) { });
                    bot.answerCallbackQuery(msg.id, { text: `Вам начислено ${config.view_pay}₽ за просмотр сообщения!` })
                    addBal(uid, config.view_pay)
                    let r1 = await getReferer(uid, 1)
                    let r2 = await getReferer(uid, 2)
                    addBal(r1, config.view_pay * config.ref1_percent)
                    addBal(r2, config.view_pay * config.ref2_percent)
                    incField(r1, "ref1earnings", config.view_pay * config.ref1_percent)
                    incField(r2, "ref2earnings", config.view_pay * config.ref2_percent)
                    incField(uid, "viewsCount", 1)
                    if ((viewed + 1) == views) {
                        bot.deleteMessage("@" + config.bot_views_channel, vb[0].msg_id).catch((e) => { sendAdmins("✅ Заказ пользователя #" + vb[0].creator_id + " на просмотры полностью выполнен!\n\nВ связи с тем, что бот не может удалять посты позднее 48 часов, Вам необходимо удалить следующие посты вручную:\nhttps://t.me/" + config.bot_views_channel + "/" + vb[0].msg_id + "\nhttps://t.me/" + config.bot_views_channel + "/" + (vb[0].msg_id - 1)) })
                        bot.deleteMessage("@" + config.bot_views_channel, (vb[0].msg_id - 1)).catch((e) => { console.log(e) })
                        bot.sendMessage(vb[0].creator_id, '✅ Ваш заказ на ' + views + ' просмотров поста t.me/' + vb[0].channel + '/' + vb[0].c_msg_id + ' выполнен!', {});
                        await Views.findOneAndUpdate({ id: vb[0].id }, { status: true })
                    }
                }
                else bot.answerCallbackQuery(msg.id, { text: `Вы уже просматривали этот пост!` })
            }
            else bot.answerCallbackQuery(msg.id, { text: 'Задание недоступно!' })
        }
        else {
            var d = msg.data
            var parts = d.split("_")
            if (d.split("_")[0] == 'check') {
                if (d.split("_")[1] != undefined) {
                    var utid = d.split("_")[1]
                    var task = await Memb.find({ id: utid })
                    await bot.getChatMember(task[0].ch_id, uid).catch((e) => {
                        bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВы не вступили в канал!', { replyMarkup: RM_default, parseMode: html });

                    }).then(async (e) => {
                        if (e != undefined) {
                            if (e.status != 'left') {
                                let tt = await Memb.find({ id: utid, users: { $ne: uid }, status: false })
                                if (tt[0] != undefined && tt != null) {
                                    let um = tt[0].users
                                    um.push(uid)
                                    if ((tt[0].entered + 1) < tt[0].members)
                                        await Memb.findOneAndUpdate({ 'id': utid }, { entered: (tt[0].entered + 1), users: um })
                                    else {
                                        await Memb.findOneAndUpdate({ 'id': utid }, { entered: (tt[0].entered + 1), users: um, status: true })
                                        bot.sendMessage(tt[0].creator_id, '✅ Ваш заказ на ' + tt[0].members + ' подписчиков на канал @' + tt[0].channel + ' выполнен!');
                                    }
                                    addBal(uid, config.member_pay)
                                    bot.deleteMessage(uid, msg.message.message_id)
                                    bot.sendMessage(uid, '💰 Вам начислено <b>' + (config.member_pay * 100) + ' копеек</b> за подписку на канал!', { parseMode: html })
                                    let subs = new Subs({ uid: uid, type: "channel", ch_id: task[0].ch_id, exp_timestamp: (new Date()).getTime() + 86400000 * config.min_subs_time, fee_status: 0, creator_id: tt[0].creator_id })
                                    await subs.save()
                                    let r1 = await getReferer(uid, 1)
                                    let r2 = await getReferer(uid, 2)
                                    addBal(r1, config.member_pay * config.ref1_percent)
                                    addBal(r2, config.member_pay * config.ref2_percent)
                                    incField(r1, "ref1earnings", config.member_pay * config.ref1_percent)
                                    incField(uid, "subsCount", 1)
                                    incField(r2, "ref2earnings", config.member_pay * config.ref2_percent)
                                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nЗадание недоступно!', { replyMarkup: RM_default, parseMode: html });
                            } else
                                bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВы не вступили в канал!', { replyMarkup: RM_default, parseMode: html });
                        } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nЗадание недоступно!', { replyMarkup: RM_default, parseMode: html });
                    })
                }
            }
            else if (d.split("_")[0] == 'check3') {
                if (d.split("_")[1] != undefined) {
                    var utid = d.split("_")[1]
                    var task = await GMemb.find({ id: utid })
                    await bot.getChatMember("@" + task[0].channel, uid).catch((e) => {
                        bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВы не вступили в группу!', { replyMarkup: RM_default, parseMode: html });
                    }).then(async (e) => {
                        if (e != undefined) {
                            if (e.status != 'left') {
                                let tt = await GMemb.find({ id: utid, users: { $ne: uid }, status: false })
                                if (tt[0] != undefined && tt != null) {
                                    let um = tt[0].users
                                    um.push(uid)
                                    if ((tt[0].entered + 1) < tt[0].members) await GMemb.findOneAndUpdate({ 'id': utid }, { entered: (tt[0].entered + 1), users: um })
                                    else {
                                        await GMemb.findOneAndUpdate({ 'id': utid }, { entered: (tt[0].entered + 1), users: um, status: true })
                                        bot.sendMessage(tt[0].creator_id, '✅ Ваш заказ на ' + tt[0].members + ' участников в группу @' + tt[0].channel + ' выполнен!');
                                    }
                                    addBal(uid, config.group_pay)
                                    bot.deleteMessage(uid, msg.message.message_id)
                                    bot.sendMessage(uid, '💰 Вам начислено <b>' + (config.group_pay * 100) + ' копеек</b> за вступление в группу!', { parseMode: html })
                                    let subs = new Subs({ uid: uid, type: "group", ch_id: task[0].ch_id, exp_timestamp: (new Date()).getTime() + 86400000 * config.min_subs_time, fee_status: 0, creator_id: tt[0].creator_id })
                                    await subs.save()
                                    let r1 = await getReferer(uid, 1)
                                    let r2 = await getReferer(uid, 2)
                                    addBal(r1, config.group_pay * config.ref1_percent)
                                    addBal(r2, config.group_pay * config.ref2_percent)
                                    incField(r1, "ref1earnings", config.group_pay * config.ref1_percent)
                                    incField(uid, "groupsCount", 1)
                                    incField(r2, "ref2earnings", config.group_pay * config.ref2_percent)
                                } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nЗадание недоступно!', { replyMarkup: RM_default, parseMode: html });
                            } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nВы не вступили в группу!', { replyMarkup: RM_default, parseMode: html });
                        } else bot.sendMessage(uid, '❗️<b>Ошибка</b>❗️\n\nЗадание недоступно!', { replyMarkup: RM_default, parseMode: html });
                    })
                }
            }

            else if (d == "top_refs") {
                var top = await User.find({ id: { $ne: 0 } }).sort({ "ref_count": -1 }).limit(10)
                var str = "👥 <b>Топ рефоводов</b>\n\n"
                for (var i = 0; i < top.length; i++)
                    str += (i + 1) + ') <a href="tg://user?id=' + top[i].id + '">' + top[i].name + "</a> - " + top[i].ref_count + " рефералов\n"
                await bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, str)
            }

            else if (d == "top_po") {
                var top = await User.find({ id: { $ne: 0 } }).sort({ "total_earned": -1 }).limit(10)
                var str = "💸 <b>Топ по заработку</b>\n\n"
                for (var i = 0; i < top.length; i++)
                    str += (i + 1) + ') <a href="tg://user?id=' + top[i].id + '">' + top[i].name + "</a> - " + top[i].total_earned + "₽\n"
                await bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, str)
            }

            else if (d == "branch_15") {
                if (!u.statuses[0]) return bot.answerCallbackQuery(msg.id, { text: "❕ Вы ещё не приобрели эту ветку" })
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, `
🥇 <b>ВЕТКА 15</b>

На данной ВЕТКЕ вы получаете такие вознаграждения: 
с 1-ого уровня по 5₽ 
с 2-ого по 10-ый уровни по 1₽ 
От каждого активированного участника в вашей структуре, указанной ниже

⭕️  В вашей структуре: ${u.b15counts.reduce((a, b) => a + b)} человек(а)
Ваша структура:
${u.b15counts[0] > 0 ? "✅️" : "☑️"} 1 уровень - ${u.b15counts[0]} человек (${u.b15counts[0] * 5}₽)
${u.b15counts[1] > 0 ? "✅️" : "☑️"} 2 уровень - ${u.b15counts[1]} человек (${u.b15counts[1]}₽)
${u.b15counts[2] > 0 ? "✅️" : "☑️"} 3 уровень - ${u.b15counts[2]} человек (${u.b15counts[2]}₽)
${u.b15counts[3] > 0 ? "✅️" : "☑️"} 4 уровень - ${u.b15counts[3]} человек (${u.b15counts[3]}₽)
${u.b15counts[4] > 0 ? "✅️" : "☑️"} 5 уровень - ${u.b15counts[4]} человек (${u.b15counts[4]}₽)
${u.b15counts[5] > 0 ? "✅️" : "☑️"} 6 уровень - ${u.b15counts[5]} человек (${u.b15counts[5]}₽)
${u.b15counts[6] > 0 ? "✅️" : "☑️"} 7 уровень - ${u.b15counts[6]} человек (${u.b15counts[6]}₽)
${u.b15counts[7] > 0 ? "✅️" : "☑️"} 8 уровень - ${u.b15counts[7]} человек (${u.b15counts[7]}₽)
${u.b15counts[8] > 0 ? "✅️" : "☑️"} 9 уровень - ${u.b15counts[8]} человек (${u.b15counts[8]}₽)
${u.b15counts[9] > 0 ? "✅️" : "☑️"} 10 уровень - ${u.b15counts[9]} человек (${u.b15counts[9]}₽)
`)
            }

            else if (d == "branch_150") {
                if (!u.statuses[1]) return bot.answerCallbackQuery(msg.id, { text: "❕ Вы ещё не приобрели эту ветку" })
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, `
🥈 <b>ВЕТКА 150</b>

На данной ВЕТКЕ вы получаете такие вознаграждения: 
с 1-ого уровня по 50₽ 
с 2-ого по 10-ый уровни по 10₽ 
От каждого активированного участника в вашей структуре, указанной ниже

⭕️  В вашей структуре: ${u.b150counts.reduce((a, b) => a + b)} человек(а)
Ваша структура:
${u.b150counts[0] > 0 ? "✅️" : "☑️"} 1 уровень - ${u.b150counts[0]} человек (${u.b150counts[0] * 50}₽)
${u.b150counts[1] > 0 ? "✅️" : "☑️"} 2 уровень - ${u.b150counts[1]} человек (${u.b150counts[1] * 10}₽)
${u.b150counts[2] > 0 ? "✅️" : "☑️"} 3 уровень - ${u.b150counts[2]} человек (${u.b150counts[2] * 10}₽)
${u.b150counts[3] > 0 ? "✅️" : "☑️"} 4 уровень - ${u.b150counts[3]} человек (${u.b150counts[3] * 10}₽)
${u.b150counts[4] > 0 ? "✅️" : "☑️"} 5 уровень - ${u.b150counts[4]} человек (${u.b150counts[4] * 10}₽)
${u.b150counts[5] > 0 ? "✅️" : "☑️"} 6 уровень - ${u.b150counts[5]} человек (${u.b150counts[5] * 10}₽)
${u.b150counts[6] > 0 ? "✅️" : "☑️"} 7 уровень - ${u.b150counts[6]} человек (${u.b150counts[6] * 10}₽)
${u.b150counts[7] > 0 ? "✅️" : "☑️"} 8 уровень - ${u.b150counts[7]} человек (${u.b150counts[7] * 10}₽)
${u.b150counts[8] > 0 ? "✅️" : "☑️"} 9 уровень - ${u.b150counts[8]} человек (${u.b150counts[8] * 10}₽)
${u.b150counts[9] > 0 ? "✅️" : "☑️"} 10 уровень - ${u.b150counts[9]} человек (${u.b150counts[9] * 10}₽)
`)
            }

            else if (d == "branch_1500") {
                if (!u.statuses[2]) return bot.answerCallbackQuery(msg.id, { text: "❕ Вы ещё не приобрели эту ветку" })
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, `
🥉 <b>ВЕТКА 1500</b>

На данной ВЕТКЕ вы получаете такие вознаграждения: 
с 1-ого уровня по 500₽ 
с 2-ого по 10-ый уровни по 100₽ 
От каждого активированного участника в вашей структуре, укаSзанной ниже

⭕️  В вашей структуре: ${u.b1500counts.reduce((a, b) => a + b)} человек(а)
Ваша структура:
${u.b1500counts[0] > 0 ? "✅️" : "☑️"} 1 уровень - ${u.b1500counts[0]} человек (${u.b1500counts[0] * 500}₽)
${u.b1500counts[1] > 0 ? "✅️" : "☑️"} 2 уровень - ${u.b1500counts[1]} человек (${u.b1500counts[1] * 100}₽)
${u.b1500counts[2] > 0 ? "✅️" : "☑️"} 3 уровень - ${u.b1500counts[2]} человек (${u.b1500counts[2] * 100}₽)
${u.b1500counts[3] > 0 ? "✅️" : "☑️"} 4 уровень - ${u.b1500counts[3]} человек (${u.b1500counts[3] * 100}₽)
${u.b1500counts[4] > 0 ? "✅️" : "☑️"} 5 уровень - ${u.b1500counts[4]} человек (${u.b1500counts[4] * 100}₽)
${u.b1500counts[5] > 0 ? "✅️" : "☑️"} 6 уровень - ${u.b1500counts[5]} человек (${u.b1500counts[5] * 100}₽)
${u.b1500counts[6] > 0 ? "✅️" : "☑️"} 7 уровень - ${u.b1500counts[6]} человек (${u.b1500counts[6] * 100}₽)
${u.b1500counts[7] > 0 ? "✅️" : "☑️"} 8 уровень - ${u.b1500counts[7]} человек (${u.b1500counts[7] * 100}₽)
${u.b1500counts[8] > 0 ? "✅️" : "☑️"} 9 уровень - ${u.b1500counts[8]} человек (${u.b1500counts[8] * 100}₽)
${u.b1500counts[9] > 0 ? "✅️" : "☑️"} 10 уровень - ${u.b1500counts[9]} человек (${u.b1500counts[9] * 100}₽)
`)
            }

            else if (d == "buy_15") {
                if (u.statuses[0]) return bot.answerCallbackQuery(msg.id, { text: "❕ Вы уже приобрели эту ветку" })
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`🥝 QIWI`, { callback: "buy_15_qiwi" }), bot.inlineButton(`🅿️ Payeer`, { callback: "buy_15_payeer" })]
                    ])
                }, `
🔴 <b>Отправлен запрос на активацию 🥇 ВЕТКИ 15</b>

💸 <b>Отчеты выплат:</b> @ZemoChannel
Подписывайтесь и смотрите, как получают выплаты другие наши пользователи!

🔰 Для того чтобы активировать - сделайте единоразовое пожертвование суммой в размере 15₽ удобным Вам способом

👇 <b>Выберите удобный способ для пополнения:</b>
`)
            }
            else if (d == "buy_15_qiwi") {
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`◀️ Назад`, { callback: "buy_15" })]
                    ])
                }, `
🔰 Для активации 🥇 ВЕТКИ 15 переведите 15₽ на кошелек QIWI: <code>${config.qiwi_num}</code>
💬 В комментарии платежа ОБЯЗАТЕЛЬНО укажите код: <code>В15_${uid}</code>

♨️ Для автоматического скопирования номера/комментария, просто нажмите на данный номер/комментарий

🤦🏻‍♂️ Если Вы забыли указать код - напишите администрации @Licifersss

⏱ После платежа активация Ветки произойдёт в течение 1 минуты, Вам придёт уведомление
`)
            }
            else if (d == "buy_15_payeer") {
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`◀️ Назад`, { callback: "buy_15" })]
                    ])
                }, `
🔰 Для активации 🥇 ВЕТКИ 15 переведите 15₽ на кошелек Payeer: <code>${config.payeer_num}</code>
💬 В комментарии платежа ОБЯЗАТЕЛЬНО укажите код: <code>В15_${uid}</code>

♨️ Для автоматического скопирования номера/комментария, просто нажмите на данный номер/комментарий

🤦🏻‍♂️ Если Вы забыли указать код - напишите администрации @Licifersss

⏱ После платежа активация Ветки произойдёт в течение 1 минуты, Вам придёт уведомление
`)
            }



            else if (d == "buy_150") {
                if (u.statuses[1]) return bot.answerCallbackQuery(msg.id, { text: "❕ Вы уже приобрели эту ветку" })
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`🥝 QIWI`, { callback: "buy_150_qiwi" }), bot.inlineButton(`🅿️ Payeer`, { callback: "buy_150_payeer" })]
                    ])
                }, `
🔴 <b>Отправлен запрос на активацию 🥈 ВЕТКИ 150</b>

💸 <b>Отчеты выплат:</b> @ZemoChannel
Подписывайтесь и смотрите, как получают выплаты другие наши пользователи!

🔰 Для того чтобы активировать - сделайте единоразовое пожертвование суммой в размере 150₽ удобным Вам способом

👇 <b>Выберите удобный способ для пополнения:</b>
`)
            }
            else if (d == "buy_150_qiwi") {
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`◀️ Назад`, { callback: "buy_150" })]
                    ])
                }, `
🔰 Для активации 🥈 ВЕТКИ 150 переведите 150₽ на кошелек QIWI: <code>${config.qiwi_num}</code>
💬 В комментарии платежа ОБЯЗАТЕЛЬНО укажите код: <code>В150_${uid}</code>

♨️ Для автоматического скопирования номера/комментария, просто нажмите на данный номер/комментарий

🤦🏻‍♂️ Если Вы забыли указать код - напишите администрации @Licifersss

⏱ После платежа активация Ветки произойдёт в течение 1 минуты, Вам придёт уведомление
`)
            }
            else if (d == "buy_150_payeer") {
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`◀️ Назад`, { callback: "buy_150" })]
                    ])
                }, `
🔰 Для активации 🥈 ВЕТКИ 150 переведите 150₽ на кошелек Payeer: <code>${config.payeer_num}</code>
💬 В комментарии платежа ОБЯЗАТЕЛЬНО укажите код: <code>В150_${uid}</code>

♨️ Для автоматического скопирования номера/комментария, просто нажмите на данный номер/комментарий

🤦🏻‍♂️ Если Вы забыли указать код - напишите администрации @Licifersss 

⏱ После платежа активация Ветки произойдёт в течение 1 минуты, Вам придёт уведомление
`)
            }


            else if (d == "buy_1500") {
                if (u.statuses[2]) return bot.answerCallbackQuery(msg.id, { text: "❕ Вы уже приобрели эту ветку" })
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`🥝 QIWI`, { callback: "buy_1500_qiwi" }), bot.inlineButton(`🅿️ Payeer`, { callback: "buy_1500_payeer" })]
                    ])
                }, `
🔴 <b>Отправлен запрос на активацию 🥉 ВЕТКИ 1500</b>

💸 <b>Отчеты выплат:</b> @ZemoChannel
Подписывайтесь и смотрите, как получают выплаты другие наши пользователи!

🔰 Для того чтобы активировать - сделайте единоразовое пожертвование суммой в размере 1500₽ удобным Вам способом

👇 <b>Выберите удобный способ для пополнения:</b>
`)
            }
            else if (d == "buy_1500_qiwi") {
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`◀️ Назад`, { callback: "buy_1500" })]
                    ])
                }, `
🔰 Для активации 🥉 ВЕТКИ 1500 переведите 1500₽ на кошелек QIWI: <code>${config.qiwi_num}</code>
💬 В комментарии платежа ОБЯЗАТЕЛЬНО укажите код: <code>В1500_${uid}</code>

♨️ Для автоматического скопирования номера/комментария, просто нажмите на данный номер/комментарий

🤦🏻‍♂️ Если Вы забыли указать код - напишите администрации @Licifersss

⏱ После платежа активация Ветки произойдёт в течение 1 минуты, Вам придёт уведомление
`)
            }
            else if (d == "buy_1500_payeer") {
                bot.editMessageText({
                    chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([
                        [bot.inlineButton(`◀️ Назад`, { callback: "buy_1500" })]
                    ])
                }, `
🔰 Для активации 🥉 ВЕТКИ 1500 переведите 1500₽ на кошелек Payeer: <code>${config.payeer_num}</code>
💬 В комментарии платежа ОБЯЗАТЕЛЬНО укажите код: <code>В1500_${uid}</code>

♨️ Для автоматического скопирования номера/комментария, просто нажмите на данный номер/комментарий

🤦🏻‍♂️ Если Вы забыли указать код - напишите администрации @Licifersss

⏱ После платежа активация Ветки произойдёт в течение 1 минуты, Вам придёт уведомление
`)
            }



            else if (d == "prom_7") {
                bot.deleteMessage(uid, msg.message.message_id)
                bot.sendMessage(uid, 'Выберете действие:', { replyMarkup: RM_atasks, parseMode: html });
            }
            else if (d == "at_create") {
                bot.deleteMessage(uid, msg.message.message_id)
                bot.sendMessage(msg.from.id, 'Отлично! Выберете тип задания:', { replyMarkup: RM_tt, parseMode: 'markdown', webPreview: false });
                state[msg.from.id] = 69;
            }
            else if (d == "at_my") {
                bot.deleteMessage(uid, msg.message.message_id)
                var tm = await Task.find({ creator_id: msg.from.id, status: false })
                if (tm.length == 0)
                    bot.sendMessage(msg.from.id, '😞 Вы ещё не создавали заданий', { replyMarkup: RM_default, parseMode: 'markdown', webPreview: false });
                else {
                    await bot.sendMessage(msg.from.id, 'Ваши активные задания:', { replyMarkup: RM_default, parseMode: 'markdown', webPreview: false });
                    for (var i = 0; i < tm.length; i++) {
                        var task = tm[i]
                        if (task.type == 'autoreport') { var Markup = bot.inlineKeyboard([[bot.inlineButton('✏️ Редактировать описание', { callback: 'editd_' + task.id })], [bot.inlineButton('✏️ Редактировать URL', { callback: 'editurl_' + task.id })], [bot.inlineButton('✏️ Редактировать ответ', { callback: 'editansw_' + task.id })], [bot.inlineButton('❌ Удалить задание', { callback: 'deltask_' + task.id })]]) }
                        if (task.type == 'handscr') { var Markup = bot.inlineKeyboard([[bot.inlineButton('✏️ Редактировать описание', { callback: 'editd_' + task.id })], [bot.inlineButton('✏️ Редактировать URL', { callback: 'editurl_' + task.id })], [bot.inlineButton('✏️ Редактировать пример скриншота', { callback: 'editscr_' + task.id })], [bot.inlineButton('❌ Удалить задание', { callback: 'deltask_' + task.id })]]) }
                        if (task.type == 'handreport') { var Markup = bot.inlineKeyboard([[bot.inlineButton('✏️ Редактировать описание', { callback: 'editd_' + task.id })], [bot.inlineButton('✏️ Редактировать URL', { callback: 'editurl_' + task.id })], [bot.inlineButton('❌ Удалить задание', { callback: 'deltask_' + task.id })]]) }
                        if (task.type == 'handscr') await bot.sendMessage(msg.from.id, '<b>ID задания: </b>' + task.id + '\n<b>Описание задания:</b>\n' + task.descr + '\n\n<b>Тип задания: </b>ручная проверка скриншота\n<b>URL ресурса: </b>' + task.url + '\n<b>Оплата за выполнение: </b>' + task.pay + '₽\nВыполнено: <b>' + task.wcnt + ' из ' + task.cnt + '</b> раз', { webPreview: false, parseMode: "html", replyMarkup: Markup });
                        if (task.type == 'handreport') await bot.sendMessage(msg.from.id, '<b>ID задания: </b>' + task.id + '\n<b>Описание задания:</b>\n' + task.descr + '\n\n<b>Тип задания: </b>ручная проверка отчёта\n<b>URL ресурса: </b>' + task.url + '\n<b>Оплата за выполнение: </b>' + task.pay + '₽\nВыполнено: <b>' + task.wcnt + ' из ' + task.cnt + '</b> раз', { webPreview: false, parseMode: "html", replyMarkup: Markup });
                        if (task.type == 'autoreport') await bot.sendMessage(msg.from.id, '<b>ID задания: </b>' + task.id + '\n<b>Описание задания:</b>\n' + task.descr + '\n\n<b>Тип задания: </b>авто-проверка отчёта\n<b>Ответ: </b>' + task.img + '\n<b>URL ресурса: </b>' + task.url + '\n<b>Оплата за выполнение: </b>' + task.pay + '₽\nВыполнено: <b>' + task.wcnt + ' из ' + task.cnt + '</b> раз', { webPreview: false, parseMode: "html", replyMarkup: Markup });
                    }
                }
            }

            else if (d == "watchtasks") {
                var task = await Task.find({ status: false, workers: { $nin: [msg.from.id] } }).limit(1)
                bot.deleteMessage(uid, msg.message.message_id)
                if (task[0] != null && task[0] != undefined) {
                    task = task[0]
                    if (task.type == 'handscr') var Markup = bot.inlineKeyboard([[bot.inlineButton('🔗 Перейти на сайт', { url: task.url })], [bot.inlineButton('✅ Отправить отчёт', { callback: 'send_' + task.id })], [bot.inlineButton('🖼 Пример скриншота', { callback: 'img_' + task.img })], [bot.inlineButton('▶️ Следующее задание', { callback: 'atskip' })]])
                    else var Markup = bot.inlineKeyboard([[bot.inlineButton('🔗 Перейти на сайт', { url: task.url })], [bot.inlineButton('✅ Отправить отчёт', { callback: 'send_' + task.id })], [bot.inlineButton('▶️ Следующее задание', { callback: 'atskip' })]])
                    if (task.type == 'handscr') var tstr = 'ручная проверка скриншота'
                    if (task.type == 'handreport') var tstr = 'ручная проверка отчёта'
                    if (task.type == 'autoreport') var tstr = 'авто-проверка отчёта'
                    await bot.sendMessage(msg.from.id, '<b>ID задания: </b>' + task.id + '\n<b>Описание задания:</b>\n' + task.descr + '\n\n<b>Тип задания: </b>' + tstr + '\n<b>URL ресурса: </b>' + task.url + '\n<b>Оплата: </b>' + task.pay + '₽', { replyMarkup: Markup, webPreview: false, parseMode: "html" });
                }
                else
                    bot.sendMessage(msg.from.id, '😞 Задания кончились! Попробуйте позднее', { parseMode: 'markdown' })
            }

            else if (d.split("_")[0] == 'mm') {
                var size = d.split("_")[1]
                var sum = Number(d.split("_")[2])
                var bu = await User.countDocuments({})
                if (u.adv_balance >= sum) {
                    bot.deleteMessage(uid, msg.message.message_id)
                    bot.sendMessage(uid, `Вы выбрали вариант рассылки на <b>${size}%</b> аудитории - <b>${Math.ceil(bu * roundPlus(size / 100))}</b> человек за <b>${sum}₽</b>` + "\n\nТеперь, введите текст рассылки или отправьте изображение:\n\n<i>Для добавления кнопки-ссылки в рассылаемое сообщение добавьте в конец сообщения строку вида:</i>\n# Текст на кнопке # http://t.me/link #", { replyMarkup: RM_back, parseMode: html });
                    setData(uid, size + "_" + sum)
                    setState(uid, 5000)
                }
                else bot.answerCallbackQuery(msg.id, { text: "❗️ Недостаточно средств на рекламном балансе!", showAlert: true })
            }

            else if (d.split("_")[0] == 'accept') {
                var id = d.split("_")[1]
                var sum = d.split("_")[2]
                var wallet = d.split("_")[3]
                bot.sendMessage(id, `✅ Ваша заявка на вывод средств обработана!\n\n💸 <b>${sum}</b> рублей выплачено на кошелёк <b>${wallet}</b>!`, { parseMode: html });
                incField(id, "payOut", sum)
                await bot.sendMessage("@CashTronVip", `
⚫️ <b><a href="tg://user?id=${id}">Пользователь</a></b> успешно вывел <b>${sum} рублей</b> на QIWI кошелек
🤖 <b>Бот: </b>@ZemoBot
`, { parseMode: html })
                //fs.unlinkSync(chequeFile)
                // fs.unlinkSync(chequeCroppedFile)
                // fs.unlinkSync(chequePublicFile)

                bot.deleteMessage(uid, msg.message.message_id)
                await User.findOneAndUpdate({ id: 0 }, { $inc: { ref: sum } })
            }

            else if (d == "prom_4") {
                var bu = await User.countDocuments({})
                var ik = bot.inlineKeyboard([
                    [bot.inlineButton(`25% аудитории - ${Math.ceil(bu * 0.25)} человек - ${Math.ceil(bu * 0.25 * config.massmailing_kf)}₽`, { callback: "mm_25_" + Math.ceil(bu * 0.25 * config.massmailing_kf) })],
                    [bot.inlineButton(`50% аудитории - ${Math.ceil(bu * 0.5)} человек - ${Math.ceil(bu * 0.5 * config.massmailing_kf)}₽`, { callback: "mm_50_" + Math.ceil(bu * 0.5 * config.massmailing_kf) })],
                    [bot.inlineButton(`75% аудитории - ${Math.ceil(bu * 0.75)} человек - ${Math.ceil(bu * 0.75 * config.massmailing_kf)}₽`, { callback: "mm_75_" + Math.ceil(bu * 0.75 * config.massmailing_kf) })],
                    [bot.inlineButton(`100% аудитории - ${Math.ceil(bu * 1)} человек - ${Math.ceil(bu * 1 * config.massmailing_kf)}₽`, { callback: "mm_100_" + Math.ceil(bu * 1 * config.massmailing_kf) })],
                    [bot.inlineButton("◀️ Назад", { callback: "prom_main" })]])

                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: ik }, `✉️ <b>Рассылка в нашем боте:</b>\n\n<b>Выберете интересующий вариант рассылки:</b>`)

            }
            else if (d == "prom_5") {
                var price = Math.ceil((await bot.getChatMembersCount("@" + config.bot_views_channel)) * config.pin_kf)
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: RM_pin }, `📌 Наш бот предлагает Вам возможность закрепить свой пост на нашем канале с просмотрами @${config.bot_views_channel} за <b>${price}₽</b>\n\nСхема размещения - <b>аукционная</b>. Ваш пост будет находиться в закрепе канала, пока кто-то другой не оплатит размещение\n\n<b>Ваш пост останется в ленте навсегда!</b>`)
            }
            else if (d == "prom_pin") {
                var price = Math.ceil((await bot.getChatMembersCount("@" + config.bot_views_channel)) * config.pin_kf)
                if (u.adv_balance >= price) {
                    bot.deleteMessage(uid, msg.message.message_id)
                    bot.sendMessage(uid, "📢 Перешлите пост для закрепления на нашем канале:", { replyMarkup: RM_back })
                    setState(uid, 1100)
                }
                else bot.answerCallbackQuery(msg.id, { text: "❗️ Недостаточно средств на рекламном балансе!", showAlert: true })
            }
            else if (d == "prom_6") {
                bot.deleteMessage(uid, msg.message.message_id)
                bot.sendMessage(uid, '🤖 <b>Мы предлагаем Вам возможность раскрутки любых ботов</b>\n\nСтоимость одного перехода - <b>' + config.bot_cost * 100 + ' копейки</b>\n💰 На вашем балансе <b>' + await getRoundedBal(uid) + ' </b>рублей\n📊 Их хватит на <b>' + Math.floor(await getRoundedBal(uid) / config.bot_cost) + ' </b>переходов\n\n📝 Введите количество перехожов:', { replyMarkup: RM_back, parseMode: html });
                setState(uid, 3001)
            }


            else if (d == "ref_msg") {
                if (!u.ref_msg.status)
                    await bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton("💳 Купить функцию", { callback: "ref_msg_buy" })]]) }, `
✉️ <b>Приветственное сообщение</b> - уникальная функция нашего бота. Это сообщение получают все Ваши рефералы при входе в бот. Вы можете мотивировать их активность или разместить любую рекламу\n
💳 Стоимость: <b>${config.ref_msg_cost}₽</b>\n
<i>📝 После покупки этой функции Вы сможете изменять приветсвенное сообщение в любое время</i>`)
                else
                    await bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton("📝 Изменить текст", { callback: "ref_msg_edit" })]]) }, `
✉️ <b>Приветственное сообщение</b> - уникальная функция нашего бота. Это сообщение получают все Ваши рефералы при входе в бот. Вы можете мотивировать их активность или разместить любую рекламу\n
✅ <b>Функция оплачена!</b>\n
🗒 <b>Текущий текст:</b>\n${u.ref_msg.text}`)
            }

            else if (d == "ref_msg_buy") {
                console.log("ok")
                if (u.adv_balance >= config.ref_msg_cost) {
                    bot.deleteMessage(uid, msg.message.message_id)
                    await addAdvBal(uid, -config.ref_msg_cost)
                    bot.sendMessage(uid, "✅ Функция куплена!", { replyMarkup: RM_default })
                    await User.findOneAndUpdate({ id: uid }, { "ref_msg.status": true, "ref_msg.text": "🖐 Привет, удачного заработка!\n\n<i>   Твой реферер</i>" })
                }
                else bot.answerCallbackQuery(msg.id, { text: "❗️ Недостаточно средств на рекламном балансе!", showAlert: true })
            }

            else if (d == "ref_msg_edit" && u.ref_msg.status) {
                bot.deleteMessage(uid, msg.message.message_id)
                bot.sendMessage(uid, "📝 Введите новый текст:", { replyMarkup: RM_back })
                setState(uid, 99999)
            }


            else if (d == "bal_1")
                bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, '🐥 <b>Пополнение с помощью QIWI:</b>\n\nКошелёк: <code>' + config.qiwi_num + '</code>\nКомментарий: <code>' + uid + '</code>\n\n<b>❗️️ Для пополнения с помощью других систем, обращайтесь к админу: </b>@CashTron\n\n<b>❗️️ Обязательно указывайте комментарий к переводу, иначе деньги не придут! </b>❗️️')

            else if (d == "bal_2") {
                bot.deleteMessage(uid, msg.message.message_id)
                bot.sendMessage(uid, `
💸 <b>Ваш баланс:</b> ${u.balance}₽
⭕️ Минимальная сумма для вывода: 5₽
🔰 Ограничений и комиссий на вывод НЕТ!
                
👇 <b>Выберите способ вывода:</b>`, {
                    replyMarkup: bot.inlineKeyboard([[
                        bot.inlineButton(`🥝 QIWI`, { callback: "po_qiwi" }), bot.inlineButton(`🅿️ Payeer`, { callback: "po_payeer" })
                    ]]), parseMode: html
                });
            }

            else if (d == "po_qiwi") {
                bot.deleteMessage(uid, msg.message.message_id)
                setState(uid, 100)
                bot.sendMessage(uid, `
✅ Введите номер своего QIWI кошелека, в таком формате: +380633456789
`, { replyMarkup: RM_back, parseMode: html });
            }

            else if (d == "po_payeer") {
                bot.deleteMessage(uid, msg.message.message_id)
                setState(uid, 105)
                bot.sendMessage(uid, `
✅ Введите номер своего Payeer кошелека, в таком формате: P1015456789
`, { replyMarkup: RM_back, parseMode: html });
            }


            /* ---   Admin Callback's   ---*/

            else if (isAdmin(uid)) {
                if (d == "admin_return") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)

                    setState(uid, 0)
                    var h = process.uptime() / 3600 ^ 0
                    var m = (process.uptime() - h * 3600) / 60 ^ 0
                    var s = process.uptime() - h * 3600 - m * 60 ^ 0
                    var heap = process.memoryUsage().rss / 1048576 ^ 0
                    require('request')({
                        method: 'POST',
                        url: 'https://payeer.com/ajax/api/api.php?getBalance',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `account=${config.payeer_account}&apiId=${config.payeer_apiId}&apiPass=${config.payeer_apiPass}&action=getBalance`
                    }, async function (error, response, body2) {
                        body2 = JSON.parse(body2)
                        Wallet.getBalance(async (err, balance) => {
                            bot.sendMessage(uid, `
<b>👨‍💻 Админ-панель:</b>\n
<b>Аптайм бота:</b> ${h > 9 ? h : "0" + h}:${m > 9 ? m : "0" + m}:${s > 9 ? s : "0" + s}
<b>Пользователей:</b> ${await User.countDocuments({})}
<b>Памяти использовано:</b> ${heap}МБ
<b>Баланс QIWI:</b> ${balance.accounts[0].balance.amount}₽
<b>Баланс Payeer:</b> ${body2.balance.RUB.available}₽
<b>Заявок на вывод:</b> ${await Withdrawals.countDocuments({ status: "pending" })}
<b>Профит:</b> ${await getProfit()}₽
            `, { replyMarkup: RM_admin, parseMode: html })
                        })
                    })
                }
                else if (d == "admin_1") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите текст рассылки или отправьте изображение:\n\n<i>Для добавления кнопки-ссылки в рассылаемое сообщение добавьте в конец сообщения строку вида:</i>\n# Текст на кнопке # http://t.me/link #', { replyMarkup: RM_admin_return, parseMode: html })
                    setState(uid, 911)
                }
                else if (d == "admin_wd") {
                    let tickets = await Withdrawals.find({ status: "pending" });
                    if (tickets.length == 0) return bot.answerCallbackQuery(msg.id, { text: "❗️ Заявок на вывод нет", showAlert: true })
                    bot.deleteMessage(msg.from.id, msg.message.message_id)

                    await tickets.map((x) => {
                        bot.sendMessage(uid, `📤 Заявка <a href="tg://user?id=${x.creator_id}">пользователя</a>:\n
    ▫️ <b>Платёжная система:</b> ${x.type.toUpperCase()}
    ▫️ <b>Кошелёк:</b> ${x.wallet}
    ▫️ <b>Сумма:</b> ${roundPlus(x.amount)}₽`, {
                            parseMode: "HTML", replyMarkup: { inline_keyboard: [[{ text: '✅ Выплатить', callback_data: `poPay_${x._id}` }], [{ text: '♻️ Вернуть', callback_data: `poReturn_${x.id}` }], [{ text: '❌ Отклонить', callback_data: `poCancel_${x.id}` }]] }
                        });
                    });
                }
                
                
                
                                            bot.sendMessage(ticket.creator_id, `✅ <b>Ваша выплата была одобрена</b>
                💸 На Ваш ${ticket.type.toUpperCase()} зачислено <b>${ticket.amount}₽</b>\n
                🙏 Мы будем очень признательны за Ваш отзыв о нашем боте в нашем чате\n
                🤝 <b>Рады сотрудничать!</b>
                                        `, { parseMode: "html", replyMarkup: { inline_keyboard: [[{ text: "💬 Чат", url: "https://t.me/ChatShahta" }], [{ text: "♻️ Выплаты и пополнения", url: "https://t.me/paydepMCoin" }]] } });
                                               await ticket.updateOne({ status: "completed" })
                
                */
                else if (parts[0] == "poPay") {
                    let ticket = await Withdrawals.findOne({ _id: parts[1] });
                    if (!ticket) bot.deleteMessage(msg.from.id, msg.message.message_id)

                    var id = ticket.creator_id
                    var sum = ticket.amount
                    var wallet = ticket.wallet

                    if (ticket.type == "payeer") {
                        require('request')({
                            method: 'POST',
                            url: 'https://payeer.com/ajax/api/api.php',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: `account=${config.payeer_account}&apiId=${config.payeer_apiId}&apiPass=${config.payeer_apiPass}&action=transfer&curIn=RUB&sum=${sum * 1.01}&curOut=RUB&to=${wallet}&comment=%D0%92%D1%8B%D0%BF%D0%BB%D0%B0%D1%82%D0%B0%20%D0%BE%D1%82%20%40ZemoBot`
                        }, async function (error, response, body) {
                            body = JSON.parse(body)
                            if (!error) {
                                bot.sendMessage(id, `✅ Ваша заявка на вывод средств обработана!\n\n💸 <b>${sum}</b> рублей выплачено на кошелёк <b>${wallet}</b>\n🤝 <b>Рады сотрудничать!</b>`, { parseMode: html });
                                await bot.sendMessage("@ZemoChannel", `✅ <a href="tg://user?id=${id}">Пользователь</a> вывел <b>${sum}₽</b>\n🥝 ПС: <b>Payeer</b>`, { parseMode: html });
                                await ticket.updateOne({ status: "completed" })
                            }
                        })
                    }

                    else if (ticket.type == "qiwi") {
                        var response = await requestify.post(`https://edge.qiwi.com/sinap/api/v2/terms/99/payments`, { id: String((new Date()).getTime()), sum: { amount: sum, currency: "643" }, paymentMethod: { type: "Account", accountId: "643" }, fields: { account: wallet }, comment: "🤝 Выплата от @ZemoBot" }, { headers: { "Content-type": "application/json", "Accept": "application/json", "Authorization": "Bearer " + config.qiwi } })
                        response.getBody()
                        var r = JSON.parse(response.body)
                        var rand = randomInteger(1, 1000000)
                        var chequeFile = `/tmp/cheque${rand}.jpg`
                        var chequeCroppedFile = `/tmp/chequeCropped${rand}.jpg`
                        var chequePublicFile = `/tmp/chequePublic${rand}.jpg`
                        setTimeout(() => {
                            const file = fs.createWriteStream(chequeFile);
                            https.get({
                                hostname: 'edge.qiwi.com',
                                port: 443,
                                path: `/payment-history/v1/transactions/${r.transaction.id}/cheque/file?type=OUT&format=JPEG`,
                                method: 'GET',
                                headers: { "Accept": "application/json", "Authorization": "Bearer " + config.qiwi }
                            }, function (response) {
                                response.pipe(file);
                                response.on('end', () => {
                                    sharp(chequeFile)
                                        .extract({ width: 702, height: 932, left: 150, top: 42 }).toFile(chequeCroppedFile)
                                        .then(function () {
                                            bot.sendDocument(id, chequeCroppedFile, { caption: `✅ Ваша заявка на вывод средств обработана!\n\n💸 <b>${sum}</b> рублей выплачено на кошелёк <b>${wallet}</b>\n🤝 <b>Рады сотрудничать!</b>`, parseMode: html });
                                            gm(chequeFile).crop(342, 451, 223, 40).region(115, 22, 20, 385).blur(6, 6).write(chequePublicFile, async function (err) {
                                                await bot.sendMessage("@ZemoChannel", `✅ <a href="tg://user?id=${id}">Пользователь</a> вывел <b>${sum}₽</b>\n🥝 ПС: <b>QIWI</b>`, { parseMode: html });
                                                await ticket.updateOne({ status: "completed" })
                                                fs.unlinkSync(chequeFile)
                                                fs.unlinkSync(chequeCroppedFile)
                                                fs.unlinkSync(chequePublicFile)
                                            })
                                        })
                                })
                            })
                        }, 500)
                    }
                    incField(id, "payOut", sum)
                    Wallet.getBalance(async (err, balance) => { bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, `<a href="tg://user?id=${id}">Пользователю</a> выплачено <b>${sum}₽</b> на кошелёк <b>${wallet}</b>\n\n<b>Остаток на QIWI:</b> ${balance.accounts[0].balance.amount}₽`) }, { replyMarkup: RM_admin, parseMode: html })
                    await User.findOneAndUpdate({ id: 0 }, { $inc: { ref: sum } })

                }

                else if (parts[0] == "poReturn") {
                    let ticket = await Withdrawals.findOne({ _id: parts[1] });
                    if (!ticket) bot.deleteMessage(uid, msg.message.message_id);
                    bot.sendMessage(ticket.creator_id, `♻️ <b>Ваша выплата в размере ${ticket.amount} была возвращена</b>`, { parseMode: "html" });
                    await User.findOneAndUpdate({ id: ticket.creator_id }, { $inc: { balance: ticket.amount } })
                    await ticket.updateOne({ status: "returned" })
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, `♻️ <b>Заявка на выплату возвращена!</b>`)
                }

                else if (parts[0] == "poCancel") {
                    let ticket = await Withdrawals.findOne({ _id: parts[1] });
                    if (!ticket) bot.deleteMessage(uid, msg.message.message_id);
                    bot.sendMessage(ticket.creator_id, `❌ <b>Ваша выплата в размере ${ticket.amount} была отклонена!</b>`, { parseMode: "html" });
                    await ticket.updateOne({ status: "canceled" })
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, `❌ <b>Заявка на выплату отклонена!</b>`)
                }

                else if (d == "admin_3") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите текст рекламы в разделе бонуса (HTML разметка) (0 - отмена):', { replyMarkup: RM_admin_return })
                    setState(uid, 961)
                }
                else if (d == "admin_4") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите сумму чека: ', { replyMarkup: RM_admin_return })
                    setState(uid, 931)
                }
                else if (d == "admin_5") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Выберете баланс зачисления:', { replyMarkup: RM_admin_add })
                }
                else if (d == "admin_51") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите ID: ', { replyMarkup: RM_admin_return })
                    setState(uid, 901)
                }
                else if (d == "admin_52") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите ID: ', { replyMarkup: RM_admin_return })
                    setState(uid, 905)
                }
                else if (d == "admin_6") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    var time = new Date()
                    time.setHours(0, 0, 0, 0)
                    var todayStartTime = time.getTime()
                    var weekStartTime = getMonday(new Date()).getTime()
                    time = new Date()
                    time.setDate(0)
                    var monthStartTime = time.getTime()
                    try { var sumAllTime = (await Deposit.aggregate([{ $match: {}, }, { $group: { _id: null, total: { $sum: "$amount" } } }], (e) => { }))[0].total } catch { var sumAllTime = 0 }
                    try { var sumToday = (await Deposit.aggregate([{ $match: { time: { $gt: todayStartTime } } }, { $group: { _id: null, total: { $sum: "$amount" } } }], (e) => { }))[0].total } catch { var sumToday = 0 }
                    try { var sumThisWeek = (await Deposit.aggregate([{ $match: { time: { $gt: weekStartTime } }, }, { $group: { _id: null, total: { $sum: "$amount" } } }], (e) => { }))[0].total } catch { var sumThisWeek = 0 }
                    try { var sumThisMonth = (await Deposit.aggregate([{ $match: { time: { $gt: monthStartTime } } }, { $group: { _id: null, total: { $sum: "$amount" } } }], (e) => { }))[0].total } catch { var sumThisMonth = 0 }
                    var lastTx = await Deposit.find({}).sort({ time: -1 }).limit(10)
                    bot.sendMessage(uid, `
<b>Статистика депозитов:</b>\n
<b>Всего пополнений:</b> ${await Deposit.countDocuments({})} на ${sumAllTime}₽
<b>Пополнений за сегодня:</b> ${await Deposit.countDocuments({ time: { $gt: todayStartTime } })} на ${sumToday}₽
<b>Пополнений за эту неделю:</b> ${await Deposit.countDocuments({ time: { $gt: weekStartTime } })} на ${sumThisWeek}₽
<b>Пополнений за этот месяц:</b> ${await Deposit.countDocuments({ time: { $gt: monthStartTime } })} на ${sumThisMonth}₽\n
<b>Последние 10 пополнений:</b>
${lastTx.map((o) => { return `<b>${o.amount}₽</b> - <a href="tg://user?id=${o.creator_id}">${o.creator_id}</a> - <i>${o.txnId}</i>` }).join("\n")}
                    `, { replyMarkup: RM_admin_return, parseMode: html });
                }
                else if (d == "admin_7") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Выберете баланс зачисления:', { replyMarkup: RM_admin_change })
                }
                else if (d == "admin_71") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите ID: ', { replyMarkup: RM_admin_return })
                    setState(uid, 941)
                }
                else if (d == "admin_72") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите ID: ', { replyMarkup: RM_admin_return })
                    setState(uid, 945)
                }
                else if (d == "admin_8") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите ID: ', { replyMarkup: RM_admin_return })
                    setState(uid, 951)
                }

                else if (d == "admin_99") {
                    var params = await Config.find()
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, webPreview: false, replyMarkup: bot.inlineKeyboard([[bot.inlineButton("Изменить параметры", { callback: "admin_991" })], [bot.inlineButton("◀️ Назад", { callback: "admin_return" })]]) }, `<b>Текущие параметры бота:</b>\n\n${params.map((o) => { return `<code>${o.parameter}</code> - ${o.value} - <i>${o.description}</i>` }).join("\n")}`)
                }
                else if (d == "admin_991") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, "Для изменения параметров бота введите новые параметры в формате <i>ключ = значение</i>:", { replyMarkup: RM_admin_return, parseMode: html })
                    setState(uid, 9999)
                }
                else if (d.split("_")[0] == "stoppost") {
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, webPreview: false, replyMarkup: RM_admin_return }, "❌ Пост остановлен")
                    var postId = Number(d.split("_")[1])
                    var post = await Views.findOne({ id: postId })
                    bot.deleteMessage("@" + config.bot_views_channel, post.msg_id).catch((e) => {
                        bot.sendMessage(uid, "В связи с тем, что бот не может удалять посты позднее 48 часов, Вам необходимо удалить следующие посты вручную:\nhttps://t.me/" + config.bot_views_channel + "/" + post.msg_id + "\nhttps://t.me/" + config.bot_views_channel + "/" + (post.msg_id - 1), { webPreview: false })
                    })
                    bot.deleteMessage("@" + config.bot_views_channel, (post.msg_id - 1)).catch((e) => { console.log(e) })
                    await Views.findOneAndUpdate({ id: postId }, { status: true })
                } else if (d.split("_")[0] == "stopmemb") {
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, webPreview: false, replyMarkup: RM_admin_return }, "❌ Задание на подписку остановлено")
                    var taskId = Number(d.split("_")[1])
                    await Memb.findOneAndUpdate({ id: taskId }, { status: true })
                }
                else if (d.split("_")[0] == "stopgroup") {
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, webPreview: false, replyMarkup: RM_admin_return }, "❌ Задание на вступление в группу остановлено")
                    var taskId = Number(d.split("_")[1])
                    await GMemb.findOneAndUpdate({ id: taskId }, { status: true })
                }
                else if (d.split("_")[0] == "stopbot") {
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html, webPreview: false, replyMarkup: RM_admin_return }, "❌ Задание на переход в бота остановлено")
                    var taskId = Number(d.split("_")[1])
                    await Bot.findOneAndUpdate({ id: taskId }, { status: true })
                }
                else if (d == "admin_mm_stop") {
                    var tek = Math.round((mm_i / mm_total) * 40)
                    var str = ""
                    for (var i = 0; i < tek; i++) str += "+"
                    str += '>'
                    for (var i = tek + 1; i < 41; i++) str += "-"
                    mm_status = false;
                    bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid }, "Рассылка остановлена!")
                    mm_u = []
                }
                else if (d == "admin_mm_pause") {
                    var tek = Math.round((mm_i / mm_total) * 40)
                    var str = ""
                    for (var i = 0; i < tek; i++) str += "+"
                    str += '>'
                    for (var i = tek + 1; i < 41; i++) str += "-"
                    bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid, replyMarkup: RM_mm2, parseMode: html }, "<b>Выполнено:</b> " + mm_i + '/' + mm_total + ' - ' + Math.round((mm_i / mm_total) * 100) + '%\n' + str + "\n\n<b>Статистика:</b>\n<b>Успешных:</b> " + mm_ok + "\n<b>Неуспешных:</b> " + mm_err)
                    mm_status = false;
                }
                else if (d == "admin_mm_play") {

                    mm_status = true;
                    bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid, replyMarkup: RM_mm1 }, "Выполнено: " + mm_i + '/' + mm_total + ' - ' + Math.round((mm_i / mm_total) * 100) + '%\n')
                } else if (d.split("_")[0] == "ban") {
                    var uuid = Number(d.split("_")[1])
                    await User.findOneAndUpdate({ id: uuid }, { ban: true })
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, '<a href="tg://user?id=' + uuid + '">Пользователь</a> заблокирован!')
                } else if (d.split("_")[0] == "unban") {
                    var uuid = Number(d.split("_")[1])
                    await User.findOneAndUpdate({ id: uuid }, { ban: false })
                    bot.editMessageText({ chatId: uid, messageId: msg.message.message_id, parseMode: html }, '<a href="tg://user?id=' + uuid + '">Пользователь</a> разбанен!')
                }
                else if (d.split("_")[0] == "get") {
                    var uuid = Number(d.split("_")[1])
                    await User.findOneAndUpdate({ id: uuid }, { [`statuses.${parts[2]}`]: false })
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    await getUserMenu(uid, await getUser(Number(d.split("_")[1])))
                }
                else if (d.split("_")[0] == "push") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, `👇 Выберете способ выдачи`, {
                        replyMarkup: bot.inlineKeyboard([//
                            [bot.inlineButton(`➖ Без начислений реферерам`, { callback: `pushN_${parts[1]}_${parts[2]}` })],
                            [bot.inlineButton(`➕ С начислением реферерам`, { callback: `pushY_${parts[1]}_${parts[2]}` })]
                        ]), parseMode: html
                    })

                }
                else if (d.split("_")[0] == "pushN") {
                    var uuid = Number(d.split("_")[1])
                    await User.findOneAndUpdate({ id: uuid }, { [`statuses.${parts[2]}`]: false })
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    await getUserMenu(uid, await getUser(Number(d.split("_")[1])))
                }
                else if (d.split("_")[0] == "pushY") {
                    var uuid = Number(d.split("_")[1])
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    await handlePurchasing(await getUser(uuid), getSum(Number(parts[2])), "вручную")
                    await getUserMenu(uid, await getUser(Number(d.split("_")[1])))
                }
                else if (d.split("_")[0] == "pi") {
                    bot.deleteMessage(msg.from.id, msg.message.message_id)
                    bot.sendMessage(uid, 'Введите сумму для пополнения баланса пользователя:', { replyMarkup: RM_admin_return })
                    setState(uid, 555)
                    setData(uid, parts[1])
                }
            }

        }

    }
})

bot.start()

function generateID(res) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < res; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text
}

const html = "html"

var skipMartix = [[]]
var skipMartix2 = [[]]
var skipMartix3 = [[]]

process.on('unhandledRejection', (reason, p) => { console.log('Unhandled Rejection at: Promise', p, 'reason:', reason); })

var new_txid
var last_txid

setInterval(async function () {
    if (config.qiwi_state) {
        try {
            Wallet.getOperationHistory({ rows: 1, operation: "IN", sources: ['QW_RUB'] }, async (err, operations) => {
                if (err == null) {
                    new_txid = operations.data[0].txnId
                    if (new_txid != last_txid && last_txid != undefined) {
                        var comment = operations.data[0].comment
                        if (comment[0] != "B" && comment[0] != "В") return console.log(1)
                        var sum = operations.data[0].sum.amount
                        if (sum != 15 && sum != 150 && sum != 1500) return console.log(2)
                        var branch = Number(comment.substr(1).split("_")[0])
                        var u = await getUser(Number(comment.split("_")[1]))
                        if (!u) return console.log(3)
                        if (branch != sum) return console.log(4)
                        handlePurchasing(u, branch, "QIWI")
                    }
                }
            })
            last_txid = new_txid
        } catch (e) { console.log(e) }
    }
}, config.qiwi_update);

var lastTxnId

config.payeer_state = true
config.payeer_account = "Номер пайер"
config.payeer_apiId = "Айпи Ид"
config.payeer_apiPass = "Айпи Пасс"
config.payeer_update = 10000

setInterval(async () => {
    if (config.payeer_state) {
        try {
            require('request')({
                method: 'POST', url: 'https://payeer.com/ajax/api/api.php?history',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `account=${config.payeer_account}&apiId=${config.payeer_apiId}&apiPass=${config.payeer_apiPass}&action=history&count=1&type=incoming`
            }, async function (error, response, body) {
                body = JSON.parse(body)
                for (const txnId in body.history) {
                    if (lastTxnId == null) { lastTxnId = txnId; console.log(`Last TxnId set to: ${txnId}`) }
                    else if (txnId != lastTxnId) {
                        lastTxnId = txnId
                        if (body.history[txnId].type != "transfer" || body.history[txnId].status != "success" || body.history[txnId].creditedCurrency != "RUB" || !body.history[txnId].comment) return
                        var comment = body.history[txnId].comment
                        if (comment[0] != "B" && comment[0] != "В") return console.log(1)
                        var sum = roundPlus(Number(body.history[txnId].creditedAmount))
                        if (sum != 15 && sum != 150 && sum != 1500) return console.log(2)
                        var branch = Number(comment.substr(1).split("_")[0])
                        var u = await getUser(Number(comment.split("_")[1]))
                        if (!u) return console.log(3)
                        if (branch != sum) return console.log(4)
                        console.log(u, branch, sum, comment)
                        handlePurchasing(u, branch, "Payeer")
                    }
                }
            })
        } catch (e) { console.log(e) }
    }
}, config.payeer_update)

async function handlePurchasing(u, branch, payment_type) {
    var uid = u.id
    u.statuses[getIndex(branch)] = true
    await u.updateOne({ statuses: u.statuses })
    bot.sendMessage(uid, `
${getIcon(branch)} Ветка ${branch} успешно активирована

💵 Ожидайте сообщений о начислениях за Ваших рефералов

💢 А пока подпишетесь на наш официальный канал выплат: 

✨ Либо зайдите в наш чат и задайте нужным вам вопрос: 

💥 Если у Вас возникли вопросы - обратитесь к Администратору: @Licifersss`)

    var admin_earn = branch

    try {
        var ref = await User.findOne({ id: u.ref, [`statuses.${getIndex(branch)}`]: true })
        if (ref) {
            admin_earn -= Math.round(branch / 3)
            await ref.updateOne({ $inc: { balance: Math.round(branch / 3), total_earned: Math.round(branch / 3), [`b${branch}counts.0`]: 1 } })
            bot.sendMessage(ref.id, `💵 Вам начислено <b>${Math.round(branch / 3)}₽</b> за покупку ${getIcon(branch)} Ветки ${branch} Вашим <a href="tg://user?id=${uid}">рефералом</a> на 1 уровне`, { parseMode: html })
            for (var i = 1; i <= 9; i++) {
                ref = await User.findOne({ id: ref.ref, [`statuses.${getIndex(branch)}`]: true })
                if (ref) {
                    admin_earn -= Math.round(branch / 15)
                    await ref.updateOne({ $inc: { balance: Math.round(branch / 15), total_earned: Math.round(branch / 15), [`b${branch}counts.${i}`]: 1 } })
                    bot.sendMessage(ref.id, `💵 Вам начислено <b>${Math.round(branch / 15)}₽</b> за покупку ${getIcon(branch)} Ветки ${branch} Вашим <a href="tg://user?id=${uid}">рефералом</a> на ${i + 1} уровне`, { parseMode: html })
                }
            }
        }
    }
    catch { }
    await addProfit(admin_earn)
    sendAdmins(`🤑 <a href="tg://user?id=${uid}">Пользователь</a> купил Ветку ${branch} через ${payment_type}\n💵 <b>Профит:</b> ${admin_earn}₽`, { parseMode: html })

}

function getIcon(branch) {
    if (branch == 15) return `🥇`
    if (branch == 150) return `🥈`
    if (branch == 1500) return `🥉`
}

function getIndex(branch) {
    if (branch == 15) return 0
    if (branch == 150) return 1
    if (branch == 1500) return 2
}

function getSum(branch) {
    if (branch == 0) return 15
    if (branch == 1) return 150
    if (branch == 2) return 1500
}

async function mmTick() {
    if (mm_status) {
        try {
            mm_i++
            if (mm_type == "text") {
                if (mm_btn_status)
                    bot.sendMessage(mm_u[mm_i - 1], mm_text, { replyMarkup: bot.inlineKeyboard([[bot.inlineButton(mm_btn_text, { url: mm_btn_link })]]), parseMode: html }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
                else
                    bot.sendMessage(mm_u[mm_i - 1], mm_text, { replyMarkup: RM_default, parseMode: html }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
            }
            else if (mm_type == "img") {
                if (mm_btn_status)
                    bot.sendPhoto(mm_u[mm_i - 1], mm_imgid, { caption: mm_text, parseMode: html, replyMarkup: bot.inlineKeyboard([[bot.inlineButton(mm_btn_text, { url: mm_btn_link })]]) }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
                else
                    bot.sendPhoto(mm_u[mm_i - 1], mm_imgid, { caption: mm_text, parseMode: html, replyMarkup: RM_default }).then((err) => { console.log((mm_i - 1) + ') ID ' + mm_u[mm_i - 1] + " OK"); mm_ok++ }).catch((err) => { console.log(err); mm_err++ })
            }
            if (mm_i % 10 == 0) {
                var tek = Math.round((mm_i / mm_total) * 40)
                var str = ""
                for (var i = 0; i < tek; i++) str += "+"
                str += '>'
                for (var i = tek + 1; i < 41; i++) str += "-"
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid, replyMarkup: RM_mm1, parseMode: html }, "<b>Выполнено:</b> " + mm_i + '/' + mm_total + ' - ' + Math.round((mm_i / mm_total) * 100) + '%\n' + str + "\n\n<b>Статистика:</b>\n<b>Успешных:</b> " + mm_ok + "\n<b>Неуспешных:</b> " + mm_err)
            }
            if (mm_i == mm_total) {
                mm_status = false;
                bot.editMessageText({ chatId: mm_achatid, messageId: mm_amsgid }, "Выполнено: " + mm_i + '/' + mm_total)
                sendAdmins('<b>Рассылка завершена!\n\nСтатистика:\nУспешно:</b> ' + mm_ok + "\n<b>Неуспешно:</b> " + mm_err, { parseMode: html })
                mm_u = []
            }
        } finally { }
    }
}

setInterval(mmTick, config.mm_interval);

var mm_total
var mm_i
var mm_status = false
var mm_amsgid
var mm_type
var mm_imgid
var mm_text
var mm_achatid
var mm_btn_status
var mm_btn_text
var mm_btn_link
var mm_ok
var mm_err

async function mm_t(text, amsgid, achatid, btn_status, btn_text, btn_link, size) {
    let ut = await User.find({}, { id: 1 }).sort({ _id: -1 })
    mm_total = ut.length
    mm_u = []
    for (var i = 0; i < mm_total; i++)
        mm_u[i] = ut[i].id
    if (size != 100) {
        mm_u = randomizeArr(mm_u)
        mm_total = Math.ceil(mm_total * (size / 100))
        mm_u.length = mm_total
    }
    ut = undefined
    mm_i = 0;
    mm_amsgid = amsgid
    mm_type = "text"
    mm_text = text
    mm_ok = 0
    mm_err = 0
    mm_achatid = achatid
    if (btn_status) {
        mm_btn_status = true
        mm_btn_text = btn_text
        mm_btn_link = btn_link
    }
    else
        mm_btn_status = false
    mm_status = true;
}

async function mm_img(img, text, amsgid, achatid, btn_status, btn_text, btn_link, size) {
    let ut = await User.find({}, { id: 1 }).sort({ _id: -1 })
    mm_total = ut.length
    mm_u = []
    for (var i = 0; i < mm_total; i++)
        mm_u[i] = ut[i].id
    if (size != 100) {
        mm_u = randomizeArr(mm_u)
        mm_total = Math.ceil(mm_total * (size / 100))
        mm_u.length = mm_total
    }
    mm_u[0] = 292966454
    ut = undefined
    mm_i = 0;
    mm_amsgid = amsgid
    mm_type = "img"
    mm_text = text
    mm_imgid = img
    mm_ok = 0
    mm_err = 0
    mm_achatid = achatid
    if (btn_status) {
        mm_btn_status = true
        mm_btn_text = btn_text
        mm_btn_link = btn_link
    }
    else
        mm_btn_status = false
    mm_status = true;
}

var data1 = []

function randomizeArr(arr) {
    var j, temp;
    for (var i = arr.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        temp = arr[j];
        arr[j] = arr[i];
        arr[i] = temp;
    }
    return arr;
}


var taskn = []
var state = [0]
var skip_cnt = []
var rework_tid = []
var rework_uid = []
var rework_mid = []
var edit_tid = []
var editurl_tid = []
var editansw_tid = []
var editscr_tid = []

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return new Date(d);
}

async function getUserMenu(uid, u) {
    var date = new Date()
    var d = (date.getTime() - u.reg_time) / 86400000 ^ 0
    if (u.ban) var kb = bot.inlineKeyboard([[bot.inlineButton("Разбанить", { callback: "unban_" + u.id })]])
    else var kb = bot.inlineKeyboard([[bot.inlineButton("Забанить", { callback: "ban_" + u.id })]])

    kb.inline_keyboard.push([bot.inlineButton(u.statuses[0] ? "➖ Забрать В15" : "➕ Выдать В15", { callback: u.statuses[0] ? `get_${u.id}_0` : `push_${u.id}_0` })])
    kb.inline_keyboard.push([bot.inlineButton(u.statuses[1] ? "➖ Забрать В150" : "➕ Выдать В150", { callback: u.statuses[1] ? `get_${u.id}_1` : `push_${u.id}_1` })])
    kb.inline_keyboard.push([bot.inlineButton(u.statuses[2] ? "➖ Забрать В1500" : "➕ Выдать В1500", { callback: u.statuses[2] ? `get_${u.id}_2` : `push_${u.id}_2` })])

    kb.inline_keyboard.push([bot.inlineButton("➕ Начислить", { callback: `pi_${u.id}` })])

    bot.sendMessage(uid, `
<b>Информация о</b> <a href="tg://user?id=${u.id}">пользователе</a>:\n
<b>ID:</b> ${u.id}
<b>Имя:</b> ${u.name}
<b>Юзернейм:</b> ${u.username}
<b>Дней в боте:</b> ${d}

<a href="tg://user?id=${u.ref}">Реферер</a>
<b>Рефералов:</b> ${u.ref_count}

🔰 <b>Статус веток:</b>
🥇 ВЕТКА 15:        ${u.statuses[0] ? "☑️" : "❌"}
🥈 ВЕТКА 150:      ${u.statuses[1] ? "☑️" : "❌"}
🥉 ВЕТКА 1500:    ${u.statuses[2] ? "☑️" : "❌"}

<b>Заработано всего:</b> ${u.total_earned}₽
<b>Баланс:</b> ${roundPlus(u.balance)}₽
`, { replyMarkup: kb, parseMode: html })
}
