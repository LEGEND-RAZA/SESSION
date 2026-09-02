import makeWASocket, {
  Browsers,
  useMultiFileAuthState,
  jidNormalizedUser,
  delay,
  fetchLatestBaileysVersion   // optional but recommended
} from '@whiskeysockets/baileys'

import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import P from 'pino'

// ... keep the rest of your app setup (app, PORT, logger, botPattern, HTML, etc.)

app.get('/code', async (req, res) => {
  const number = String(req.query.number || '').replace(/\D/g, '')

  if (!number || number.length < 8) {
    return res.status(400).json({ error: 'Invalid phone number' })
  }

  const sessionPath = path.join(process.cwd(), `temp_${Date.now()}`)
  let sock = null
  let codeSent = false          // prevent double response
  let pairingRequested = false

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    // Optional but strongly recommended
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      auth: state,
      // Prefer macOS Chrome – most stable for pairing codes
      browser: Browsers.macOS('Chrome'),
      // browser: Browsers.ubuntu('Chrome'), // also ok
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 15_000
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      console.log('[WhatsApp]', connection || (qr ? 'qr received' : 'connecting'))

      // ★★★ KEY FIX: Request pairing code ONLY when QR event fires ★★★
      if (qr && !sock.authState.creds.registered && !pairingRequested) {
        pairingRequested = true

        try {
          console.log('[WhatsApp] Requesting pairing code for', number)
          const pairingCode = await sock.requestPairingCode(number)

          const formattedCode = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode

          console.log('[WhatsApp] Pairing code:', formattedCode)

          if (!res.headersSent && !codeSent) {
            codeSent = true
            res.json({ code: formattedCode })
          }
        } catch (err) {
          console.error('[WhatsApp] requestPairingCode failed:', err)
          if (!res.headersSent) {
            res.status(500).json({ error: err?.message || 'Failed to generate code' })
          }
        }
      }

      if (connection === 'open') {
        console.log('[WhatsApp] Successfully connected')

        // Give Baileys time to finish writing credentials
        await delay(2500)

        const credsFile = path.join(sessionPath, 'creds.json')
        if (!fs.existsSync(credsFile)) {
          console.error('[WhatsApp] creds.json not found')
          return
        }

        const credsData = fs.readFileSync(credsFile, 'utf8')
        const sessionId = `\( {botPattern}\~ \){Buffer.from(credsData).toString('base64')}`

        const botJid = jidNormalizedUser(sock.user.id)
        console.log('[WhatsApp] Bot JID:', botJid)

        try {
          await sock.sendMessage(botJid, {
            text: `🤖 *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\nHere is your SESSION_ID:\n\n\`\`\`\n${sessionId}\n\`\`\`\n\n✅ Session generated successfully.`
          })
          console.log('[WhatsApp] SESSION_ID sent successfully')
        } catch (sendError) {
          console.error('[WhatsApp] Failed to send SESSION_ID:', sendError)
        }

        // Keep connection alive a bit longer so WhatsApp fully settles the session
        setTimeout(() => {
          console.log('[WhatsApp] Closing temporary connection')
          try { sock.ws?.close() } catch {}
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true })
          } catch {}
        }, 25000)
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        console.log('[WhatsApp] Connection closed:', statusCode)

        // 515 = restart required (normal after successful pairing)
        // 401 = logged out / rejected
        setTimeout(() => {
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true })
          } catch {}
        }, 5000)
      }
    })

  } catch (e) {
    console.error('[Pairing Error]', e)
    if (!res.headersSent) {
      res.status(500).json({ error: e?.message || 'Internal Server Error' })
    }
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true })
    } catch {}
  }
})
