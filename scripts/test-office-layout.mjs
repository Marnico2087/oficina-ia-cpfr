import test from 'node:test'
import assert from 'node:assert/strict'
import { makeOfficeLayout } from '../src/scene/officeLayout.ts'
import { DEFAULT_AGENTS, makeAgent, validateAgent, validStoredAgents } from '../server/agents.mjs'
import { advanceMovement, CHAIR_Z, CHAIR_APPROACH_Z, createMovementState, makeWalkRoute, STAND_SIDE_X, STAND_Z, walkAt } from '../src/scene/officeMotion.ts'
import { DEFAULT_OFFICE_PREFERENCES, normalizeOfficePreferences } from '../src/scene/officePreferences.ts'

const departments = ['architecture', 'engineering', 'design', 'quality', 'research', 'operations', 'security', 'data', 'general']
function makeTeam(count) {
  return Array.from({ length: count }, (_, index) => makeAgent({
    name: `Agent ${index}`, role: `Role ${index}`, specialty: `Specialty ${index}`,
    color: '#6474ab', department: departments[index % departments.length],
  }, `agent-${index}`))
}

for (const spacing of ['compact', 'regular', 'spacious']) {
  test(`${spacing} modular layout includes connected corridors and valid agent paths`, () => {
    const layout = makeOfficeLayout(makeTeam(90), spacing)
    assert.ok(layout.passages.length > 0)
    assert.equal(layout.seats.length, 90)
    for (const seat of layout.seats) {
      const sector = layout.sectors.find(area => area.id === seat.sector)
      const ordinal = layout.seats.filter(item => item.sector === seat.sector).indexOf(seat)
      const route = makeWalkRoute(seat, sector, ordinal)
      for (const phase of [0, 3, 5, 10, 20, 50, 150]) {
        const state = walkAt(route, phase, 'lively')
        assert.ok(Number.isFinite(state.position[0]) && Number.isFinite(state.position[1]))
        assert.ok(state.position[0] >= sector.center[0] - sector.width / 2)
        assert.ok(state.position[0] <= sector.center[0] + sector.width / 2)
        assert.ok(state.position[1] >= sector.center[2] - sector.depth / 2)
        assert.ok(state.position[1] <= sector.center[2] + sector.depth / 2 + 1.3)
      }
      assert.deepEqual(walkAt(route, 12, 'off').position, [seat.position[0] + STAND_SIDE_X, seat.position[2] + STAND_Z])
    }
  })
}

test('walking paths stay outside workstation and chair footprints across multiple team sizes', () => {
  for (const count of [1, 4, 20, 50, 100]) {
    for (const spacing of ['compact', 'regular', 'spacious']) {
      const layout = makeOfficeLayout(makeTeam(count), spacing)
      for (const seat of layout.seats) {
        const sector = layout.sectors.find(item => item.id === seat.sector)
        const ordinal = layout.seats.filter(item => item.sector === seat.sector).indexOf(seat)
        const route = makeWalkRoute(seat, sector, ordinal)
        for (let segment = 0; segment < route.points.length - 1; segment++) {
          const [ax, az] = route.points[segment], [bx, bz] = route.points[segment + 1]
          // Sample the entire segment, not only the endpoints (diagonal cuts
          // through furniture are invisible to endpoint-only checks).
          for (let sample = 0; sample <= 12; sample++) {
            const t = sample / 12
            const px = ax + (bx - ax) * t, pz = az + (bz - az) * t
            for (const other of layout.seats.filter(item => item.sector === seat.sector)) {
              const dx = Math.abs(px - other.position[0]), dz = pz - other.position[2]
              assert.ok(!(dx < 1.35 && dz > -.98 && dz < .55), `desk collision at ${count}/${spacing}/${seat.agent.id}`)
              assert.ok(!(dx < .55 && dz > .65 && dz < 1.67), `chair collision at ${count}/${spacing}/${seat.agent.id}`)
            }
          }
        }
      }
    }
  }
})

