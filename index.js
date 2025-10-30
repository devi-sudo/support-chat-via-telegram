
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

// Bot Configuration

const BOT_TOKEN = process.env.BOT_TOKEN ;
const OWNER_ID = process.env.OWNER_ID ;
// Initialize bot with polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
// Storage
const userList = new Set();
const quickReplySessions = new Map();

// Allowed Links - Multiple formats to catch all variations
const ALLOWED_LINKS = [
    'https://t.me/zboxxbot?start=ref_',
    'https://t.me/zboxxbot?start=view_',
    't.me/zboxxbot?start=ref_',
    't.me/zboxxbot?start=view_',
    'http://t.me/zboxxbot?start=ref_',
    'http://t.me/zboxxbot?start=view_'
];

// Express Server
app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running',
        users: userList.size,
        port: PORT
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});

// Utility Functions
function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
}

function cleanText(text) {
    if (!text) return '';
    return text.replace(/[`]/g, "'");
}

function isAllowedLink(text) {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    
    // Check for all allowed link patterns
    const allowedPatterns = [
        /https?:\/\/t\.me\/zboxxbot\?start=ref_[a-zA-Z0-9_]*/i,
        /https?:\/\/t\.me\/zboxxbot\?start=view_[a-zA-Z0-9_]*/i,
        /t\.me\/zboxxbot\?start=ref_[a-zA-Z0-9_]*/i,
        /t\.me\/zboxxbot\?start=view_[a-zA-Z0-9_]*/i
    ];
    
    return allowedPatterns.some(pattern => pattern.test(lowerText));
}

function hasUnauthorizedLinks(text) {
    if (!text) return false;
    
    const patterns = [
        // All http/https URLs
        /https?:\/\/[^\s<>"]+/gi,
        
        // All t.me links (except allowed zboxxbot)
        /t\.me\/[^\s<>"]+/gi,
        
        // All usernames (@username)
        /@[a-zA-Z0-9_]{3,}/gi,
        
        // All domains (www.anything.in, short.link, etc.)
        /(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"]*)?/gi,
        
        // Shortlinks and common URL shorteners
        /(?:bit\.ly|goo\.gl|tinyurl|t\.co|ow\.ly|is\.gd|buff\.ly|adf\.ly|shorte\.st|bc\.vc|tr\.im|prettylink|qr\.net|v\.gd|cur\.lv|tiny\.cc|cli\.gs|u\.to|j\.mp|buzurl|cutt\.us|u\.bb|yourls|xo\.at|scrnch\.me|v\.gd|viralurl|qr\.net|1url\.com|tweez\.me|v\.ht|v\.gd|tr\.im|link\.zip|url\.rs)\/[^\s<>"]+/gi,
        
        // IP addresses as links
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/gi,
        
        // Email-like patterns that might be used as links
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi,
        
        // Hidden links in text (without http)
        /\b(?:www\.|ftp\.)[^\s<>"]+\.[a-zA-Z]{2,}(?:\/[^\s<>"]*)?\b/gi
    ];
    
    let allLinks = [];
    for (const pattern of patterns) {
        const matches = text.match(pattern) || [];
        allLinks = [...allLinks, ...matches];
    }
    
    allLinks = [...new Set(allLinks)];
    
    console.log('Found links:', allLinks);
    
    for (const link of allLinks) {
        console.log(`Checking link: "${link}" - Allowed: ${isAllowedLink(link)}`);
        if (!isAllowedLink(link)) {
            console.log(`🚫 Blocked link: ${link}`);
            return true;
        } else {
            console.log(`✅ Allowed link: ${link}`);
        }
    }
    
    return false;
}

async function isAdmin(chatId, userId) {
    try {
        const chatMember = await bot.getChatMember(chatId, userId);
        return ['administrator', 'creator'].includes(chatMember.status);
    } catch (error) {
        return false;
    }
}

// Safe send function with proper escaping
async function safeSendMessage(chatId, text, options = {}) {
    try {
        if (options.disableMarkdown) {
            const plainOptions = { ...options };
            delete plainOptions.parse_mode;
            delete plainOptions.disableMarkdown;
            return await bot.sendMessage(chatId, text, plainOptions);
        }
        
        return await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            ...options
        });
    } catch (error) {
        console.error('Send message error:', error.message);
        try {
            const fallbackOptions = { ...options };
            delete fallbackOptions.parse_mode;
            delete fallbackOptions.disableMarkdown;
            return await bot.sendMessage(chatId, text, fallbackOptions);
        } catch (fallbackError) {
            console.error('Fallback send error:', fallbackError.message);
            throw fallbackError;
        }
    }
}

// Start Command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    userList.add(user.id);
    
    const welcomeText = `🤖 Welcome to Zbox Help Bot!

*Features:*
• Real Time Chat With Team
• 24x7 Support
• Bug fixed

Use the commands below:`;

    const keyboard = {
        inline_keyboard: [
               [{ text: '📊 Stats', callback_data: 'stats_btn' }],
            [{ text: '📞 Support', callback_data: 'support_btn' },
                { text: '🆘 Help', callback_data: 'help_btn' }],
        
        ]
    };

    try {
        await safeSendMessage(chatId, welcomeText, {
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Start command error:', error.message);
    }
});

// Callback Query Handler
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'help_btn') {
        const helpText = `🆘 Help & Support

• Send messages the team will reply in a seconds 

BEST REGARD,
:: ZBOX TEAM ::
`;

        await safeSendMessage(msg.chat.id, helpText);
    }
    else if (data === 'support_btn') {
        await safeSendMessage(msg.chat.id, `📞 Support\n\nsend a message this will be diliverd to Owner or Team`);
    }
    else if (data === 'stats_btn') {
        await safeSendMessage(msg.chat.id, `📊 Statistics\n\n• Bot Is Active in 99.9% Time \n• Total Active Users: 4395\n• Active Sessions: ${quickReplySessions.size}`);
    }
    else if (data.startsWith('copy_')) {
        const userId = data.split('_')[1];
        await safeSendMessage(msg.chat.id, `📋 User ID: ${userId}\n\nUse: /reply ${userId} your_message`, {
            disableMarkdown: true
        });
    }
    else if (data.startsWith('quick_')) {
        const userId = data.split('_')[1];
        const originalMessage = msg.text || '';
        const usernameMatch = originalMessage.match(/@([a-zA-Z0-9_]+)/);
        const username = usernameMatch ? usernameMatch[0] : 'User';
        
        quickReplySessions.set(callbackQuery.from.id, {
            targetUserId: userId,
            targetUsername: username
        });
        
        await safeSendMessage(msg.chat.id, `💬 Quick Reply to: ${username}\n🆔 ID: ${userId}\n\n📝 Now type your message:\nI'll send it to this user`, {
            disableMarkdown: true
        });
    }
});

