import { useState } from 'react'
import './DimensionEditor.css'

export default function DimensionEditor({ roomData, onChange }) {
  const [data, setData] = useState(roomData)

  function update(newData) {
    setData(newData)
    onChange(newData)
  }

  function updateWall(index, field, value) {
    const walls = [...data.room.walls]
    walls[index] = { ...walls[index], [field]: value }
    update({ ...data, room: { ...data.room, walls } })
  }

  function updateFeature(wallIndex, featureIndex, field, value) {
    const walls = [...data.room.walls]
    const features = [...walls[wallIndex].features]
    features[featureIndex] = { ...features[featureIndex], [field]: value }
    walls[wallIndex] = { ...walls[wallIndex], features }
    update({ ...data, room: { ...data.room, walls } })
  }

  function addFeature(wallIndex, type) {
    const walls = [...data.room.walls]
    const newFeature = type === 'door'
      ? { type: 'door', position: 0.5, width: 0.9, height: 2.1, fromFloor: 0 }
      : { type: 'window', position: 0.5, width: 1.2, height: 1.2, fromFloor: 0.9 }
    walls[wallIndex] = {
      ...walls[wallIndex],
      features: [...walls[wallIndex].features, newFeature],
    }
    update({ ...data, room: { ...data.room, walls } })
  }

  function removeFeature(wallIndex, featureIndex) {
    const walls = [...data.room.walls]
    walls[wallIndex] = {
      ...walls[wallIndex],
      features: walls[wallIndex].features.filter((_, i) => i !== featureIndex),
    }
    update({ ...data, room: { ...data.room, walls } })
  }

  function updateHeight(value) {
    update({ ...data, room: { ...data.room, height: value } })
  }

  return (
    <div className="room3d-editor-container">
      <h2>Review Dimensions</h2>
      <p className="room3d-editor-hint">Verify and adjust the extracted measurements</p>

      <div className="room3d-editor-section">
        <label className="room3d-editor-label">
          Ceiling Height (m)
          <input
            type="number"
            step="0.1"
            min="1"
            max="10"
            value={data.room.height ?? 2.7}
            onChange={(e) => updateHeight(parseFloat(e.target.value) || 2.7)}
            className="room3d-editor-input"
          />
        </label>
      </div>

      <div className="room3d-walls-list">
        {data.room.walls.map((wall, wi) => (
          <div key={wall.id} className={`room3d-wall-card ${wall.uncertain ? 'uncertain' : ''}`}>
            <div className="room3d-wall-header">
              <span className="room3d-wall-name">{wall.id}</span>
              {wall.uncertain && <span className="room3d-uncertain-badge">Uncertain</span>}
            </div>

            <label className="room3d-editor-label">
              Length (m)
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={wall.length}
                onChange={(e) => updateWall(wi, 'length', parseFloat(e.target.value) || 0)}
                className="room3d-editor-input"
              />
            </label>

            {wall.features.map((feat, fi) => (
              <div key={fi} className="room3d-feature-row">
                <span className="room3d-feature-type">{feat.type}</span>
                <label>
                  Pos
                  <input
                    type="number" step="0.1" min="0"
                    value={feat.position}
                    onChange={(e) => updateFeature(wi, fi, 'position', parseFloat(e.target.value) || 0)}
                    className="room3d-editor-input small"
                  />
                </label>
                <label>
                  W
                  <input
                    type="number" step="0.1" min="0.1"
                    value={feat.width}
                    onChange={(e) => updateFeature(wi, fi, 'width', parseFloat(e.target.value) || 0.1)}
                    className="room3d-editor-input small"
                  />
                </label>
                <label>
                  H
                  <input
                    type="number" step="0.1" min="0.1"
                    value={feat.height}
                    onChange={(e) => updateFeature(wi, fi, 'height', parseFloat(e.target.value) || 0.1)}
                    className="room3d-editor-input small"
                  />
                </label>
                <button className="room3d-btn-icon" onClick={() => removeFeature(wi, fi)} title="Remove">
                  x
                </button>
              </div>
            ))}

            <div className="room3d-feature-actions">
              <button className="btn btn-secondary room3d-btn-small" onClick={() => addFeature(wi, 'door')}>
                + Door
              </button>
              <button className="btn btn-secondary room3d-btn-small" onClick={() => addFeature(wi, 'window')}>
                + Window
              </button>
            </div>
          </div>
        ))}
      </div>

      <FloorPlanPreview walls={data.room.walls} />
    </div>
  )
}

function FloorPlanPreview({ walls }) {
  if (!walls || walls.length < 3) return null

  const padding = 40
  const size = 280
  const points = computeWallPoints(walls)
  if (!points.length) return null

  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min((size - padding * 2) / rangeX, (size - padding * 2) / rangeY)

  function tx(x) { return padding + (x - minX) * scale }
  function ty(y) { return padding + (y - minY) * scale }

  const pathData = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${tx(p[0])} ${ty(p[1])}`
  ).join(' ') + ' Z'

  return (
    <div className="room3d-floor-plan-preview">
      <h4>Floor Plan Preview</h4>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={pathData} fill="var(--primary-bg)" stroke="var(--primary)" strokeWidth="2" />
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length]
          const mx = (tx(p[0]) + tx(next[0])) / 2
          const my = (ty(p[1]) + ty(next[1])) / 2
          return (
            <text key={i} x={mx} y={my - 6} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">
              {walls[i]?.length}m
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function computeWallPoints(walls) {
  const points = [[0, 0]]
  let angle = 0
  for (let i = 0; i < walls.length - 1; i++) {
    const len = walls[i].length
    const x = points[i][0] + len * Math.cos(angle * Math.PI / 180)
    const y = points[i][1] + len * Math.sin(angle * Math.PI / 180)
    points.push([x, y])
    const interiorAngle = 90
    angle += 180 - interiorAngle
  }
  return points
}
