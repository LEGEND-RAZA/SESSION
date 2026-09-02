import makeWASocket, {
  Browsers,
  useMultiFileAuthState,
  jidNormalizedUser,
  delay,
  DisconnectReason
} from '@whiskeysockets/baileys'

import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import P from 'pino'

const app = express()
const PORT = process.env.PORT || 3000
const logger = P({ level: 'silent' })

// Pattern applied: Raza
const botPattern = 'Raza'

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ʀᴀᴢᴀ ʙᴏᴛ - ᴘᴀɪʀɪɴɢ ᴄᴏᴅᴇ</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: monospace; background: #0d1117; color: #c9d1d9; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #161b22; padding: 25px; border-radius: 10px; border: 1px solid #30363d; text-align: center; max-width: 350px; width: 100%; }
        input { width: 90%; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #30363d; background: #0d1117; color: #fff; font-size: 16px; text-align: center; }
        button { background: #238636; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 95%; font-size: 16px; margin-top: 5px; }
        #code-box { margin-top: 15px; display: none; flex-direction: column; align-items: center; }
        #code { font-size: 22px; color: #58a6ff; letter-spacing: 2px; font-weight: bold; background: #0d1117; padding: 10px; border-radius: 5px; border: 1px dashed #30363d; width: 90%; word-break: break-all; }
        .copy-btn { background: #1f6feb; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🤖 ʀᴀᴢᴀ ʙᴏᴛ ᴘᴀɪʀɪɴɢ</h2>
        <p>Enter phone number with country code</p>
        <form id="pairForm">
          <input type="text" id="number" placeholder="923xxxxxxxxx" required />
          <button type="submit">Get Pairing Code</button>
        </form>
        <div id="status" style="margin-top:15px;font-weight:bold;"></div>
        <div id="code-box">
          <div id="code"></div>
          <button class="copy-btn" id="copyBtn" onclick="copyCode()">📋 Copy Code</button>
        </div>
      </div>
      <script>
        let rawPairCode = ''

        document.getElementById('pairForm').addEventListener('submit', async (e) => {
          e.preventDefault()
          const number = document.getElementById('number').value.replace(/\\D/g, '')
          const statusDiv = document.getElementById('status')
          const codeBox = document.getElementById('code-box')

          statusDiv.innerText = '⌛ Generating...'
          codeBox.style.display = 'none'

          try {
            const res = await fetch('/code?number=' + encodeURIComponent(number))
            const data = await res.json()

            if (data.code) {
              rawPairCode = data.code
              document.getElementById('code').innerText = data.code
              statusDiv.innerText = '📲 Enter this code on WhatsApp now...'
              codeBox.style.display = 'flex'
            } else {
              statusDiv.innerText = '❌ ' + (data.error || 'Failed to generate code')
            }
          } catch (err) {
            statusDiv.innerText = '❌ Request Error'
          }
        })

        function copyCode() {
          if (!rawPairCode) return
          navigator.clipboard.writeText(rawPairCode)
          const btn = document.getElementById('copyBtn')
          btn.innerText = '✅ Copied!'
          setTimeout(() => { btn.innerText = '📋 Copy Code' }, 2000)
        }
      </script>
    </body>
    </html>
  `)
})

app.get('/code', async (req, res) => {
  const number = String(req.query.number || '').replace(/\D/g, '')

  if (!number || number.length < 7) {
    return res.status(400).json({ error: 'Invalid phone number provided.' })
  }

  const sessionPath = path.join(process.cwd(), `temp_${Date.now()}`)
  let codeSent = false

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      console.log('[WhatsApp State]', connection || 'connecting')

      if (connection === 'open') {
        console.log('[WhatsApp] Pair verified & connected!')
        await delay(5000)

        const credsFile = path.join(sessionPath, 'creds.json')

        if (fs.existsSync(credsFile)) {
          const credsData = fs.readFileSync(credsFile, 'utf8')
          const sessionId = `${botPattern}~${Buffer.from(credsData).toString('base64')}`
          
          const rawUser = sock.user?.id || ''
          const botJid = jidNormalizedUser(rawUser)

          console.log('[WhatsApp] Target JID:', botJid)

          if (botJid) {
            try {
              await sock.sendMessage(botJid, {
                text: `🤖 *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\nHere is your SESSION_ID:\n\n\`\`\`\n${sessionId}\n\`\`\`\n\n✅ Session generated successfully.`
              })
              console.log('[WhatsApp] SESSION_ID dispatched!')
            } catch (err) {
              console.error('[WhatsApp] Send error:', err)
            }
          }
        }

        setTimeout(() => {
          try { sock.ws.close() } catch {}
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
        }, 15000)
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        console.log('[WhatsApp] Closed with status:', statusCode)

        if (statusCode === DisconnectReason.loggedOut) {
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
        }
      }
    })

    // Reliable pairing handler aligned with your working script pattern
    if (!sock.authState.creds.registered) {
      await delay(3000) // Stable buffer allowing the socket connection to stabilize

      try {
        const pairingCode = await sock.requestPairingCode(number)
        const formattedCode = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode

        if (!res.headersSent) {
          codeSent = true
          return res.json({ code: formattedCode })
        }
      } catch (e) {
        console.error('[-] Pairing code request failed:', e?.message || e)
        if (!res.headersSent) {
          return res.status(500).json({ error: e?.message || 'Pairing code request failed' })
        }
      }
    } else {
      if (!res.headersSent) {
        return res.status(400).json({ error: 'Device already registered.' })
      }
    }

  } catch (e) {
    console.error('Pairing process error:', e)
    if (!res.headersSent) {
      return res.status(500).json({ error: e?.message || 'Server Error' })
    }
    try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
  }
})

app.listen(PORT, () => {
  console.log(`ʀᴀᴢᴀ ᴘᴀɪʀ sᴇʀᴠᴇʀ ʀᴜɴɴɪɴɢ ᴏɴ ᴘᴏʀᴛ ${PORT}`)
})
