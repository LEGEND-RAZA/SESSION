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

// Handle connection updates
sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update

  if (connection === 'open') {
    await delay(5000)

    try {
      const credsFile = path.join(sessionPath, 'creds.json')

      if (fs.existsSync(credsFile) && sock.user?.id) {
        const credsData = fs.readFileSync(credsFile, 'utf-8')
        const sessionId = `Raza\~${Buffer.from(credsData).toString('base64')}`
        const botJid = sock.user.id.split('@')[0].split(':')[0] + '@s.whatsapp.net'

        await sock.sendMessage(botJid, {
          text: `🤖 *ʀᴀᴢᴀ ʙᴏᴛ sᴇssɪᴏɴ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\nHere is your SESSION_ID:\n\n\`\`\`${sessionId}\`\`\``
        })
      }
    } catch (err) {
      console.error('Error sending session:', err)
    }

    // Close after sending
    setTimeout(() => {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true })
      } catch {}
      sock.end()
    }, 3000)
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode
    if (statusCode !== 401) {
      setTimeout(() => {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true })
        } catch {}
      }, 5000)
    }
  }
})

// Request pairing code only if not registered
await delay(2000)

if (!sock.authState.creds.registered) {
  try {
    const pairingCode = await sock.requestPairingCode(number)
    const formattedCode = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode
    return res.json({ code: formattedCode })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to generate pairing code' })
  }
} else {
  // Already registered
  return res.json({ message: 'Already registered / Session already exists' })
}
