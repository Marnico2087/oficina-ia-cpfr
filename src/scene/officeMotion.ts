import type { Seat, Sector } from './officeLayout'
import type { OfficeMotion } from './officePreferences'

type Point = [number, number]
export type Route = { points: Point[]; durations: number[]; total: number }

// Paths use the unobstructed front edge of each desk row, the side aisle,
// and the lounge strip at the sector entrance. Every agent has a home seat.
export function makeWalkRoute(seat: Seat, sector: Sector, slot: number): Route {
  const [x, , z] = seat.position
  const sideAisle = sector.center[0] - sector.width / 2 + .73
  const front = sector.center[2] + sector.depth / 2 - .85
  const loungeX = sector.center[0] + (slot % 4 - 1.5) * .68
  const points: Point[] = [
    [x, z], [x, z + 1.15], [sideAisle, z + 1.15], [sideAisle, front],
    [loungeX, front], [sideAisle, front], [sideAisle, z + 1.15], [x, z + 1.15], [x, z],
  ]
  const durations = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]) / 1.3)
  return { points, durations, total: durations.reduce((sum, seconds) => sum + seconds, 0) + 9 }
}

export function walkAt(route: Route, seconds: number, motion: OfficeMotion): { position: Point; walking: boolean; social: boolean; facing: number } {
  const home = route.points[0]
  if (motion === 'off') return { position: home, walking: false, social: false, facing: Math.PI }
  const factor = motion === 'subtle' ? .55 : 1
  const cycle = route.total / factor
  let remaining = ((seconds % cycle) + cycle) % cycle * factor
  if (remaining < 3) return { position: home, walking: false, social: false, facing: Math.PI }
  remaining -= 3
  for (let index = 0; index < route.durations.length; index++) {
    if (index === 4) {
      if (remaining < 4) return { position: route.points[4], walking: false, social: true, facing: 0 }
      remaining -= 4
    }
    const duration = route.durations[index]
    if (remaining < duration) {
      const start = route.points[index], end = route.points[index + 1]
      const alpha = duration ? remaining / duration : 1
      return {
        position: [start[0] + (end[0] - start[0]) * alpha, start[1] + (end[1] - start[1]) * alpha],
        walking: duration > .08,
        social: false,
        facing: Math.atan2(end[0] - start[0], end[1] - start[1]),
      }
    }
    remaining -= duration
  }
  return { position: home, walking: false, social: false, facing: Math.PI }
}
