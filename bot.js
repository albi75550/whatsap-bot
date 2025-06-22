const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const persist = require('node-persist');

(async () => { await persist.init({ dir: './storage' }); })();

const MAX_QUERIES = 5;
const STATE = {};
const client = new Client({ authStrategy: new LocalAuth() });

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ WhatsApp Bot is ready!'));

client.on('message', async (msg) => {
    const userId = msg.from;
    const text = msg.body.trim().toLowerCase();

    let user = await persist.getItem(userId);
    const now = new Date();

    if (!user || new Date(user.resetAt) < now) {
        user = { count: 0, resetAt: new Date(now.getTime() + 86400000), paid: false };
        await persist.setItem(userId, user);
    }

    // --- Handle Commands ---
    if (text === "/start") {
        STATE[userId] = { step: "ASK_BRN" };
        return msg.reply("🔍 Please enter the 17-digit BRN:");
    }

    if (text === "/help") {
        return msg.reply(`📘 *User Manual*\n\n/start - Start a new BRN query\n/myac - View your account usage\n/help - Show this manual`);
    }

    if (text === "/myac") {
        const remaining = user.paid ? 'Unlimited' : MAX_QUERIES - user.count;
        const resetTime = new Date(user.resetAt).toLocaleString();
        return msg.reply(
            `📊 *Your Account Info:*\n` +
            `Used Today: ${user.count}/${MAX_QUERIES}\n` +
            `Remaining: ${remaining}\n` +
            `Reset Time: ${resetTime}\n` +
            `Paid: ${user.paid ? "✅" : "❌"}`
        );
    }

    // --- Continue if in conversation state ---
    if (!STATE[userId]) return;

    const state = STATE[userId];

    if (state.step === "ASK_BRN") {
        if (!/^\d{17}$/.test(msg.body)) return msg.reply("❌ Must be 17 digits.");
        state.brn = msg.body;
        state.step = "ASK_DOB";
        return msg.reply("📅 Enter DOB (YYYY-MM-DD):");
    }

    if (state.step === "ASK_DOB") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(msg.body)) return msg.reply("❌ Format should be YYYY-MM-DD");

        if (user.count >= MAX_QUERIES && !user.paid) {
            return msg.reply("⚠️ You've used your 5 free queries. Upgrade to continue: https://example.com/upgrade");
        }

        const url = `https://alnayeem.top/Birth-Information.php?brn=${state.brn}&dob=${msg.body}`;
        try {
            const res = await axios.get(url);
            const d = res.data;
            if (!d.person || !d.person.nameEn) return msg.reply("❌ No result found.");

            const reply = `✅ *Name*: ${d.person.nameEn}\n👨 *Father*: ${d.father.nameEn}\n👩 *Mother*: ${d.mother.nameEn}\n📅 *DOB*: ${d.dob}\n🆔 *BRN*: ${d.brn}`;
            msg.reply(reply);

            if (!user.paid) {
                user.count += 1;
                await persist.setItem(userId, user);
            }
        } catch (e) {
            msg.reply("❌ API error.");
        }

        delete STATE[userId];
    }
});

client.initialize();
