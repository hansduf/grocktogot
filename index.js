const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const moment = require('moment-timezone');
const colors = require('colors');
const fs = require('fs');
const Jimp = require('jimp');
const { createCanvas } = require('canvas');
const express = require('express');
const qrcodelib = require('qrcode');

const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        args: [ 
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-translate',
            '--disable-background-networking',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-blink-features=AutomationControlled'
        ],
        timeout: 60000,
        protocolTimeout: 60000
    },
    webVersionCache: { 
        type: 'remote', 
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2403.2.html'
    },
    ffmpeg: './ffmpeg.exe',
    authStrategy: new LocalAuth({ clientId: "client" }),
    bypassCSRF: true
});
const config = require('./config/config.json');

// Web Server Setup
const app = express();
const PORT = process.env.PORT || 3000;

// State variables
let currentQR = null;
let isConnected = false;

// Middleware
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Function to generate text image using Canvas with dynamic font sizing
async function generateTextImage(text) {
    try {
        const width = 512;
        const height = 512;
        const paddingX = 40;
        const paddingY = 60;
        const maxWidth = width - (paddingX * 2);
        const maxHeight = height - (paddingY * 2);
        
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Fill white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Calculate optimal font size based on text length
        const textLength = text.length;
        
        // Dynamic font size calculation - aggressive sizing untuk fill space
        let startFontSize;
        if (textLength <= 15) {
            startFontSize = 110;
        } else if (textLength <= 30) {
            startFontSize = 100;
        } else if (textLength <= 50) {
            startFontSize = 90;
        } else if (textLength <= 80) {
            startFontSize = 80;
        } else if (textLength <= 120) {
            startFontSize = 70;
        } else if (textLength <= 180) {
            startFontSize = 58;
        } else {
            startFontSize = 44;
        }
        
        // Find best fitting font size
        let optimalFontSize = startFontSize;
        let optimalLines = [];
        
        for (let fontSize = startFontSize; fontSize >= 16; fontSize -= 1) {
            ctx.font = `600 ${fontSize}px Arial, sans-serif`;
            
            // Smart word wrap - optimize for justified alignment
            const words = text.split(' ');
            const testLines = [];
            let currentLine = '';
            
            for (let word of words) {
                const testLine = currentLine ? currentLine + ' ' + word : word;
                // For justify calculation, add some buffer for spacing
                const metrics = ctx.measureText(testLine);
                // Use 95% of maxWidth to ensure justified text doesn't overflow
                if (metrics.width > (maxWidth * 0.95) && currentLine) {
                    testLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) testLines.push(currentLine);
            
            // Calculate total height needed
            const lineHeight = fontSize * 1.45;
            const totalHeight = testLines.length * lineHeight;
            
            // Check if fits in frame
            if (totalHeight <= maxHeight) {
                optimalFontSize = fontSize;
                optimalLines = testLines;
                break;
            }
        }
        
        // Draw with optimal font size
        ctx.font = `600 ${optimalFontSize}px Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        
        const lineHeight = optimalFontSize * 1.45;
        
        // Calculate vertical centering
        const textTotalHeight = optimalLines.length * lineHeight;
        const verticalSpace = maxHeight - textTotalHeight;
        let startY = paddingY + (verticalSpace / 2) + optimalFontSize;
        
        // Draw each line with smart justification
        let y = startY;
        for (let i = 0; i < optimalLines.length; i++) {
            const line = optimalLines[i];
            const isLastLine = (i === optimalLines.length - 1);
            
            if (isLastLine) {
                // Last line - align left
                ctx.textAlign = 'left';
                ctx.fillText(line, paddingX, y);
            } else {
                // Full justify - rata kanan kiri penuh
                const words = line.split(' ');
                if (words.length > 1) {
                    // Calculate total width of all words (without spaces)
                    let totalWordsWidth = 0;
                    for (let word of words) {
                        totalWordsWidth += ctx.measureText(word).width;
                    }
                    
                    // Total space to distribute = maxWidth - total words width
                    const totalSpace = maxWidth - totalWordsWidth;
                    const spacePerGap = totalSpace / (words.length - 1);
                    
                    // Full justify spacing - distribute from left
                    let x = paddingX;
                    for (let j = 0; j < words.length; j++) {
                        ctx.fillText(words[j], x, y);
                        const wordWidth = ctx.measureText(words[j]).width;
                        
                        if (j < words.length - 1) {
                            // Add word width + calculated space for gap
                            x += wordWidth + spacePerGap;
                        }
                    }
                } else {
                    // Single word line - center it
                    const singleWordWidth = ctx.measureText(words[0]).width;
                    const centerX = paddingX + (maxWidth - singleWordWidth) / 2;
                    ctx.fillText(line, centerX, y);
                }
            }
            y += lineHeight;
        }
        
        console.log(`[generateTextImage] Text length: ${textLength}, Font size: ${optimalFontSize}px, Lines: ${optimalLines.length}`.cyan);
        
        // Add subtle border
        ctx.strokeStyle = '#DDDDDD';
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, width - 16, height - 16);
        
        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error('[generateTextImage] Error:'.red, error.message);
        console.error(error.stack);
        throw error;
    }
}

// Function to add text to image
async function addTextToImage(imageBuffer, text) {
    try {
        // Try to load image, if WebP fails, convert using ffmpeg
        let image;
        try {
            image = await Jimp.read(imageBuffer);
        } catch (err) {
            if (err.message.includes('Unsupported MIME type') || err.message.includes('webp')) {
                console.log('[addTextToImage] WebP detected, converting to PNG...'.cyan);
                // Convert WebP to PNG using ffmpeg
                const fs = require('fs');
                const { execSync } = require('child_process');
                const inputPath = `./temp_webp_${Date.now()}.webp`;
                const outputPath = `./temp_png_${Date.now()}.png`;
                
                fs.writeFileSync(inputPath, imageBuffer);
                try {
                    execSync(`ffmpeg -i "${inputPath}" -y "${outputPath}"`, { stdio: 'pipe' });
                    const pngBuffer = fs.readFileSync(outputPath);
                    image = await Jimp.read(pngBuffer);
                    // Cleanup
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                } catch (ffmpegErr) {
                    console.error('[addTextToImage] FFmpeg conversion failed:'.red, ffmpegErr.message);
                    throw new Error('Could not convert WebP sticker format');
                }
            } else {
                throw err;
            }
        }
        
        // Resize ke ukuran sticker jika perlu
        const maxSize = 512;
        if (image.bitmap.width > maxSize || image.bitmap.height > maxSize) {
            image.scaleToFit(maxSize, maxSize);
        }

        // Ensure square canvas (untuk sticker)
        const size = Math.max(image.bitmap.width, image.bitmap.height);
        let squaredImage = await Jimp.create(size, size, 0xFFFFFFFF);
        const x = (size - image.bitmap.width) / 2;
        const y = (size - image.bitmap.height) / 2;
        squaredImage.composite(image, x, y);

        // Use Canvas to add text instead of Jimp (more reliable)
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Draw base sticker image using a different approach
        // Convert Jimp image to data URL first
        const imageBase64 = await squaredImage.getBase64(Jimp.MIME_PNG);
        const img = new (require('canvas')).Image();
        img.src = imageBase64;
        ctx.drawImage(img, 0, 0, size, size);

        // Add semi-transparent background for text
        const textY = size - 80;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, textY, size, 80);

        // Add text with auto-sizing
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        
        // Simple word wrap and render
        const textPadding = 10;
        const maxTextWidth = size - (textPadding * 2);
        const words = text.split(' ');
        let currentLine = '';
        let lineY = textY + 25;
        
        for (let word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxTextWidth && currentLine) {
                ctx.fillText(currentLine, textPadding, lineY);
                currentLine = word;
                lineY += 30;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            ctx.fillText(currentLine, textPadding, lineY);
        }

        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error('[addTextToImage] Error:'.red, error.message);
        console.error(error.stack);
        throw error;
    }
}

client.on('qr', (qr) => {
    currentQR = qr;
    isConnected = false;
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Scan the QR below : `);
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isConnected = true;
    currentQR = null;
    console.clear();
    const consoleText = './config/console.txt';
    fs.readFile(consoleText, 'utf-8', (err, data) => {
        if (err) {
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Console Text not found!`.yellow);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Already!`.green);
        } else {
            console.log(data.green);
            console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${config.name} is Already!`.green);
        }
    });
});

// Bot authenticated
client.on('authenticated', () => {
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ✅ Bot Authenticated!`.green);
});

// Bot connection state change
client.on('change_state', (state) => {
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Connection State: ${state}`.cyan);
});

// Bot disconnected
client.on('disconnected', (reason) => {
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ❌ Bot Disconnected: ${reason}`.red);
});

