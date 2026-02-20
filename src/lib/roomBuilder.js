import * as THREE from 'three'

const WALL_THICKNESS = 0.15
const WALL_COLOR = 0xe2e8f0
const FLOOR_COLOR = 0xd4c4a8
const CEILING_COLOR = 0xf1f5f9
const DOOR_COLOR = 0x8b6914
const WINDOW_COLOR = 0x87ceeb

/**
 * Build Three.js meshes from room dimension data.
 * Returns an array of Three.js Object3D instances.
 */
export function buildRoom(roomData) {
  const { walls, height: ceilingHeight } = roomData.room
  const h = ceilingHeight ?? 2.7
  const objects = []
  const points = computeCorners(walls)

  // Build each wall
  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i]
    const start = points[i]
    const end = points[(i + 1) % points.length]
    const wallLength = wall.length

    const wallObjects = buildWall(start, end, wallLength, h, wall.features)
    objects.push(...wallObjects)
  }

  // Floor
  const floorShape = new THREE.Shape()
  floorShape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    floorShape.lineTo(points[i][0], points[i][1])
  }
  floorShape.closePath()

  const floorGeo = new THREE.ShapeGeometry(floorShape)
  const floorMat = new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, side: THREE.DoubleSide })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.name = 'floor'
  objects.push(floor)

  // Ceiling
  const ceilingGeo = new THREE.ShapeGeometry(floorShape)
  const ceilingMat = new THREE.MeshStandardMaterial({ color: CEILING_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat)
  ceiling.rotation.x = -Math.PI / 2
  ceiling.position.y = h
  ceiling.name = 'ceiling'
  objects.push(ceiling)

  return objects
}

function buildWall(start, end, length, height, features) {
  const objects = []
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const angle = Math.atan2(dz, dx)

  // Sort features by position
  const sortedFeatures = [...(features || [])].sort((a, b) => a.position - b.position)

  if (sortedFeatures.length === 0) {
    // Solid wall
    const geo = new THREE.BoxGeometry(length, height, WALL_THICKNESS)
    const mat = new THREE.MeshStandardMaterial({ color: WALL_COLOR })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(
      start[0] + dx / 2,
      height / 2,
      start[1] + dz / 2
    )
    mesh.rotation.y = -angle
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = 'wall'
    objects.push(mesh)
  } else {
    // Wall with cutouts — build solid segments and feature fills
    let cursor = 0

    for (const feat of sortedFeatures) {
      const featStart = feat.position
      const featEnd = feat.position + feat.width

      // Solid segment before this feature
      if (featStart > cursor) {
        const segLen = featStart - cursor
        const segCenter = cursor + segLen / 2
        objects.push(createWallSegment(start, angle, dx / length, dz / length, segCenter, segLen, height))
      }

      // Segment above the feature
      const aboveHeight = height - (feat.fromFloor + feat.height)
      if (aboveHeight > 0.01) {
        const aboveY = feat.fromFloor + feat.height + aboveHeight / 2
        objects.push(createWallSegment(start, angle, dx / length, dz / length, featStart + feat.width / 2, feat.width, aboveHeight, aboveY))
      }

      // Segment below the feature (for windows)
      if (feat.fromFloor > 0.01) {
        objects.push(createWallSegment(start, angle, dx / length, dz / length, featStart + feat.width / 2, feat.width, feat.fromFloor, feat.fromFloor / 2))
      }

      // Feature fill (colored plane for door/window)
      const fillGeo = new THREE.PlaneGeometry(feat.width, feat.height)
      const fillColor = feat.type === 'door' ? DOOR_COLOR : WINDOW_COLOR
      const fillMat = new THREE.MeshStandardMaterial({
        color: fillColor,
        transparent: true,
        opacity: feat.type === 'window' ? 0.4 : 0.7,
        side: THREE.DoubleSide,
      })
      const fill = new THREE.Mesh(fillGeo, fillMat)
      const cx = featStart + feat.width / 2
      fill.position.set(
        start[0] + (dx / length) * cx,
        feat.fromFloor + feat.height / 2,
        start[1] + (dz / length) * cx
      )
      fill.rotation.y = -angle + Math.PI / 2
      fill.name = feat.type
      objects.push(fill)

      cursor = featEnd
    }

    // Remaining solid segment after last feature
    if (cursor < length) {
      const segLen = length - cursor
      const segCenter = cursor + segLen / 2
      objects.push(createWallSegment(start, angle, dx / length, dz / length, segCenter, segLen, height))
    }
  }

  return objects
}

function createWallSegment(start, angle, dirX, dirZ, centerAlongWall, segLength, segHeight, yCenter) {
  const geo = new THREE.BoxGeometry(segLength, segHeight, WALL_THICKNESS)
  const mat = new THREE.MeshStandardMaterial({ color: WALL_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(
    start[0] + dirX * centerAlongWall,
    yCenter ?? segHeight / 2,
    start[1] + dirZ * centerAlongWall
  )
  mesh.rotation.y = -angle
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.name = 'wall'
  return mesh
}

/**
 * Compute corner points from wall data.
 * Walks walls clockwise using 90-degree turns for rectangular rooms.
 */
export function computeCorners(walls) {
  const points = [[0, 0]]
  let angle = 0 // radians, starting direction = positive X

  for (let i = 0; i < walls.length; i++) {
    const len = walls[i].length
    const x = points[i][0] + len * Math.cos(angle)
    const z = points[i][1] + len * Math.sin(angle)
    points.push([x, z])
    // Turn 90 degrees clockwise for rectangular rooms
    angle += Math.PI / 2
  }

  return points
}

/**
 * Get the center point and size of the room for camera positioning.
 */
export function getRoomBounds(walls) {
  const points = computeCorners(walls)
  const xs = points.map(p => p[0])
  const zs = points.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return {
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    size: Math.max(maxX - minX, maxZ - minZ),
  }
}
