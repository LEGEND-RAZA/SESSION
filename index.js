import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import makeWASocket, { delay, jidNormalizedUser, useMultiFileAuthState } from '@whiskeysockets/baileys'
import pino from 'pino'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080
const logger = pino({ level: 'silent' })

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Homepage route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Raza Bot Pair Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #0f172a;
          color: #f8fafc;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background-color: #1e293b;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          text-align: center;
          max-width: 400px;
        }
        h1 { color: #38bdf8; margin-bottom: 0.5rem; }
        p { color: #94a3b8; font-size: 0.95rem; }
        code { background: #334155; padding: 4px 8px; border-radius: 4px; color: #f43f5e; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🤖 Raza Bot Pair Server</h1>
        <p>Server is running smoothly!</p>
        <p>To request a pairing code, use:</p>
        <p><code>/pair?number=YOUR_PHONE_NUMBER</code></p>
      </div>
    </body>
    </html>
  `)
})

// Pairing Route
app.get('/pair', async (req, res) => {
  const number = req.query.number
  if (!number) {
    return res.status(400).json({ error: 'Phone number is required' })
  }

  const sessionPath = path.join(process.cwd(), 'temp', `session_${Date.now()}`)

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    const sock = makeWASocket({
      auth: state,
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 10000
    })

    sock.ev.on('creds.update', saveCreds)

    await delay(3000)

    if (!sock.authState.creds.registered) {
      const pairingCode = await sock.requestPairingCode(number)
      const formattedCode = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode
      
      res.json({ code: formattedCode })
    }

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        await delay(5000)
        const credsFile = path.join(sessionPath, 'creds.json')
        
        if (fs.existsSync(credsFile)) {
          const credsData = fs.readFileSync(credsFile, 'utf-8')
          
          // Pattern prefix configured to Raza
          const sessionId = `Raza~${Buffer.from(credsData).toString('base64')}`
          const rawJid = sock.user?.id || sock.user?.jid
          const botJid = jidNormalizedUser(rawJid)

          await sock.sendMessage(botJid, {
            text: `🤖 *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\nHere is your SESSION_ID:\n\n\`\`\`${sessionId}\`\`\``
          })
        }

        setTimeout(() => {
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
          sock.ws.close()
        }, 3000)
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        if (statusCode !== 401) {
          setTimeout(() => {
            try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
          }, 5000)
        }
      }
    })

  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e?.message || 'Internal Server Error' })
    }
    try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
  }
})

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

app.listen(PORT, () => {
  console.log(`[RAZA BOT] Pair server is running on port ${PORT}`)
})
