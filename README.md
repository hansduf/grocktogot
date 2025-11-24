# 🎨 StickerWhatsAppBOT - Enhanced Edition

<div align="center">
  <p><strong>Advanced WhatsApp Sticker Bot with Text-to-Sticker Generation</strong></p>
  <p>Built with <a href="https://github.com/pedroslopez/whatsapp-web.js/">whatsapp-web.js</a>, <a href="https://nodejs.org/">Node.js</a>, and Canvas</p>
</div>

---

## 📋 Features

| Feature | Status |
|:--------|:------:|
| 📸 Image to Sticker | ✅ |
| 🎬 Video to Sticker | ✅ |
| 🎞️ GIF to Sticker | ✅ |
| 🖼️ Sticker to Image | ✅ |
| 📝 Text to Sticker (NEW) | ✅ |
| ✍️ Add Text to Image | ✅ |
| ✍️ Add Text to Sticker | ✅ |
| 🏷️ Change Sticker Metadata | ✅ |
| 🎯 Reply-based Commands | ✅ |
| 🌍 Multi-timezone Support | ✅ |
| 💬 Group Chat Support | ✅ |
| 🔄 Auto-reload on Code Changes | ✅ |

---

## 🚀 Quick Start

### Prerequisites
- Node.js v16+ 
- FFmpeg (for WebP conversion)
- npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd StickerWhatsAppBOT

# Install dependencies
npm install

# Start the bot
npm start

# Or for development with auto-reload
npm run dev
```

### First Run
1. Run `npm start` or `npm run dev`
2. Scan the QR code with WhatsApp
3. Bot is ready to use!

---

## ⚙️ Configuration

Edit `config/config.json`:

```json
{
  "name": "yass",
  "author": "halow tyass",
  "prefix": ",",
  "timezone": "Asia/Jakarta",
  "groups": true,
  "log": true
}
```

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Sticker pack name |
| `author` | string | Sticker author name |
| `prefix` | string | Command prefix (e.g., `,` or `!`) |
| `timezone` | string | Timezone for logging |
| `groups` | boolean | Enable bot in group chats |
| `log` | boolean | Enable console logging |

---

## 💬 Commands

### Convert Media to Sticker
```
,convert          - Convert image/video/sticker (auto-detect)
,sticker          - Convert image/video to sticker (reply to media)
```

### Create Sticker from Text ⭐ NEW
```
,textsticker <text>    - Create sticker with justified text
                        Auto-sizing: 110px (short) to 44px (long)
Example: ,textsticker Hello World
```

### Add Text to Media
```
,addtext <text>        - Add text overlay to image (reply to image)
,sticktext <text>      - Add text overlay to sticker (reply to sticker)
Example: ,addtext Important Info
```

### Sticker Tools
```
,image                 - Convert sticker to image (reply to sticker)
,change <name>|<author> - Change sticker metadata (reply to sticker)
Example: ,change MySticker|MyName
```

### Help
```
,halo    or    halo    - Show all available commands
```

---

## 🎯 Text-to-Sticker Features

- **Dynamic Font Sizing**: Automatically adjusts font size based on text length
- **Justified Text**: Full width text alignment (rata kanan kiri)
- **Auto Line Wrapping**: Intelligently wraps long text
- **Centered Layout**: Vertically centered text in frame
- **Border**: Subtle gray border for visual appeal

### Font Size Calculator
- ≤15 chars: 110px
- ≤30 chars: 100px
- ≤50 chars: 90px
- ≤80 chars: 80px
- ≤120 chars: 70px
- ≤180 chars: 58px
- \>180 chars: 44px

---

## 🛠️ Built With

- **whatsapp-web.js** - WhatsApp Web automation
- **Canvas** - Text rendering and image manipulation
- **Jimp** - Image processing and manipulation
- **FFmpeg** - Media conversion (WebP support)
- **Moment-Timezone** - Timezone handling
- **Colors** - Terminal output coloring
- **Nodemon** - Development auto-reload

---

## 📁 Project Structure

```
StickerWhatsAppBOT/
├── index.js                 # Main bot logic
├── package.json            # Project dependencies
├── nodemon.json           # Nodemon configuration
├── config/
│   ├── config.json        # Bot configuration
│   └── console.txt        # Startup ASCII art
└── client_data/           # WhatsApp session data
```

---

## 🔍 How It Works

### Text-to-Sticker Generation
1. User sends `,textsticker <text>`
2. Canvas calculates optimal font size based on text length
3. Text is wrapped to fit within boundaries
4. Each line (except last) is justified to full width
5. PNG buffer is generated and sent as sticker

### Text Overlay on Sticker
1. User replies to sticker with `,sticktext <text>`
2. WebP sticker is converted to PNG via FFmpeg
3. Jimp loads the PNG image
4. Canvas overlays text at bottom with semi-transparent background
5. Result is sent back as edited sticker

---

## 🎮 Development

### Auto-reload During Development
```bash
npm run dev
```

Nodemon watches for changes in:
- `index.js`
- `config/` directory

Automatically restarts on file changes with a 500ms delay.

### File Watching
```json
{
  "watch": ["index.js", "config"],
  "ignore": ["node_modules", ".git", "client_data", "temp*.png", "temp*.webp"],
  "ext": "js,json"
}
```

---

## ⚠️ Important Notes

- ✅ Works on Windows, macOS, and Linux
- ❌ Does NOT work on Android/Termux
- Requires FFmpeg for WebP sticker support
- Session data is stored in `client_data/` folder
- Temporary files are auto-cleaned up

---

## 🚨 Troubleshooting

### Bot Not Responding
- Check if bot is authenticated (scan QR code again)
- Verify prefix in `config/config.json`
- Check console for error messages

### WebP Conversion Error
- Ensure FFmpeg is installed and accessible
- Update config: `"ffmpeg": "./ffmpeg.exe"` (Windows)

### Text Not Justifying Properly
- Text should contain multiple words for justify to work
- Single-word text will be centered instead

### Auto-reload Not Working
- Install nodemon: `npm install --save-dev nodemon`
- Run with: `npm run dev`

---

## 📝 License

MIT License - Feel free to use and modify for personal use.

---

## 👨‍💻 Author

**Developed with ❤️ by halow tyass**

*Last Updated: November 2025*