// Group Message Handler - Link Moderation
bot.on('message', async (msg) => {
    // Skip if message is from bot itself
    if (msg.from.is_bot) return;
    
    // Group message handling
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        const user = msg.from;
        const messageText = msg.text || msg.caption || '';
        
        // Skip admin messages
        if (await isAdmin(msg.chat.id, user.id)) return;
        
        // Check for unauthorized links
        if (hasUnauthorizedLinks(messageText)) {
            try {
                await bot.deleteMessage(msg.chat.id, msg.message_id);
                
                const safeUsername = user.username || user.first_name || 'User';
                const warningText = `❌ @${safeUsername}, only ZBOXXBOT referral links allowed!\n\nAllowed:\n• t.me/zboxxbot?start=ref_\n• t.me/zboxxbot?start=view_\nAdd your code after the underscore\n\n⚠️ No other links not allowed else ban or mute`;
                
                const warningMsg = await safeSendMessage(msg.chat.id, warningText, {
                    disableMarkdown: true
                });
                
                // Delete warning message after 10 seconds
                setTimeout(async () => {
                    try {
                        await bot.deleteMessage(msg.chat.id, warningMsg.message_id);
                    } catch (e) {
                        // Ignore deletion errors
                    }
                }, 10000);
                
            } catch (error) {
                console.error('Warning message error:', error.message);
            }
        }
        return;
    }
    
    // Private message handling - Users to Owner
    if (msg.chat.type === 'private' && msg.from.id.toString() !== OWNER_ID) {
        const user = msg.from;
        
        userList.add(user.id);
        
        // Skip commands
        if (msg.text && msg.text.startsWith('/')) return;
        
        try {
            const safeFirstName = cleanText(user.first_name || 'User');
            const safeLastName = user.last_name ? ' ' + cleanText(user.last_name) : '';
            const safeUsername = user.username ? cleanText(user.username) : 'no_username';
            
            const userInfo = `👤 ${safeFirstName}${safeLastName} (@${safeUsername})`;
            const buttons = {
                inline_keyboard: [
                    [{ text: '📋 Copy ID', callback_data: `copy_${user.id}` }],
                    [{ text: '💬 Quick Reply', callback_data: `quick_${user.id}` }]
                ]
            };
            
            // Handle different message types - ALL WITHOUT MARKDOWN
            if (msg.photo) {
                const caption = msg.caption ? `\n\n${cleanText(msg.caption)}` : '';
                await bot.sendPhoto(OWNER_ID, msg.photo[msg.photo.length - 1].file_id, {
                    caption: `${userInfo}\n🆔 ID: ${user.id}${caption}`,
                    reply_markup: buttons
                });
            } 
            else if (msg.video) {
                const caption = msg.caption ? `\n\n${cleanText(msg.caption)}` : '';
                await bot.sendVideo(OWNER_ID, msg.video.file_id, {
                    caption: `${userInfo}\n🆔 ID: ${user.id}${caption}`,
                    reply_markup: buttons
                });
            }
            else if (msg.document) {
                const caption = msg.caption ? `\n\n${cleanText(msg.caption)}` : '';
                await bot.sendDocument(OWNER_ID, msg.document.file_id, {
                    caption: `${userInfo}\n🆔 ID: ${user.id}${caption}`,
                    reply_markup: buttons
                });
            }
            else if (msg.text) {
                await bot.sendMessage(OWNER_ID, `${userInfo}\n🆔 ID: ${user.id}\n\n💬 ${cleanText(msg.text)}`, {
                    reply_markup: buttons
                });
            }
            else {
                await bot.forwardMessage(OWNER_ID, msg.chat.id, msg.message_id);
                await bot.sendMessage(OWNER_ID, `${userInfo}\n🆔 ID: ${user.id}\n\n📨 Forwarded message`, {
                    reply_markup: buttons
                });
            }
            
            await bot.sendMessage(msg.chat.id, '⌛Team Typing ....', {
                reply_to_message_id: msg.message_id
            });
            
        } catch (error) {
            console.error('Forward error:', error.message);
            await bot.sendMessage(msg.chat.id, '✅ Message received! Our Team will reply soon.');
        }
        return;
    }
    
    // Owner message handling - Quick Reply System
    if (msg.chat.type === 'private' && msg.from.id.toString() === OWNER_ID) {
        // Handle quick reply sessions
        if (quickReplySessions.has(msg.from.id) && !msg.text?.startsWith('/')) {
            const session = quickReplySessions.get(msg.from.id);
            const targetUserId = session.targetUserId;
            const targetUsername = session.targetUsername;
            const ownerMessage = msg.text || msg.caption || '';
            
            if (!ownerMessage.trim()) {
                await bot.sendMessage(msg.chat.id, '❌ Please type a valid message.');
                return;
            }
            
            try {
                if (msg.photo) {
                    const photo = msg.photo[msg.photo.length - 1];
                    await bot.sendPhoto(targetUserId, photo.file_id, {
                        caption: msg.caption || ''
                    });
                }
                else if (msg.video) {
                    await bot.sendVideo(targetUserId, msg.video.file_id, {
                        caption: msg.caption || ''
                    });
                }
                else if (msg.document) {
                    await bot.sendDocument(targetUserId, msg.document.file_id, {
                        caption: msg.caption || ''
                    });
                }
                else {
                    await bot.sendMessage(targetUserId, ownerMessage);
                }
                
                await bot.sendMessage(msg.chat.id, `✅ ${targetUsername}\n\n (${targetUserId})\n.....`);
                
                quickReplySessions.delete(msg.from.id);
                
            } catch (error) {
                await bot.sendMessage(msg.chat.id, `❌ Failed to send. User may have blocked bot.`);
            }
            return;
        }
        
        // Handle replies to forwarded messages
        if (msg.reply_to_message) {
            const repliedMessage = msg.reply_to_message;
            const replyText = msg.text || msg.caption;
            
            if (!replyText) return;
            
            const messageText = repliedMessage.text || repliedMessage.caption || '';
            const idMatch = messageText.match(/ID: (\d+)/);
            
            if (idMatch) {
                const targetUserId = idMatch[1];
                
                try {
                    if (msg.photo) {
                        const photo = msg.photo[msg.photo.length - 1];
                        await bot.sendPhoto(targetUserId, photo.file_id, {
                            caption: msg.caption || ''
                        });
                    }
                    else if (msg.video) {
                        await bot.sendVideo(targetUserId, msg.video.file_id, {
                            caption: msg.caption || ''
                        });
                    }
                    else if (msg.document) {
                        await bot.sendDocument(targetUserId, msg.document.file_id, {
                            caption: msg.caption || ''
                        });
                    }
                    else {
                        await bot.sendMessage(targetUserId, replyText);
                    }
                    
                    await bot.sendMessage(msg.chat.id, '✅ Reply sent!');
                    
                } catch (error) {
                    await bot.sendMessage(msg.chat.id, '❌ Failed to send reply.');
                }
            }
        }
    }
});

