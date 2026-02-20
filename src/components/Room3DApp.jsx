import { useState, lazy, Suspense } from "react";
import { useAuth } from "../context/AuthContext";
import "./Room3DApp.css";

const ImageUpload = lazy(() => import("./room3d/ImageUpload"));
const DimensionEditor = lazy(() => import("./room3d/DimensionEditor"));
const RoomViewer3D = lazy(() => import("./room3d/RoomViewer3D"));

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "extract", label: "Extract" },
  { id: "edit", label: "Edit" },
  { id: "view", label: "3D View" },
];

const DEFAULT_ROOM = {
  room: {
    shape: "rectangular",
    height: 2.7,
    walls: [
      { id: "wall-1", length: 4.0, features: [] },
      { id: "wall-2", length: 3.0, features: [] },
      { id: "wall-3", length: 4.0, features: [] },
      { id: "wall-4", length: 3.0, features: [] },
    ],
    angles: [90, 90, 90, 90],
  },
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Room3DApp({ onSwitchApp }) {
  const { user, logout } = useAuth();
  const [step, setStep] = useState("upload");
  const [imageFile, setImageFile] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleExtract() {
    if (!imageFile) return;
    setLoading(true);
    setError(null);

    try {
      const base64 = await fileToBase64(imageFile);
      const mediaType = imageFile.type || "image/jpeg";

      const apiUrl = import.meta.env.DEV
        ? "/api/room-extract"
        : "/.netlify/functions/room-extract";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Extraction failed");
      }

      const data = await res.json();
      if (!data.room.height) data.room.height = 2.7;
      data.room.walls = data.room.walls.map((w, i) => ({
        ...w,
        id: w.id || `wall-${i + 1}`,
        features: w.features || [],
      }));

      setRoomData(data);
      setStep("edit");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleManualEntry() {
    setRoomData(structuredClone(DEFAULT_ROOM));
    setStep("edit");
  }

  function handleStartOver() {
    setStep("upload");
    setImageFile(null);
    setRoomData(null);
    setError(null);
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-icon room3d-icon">3D</div>
            <div>
              <h1>Room 3D</h1>
              <p className="subtitle">Sketch to 3D Model</p>
            </div>
          </div>
          <div className="user-info">
            <span className="user-name">{user.displayName}</span>
            <button className="btn btn-secondary app-switcher" onClick={onSwitchApp}>
              Football Fantasy
            </button>
            <button className="btn btn-secondary" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="room3d-step-nav">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`room3d-step-item ${step === s.id ? "active" : ""} ${i < stepIndex ? "done" : ""}`}
          >
            <div className="room3d-step-number">{i < stepIndex ? "\u2713" : i + 1}</div>
            <span className="room3d-step-label">{s.label}</span>
          </div>
        ))}
      </nav>

      <main className="app-main">
        <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
          {step === "upload" && (
            <>
              <ImageUpload onImageSelected={setImageFile} />
              <div className="room3d-step-actions">
                <button
                  className="btn btn-primary"
                  disabled={!imageFile || loading}
                  onClick={() => { setStep("extract"); handleExtract(); }}
                >
                  Extract Dimensions
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleManualEntry}
                >
                  Enter Manually
                </button>
              </div>
            </>
          )}

          {step === "extract" && (
            <div className="room3d-extract-status">
              {loading && (
                <>
                  <div className="spinner" />
                  <p>Analyzing your sketch with Claude Vision...</p>
                  <p className="room3d-extract-sub">This may take a few seconds</p>
                </>
              )}
              {error && (
                <div className="room3d-extract-error">
                  <div className="room3d-error-icon">!</div>
                  <p>{error}</p>
                  <div className="room3d-step-actions">
                    <button className="btn btn-secondary" onClick={handleStartOver}>
                      Try Again
                    </button>
                    <button className="btn btn-secondary" onClick={handleManualEntry}>
                      Enter Manually Instead
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "edit" && roomData && (
            <>
              <DimensionEditor roomData={roomData} onChange={setRoomData} />
              <div className="room3d-step-actions">
                <button className="btn btn-secondary" onClick={handleStartOver}>
                  Start Over
                </button>
                <button className="btn btn-primary" onClick={() => setStep("view")}>
                  Generate 3D Model
                </button>
              </div>
            </>
          )}

          {step === "view" && roomData && (
            <>
              <RoomViewer3D roomData={roomData} />
              <div className="room3d-step-actions">
                <button className="btn btn-secondary" onClick={() => setStep("edit")}>
                  Back to Edit
                </button>
                <button className="btn btn-secondary" onClick={handleStartOver}>
                  New Sketch
                </button>
              </div>
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
}
