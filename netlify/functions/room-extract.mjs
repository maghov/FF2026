import Anthropic from "@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
- If ceiling height is not indicated, set height to null`;

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const { image, mediaType } = await req.json();

    if (!image) {
      return Response.json(
        { error: "No image data provided" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: image,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: "Could not extract room data from image" },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const roomData = JSON.parse(jsonMatch[0]);
    return Response.json(roomData, { headers: CORS_HEADERS });
  } catch (err) {
    return Response.json(
      { error: err.message || "Failed to extract dimensions" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const config = {
  path: "/api/room-extract",
};
