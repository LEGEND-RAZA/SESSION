<div align="center">

# 🤖 ʀᴀᴢᴀ ʙᴏᴛ - sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇʀ

*A fast, lightweight web application to generate WhatsApp `SESSION_ID` for Baileys-based WhatsApp bots.*

[![Heroku Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/LEGEND-RAZA/SESSION)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/LEGEND-RAZA/SESSION)

---

</div>

## ✨ Features

- **Pairing Code Method:** Generate an 8-digit WhatsApp pairing code directly in your browser.
- **QR Code Method:** Live QR code generation for scanning via Linked Devices.
- **1-Click Copy:** Built-in copy button for easy code extraction.
- **Direct WhatsApp Message:** Automatically sends the generated `SESSION_ID` string directly to your WhatsApp.
- **Fast & Lightweight:** Built using Express and Baileys with low memory usage.

---

## 🚀 Quick Deployment

### Option 1: Heroku

1. Click the **Deploy to Heroku** button above.
2. Enter your app name and click **Deploy App**.
3. Once deployed, open the app URL in your browser.

---

### Option 2: Render

1. Click the **Deploy to Render** button above.
2. Connect your GitHub account and complete setup.
3. Use the following deployment settings if prompted manually:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run pair` (or `npm run qr`)

---

## 📱 How to Use

1. Open your deployed Web App URL.
2. Enter your WhatsApp phone number with your country code (e.g., `923xxxxxxxxx`).
3. Click **Get Pairing Code** and copy the code.
4. Open WhatsApp on your phone:
   - Go to **Settings > Linked Devices > Link a Device > Link with Phone Number Instead**.
   - Enter the 8-digit pairing code.
5. Once connected, your `SESSION_ID` will be generated and sent directly to your WhatsApp chat!

---

<div align="center">

**Made with ❤️ for Raza Bot**

</div>
