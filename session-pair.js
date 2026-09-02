import makeWASocket, {
  Browsers,
  useMultiFileAuthState,
  jidNormalizedUser,
  delay
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
        body {
          font-family: monospace;
          background: #0d1117;
          color: #c9d1d9;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }

        .card {
          background: #161b22;
          padding: 25px;
          border-radius: 10px;
          border: 1px solid #30363d;
          text-align: center;
          max-width: 350px;
          width: 100%;
        }

        input {
          width: 90%;
          padding: 10px;
          margin: 10px 0;
          border-radius: 5px;
          border: 1px solid #30363d;
          background: #0d1117;
          color: #fff;
          font-size: 16px;
          text-align: center;
        }

        button {
          background: #238636;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          width: 95%;
          font-size: 16px;
          margin-top: 5px;
        }

        #code-box {
          margin-top: 15px;
          display: none;
          flex-direction: column;
          align-items: center;
        }

        #code {
          font-size: 22px;
          color: #58a6ff;
          letter-spacing: 2px;
          font-weight: bold;
          background: #0d1117;
          padding: 10px;
          border-radius: 5px;
          border: 1px dashed #30363d;
          width: 90%;
          word-break: break-all;
        }

        .copy-btn {
          background: #1f6feb;
          margin-top: 10px;
        }
      </style>
    </head>

    <body>
      <div class="card">

        <h2>🤖 ʀᴀᴢᴀ ʙᴏᴛ ᴘᴀɪʀɪɴɢ</h2>

        <p>Enter phone number with country code</p>

        <form id="pairForm">
          <input
            type="text"
            id="number"
            placeholder="923xxxxxxxxx"
            required
          />

          <button type="submit">
            Get Pairing Code
          </button>
        </form>

        <div
          id="status"
          style="margin-top:15px;font-weight:bold;"
        ></div>

        <div id="code-box">
          <div id="code"></div>

          <button
            class="copy-btn"
            id="copyBtn"
            onclick="copyCode()"
          >
            📋 Copy Code
          </button>
        </div>

      </div>

      <script>
        let rawPairCode = ''

        document
          .getElementById('pairForm')
          .addEventListener('submit', async (e) => {

            e.preventDefault()

            const number =
              document
                .getElementById('number')
                .value
                .replace(/\\D/g, '')

            const statusDiv =
              document.getElementById('status')

            const codeBox =
              document.getElementById('code-box')

            statusDiv.innerText = '⌛ Generating...'
            codeBox.style.display = 'none'

            try {

              const res =
                await fetch('/code?number=' + encodeURIComponent(number))

              const data = await res.json()

              if (data.code) {

                rawPairCode = data.code

                document.getElementById('code').innerText =
                  data.code

                statusDiv.innerText =
                  '📲 Enter this code on WhatsApp now...'

                codeBox.style.display = 'flex'

              } else {

                statusDiv.innerText =
                  '❌ ' + (data.error || 'Failed to generate code')

              }

            } catch (err) {

              statusDiv.innerText =
                '❌ Request Error'

            }

          })

        function copyCode() {

          if (!rawPairCode) return

          navigator.clipboard.writeText(rawPairCode)

          const btn =
            document.getElementById('copyBtn')

          btn.innerText = '✅ Copied!'

          setTimeout(() => {
            btn.innerText = '📋 Copy Code'
          }, 2000)
        }
      </script>
    </body>
    </html>
  `)
})


app.get('/code', async (req, res) => {

  const number =
    String(req.query.number || '')
      .replace(/\D/g, '')

  if (!number || number.length < 7) {

    return res.status(400).json({
      error: 'Invalid phone number'
    })

  }

  const sessionPath =
    path.join(
      process.cwd(),
      `temp_${Date.now()}`
    )

  let sock

  try {

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(sessionPath)

    sock = makeWASocket({

      auth: state,

      browser: Browsers.ubuntu('Chrome'),

      logger,

      markOnlineOnConnect: false,

      syncFullHistory: false,

      generateHighQualityLinkPreview: false,

      connectTimeoutMs: 60000,

      defaultQueryTimeoutMs: 60000,

      keepAliveIntervalMs: 10000

    })


    /*
     * IMPORTANT:
     * Save credentials whenever Baileys updates them.
     */
    sock.ev.on(
      'creds.update',
      saveCreds
    )


    /*
     * CONNECTION HANDLER
     *
     * Register this BEFORE requesting the pairing code.
     */
    sock.ev.on(
      'connection.update',
      async ({
        connection,
        lastDisconnect
      }) => {

        console.log(
          '[WhatsApp]',
          connection || 'connecting'
        )


        if (connection === 'open') {

          console.log(
            '[WhatsApp] Successfully connected'
          )

          /*
           * Give Baileys enough time to finish
           * writing the credentials.
           */
          await delay(3000)

          const credsFile =
            path.join(
              sessionPath,
              'creds.json'
            )


          if (!fs.existsSync(credsFile)) {

            console.error(
              '[WhatsApp] creds.json not found'
            )

            return

          }


          const credsData =
            fs.readFileSync(
              credsFile,
              'utf8'
            )


          /*
           * SESSION ID
           */
          const sessionId =
            `${botPattern}~${Buffer
              .from(credsData)
              .toString('base64')}`


          /*
           * IMPORTANT FIX:
           *
           * Do NOT manually construct:
           *
           * sock.user.id.split(':')[0] +
           * '@s.whatsapp.net'
           *
           * Use Baileys JID normalization.
           */
          const botJid =
            jidNormalizedUser(
              sock.user.id
            )


          console.log(
            '[WhatsApp] Bot JID:',
            botJid
          )


          try {

            await sock.sendMessage(
              botJid,
              {
                text:
`🤖 *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*

