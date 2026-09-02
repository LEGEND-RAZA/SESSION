import express from 'express'
import fs from 'fs'
import path from 'path'
import makeWASocket, { delay, jidNormalizedUser, useMultiFileAuthState } from '@whiskeysockets/baileys'
import pino from 'pino'

const app = express()
const PORT = process.env.PORT || 8080
const logger = pino({ level: 'silent' })

app.use(express.json())

app.get('/', (req, res) => {
  res.send('🤖 Raza Bot Pair Server is Running!')
})

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

app.listen(PORT, () => console.log(`Pair server running on port ${PORT}`))