// Handle puppeteer/protocol errors - suppress non-critical errors
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message) {
        // Suppress harmless puppeteer protocol errors
        if (reason.message.includes('Execution context was destroyed') || 
            reason.message.includes('Protocol error') ||
            reason.message.includes('Target closed')) {
            // Just log as warning, don't crash
            if (config.log) {
                console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ⚠️ Puppeteer protocol error (suppressed)`.dim);
            }
            return;
        }
        // Log other unhandled rejections
        console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ❌ Unhandled Rejection: ${reason.message}`.red);
    }
});

client.on('message', async (message) => {
    const isGroups = message.from.endsWith('@g.us') ? true : false;
    const senderName = message.from.replace("@c.us", "").replace("@g.us", "");
    const chatType = isGroups ? '👥 GROUP' : '👤 PRIVATE';
    
    // Log incoming message
    if (config.log) {
        console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: ${message.body.substring(0, 50)}${message.body.length > 50 ? '...' : ''}`.cyan);
    }
    
    // Check if message starts with prefix
    const hasPrefix = message.body.startsWith(config.prefix);
    
    // For groups: require mention
    if (isGroups && config.groups) {
        const isMentioned = message.mentions.length > 0;
        if (!isMentioned && !hasPrefix) {
            return; // Ignore jika di grup dan tidak ada mention/prefix
        }
    }

    if ((isGroups && config.groups) || !isGroups) {
        
        // Help Command - Show all commands (with atau without prefix)
        if (message.body == `${config.prefix}halo` || message.body.toLowerCase() == 'halo') {
            if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed halo command`.yellow);
            
            const helpText = `
SALAMM BAHAGIAA💥🔥💥🔥💥

📌 *CARA PAKAI:*

1️⃣ *Convert Foto/Video ke Sticker*
   • Kirim foto/video + caption: ${config.prefix}convert
   • Atau reply foto/video + ketik: ${config.prefix}convert

2️⃣ *Buat Sticker dari Teks*
   • Ketik: ${config.prefix}textsticker <text>
   • Fitur: Auto-size font, justified text, centered
   • Contoh: ${config.prefix}textsticker Halo Dunia

3️⃣ *Tambah Teks ke Gambar*
   • Reply gambar + ketik: ${config.prefix}addtext <text>
   • Contoh: ${config.prefix}addtext Info Penting

4️⃣ *Tambah Teks ke Sticker*
   • Reply sticker + ketik: ${config.prefix}sticktext <text>
   • Contoh: ${config.prefix}sticktext Mantap!

5️⃣ *Convert Sticker ke Gambar*
   • Reply sticker + ketik: ${config.prefix}image

6️⃣ *Ubah Nama & Author Sticker*
   • Reply sticker + ketik: ${config.prefix}change <nama> | <author>
   • Contoh: ${config.prefix}change MySticker | MyName

💡 *Tips:*
• Gunakan prefix: ${config.prefix}
• Perintah harus jelas dan tepat

`;
            
            client.sendMessage(message.from, helpText);
            return;
        }

        // Universal Convert Command (Auto-detect)
        if (message.body == `${config.prefix}convert`) {
            // Check if it's direct send atau reply
            let mediaToConvert = null;
            let mediaType = null;

            // Case 1: Direct send media dengan command di caption
            if (message.type === 'image' || message.type === 'video' || message.type === 'gif') {
                mediaToConvert = message;
                mediaType = message.type;
            } 
            // Case 2: Reply ke media
            else if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.hasMedia) {
                    mediaToConvert = quotedMsg;
                    mediaType = quotedMsg.type;
                }
            }

            if (mediaToConvert && mediaType) {
                const isToSticker = mediaType !== 'sticker'; // Jika bukan sticker, convert ke sticker
                const action = isToSticker ? 'sticker' : 'image';
                
                if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}convert (${mediaType} → ${action})`.yellow);
                client.sendMessage(message.from, config.messages.loading);
                
                try {
                    const media = await mediaToConvert.downloadMedia();
                    
                    if (isToSticker) {
                        // Convert to sticker
                        client.sendMessage(message.from, media, {
                            sendMediaAsSticker: true,
                            stickerName: config.name,
                            stickerAuthor: config.author
                        }).then(() => {
                            client.sendMessage(message.from, config.messages.success);
                        });
                    } else {
                        // Convert to image
                        client.sendMessage(message.from, media).then(() => {
                            client.sendMessage(message.from, config.messages.success);
                        });
                    }
                } catch {
                    client.sendMessage(message.from, "*[❎]* Failed!");
                }
            } else {
                client.sendMessage(message.from, `*[❎]* Send/Reply media first!\n*Usage:*\n- Send media with caption: *${config.prefix}convert*\n- Reply media: *${config.prefix}convert*`);
            }
            return;
        }

        // Image to Sticker (Auto && Caption) - DISABLED
        // if ((message.type == "image" || message.type == "video" || message.type  == "gif") || (message._data.caption == `${config.prefix}sticker`)) {
        //     if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}sticker (${message.type})`.yellow);
        //     client.sendMessage(message.from, config.messages.loading);
        //     try {
        //         const media = await message.downloadMedia();
        //         client.sendMessage(message.from, media, {
        //             sendMediaAsSticker: true,
        //             stickerName: config.name, // Sticker Name = Edit in 'config/config.json'
        //             stickerAuthor: config.author // Sticker Author = Edit in 'config/config.json'
        //         }).then(() => {
        //             client.sendMessage(message.from, config.messages.success);
        //         });
        //     } catch {
        //         client.sendMessage(message.from, config.messages.error);
        //     }
        // }

        // Image to Sticker (With Reply Image)
        if (message.body == `${config.prefix}sticker`) {
            if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}sticker (reply)`.yellow);
            const quotedMsg = await message.getQuotedMessage(); 
            if (message.hasQuotedMsg && quotedMsg.hasMedia) {
                client.sendMessage(message.from, config.messages.loading);
                try {
                    const media = await quotedMsg.downloadMedia();
                    client.sendMessage(message.from, media, {
                        sendMediaAsSticker: true,
                        stickerName: config.name, // Sticker Name = Edit in 'config/config.json'
                        stickerAuthor: config.author // Sticker Author = Edit in 'config/config.json'
                    }).then(() => {
                        client.sendMessage(message.from, config.messages.success);
                    });
                } catch {
                    client.sendMessage(message.from, config.messages.error);
                }
            } else {
                client.sendMessage(message.from, "*[❎]* Reply Image First!");
            }

        // Sticker to Image (Auto) - DISABLED
        // } else if (message.type == "sticker") {
        //     if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Auto convert sticker → image`.yellow);
        //     client.sendMessage(message.from, config.messages.loading);
        //     try {
        //         const media = await message.downloadMedia();
        //         client.sendMessage(message.from, media).then(() => {
        //             client.sendMessage(message.from, config.messages.success);
        //         });  
        //     } catch {
        //         client.sendMessage(message.from, config.messages.error);
        //     }

        // Sticker to Image (With Reply Sticker)
        } else if (message.body == `${config.prefix}image`) {
            if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}image (reply)`.yellow);
            const quotedMsg = await message.getQuotedMessage(); 
            if (message.hasQuotedMsg && quotedMsg.hasMedia) {
                client.sendMessage(message.from, config.messages.loading);
                try {
                    const media = await quotedMsg.downloadMedia();
                    client.sendMessage(message.from, media).then(() => {
                        client.sendMessage(message.from, config.messages.success);
                    });
                } catch {
                    client.sendMessage(message.from, config.messages.error);
                }
            } else {
                client.sendMessage(message.from, "*[❎]* Reply Sticker First!");
            }

        // Claim or change sticker name and sticker author
        } else if (message.body.startsWith(`${config.prefix}change`)) {
            if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}change (reply)`.yellow);
            if (message.body.includes('|')) {
                let name = message.body.split('|')[0].replace(message.body.split(' ')[0], '').trim();
                let author = message.body.split('|')[1].trim();
                const quotedMsg = await message.getQuotedMessage(); 
                if (message.hasQuotedMsg && quotedMsg.hasMedia) {
                    client.sendMessage(message.from, config.messages.loading);
                    try {
                        const media = await quotedMsg.downloadMedia();
                        client.sendMessage(message.from, media, {
                            sendMediaAsSticker: true,
                            stickerName: name,
                            stickerAuthor: author
                        }).then(() => {
                            client.sendMessage(message.from, config.messages.success);
                        });
                    } catch {
                        client.sendMessage(message.from, config.messages.error);
                    }
                } else {
                    client.sendMessage(message.from, "*[❎]* Reply Sticker First!");
                }
            } else {
                client.sendMessage(message.from, `*[❎]* Run the command :\n*${config.prefix}change <name> | <author>*`);
            }

        // Add text to image
        } else if (message.body.startsWith(`${config.prefix}addtext `)) {
            const textContent = message.body.replace(`${config.prefix}addtext `, '').trim();
            if (textContent.length === 0) {
                client.sendMessage(message.from, `*[❎]* Usage: *${config.prefix}addtext <your text>* (Reply to Image)`);
                return;
            }
            const quotedMsg = await message.getQuotedMessage();
            if (message.hasQuotedMsg && quotedMsg.hasMedia && (quotedMsg.type === 'image' || quotedMsg.type === 'video')) {
                if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}addtext (reply)`.yellow);
                client.sendMessage(message.from, config.messages.loading);
                try {
                    const media = await quotedMsg.downloadMedia();
                    const imageBuffer = Buffer.from(media.data, 'base64');
                    const editedImageBuffer = await addTextToImage(imageBuffer, textContent);
                    
                    client.sendMessage(message.from, editedImageBuffer, {
                        sendMediaAsSticker: true,
                        stickerName: config.name,
                        stickerAuthor: config.author
                    }).then(() => {
                        client.sendMessage(message.from, config.messages.success);
                    });
                } catch (error) {
                    console.error(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Error in addtext:`.red, error.message);
                    console.error(error.stack);
                    client.sendMessage(message.from, config.messages.error);
                }
            } else {
                client.sendMessage(message.from, `*[❎]* Reply Image First!`);
            }

        // Add text to sticker
        } else if (message.body.startsWith(`${config.prefix}sticktext `)) {
            const textContent = message.body.replace(`${config.prefix}sticktext `, '').trim();
            if (textContent.length === 0) {
                client.sendMessage(message.from, `*[❎]* Usage: *${config.prefix}sticktext <your text>* (Reply to Sticker)`);
                return;
            }
            const quotedMsg = await message.getQuotedMessage();
            if (message.hasQuotedMsg && quotedMsg.hasMedia && quotedMsg.type === 'sticker') {
                if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}sticktext (reply)`.yellow);
                client.sendMessage(message.from, config.messages.loading);
                try {
                    const media = await quotedMsg.downloadMedia();
                    const imageBuffer = Buffer.from(media.data, 'base64');
                    const editedImageBuffer = await addTextToImage(imageBuffer, textContent);
                    
                    client.sendMessage(message.from, editedImageBuffer, {
                        sendMediaAsSticker: true,
                        stickerName: config.name,
                        stickerAuthor: config.author
                    }).then(() => {
                        client.sendMessage(message.from, config.messages.success);
                    });
                } catch (error) {
                    console.error(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Error in sticktext:`.red, error.message);
                    console.error(error.stack);
                    client.sendMessage(message.from, config.messages.error);
                }
            } else {
                client.sendMessage(message.from, `*[❎]* Reply Sticker First!`);
            }
        
        // Text to Sticker
        } else if (message.body.startsWith(`${config.prefix}textsticker `)) {
            const textContent = message.body.replace(`${config.prefix}textsticker `, '').trim();
            if (textContent.length === 0) {
                client.sendMessage(message.from, `*[❎]* Usage: *${config.prefix}textsticker <your text>*`);
                return;
            }
            if (config.log) console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] ${chatType} | ${senderName}: Executed ${config.prefix}textsticker`.yellow);
            client.sendMessage(message.from, config.messages.loading);
            try {
                const imageBuffer = await generateTextImage(textContent);
                // Save to temporary file for whatsapp-web.js compatibility
                const tempPath = `./temp_text_${Date.now()}.png`;
                fs.writeFileSync(tempPath, imageBuffer);
                
                const media = await MessageMedia.fromFilePath(tempPath);
                client.sendMessage(message.from, media, {
                    sendMediaAsSticker: true,
                    stickerName: config.name,
                    stickerAuthor: config.author
                }).then(() => {
                    client.sendMessage(message.from, config.messages.success);
                    // Clean up temp file
                    fs.unlinkSync(tempPath);
                });
            } catch (error) {
                console.error('Error:', error.message);
                client.sendMessage(message.from, config.messages.error);
            }
        }
        
        // Catch invalid/unknown commands
        if (hasPrefix && 
            !message.body.startsWith(`${config.prefix}halo`) && 
            !message.body.startsWith(`${config.prefix}convert`) &&
            !message.body.startsWith(`${config.prefix}sticker`) &&
            !message.body.startsWith(`${config.prefix}image`) &&
            !message.body.startsWith(`${config.prefix}change`) &&
            !message.body.startsWith(`${config.prefix}addtext`) &&
            !message.body.startsWith(`${config.prefix}sticktext`) &&
            !message.body.startsWith(`${config.prefix}textsticker`)) {
            // Check if it's a command-like message
            const commandMatch = message.body.match(new RegExp(`^${config.prefix}([a-zA-Z]+)`));
            if (commandMatch) {
                const unknownCmd = commandMatch[1];
                client.sendMessage(message.from, 
                    `*[❎]* Command '${config.prefix}${unknownCmd}' tidak dikenal!\n\n` +
                    `Ketik *halo* untuk melihat daftar command yang tersedia.`
                );
            }
        }
    }
});

// Express Routes
app.get('/', async (req, res) => {
    if (isConnected) {
        // Bot sudah terhubung - tampilkan halaman utama
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${config.name} - Connected</title>
                <style>
                    body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
                    .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
                    h1 { color: #25d366; margin: 0; font-size: 2.5em; }
                    .status { font-size: 1.2em; color: #555; margin: 20px 0; }
                    .dot { display: inline-block; width: 10px; height: 10px; background: #25d366; border-radius: 50%; animation: pulse 1s infinite; }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ ${config.name}</h1>
                    <p class="status"><span class="dot"></span> Bot Terhubung</p>
                    <p style="color: #999; font-size: 0.9em;">WhatsApp Web telah terkoneksi<br>Bot siap menerima pesan</p>
                </div>
            </body>
            </html>
        `);
    } else if (currentQR) {
        // Masih menunggu scan - tampilkan QR code
        qrcodelib.toDataURL(currentQR, { width: 300 }, (err, url) => {
            if (err) {
                return res.status(500).send('Error generating QR code');
            }
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${config.name} - Scan QR</title>
                    <style>
                        body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
                        .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
                        h1 { color: #333; margin: 0 0 20px 0; font-size: 1.8em; }
                        .qr-container { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
                        img { max-width: 300px; border: 2px solid #ddd; }
                        .instructions { color: #666; margin-top: 20px; font-size: 0.95em; }
                        .scan-icon { font-size: 3em; margin-bottom: 10px; }
                    </style>
                    <meta http-equiv="refresh" content="3">
                </head>
                <body>
                    <div class="container">
                        <div class="scan-icon">📱</div>
                        <h1>${config.name}</h1>
                        <div class="qr-container">
                            <p style="color: #999; margin: 0 0 15px 0; font-size: 0.9em;">Scan dengan WhatsApp</p>
                            <img src="${url}" alt="QR Code">
                        </div>
                        <div class="instructions">
                            <p>1. Buka WhatsApp di ponselmu</p>
                            <p>2. Tap Menu atau Pengaturan dan pilih Linked Devices</p>
                            <p>3. Arahkan kamera ke QR Code di atas</p>
                            <p style="color: #25d366; margin-top: 15px;">Halaman akan otomatis update...</p>
                        </div>
                    </div>
                </body>
                </html>
            `);
        });
    } else {
        // Belum ada QR code - tunggu
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${config.name} - Initializing</title>
                <style>
                    body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
                    .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
                    h1 { color: #667eea; margin: 0; }
                    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
                <meta http-equiv="refresh" content="2">
            </head>
            <body>
                <div class="container">
                    <h1>${config.name}</h1>
                    <div class="spinner"></div>
                    <p style="color: #666;">Initializing bot...</p>
                </div>
            </body>
            </html>
        `);
    }
});

// API endpoint untuk status
app.get('/api/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasQR: currentQR !== null
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Web UI running at http://localhost:${PORT}`.cyan);
});

client.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(`\n[${moment().tz(config.timezone).format('HH:mm:ss')}] Shutting down gracefully...`.yellow);
    try {
        await client.destroy();
        console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Bot disconnected`.green);
    } catch (err) {
        console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Error during shutdown:`, err.message);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(`\n[${moment().tz(config.timezone).format('HH:mm:ss')}] Shutting down gracefully...`.yellow);
    try {
        await client.destroy();
        console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Bot disconnected`.green);
    } catch (err) {
        console.log(`[${moment().tz(config.timezone).format('HH:mm:ss')}] Error during shutdown:`, err.message);
    }
    process.exit(0);
});
