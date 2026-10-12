import type { Department, OfficeAgent } from '../types'
import type { OfficeSpacing } from './officePreferences'

export type Seat = { agent: OfficeAgent; position: [number, number, number]; sector: Department }
export type Sector = { id: Department; center: [number, number, number]; width: number; depth: number; count: number }
export type OfficeLayout = { sectors: Sector[]; seats: Seat[]; width: number; depth: number; passages: { x: number; z: number; width: number; depth: number }[] }

// Placement grows by rows; neither the agent registry nor scene has a fixed seat limit.
// Every agent is assigned to exactly one seat in the department they chose.
export function makeOfficeLayout(agents: OfficeAgent[], spacing: OfficeSpacing = 'regular'): OfficeLayout {
  const order: Department[] = ['engineering', 'architecture', 'design', 'quality', 'research', 'data', 'security', 'operations', 'general']
  const groups = order.map(id => ({ id, agents: agents.filter(agent => agent.department === id) }))
    .filter(group => group.agents.length > 0)
  const active = groups.length ? groups : [{ id: 'general' as const, agents: [] as OfficeAgent[] }]
  const columns = active.length <= 2 ? active.length : active.length <= 4 ? 2 : 3
  const scale = spacing === 'compact' ? .91 : spacing === 'spacious' ? 1.2 : 1
  const gap = 3.1
  const zoneWidth = 11.7 * scale
  const workstationPitch = 3.62 * scale
  const rowPitch = 2.8 * scale
  const rowHeights: number[] = []
  const depths = active.map(group => Math.max(8.5 * scale, 4.1 * scale + Math.ceil(group.agents.length / 3) * rowPitch))
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
        position: [startX + 2.25 * scale + column * workstationPitch, 0, startZ + 2.65 * scale + line * rowPitch] })
    })
  }
  // Bridge rooms physically across both axes, creating a traversable, modular campus.
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
  return { sectors, seats, passages, width: columns * (zoneWidth + gap) - gap,
    depth: rowHeights.reduce((sum, depth) => sum + depth + gap, -gap) }
}
