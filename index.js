import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import pairRouter from './session-pair.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Route for generating pairing code (e.g. /pair?number=1234567890)
app.use('/pair', pairRouter)

// Default status check endpoint
app.get('/', (req, res) => {
  res.send('🤖 Raza Bot Pair Server is Running!')
})

app.listen(PORT, () => {
  console.log(`Pair server running on port ${PORT}`)
})