// Owner Commands
bot.onText(/\/reply (.+)/, async (msg, match) => {
    if (msg.from.id.toString() !== OWNER_ID) {
        return bot.sendMessage(msg.chat.id, '❌ Owner only command.');
    }
    
    const args = match[1].split(' ');
    if (args.length < 2) {
        return bot.sendMessage(msg.chat.id, '❌ Usage: /reply USER_ID message');
    }
    
    const userId = args[0];
    const message = args.slice(1).join(' ');
    
    try {
        await bot.sendMessage(userId, message);
        await bot.sendMessage(msg.chat.id, `✅ Sent to user ${userId}`);
    } catch (error) {
        await bot.sendMessage(msg.chat.id, `❌ Failed to send to user ${userId}`);
    }
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    if (msg.from.id.toString() !== OWNER_ID) {
        return bot.sendMessage(msg.chat.id, '❌ Owner only command.');
    }
    
    const message = match[1];
    if (!message) {
        return bot.sendMessage(msg.chat.id, '❌ Usage: /broadcast message');
    }
    
    const broadcastMessage = `📢 *${message}*`;
    let success = 0;
    let failed = 0;
    
    const progressMsg = await bot.sendMessage(msg.chat.id, `🔄 Broadcasting to ${userList.size} users...`);
    
    const userArray = Array.from(userList);
    
    for (let i = 0; i < userArray.length; i++) {
        const userId = userArray[i];
        try {
            await bot.sendMessage(userId, broadcastMessage);
            success++;
            
            if (i % 5 === 0 || i === userArray.length - 1) {
                try {
                    await bot.editMessageText(`🔄 Broadcasting... ${i + 1}/${userArray.length} users`, {
                        chat_id: msg.chat.id,
                        message_id: progressMsg.message_id
                    });
                } catch (editError) {
                    // Ignore edit errors
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            failed++;
        }
    }
    
    await bot.editMessageText(`📊 Broadcast Complete\n\n✅ Success: ${success}\n❌ Failed: ${failed}\n📱 Total: ${userArray.length}`, {
        chat_id: msg.chat.id,
        message_id: progressMsg.message_id
    });
});

bot.onText(/\/users/, async (msg) => {
    if (msg.from.id.toString() !== OWNER_ID) return;
    await bot.sendMessage(msg.chat.id, `📊 Total Users: ${userList.size}`);
});

bot.onText(/\/cancel/, async (msg) => {
    if (msg.from.id.toString() === OWNER_ID && quickReplySessions.has(msg.from.id)) {
        quickReplySessions.delete(msg.from.id);
        await bot.sendMessage(msg.chat.id, '❌ Quick reply cancelled.');
    }
});

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error.message);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

console.log('🤖 Bot started successfully');

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stopPolling();
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    bot.stopPolling();
    process.exit(0);
});
