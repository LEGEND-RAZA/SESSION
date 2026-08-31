import makeWASocket, { Browsers, useMultiFileAuthState, delay, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import P from 'pino'

const app = express()
const PORT = process.env.PORT || 3000

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
        <div id="status" style="margin-top: 15px; font-weight: bold;"></div>
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
            const res = await fetch('/code?number=' + number)
            const data = await res.json()
            if (data.code) {
              rawPairCode = data.code
              document.getElementById('code').innerText = data.code
              statusDiv.innerText = ''
              codeBox.style.display = 'flex'
            } else {
              statusDiv.innerText = '❌ Failed to generate code'
            }
          } catch {
            statusDiv.innerText = '❌ Request Error'
          }
        })

        function copyCode() {
          if (!rawPairCode) return
          navigator.clipboard.writeText(rawPairCode)
          const btn = document.getElementById('copyBtn')
          btn.innerText = '✅ Copied!'
          setTimeout(() => btn.innerText = '📋 Copy Code', 2000)
        }
      </script>
    </body>
    </html>
  `)
})

app.get('/code', async (req, res) => {
  const number = (req.query.number || '').replace(/\D/g, '')
  if (!number || number.length < 7) return res.status(400).json({ error: 'Invalid number' })

  const sessionPath = path.join(process.cwd(), `temp_${Date.now()}`)
  try {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'fatal' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      emitOwnEvents: true,
      retryRequestOptions: {
        delayMs: 250,
        maxRetries: 5
      }
    })

    sock.ev.on('creds.update', saveCreds)

    await delay(3000)

    if (!sock.authState.creds.registered) {
      const rawCode = await sock.requestPairingCode(number)
      const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode
      res.json({ code: formattedCode })
    }

    sock.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'open') {
        await delay(5000)
        const credsFile = path.join(sessionPath, 'creds.json')
        if (fs.existsSync(credsFile)) {
          const credsData = fs.readFileSync(credsFile, 'utf-8')
          const sessionId = `Raza~${Buffer.from(credsData).toString('base64')}`
          const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

          await sock.sendMessage(botJid, {
            text: `✅ *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\n\`\`\`${sessionId}\`\`\``
          })
        }
        try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
        sock.ws.close()
      }
    })
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message })
    try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
  }
})

app.listen(PORT, () => console.log(`Pair server running on port ${PORT}`))
