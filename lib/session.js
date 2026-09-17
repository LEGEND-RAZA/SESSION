import fs from 'fs-extra';

async function initSession() {
    const sessionId = process.env.SESSION_ID;
    
    if (sessionId && sessionId.startsWith('RAZA~')) {
        const base64Data = sessionId.replace('RAZA~', '');
        const credsJson = Buffer.from(base64Data, 'base64').toString('utf-8');
        
        await fs.ensureDir('./session');
        await fs.writeFileSync('./session/creds.json', credsJson);
        console.log('Session successfully restored!');
    }
}
