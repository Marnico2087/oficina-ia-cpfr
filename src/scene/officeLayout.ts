import type { Department, OfficeAgent } from '../types'
import type { OfficeSpacing } from './officePreferences'

export type Seat = { agent: OfficeAgent; position: [number, number, number]; sector: Department }
export type Sector = { id: Department; center: [number, number, number]; width: number; depth: number; count: number }
export type OfficeAmenity = { id: 'meeting' | 'coffee' | 'focus'; x: number; z: number }
export type OfficeLayout = { sectors: Sector[]; seats: Seat[]; width: number; depth: number; passages: { x: number; z: number; width: number; depth: number }[]; amenities: OfficeAmenity[] }

// Placement grows by rows; neither the agent registry nor scene has a fixed seat limit.
// Every agent has exactly one seat; small teams share a common room.
export function makeOfficeLayout(agents: OfficeAgent[], spacing: OfficeSpacing = 'regular'): OfficeLayout {
  const scale = spacing === 'compact' ? .91 : spacing === 'spacious' ? 1.2 : 1
  // Small teams share one coherent studio. The agents retain their original
  // departmental identities; "general" describes only their common room.
  // Splitting four differently-skilled colleagues into four large individual
  // rooms was the main cause of the visually empty, disconnected office.
  if (agents.length <= 6) {
    const columns = Math.min(3, Math.max(1, agents.length))
    const rows = Math.ceil(agents.length / columns)
    const width = (4.65 + (columns - 1) * 3.46) * scale
    // The second row must begin behind the previous row's walking corridor.
    // Using the old 3.62 pitch made agents walk straight through the next desk.
    const rowPitch = 4.7
    const workDepth = (5.65 + (rows - 1) * rowPitch) * scale
    // Even a one-person studio gets a small, useful coffee corner; the
    // shared strip grows just enough to make a real, walkable stop.
    const sharedDepth = agents.length >= 3 ? 3.35 * scale : agents.length > 0 ? 2.8 * scale : .75 * scale
    const sector: Sector = { id: 'general', center: [width / 2, 0, workDepth / 2], width, depth: workDepth, count: agents.length }
    const seats: Seat[] = agents.map((agent, i) => ({ agent, sector: 'general',
      position: [(2.23 + i % columns * 3.46) * scale, 0, (2.18 + Math.floor(i / columns) * rowPitch) * scale],
    }))
    const amenities: OfficeAmenity[] = agents.length ? [{ id: 'coffee', x: 1.3 * scale,
      z: workDepth + (agents.length < 3 ? 1.4 : 1.675) * scale }] : []
    if (agents.length >= 3) amenities.unshift({ id: 'meeting', x: width / 2, z: workDepth + sharedDepth / 2 })
    return { sectors: [sector], seats, width, depth: workDepth + sharedDepth, passages: [],
      amenities }
  }
  const order: Department[] = ['engineering', 'architecture', 'design', 'quality', 'research', 'data', 'security', 'operations', 'general']
  const groups = order.map(id => ({ id, agents: agents.filter(agent => agent.department === id) }))
    .filter(group => group.agents.length > 0)
  const active = groups.length ? groups : [{ id: 'general' as const, agents: [] as OfficeAgent[] }]
  // Small teams share a compact coworking cluster instead of a long strip.
  const columns = active.length <= 3 ? active.length : active.length <= 6 ? 2 : 3
  // Open-plan bays share one floor. The gaps are circulation lanes, not doors.
  const gap = 1.3 * scale
  // Small teams sit together in one open row; do not reserve three empty desks
  // for every single-agent department.
  const busiest = Math.max(1, ...active.map(group => group.agents.length))
  // One desk needs one bay. Up to three desks share a row; avoid allocating
  // three empty workstation slots when a sector contains one or two agents.
  const zoneWidth = (5.15 + (Math.min(3, busiest) - 1) * 3.62) * scale
  const workstationPitch = 3.62 * scale
  const rowPitch = 3.72 * scale
  const rowHeights: number[] = []
  const depths = active.map(group => Math.max(7.2 * scale, 3.15 * scale + Math.ceil(group.agents.length / 3) * rowPitch))
  depths.forEach((depth, i) => {
    const row = Math.floor(i / columns)
    rowHeights[row] = Math.max(rowHeights[row] || 0, depth)
  })
  const sectors: Sector[] = []
  const seats: Seat[] = []
  for (let i = 0; i < active.length; i++) {
    const group = active[i]
    const row = Math.floor(i / columns)
    const col = i % columns
    const startX = col * (zoneWidth + gap)
    const startZ = rowHeights.slice(0, row).reduce((sum, depth) => sum + depth + gap, 0)
    const depth = depths[i]
    const center: [number, number, number] = [startX + zoneWidth / 2, 0, startZ + depth / 2]
    sectors.push({ id: group.id, center, width: zoneWidth, depth, count: group.agents.length })
    group.agents.forEach((agent, index) => {
      const column = index % 3
      const line = Math.floor(index / 3)
      seats.push({ agent, sector: group.id,
        position: [startX + 2.45 * scale + column * workstationPitch, 0, startZ + 2.65 * scale + line * rowPitch] })
    })
  }
  // Keep circulation strips visually connected between open team bays.
  const passages: OfficeLayout['passages'] = []
  sectors.forEach((sector, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    if (col > 0) {
      const previous = sectors[index - 1]
      // The rooms in a row can have radically different depths. Connect them
      // where their front edges overlap, not at the deeper room's midpoint.
      const overlapStart = Math.max(previous.center[2] - previous.depth / 2, sector.center[2] - sector.depth / 2)
      passages.push({ x: (previous.center[0] + sector.center[0]) / 2, z: overlapStart + 2, width: gap + .5, depth: 2.25 })
    }
    if (row > 0) {
      const above = sectors[index - columns]
      const topEdge = above.center[2] + above.depth / 2
      const bottomEdge = sector.center[2] - sector.depth / 2
      passages.push({ x: sector.center[0], z: (topEdge + bottomEdge) / 2, width: 2.35, depth: Math.max(gap + .6, bottomEdge - topEdge + .5) })
    }
  })
  const width = columns * (zoneWidth + gap) - gap
  const workDepth = rowHeights.reduce((sum, depth) => sum + depth + gap, -gap)
  // Amenities appear only when the team needs them. A solo agent gets a compact
  // work floor; larger teams progressively unlock shared facilities.
  const amenities: OfficeAmenity[] = []
  let sharedDepth = .85 * scale
  if (agents.length >= 3) {
    sharedDepth = (agents.length < 9 ? 3.45 : agents.length < 25 ? 4.3 : 5.2) * scale
    const commonZ = workDepth + sharedDepth / 2
    amenities.push({ id: 'meeting', x: width / 2, z: commonZ })
    if (agents.length >= 7) amenities.push({ id: 'coffee', x: Math.max(1.25, width * .14), z: commonZ })
    if (agents.length >= 25) amenities.push({ id: 'focus', x: width - Math.max(1.25, width * .14), z: commonZ })
  }
  return { sectors, seats, passages, amenities, width, depth: workDepth + sharedDepth }
}