test('compact floor retains clear chair approaches, back-row walkways and a separate shared lounge', () => {
  for (const count of [2, 4, 20, 50, 100, 250]) {
    for (const spacing of ['compact', 'regular', 'spacious']) {
      const layout = makeOfficeLayout(makeTeam(count), spacing)
      const farthestBayEdge = Math.max(...layout.sectors.map(sector => sector.center[2] + sector.depth / 2))
      // Meeting furniture is centered in a strip behind the last team bay.
      assert.ok(layout.depth - 1.73 - farthestBayEdge > 1.3, 'meeting table overlaps a team bay')
      for (const seat of layout.seats) {
        const sector = layout.sectors.find(item => item.id === seat.sector)
        const ordinal = layout.seats.filter(item => item.sector === seat.sector).indexOf(seat)
        const route = makeWalkRoute(seat, sector, ordinal)
        const bayEnd = sector.center[2] + sector.depth / 2
        assert.ok(bayEnd - route.points[3][1] > .75, 'rear route leaves the team bay')
        assert.ok(route.points[3][1] - (seat.position[2] + CHAIR_Z + .55) > .6,
          'rear walkway is too close to the last row of chairs')
      }
    }
  }
})

test('work transitions return along walkways, sit at the monitor and rise coherently', () => {
  const layout = makeOfficeLayout(makeTeam(4))
  const seat = layout.seats[0]
  const route = makeWalkRoute(seat, layout.sectors.find(item => item.id === seat.sector), 0)
  let state = createMovementState(route)
  for (let i = 0; i < 300; i++) state = advanceMovement(state, route, .05, false, 'lively', 0)
  assert.equal(state.stage, 'walking')
  let sawReturn = false, sawSit = false, sawApproach = false
  for (let i = 0; i < 900 && state.stage !== 'working'; i++) {
    state = advanceMovement(state, route, .05, true, 'lively', 0)
    sawReturn ||= state.stage === 'returning'
    sawApproach ||= state.stage === 'approaching'
    sawSit ||= state.stage === 'sitting'
    if (state.stage === 'sitting') {
      assert.ok(Math.abs(state.position[0] - seat.position[0]) < .001, 'avatar cannot slide sideways through chair while sitting')
      assert.ok(state.position[1] >= seat.position[2] + CHAIR_APPROACH_Z - .001)
      assert.ok(state.position[1] <= seat.position[2] + CHAIR_Z + .001)
    }
  }
  assert.equal(sawReturn, true)
  assert.equal(sawApproach, true)
  assert.equal(sawSit, true)
  assert.equal(state.stage, 'working')
  assert.equal(state.seated, 1)
  assert.ok(Math.abs(state.position[0] - seat.position[0]) < .001)
  assert.ok(Math.abs(state.position[1] - seat.position[2] - CHAIR_Z) < .001)
  let sawLeave = false
  for (let i = 0; i < 150; i++) {
    state = advanceMovement(state, route, .05, false, 'off', 0)
    sawLeave ||= state.stage === 'leaving'
    if (state.stage === 'standing') break
  }
  assert.equal(sawLeave, true)
  assert.equal(state.stage, 'standing')
  assert.equal(state.seated, 0)
  assert.deepEqual(state.position, route.points[0])
})

test('cancelling and restarting tasks during chair approach preserves continuous movement', () => {
  const layout = makeOfficeLayout(makeTeam(1))
  const route = makeWalkRoute(layout.seats[0], layout.sectors[0], 0)
  let state = createMovementState(route)
  const advance = active => {
    const before = state.position
    state = advanceMovement(state, route, .05, active, 'subtle', 0)
    assert.ok(Math.hypot(state.position[0] - before[0], state.position[1] - before[1]) < .08, 'position jumped between animation phases')
  }
  for (let i = 0; i < 14; i++) advance(true)
  assert.equal(state.stage, 'approaching')
  for (let i = 0; i < 12; i++) advance(false)
  assert.equal(state.stage, 'leaving')
  for (let i = 0; i < 120 && state.stage !== 'working'; i++) advance(true)
  assert.equal(state.stage, 'working')
  for (let i = 0; i < 6; i++) advance(false)
  assert.equal(state.stage, 'rising')
  for (let i = 0; i < 40 && state.stage !== 'working'; i++) advance(true)
  assert.equal(state.stage, 'working')
})

