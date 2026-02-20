import { Router } from 'express'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const EXTRACTION_PROMPT = `Analyze this hand-drawn room sketch. Extract all measurements and features visible in the drawing.

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:

{
  "room": {
    "shape": "rectangular" | "l-shaped" | "irregular",
    "walls": [
      {
        "id": "wall-1",
        "length": <number in meters>,
        "uncertain": <boolean, true if value is hard to read>,
        "features": [
          {
            "type": "door" | "window",
            "position": <number, distance from wall start in meters>,
            "width": <number in meters>,
            "height": <number in meters, use 2.1 for doors if not specified>,
            "fromFloor": <number in meters, 0 for doors, 0.9 for windows if not specified>
          }
        ]
      }
    ],
    "height": <number in meters if shown, otherwise null>,
    "angles": [<interior angles in degrees between consecutive walls, clockwise>]
  }
}

Rules:
- List walls in clockwise order starting from the top/north wall
- Convert all units to meters (1 ft = 0.3048m, 1 inch = 0.0254m)
- If a measurement is unclear, include your best guess and set "uncertain": true
- For rectangular rooms, provide exactly 4 walls and 4 angles of 90
- For L-shaped rooms, provide 6 walls
- If ceiling height is not indicated, set height to null`

router.post('/extract', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
    }

    const client = new Anthropic({ apiKey })
    const base64Image = req.file.buffer.toString('base64')
    const mediaType = req.file.mimetype || 'image/jpeg'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Image },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    const text = response.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Could not extract room data from image' })
    }

    const roomData = JSON.parse(jsonMatch[0])
    res.json(roomData)
  } catch (err) {
    console.error('Extraction error:', err)
    res.status(500).json({ error: err.message || 'Failed to extract dimensions' })
  }
})

export { router as extractRoute }
