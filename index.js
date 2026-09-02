import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import pairRouter from './session-pair.js'

// Setup directory paths for ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Mount the Pairing Router at /pair
app.use('/pair', pairRouter)

// Base Route / Health Check
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Raza Bot Pair Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #0f172a;
          color: #f8fafc;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .card {
          background-color: #1e293b;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          text-align: center;
          max-width: 400px;
        }
        h1 { color: #38bdf8; margin-bottom: 0.5rem; }
        p { color: #94a3b8; font-size: 0.95rem; }
        code { background: #334155; padding: 4px 8px; border-radius: 4px; color: #f43f5e; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🤖 Raza Bot Pair Server</h1>
        <p>Server is running smoothly!</p>
        <p>To request a pairing code, use:</p>
        <p><code>/pair?number=YOUR_PHONE_NUMBER</code></p>
      </div>
    </body>
    </html>
  `)
})

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Start server
app.listen(PORT, () => {
  console.log(`[RAZA BOT] Pair server is running on port ${PORT}`)
})
