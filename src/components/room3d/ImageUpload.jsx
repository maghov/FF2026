import { useState, useRef } from 'react'
import './ImageUpload.css'

export default function ImageUpload({ onImageSelected }) {
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    setPreview(URL.createObjectURL(file))
    onImageSelected(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    handleFile(file)
  }

  return (
    <div className="room3d-upload-container">
      <h2>Upload Room Sketch</h2>
      <p className="room3d-upload-hint">
        Take a photo of your hand-drawn room sketch with measurements written on it
      </p>

      <div
        className={`room3d-drop-zone ${dragOver ? 'drag-over' : ''} ${preview ? 'has-preview' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Room sketch preview" className="room3d-preview-image" />
        ) : (
          <div className="room3d-drop-placeholder">
            <div className="room3d-drop-icon">+</div>
            <p>Drag & drop your sketch here</p>
            <p className="room3d-drop-sub">or click to browse</p>
            <p className="room3d-drop-formats">PNG, JPG, HEIC</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          hidden
        />
      </div>

      {preview && (
        <button
          className="btn btn-secondary"
          onClick={(e) => {
            e.stopPropagation()
            setPreview(null)
            onImageSelected(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
