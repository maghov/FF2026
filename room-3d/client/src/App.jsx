import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import DimensionEditor from './components/DimensionEditor'
import RoomViewer3D from './components/RoomViewer3D'
import './App.css'

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'extract', label: 'Extract' },
  { id: 'edit', label: 'Edit' },
  { id: 'view', label: '3D View' },
]

export default function App() {
  const [step, setStep] = useState('upload')
  const [imageFile, setImageFile] = useState(null)
  const [roomData, setRoomData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleExtract() {
    if (!imageFile) return
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const res = await fetch('/api/extract', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Extraction failed')
      }

      const data = await res.json()
      // Ensure defaults
      if (!data.room.height) data.room.height = 2.7
      data.room.walls = data.room.walls.map((w, i) => ({
        ...w,
        id: w.id || `wall-${i + 1}`,
        features: w.features || [],
      }))

      setRoomData(data)
      setStep('edit')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleStartOver() {
    setStep('upload')
    setImageFile(null)
    setRoomData(null)
    setError(null)
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Room 3D</h1>
        <p className="app-subtitle">Sketch to 3D model</p>
      </header>

      <nav className="step-nav">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`step-item ${step === s.id ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
          >
            <div className="step-number">{i < stepIndex ? '\u2713' : i + 1}</div>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </nav>

      <main className="app-main">
        {step === 'upload' && (
          <>
            <ImageUpload onImageSelected={setImageFile} />
            <div className="step-actions">
              <button
                className="btn btn-primary"
                disabled={!imageFile || loading}
                onClick={() => { setStep('extract'); handleExtract() }}
              >
                Extract Dimensions
              </button>
            </div>
          </>
        )}

        {step === 'extract' && (
          <div className="extract-status">
            {loading && (
              <>
                <div className="spinner" />
                <p>Analyzing your sketch with Claude Vision...</p>
                <p className="extract-sub">This may take a few seconds</p>
              </>
            )}
            {error && (
              <div className="extract-error">
                <div className="error-icon">!</div>
                <p>{error}</p>
                <div className="step-actions">
                  <button className="btn btn-secondary" onClick={handleStartOver}>
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'edit' && roomData && (
          <>
            <DimensionEditor roomData={roomData} onChange={setRoomData} />
            <div className="step-actions">
              <button className="btn btn-secondary" onClick={handleStartOver}>
                Start Over
              </button>
              <button className="btn btn-primary" onClick={() => setStep('view')}>
                Generate 3D Model
              </button>
            </div>
          </>
        )}

        {step === 'view' && roomData && (
          <>
            <RoomViewer3D roomData={roomData} />
            <div className="step-actions">
              <button className="btn btn-secondary" onClick={() => setStep('edit')}>
                Back to Edit
              </button>
              <button className="btn btn-secondary" onClick={handleStartOver}>
                New Sketch
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