test('appearance preferences reject invalid persisted values and accept user selections', () => {
  assert.deepEqual(normalizeOfficePreferences(null), DEFAULT_OFFICE_PREFERENCES)
  assert.deepEqual(normalizeOfficePreferences({ theme: 'script', accent: 'url(javascript:bad)', motion: 'flying' }), DEFAULT_OFFICE_PREFERENCES)
  const chosen = normalizeOfficePreferences({ theme: 'warm', spacing: 'spacious', motion: 'off', accent: '#abcdef', social: false })
  assert.equal(chosen.theme, 'warm')
  assert.equal(chosen.spacing, 'spacious')
  assert.equal(chosen.motion, 'off')
  assert.equal(chosen.social, false)
  assert.deepEqual(normalizeOfficePreferences({ sectorColors: { engineering: '#ff1133', hacker: '#ffffff', design: 'red' } }).sectorColors, { engineering: '#ff1133' })
})

test('connecting corridors remain between rooms when one department is much larger', () => {
  const team = makeTeam(2)
  const large = Array.from({ length: 110 }, (_, index) => makeAgent({
    name: `Builder ${index}`, role: 'Developer', specialty: 'Build', color: '#6474ab', department: 'architecture',
  }, `builder-${index}`))
  const layout = makeOfficeLayout([...team, ...large])
  const first = layout.sectors[0]
  const second = layout.sectors[1]
  const passage = layout.passages[0]
  for (const sector of [first, second]) {
    assert.ok(passage.z > sector.center[2] - sector.depth / 2)
    assert.ok(passage.z < sector.center[2] + sector.depth / 2)
  }
})

for (const count of [0, 1, 2, 4, 10, 20, 50, 100, 1000]) {
  test(`office layout seats exactly ${count} agents without collisions`, () => {
    const team = makeTeam(count)
    const layout = makeOfficeLayout(team)
    assert.equal(layout.seats.length, count)
    assert.deepEqual(layout.seats.map(seat => seat.agent.id).sort(), team.map(agent => agent.id).sort())
    const positions = layout.seats.map(seat => seat.position.join(','))
    assert.equal(new Set(positions).size, count)
    assert.ok(layout.sectors.length >= 1 && layout.sectors.length <= departments.length)
    for (const seat of layout.seats) {
      const sector = layout.sectors.find(area => area.id === seat.sector)
      assert.ok(sector)
      assert.equal(seat.sector, seat.agent.department)
      assert.ok(Math.abs(seat.position[0] - sector.center[0]) < sector.width / 2)
      assert.ok(Math.abs(seat.position[2] - sector.center[2]) < sector.depth / 2)
    }
  })
}

test('default legacy agents remain compatible with persisted history', () => {
  assert.deepEqual(DEFAULT_AGENTS.map(agent => agent.id), ['atlas', 'nova', 'pixel', 'sentinel'])
  assert.equal(validStoredAgents(DEFAULT_AGENTS), true)
  assert.equal(validStoredAgents([]), true)
  assert.equal(validStoredAgents(makeTeam(20)), true)
  assert.equal(validStoredAgents([...DEFAULT_AGENTS, DEFAULT_AGENTS[0]]), false)
})

test('agent editing rejects malformed input and malicious values', () => {
  assert.equal(validateAgent({ name: 'test', role: 'dev', specialty: 'code', color: '#abcdef', department: 'engineering' }), null)
  assert.ok(validateAgent({ name: '<script>\n', role: 'dev', specialty: 'code', color: '#abcdef', department: 'engineering' }))
  assert.ok(validateAgent({ name: 'ok', role: 'dev', specialty: 'code', color: 'red', department: 'engineering' }))
  assert.ok(validateAgent({ name: 'ok', role: 'dev', specialty: 'code', color: '#abcdef', department: 'admin' }))
})
