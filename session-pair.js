const { jidNormalizedUser } = require('@whiskeysockets/baileys')

const sock = makeWASocket({
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

    sock.ev.on('creds.update', saveCreds)

    // Wait for connection initial handshake before requesting pairing code
    await delay(3000)

    if (!sock.authState.creds.registered) {
      const pairingCode = await sock.requestPairingCode(number)
      const formattedCode = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode
      
      res.json({ code: formattedCode })
    }

    // Keep active socket listening until WhatsApp pairs
    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        await delay(5000)
        const credsFile = path.join(sessionPath, 'creds.json')
        
        if (fs.existsSync(credsFile)) {
          const credsData = fs.readFileSync(credsFile, 'utf-8')
          
          // Pattern prefix set to Raza
          const sessionId = `Raza~${Buffer.from(credsData).toString('base64')}`
          
          // Clean JID formatting
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
          // Clean temporary folder if pairing fails
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
