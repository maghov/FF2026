import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportGLTF(scene) {
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  downloadBlob(blob, 'room.glb')
}

export function exportOBJ(scene) {
  const exporter = new OBJExporter()
  const result = exporter.parse(scene)
  const blob = new Blob([result], { type: 'text/plain' })
  downloadBlob(blob, 'room.obj')
}

export function exportSTL(scene) {
  const exporter = new STLExporter()
  const result = exporter.parse(scene, { binary: true })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  downloadBlob(blob, 'room.stl')
}
