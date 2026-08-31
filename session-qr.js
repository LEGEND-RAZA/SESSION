import makeWASocket, { Browsers, useMultiFileAuthState, delay } from '@whiskeysockets/baileys'
import express from 'express'
import QRCode from 'qrcode'
import fs from 'node:fs'
import path from 'node:path'
import P from 'pino'

const app = express()
const PORT = process.env.PORT || 3000

let currentQR = ''
let generatedSessionId = ''
let statusMessage = '⌛ Initializing...'

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ʀᴀᴢᴀ ʙᴏᴛ - ǫʀ sᴄᴀɴɴᴇʀ</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: monospace; background: #0d1117; color: #c9d1d9; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #161b22; padding: 25px; border-radius: 10px; border: 1px solid #30363d; text-align: center; max-width: 350px; width: 100%; }
        img { width: 230px; height: 230px; margin-top: 15px; border-radius: 8px; border: 2px solid #30363d; }
        button { background: #1f6feb; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 95%; font-size: 16px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🤖 ʀᴀᴢᴀ ʙᴏᴛ ǫʀ</h2>
        <p>Scan with WhatsApp Linked Devices</p>
        <div id="container">⌛ Loading QR...</div>
        <button id="copyBtn" style="display:none;" onclick="copySession()">📋 Copy Session ID</button>
      </div>
      <script>
        let sessionVal = ''

        setInterval(async () => {
          try {
            const res = await fetch('/qr-data')
            const data = await res.json()
            const container = document.getElementById('container')
            const copyBtn = document.getElementById('copyBtn')

            if (data.sessionId) {
              sessionVal = data.sessionId
              container.innerText = '✅ Session Generated Successfully!'
              copyBtn.style.display = 'block'
            } else if (data.qr) {
              container.innerHTML = '<img src="' + data.qr + '" />'
            } else if (data.status) {
              container.innerText = data.status
            }
          } catch {}
        }, 3000)

        function copySession() {
          if (!sessionVal) return
          navigator.clipboard.writeText(sessionVal)
          const btn = document.getElementById('copyBtn')
          btn.innerText = '✅ Copied!'
          setTimeout(() => btn.innerText = '📋 Copy Session ID', 2000)
        }
      </script>
    </body>
    </html>
  `)
})

app.get('/qr-data', (req, res) => {
  if (generatedSessionId) return res.json({ sessionId: generatedSessionId })
  if (currentQR) return res.json({ qr: currentQR })
  res.json({ status: statusMessage })
})

async function startQRServer() {
  const sessionPath = path.join(process.cwd(), `temp_qr_${Date.now()}`)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    logger: P({ level: 'fatal' })
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, qr }) => {
    if (qr) {
      currentQR = await QRCode.toDataURL(qr)
    }

    if (connection === 'open') {
      statusMessage = '✅ Linked! Reading Session...'
      currentQR = ''
      await delay(4000)

      const credsFile = path.join(sessionPath, 'creds.json')
      if (fs.existsSync(credsFile)) {
        const credsData = fs.readFileSync(credsFile, 'utf-8')
        generatedSessionId = `Raza~${Buffer.from(credsData).toString('base64')}`
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'

        await sock.sendMessage(botJid, {
          text: `✅ *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\n\`\`\`${generatedSessionId}\`\`\``
        })
      }

      try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
      sock.ws.close()
    }
  })
}

app.listen(PORT, () => {
  console.log(`QR server running on port ${PORT}`)
  startQRServer()
})