Here is your SESSION_ID:

\`\`\`
${sessionId}
\`\`\`

✅ Session generated successfully.`
              }
            )

            console.log(
              '[WhatsApp] SESSION_ID sent successfully'
            )

          } catch (sendError) {

            console.error(
              '[WhatsApp] Failed to send SESSION_ID:',
              sendError
            )

          }


          /*
           * Keep the socket alive long enough for
           * WhatsApp to finish the login/session setup.
           */
          setTimeout(() => {

            console.log(
              '[WhatsApp] Closing temporary connection'
            )

            try {
              sock.ws.close()
            } catch {}

            try {
              fs.rmSync(
                sessionPath,
                {
                  recursive: true,
                  force: true
                }
              )
            } catch {}

          }, 30000)

        }


        if (connection === 'close') {

          const statusCode =
            lastDisconnect
              ?.error
              ?.output
              ?.statusCode


          console.log(
            '[WhatsApp] Connection closed:',
            statusCode
          )


          /*
           * 401 normally means the session was
           * logged out / rejected.
           */
          if (statusCode === 401) {

            console.error(
              '[WhatsApp] Authentication rejected / logged out'
            )

          }


          setTimeout(() => {

            try {

              fs.rmSync(
                sessionPath,
                {
                  recursive: true,
                  force: true
                }
              )

            } catch {}

          }, 5000)

        }

      }
    )


    /*
     * Give the socket a moment to establish its
     * initial connection before requesting pairing.
     */
    await delay(3000)


    if (
      !sock.authState.creds.registered
    ) {

      console.log(
        '[WhatsApp] Requesting pairing code for:',
        number
      )


      const pairingCode =
        await sock.requestPairingCode(
          number
        )


      const formattedCode =
        pairingCode
          ?.match(/.{1,4}/g)
          ?.join('-') ||
        pairingCode


      console.log(
        '[WhatsApp] Pairing code:',
        formattedCode
      )


      /*
       * Send the HTTP response only once.
       */
      if (!res.headersSent) {

        return res.json({
          code: formattedCode
        })

      }

    } else {

      if (!res.headersSent) {

        return res.status(400).json({
          error:
            'This temporary session is already registered'
        })

      }

    }

  } catch (e) {

    console.error(
      '[Pairing Error]',
      e
    )


    if (!res.headersSent) {

      return res.status(500).json({
        error:
          e?.message ||
          'Internal Server Error'
      })

    }


    try {

      fs.rmSync(
        sessionPath,
        {
          recursive: true,
          force: true
        }
      )

    } catch {}

  }

})


app.listen(
  PORT,
  () => {
    console.log(
      `ʀᴀᴢᴀ ᴘᴀɪʀ sᴇʀᴠᴇʀ ʀᴜɴɴɪɴɢ ᴏɴ ᴘᴏʀᴛ ${PORT}`
    )
  }
)
