# Room 3D Model Generator - Project Plan

## Overview
A standalone web app where users upload a photo of a hand-drawn room sketch (with dimensions written on it), Claude Vision extracts the measurements, and the app generates an interactive 3D model with export capabilities.

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React App  │────▶│  Backend (API)   │────▶│  Claude Vision   │
│  (Vite)     │◀────│  (Express/       │◀────│  API             │
│             │     │   Serverless)    │     └─────────────────┘
│  - Upload   │     │                  │
│  - Edit     │     │  - Proxies API   │
│  - 3D View  │     │    key securely  │
│  - Export   │     └──────────────────┘
└─────────────┘
```

### Tech Stack
| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + Vite | Consistent with your existing skills |
| 3D Rendering | Three.js via React Three Fiber + Drei | Industry-standard browser 3D, React integration |
| Vision/AI | Claude API (claude-sonnet-4-5-20250514 with vision) | Reads hand-drawn sketches, extracts dimensions |
| Backend | Express.js (minimal) or Netlify Functions | Keeps API key server-side |
| Export | three-stdlib / custom exporters | glTF, OBJ, STL export from Three.js scene |
| Styling | CSS (same approach as FF2026) | Consistency |

---

## Core User Flow

```
1. Upload  ──▶  2. Extract  ──▶  3. Review  ──▶  4. View 3D  ──▶  5. Export
   image         dimensions       & edit          model            file
```

### Step 1: Upload Image
- Drag-and-drop or file picker for image upload
- Accepts PNG, JPG, HEIC
- Preview of uploaded image displayed

### Step 2: Extract Dimensions (Claude Vision)
- Image sent to backend → Claude API with a structured prompt
- Claude returns JSON with extracted room data:
  ```json
  {
    "room": {
      "shape": "rectangular",
      "walls": [
        { "id": "north", "length": 4.5, "unit": "m", "features": [
          { "type": "window", "position": 1.2, "width": 1.5, "height": 1.2, "fromFloor": 0.9 }
        ]},
        { "id": "east", "length": 3.0, "unit": "m", "features": [
          { "type": "door", "position": 0.8, "width": 0.9, "height": 2.1 }
        ]},
        { "id": "south", "length": 4.5, "unit": "m", "features": [] },
        { "id": "west", "length": 3.0, "unit": "m", "features": [] }
      ],
      "height": 2.7,
      "angles": [90, 90, 90, 90]
    }
  }
  ```
- Handles L-shaped, U-shaped, and irregular rooms via polygon representation

### Step 3: Review & Edit
- Show extracted dimensions overlaid on the original image
- Editable form/table for each wall, door, window
- User can correct any misread values
- Add/remove features (doors, windows) manually
- Set ceiling height (default 2.7m if not specified in sketch)

### Step 4: Interactive 3D Viewer
- Three.js scene with:
  - Walls rendered as 3D boxes with thickness
  - Floor and ceiling planes
  - Door and window cutouts in walls
  - Basic materials/colors to distinguish elements
  - Grid floor for scale reference
- Controls:
  - Orbit (rotate around room)
  - Zoom in/out
  - Pan
  - Reset view button
- Optional: first-person walkthrough mode

### Step 5: Export
- **glTF (.glb)** — universal 3D format, works in Blender, web viewers, AR apps
- **OBJ (.obj)** — widely supported legacy format
- **STL (.stl)** — for 3D printing
- Download button for each format

---

## Project Structure (New Repo)

```
room-3d/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImageUpload.jsx       # Drag-drop upload
│   │   │   ├── DimensionEditor.jsx   # Review/edit extracted data
│   │   │   ├── RoomViewer3D.jsx      # Three.js 3D scene
│   │   │   ├── ExportPanel.jsx       # Download buttons
│   │   │   └── StepWizard.jsx        # Multi-step flow container
│   │   ├── lib/
│   │   │   ├── roomBuilder.js        # Converts dimensions → 3D geometry
│   │   │   └── exporters.js          # glTF/OBJ/STL export logic
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                    # Minimal Express backend
│   ├── index.js               # API server
│   ├── routes/
│   │   └── extract.js         # POST /api/extract — sends image to Claude
│   └── package.json
├── .env.example               # ANTHROPIC_API_KEY=sk-...
├── .gitignore
└── README.md
```

---

## Implementation Phases

### Phase 1: Project scaffolding
- Init new repo with Vite + React
- Install dependencies: `@react-three/fiber`, `@react-three/drei`, `three`
- Set up Express backend with Anthropic SDK
- Basic routing and layout

### Phase 2: Image upload + Claude Vision extraction
- Build upload component with image preview
- Design the Claude prompt for structured dimension extraction
- Backend endpoint that receives image, calls Claude, returns JSON
- Handle edge cases: unclear handwriting, missing units, partial sketches

### Phase 3: Review & edit UI
- Editable table/form showing all extracted walls + features
- Visual feedback showing wall layout as a 2D floor plan
- Validation (positive numbers, reasonable ranges)

### Phase 4: 3D model generation
- `roomBuilder.js` — takes dimension JSON, outputs Three.js geometries
- Wall generation with door/window cutouts (CSG or manual geometry)
- Floor + ceiling planes
- Camera and lighting setup
- Orbit controls

### Phase 5: Export functionality
- glTF export using Three.js GLTFExporter
- OBJ export using Three.js OBJExporter
- STL export using Three.js STLExporter
- File download triggers

### Phase 6: Polish
- Loading states and error handling
- Mobile-responsive layout
- Dark mode support
- "Try again" / "Upload new image" flow

---

## Key Dependencies

```json
{
  "client": {
    "react": "^19",
    "react-dom": "^19",
    "@react-three/fiber": "^9",
    "@react-three/drei": "^10",
    "three": "^0.172",
    "three-stdlib": "^2"
  },
  "server": {
    "@anthropic-ai/sdk": "^0.39",
    "express": "^4",
    "multer": "^1",
    "cors": "^2"
  }
}
```

---

## Claude Vision Prompt Strategy

The prompt sent to Claude with the image will be structured to return reliable JSON:

```
Analyze this hand-drawn room sketch. Extract all measurements and features.

Return a JSON object with this exact structure:
- room.shape: "rectangular" | "l-shaped" | "irregular"
- room.walls[]: array of walls in clockwise order, each with:
  - length (number, in meters — convert if other units shown)
  - features[]: doors, windows with position, width, height
- room.height: ceiling height if indicated, otherwise null
- room.angles[]: interior angles between consecutive walls

Only include what you can clearly read from the sketch.
Mark uncertain values with "uncertain": true.
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Claude misreads handwriting | Review/edit step lets user correct values |
| Complex room shapes (L, U, irregular) | Support polygon-based walls, not just rectangles |
| API key exposure | Backend proxy, never in frontend |
| Large images slow upload | Client-side resize before sending |
| 3D performance on mobile | Level-of-detail adjustments, simpler materials |

---

## Future Enhancements (Out of Scope for v1)
- Furniture placement from a catalog
- Texture/material selection for walls, floor
- Measurement overlay in AR (phone camera)
- Room comparison (upload multiple sketches)
- Share 3D model via link
- Photo-to-3D (no sketch needed, use actual room photo)
