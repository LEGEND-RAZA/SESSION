import express from 'express';
import fs from 'fs-extra';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/pair', async (req, res) => {
    let num = req.query.code;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean phone number format
    num = num.replace(/[^0-9]/g, '');
    const sessionDir = `./temp_session_${Date.now()}`;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false
        });

        if (!sock.authState.creds.registered) {
            await delay(1500);
            const pairingCode = await sock.requestPairingCode(num);
            
            // Return pairing code to frontend UI
            if (!res.headersSent) {
                res.json({ code: pairingCode });
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                await delay(5000);

                // Read creds.json and encode into Base64 Session ID
                const credsPath = `${sessionDir}/creds.json`;
                if (fs.existsSync(credsPath)) {
                    const credsData = fs.readFileSync(credsPath);
                    const base64Session = Buffer.from(credsData).toString('base64');
                    const sessionId = `RAZA~${base64Session}`;

                    // Send session ID directly to user's WhatsApp chat
                    const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    await sock.sendMessage(userJid, {
                        text: `╭━━━〔 *RAZA BOT SESSION* 〕━━━┈⊷
┃
┃  *YOUR SESSION ID:*
┃  \`\`\`${sessionId}\`\`\`
┃
┃  ⚠️ *Do not share this key with anyone!*
╰━━━━━━━━━━━━━━━━━━━━━━┈⊷`
                    });

                    await sock.sendMessage(userJid, { text: sessionId });
                }

                await delay(2000);
                await sock.ws.close();
                await fs.remove(sessionDir);
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode !== 200) {
                    await fs.remove(sessionDir);
                }
            }
        });

    } catch (err) {
        console.error('Error generating pair code:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate pairing code' });
        }
        await fs.remove(sessionDir);
    }
});

app.listen(PORT, () => {
    console.log(`Session Generator running on port ${PORT}`);
});
