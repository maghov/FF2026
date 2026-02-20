import { useRef, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { buildRoom, getRoomBounds } from '../../lib/roomBuilder'
import { exportGLTF, exportOBJ, exportSTL } from '../../lib/exporters'
import './RoomViewer3D.css'

function RoomScene({ roomData }) {
  const objects = useMemo(() => buildRoom(roomData), [roomData])
  const bounds = useMemo(() => getRoomBounds(roomData.room.walls), [roomData])
  const roomHeight = roomData.room.height ?? 2.7

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 8, -5]} intensity={0.3} />

      {objects.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}

      <Grid
        args={[50, 50]}
        position={[bounds.center[0], -0.01, bounds.center[1]]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#94a3b8"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#64748b"
        fadeDistance={20}
        fadeStrength={1}
        infiniteGrid={false}
      />

      <OrbitControls
        target={[bounds.center[0], roomHeight / 2, bounds.center[1]]}
        maxDistance={bounds.size * 4}
        minDistance={1}
      />
    </>
  )
}

function SceneExporter({ onExport }) {
  const { scene } = useThree()
  onExport.current = scene
  return null
}

export default function RoomViewer3D({ roomData }) {
  const sceneRef = useRef(null)
  const bounds = useMemo(() => getRoomBounds(roomData.room.walls), [roomData])
  const roomHeight = roomData.room.height ?? 2.7

  return (
    <div className="room3d-viewer-container">
      <h2>3D Room Model</h2>

      <div className="room3d-canvas-wrapper">
        <Canvas
          shadows
          camera={{
            position: [
              bounds.center[0] + bounds.size * 1.5,
              roomHeight * 2,
              bounds.center[1] + bounds.size * 1.5,
            ],
            fov: 50,
            near: 0.1,
            far: 100,
          }}
        >
          <RoomScene roomData={roomData} />
          <SceneExporter onExport={sceneRef} />
        </Canvas>
      </div>

      <div className="room3d-export-buttons">
        <h3>Export Model</h3>
        <div className="room3d-export-row">
          <button className="btn btn-primary" onClick={() => sceneRef.current && exportGLTF(sceneRef.current)}>
            Download .glb
          </button>
          <button className="btn btn-secondary" onClick={() => sceneRef.current && exportOBJ(sceneRef.current)}>
            Download .obj
          </button>
          <button className="btn btn-secondary" onClick={() => sceneRef.current && exportSTL(sceneRef.current)}>
            Download .stl
          </button>
        </div>
        <p className="room3d-export-hint">
          .glb works in Blender, web viewers, and AR apps. .stl is for 3D printing.
        </p>
      </div>
    </div>
  )
}
