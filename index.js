import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import pino from 'pino';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/pair', async (req, res) => {
    let num = req.query.code;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    num = num.replace(/[^0-9]/g, '');
    const sessionDir = `./temp_session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

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
            
            if (!res.headersSent) {
                res.json({ code: pairingCode });
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                await delay(5000);

                const credsPath = `${sessionDir}/creds.json`;
                if (fs.existsSync(credsPath)) {
                    const credsData = fs.readFileSync(credsPath);
                    const base64Session = Buffer.from(credsData).toString('base64');
                    const sessionId = `RAZA~${base64Session}`;

                    const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    
                    await sock.sendMessage(userJid, {
                        text: `╭━━━〔 *LEGEND-RAZA SESSION* 〕━━━┈⊷
┃
┃  *YOUR SESSION ID:*
┃  \`\`\`${sessionId}\`\`\`
┃
┃  ⚠️ *Keep this ID private. Do not share it!*
╰━━━━━━━━━━━━━━━━━━━━━━━━┈⊷`
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
    console.log(`LEGEND-RAZA Session Web Server running on port ${PORT}`);
});
