import type { Department, OfficeAgent } from '../types'

export type Seat = { agent: OfficeAgent; position: [number, number, number]; sector: Department }
export type Sector = { id: Department; center: [number, number, number]; width: number; depth: number; count: number }
export type OfficeLayout = { sectors: Sector[]; seats: Seat[]; width: number; depth: number }

// Placement grows by rows; neither the agent registry nor scene has a fixed seat limit.
// Every agent is assigned to exactly one seat in the department they chose.
export function makeOfficeLayout(agents: OfficeAgent[]): OfficeLayout {
  const order: Department[] = ['engineering', 'architecture', 'design', 'quality', 'research', 'data', 'security', 'operations', 'general']
  const groups = order.map(id => ({ id, agents: agents.filter(agent => agent.department === id) }))
    .filter(group => group.agents.length > 0)
  const active = groups.length ? groups : [{ id: 'general' as const, agents: [] as OfficeAgent[] }]
  const columns = active.length <= 2 ? active.length : active.length <= 4 ? 2 : 3
  const gap = 2.6
  const zoneWidth = 11.7
  const rowHeights: number[] = []
  const depths = active.map(group => Math.max(8.5, 4.1 + Math.ceil(group.agents.length / 3) * 2.8))
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
        position: [startX + 2.25 + column * 3.62, 0, startZ + 2.65 + line * 2.8] })
    })
  }
  return { sectors, seats, width: columns * (zoneWidth + gap) - gap,
    depth: rowHeights.reduce((sum, depth) => sum + depth + gap, -gap) }
}
