import express from 'express'
import cors from 'cors'
import { extractRoute } from './routes/extract.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '20mb' }))

app.use('/api', extractRoute)

app.listen(PORT, () => {
  console.log(`Room 3D server running on http://localhost:${PORT}`)
})
