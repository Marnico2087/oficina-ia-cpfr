import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils, Vector3 } from 'three'
import { type AgentId, type OfficeTask } from '../types'
import { DEPARTMENTS, useAgents } from '../agents'
import { OfficeCampus } from './OfficeCampus'
import { OfficeAvatar } from './OfficeAvatar'
import { makeOfficeLayout, type OfficeLayout, type Seat } from './officeLayout'
import { advanceMovement, CHAIR_Z, createMovementState, makeWalkRoute, STAND_Z } from './officeMotion'
import { useOfficePreferences } from './OfficePreferencesContext'
import type { OfficePreferences } from './officePreferences'
import { useLanguage } from '../locales/i18n'
import { phaseName, statusName } from '../components/taskDisplay'
import { resolveAgentPose, selectAgentTask, TERMINAL_POSE_MS, type AgentPose } from './agentBehavior'

// Project world positions to the existing React DOM layer without creating
// separate React roots inside Three.js (which can race during unmount).
function BadgeProjector({ overlayId, seats, sectors, avatars }: { overlayId: string; seats: Seat[]; sectors: OfficeLayout['sectors']; avatars: RefObject<Map<string, Group>> }) {
  const point = useRef(new Vector3())
  const labels = useRef<Map<string, HTMLSpanElement>>(new Map())
  useEffect(() => {
    const overlay = document.getElementById(overlayId)
    const entries = overlay?.querySelectorAll<HTMLSpanElement>('[data-agent], [data-sector]') || []
    labels.current = new Map([...entries].map(node => [node.dataset.agent || `sector:${node.dataset.sector}`, node]))
    return () => { labels.current.clear() }
  }, [overlayId, seats, sectors])
  useFrame(({ camera, size }) => {
    const place = (id: string, x: number, y: number, z: number) => {
      const label = labels.current.get(id)
      if (!label) return
      point.current.set(x, y, z).project(camera)
      label.style.left = `${(point.current.x + 1) * size.width / 2}px`
      label.style.top = `${(1 - point.current.y) * size.height / 2}px`
      label.style.visibility = Math.abs(point.current.x) > 1 || Math.abs(point.current.y) > 1 || point.current.z > 1 ? 'hidden' : 'visible'
    }
    for (const seat of seats) {
      const avatar = avatars.current.get(seat.agent.id)
      if (avatar) {
        avatar.getWorldPosition(point.current)
        place(seat.agent.id, point.current.x, point.current.y + 2.28, point.current.z)
      }
    }
    for (const sector of sectors) place(`sector:${sector.id}`, sector.center[0], 3.9, sector.center[2] - sector.depth / 2 + .3)
  })
  return null
}

function Desk({ color, active, theme }: { color: string; active: boolean; theme: OfficePreferences['theme'] }) {
  const monitor = useRef<Mesh>(null)
  useFrame(state => {
    if (monitor.current) (monitor.current.material as { emissiveIntensity?: number }).emissiveIntensity = active ? .33 + Math.sin(state.clock.elapsedTime * 2.7) * .14 : .08
  })
  return <group>
    {/* Chair faces the near edge of the desk, with the backrest behind the worker. */}
    <RoundedBox position={[0, .65, CHAIR_Z]} args={[.82, .13, .83]} radius={.12} castShadow><meshStandardMaterial color="#4b6079" roughness={.78}/></RoundedBox>
    <RoundedBox position={[0, 1.05, CHAIR_Z + .43]} args={[.87, .76, .13]} radius={.12} castShadow><meshStandardMaterial color="#536c89" roughness={.82}/></RoundedBox>
    <mesh position={[0, .34, CHAIR_Z]}><cylinderGeometry args={[.07, .09, .57, 10]}/><meshStandardMaterial color="#58667b" metalness={.4}/></mesh>
    <mesh position={[0, .1, CHAIR_Z]}><boxGeometry args={[1.02, .08, .12]}/><meshStandardMaterial color="#39465d"/></mesh>
    <mesh position={[0, .1, CHAIR_Z]}><boxGeometry args={[.12, .08, .94]}/><meshStandardMaterial color="#39465d"/></mesh>
    <RoundedBox position={[0, .95, -.22]} args={[2.5, .16, 1.32]} radius={.065} castShadow receiveShadow><meshStandardMaterial color={theme === 'midnight' ? '#a48b78' : theme === 'warm' ? '#d6b79b' : '#e5eaf0'} roughness={.72} /></RoundedBox>
    {[-1.04, 1.04].map(x => [-.66, .25].map(z => <mesh key={`${x}-${z}`} position={[x, .48, z]} castShadow>
      <boxGeometry args={[.09, .92, .09]} /><meshStandardMaterial color="#556079" metalness={.45} />
    </mesh>))}
    <mesh position={[0, 1.3, -.59]}><boxGeometry args={[.08, .45, .09]} /><meshStandardMaterial color="#5e6478" /></mesh>
    <RoundedBox position={[0, 1.58, -.64]} args={[1.42, .87, .09]} radius={.045} castShadow><meshStandardMaterial color="#101c2c" /></RoundedBox>
    <mesh ref={monitor} position={[0, 1.58, -.583]}><planeGeometry args={[1.29, .75]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.3} roughness={.3} /></mesh>
    <mesh position={[0, 1.58, -.565]}><planeGeometry args={[1.14, .61]} /><meshStandardMaterial color="#0e2137" emissive="#0c2235" emissiveIntensity={.4} /></mesh>
    {Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[-.37, 1.78 - .115 * i, -.554]}>
      <planeGeometry args={[.28 + (i % 3) * .16, .022]} /><meshBasicMaterial color={i === 0 ? color : i === 3 ? '#7b9eba' : '#3d5b79'} />
    </mesh>)}
    <RoundedBox position={[0, 1.051, .16]} args={[1, .035, .34]} radius={.022}><meshStandardMaterial color="#2d354a" /></RoundedBox>
    <mesh position={[.75, 1.063, .16]}><cylinderGeometry args={[.1, .1, .04, 12]} /><meshStandardMaterial color="#242d3a" /></mesh>
    <mesh position={[-1.02, 1.055, -.54]}><cylinderGeometry args={[.12, .10, .13, 12]} /><meshStandardMaterial color={color} /></mesh>
  </group>
}

function Workstation({ seat, sector, ordinal, selected, pose, onSelect, preferences, avatars }: {
  seat: Seat; sector: OfficeLayout['sectors'][number]; ordinal: number; selected: boolean; pose: AgentPose; onSelect: () => void; preferences: OfficePreferences; avatars: RefObject<Map<string, Group>>
}) {
  const { agent, position } = seat
  const working = pose === 'thinking' || pose === 'coding' || pose === 'researching' || pose === 'finishing'
  const route = useMemo(() => makeWalkRoute(seat, sector, ordinal), [seat, sector, ordinal])
  const movement = useRef(createMovementState(route))
  useEffect(() => { movement.current = createMovementState(route) }, [route])
  const traveler = useRef<Group>(null)
  const walkRef = useRef(0)
  const seatedRef = useRef(0)
  const socialRef = useRef(false)
  useFrame((_, delta) => {
    if (!traveler.current) return
    const frame = advanceMovement(movement.current, route, delta, working, preferences.motion, ordinal)
    movement.current = frame
    const smoothing = Math.min(delta, .05)
    traveler.current.position.x = frame.position[0] - position[0]
    traveler.current.position.z = frame.position[1] - position[2]
    const turn = MathUtils.euclideanModulo(frame.facing - traveler.current.rotation.y + Math.PI, Math.PI * 2) - Math.PI
    traveler.current.rotation.y += MathUtils.clamp(turn, -smoothing * 5, smoothing * 5)
    walkRef.current = frame.walking ? 1 : 0
    seatedRef.current = frame.seated
    socialRef.current = Boolean(preferences.social && !working && frame.social && sector.count > 1)
  })
  return <group position={position}>
    <Desk color={agent.color} active={working} theme={preferences.theme} />
    <group ref={node => { traveler.current = node; if (node) avatars.current.set(agent.id, node); else avatars.current.delete(agent.id) }} position={[0, 0, STAND_Z]} rotation={[0, Math.PI, 0]}>
      <OfficeAvatar agent={agent} pose={pose} selected={selected} onSelect={onSelect} walkRef={walkRef} seatedRef={seatedRef} socialRef={socialRef}/>
    </group>
  </group>
}

function Studio({ selected, tasks, onSelect, now, overlayId, layout, visibleSeats, overview, preferences }: { selected: AgentId; tasks: OfficeTask[]; onSelect: (value: AgentId) => void; now: number; overlayId: string; layout: OfficeLayout; visibleSeats: Seat[]; overview: boolean; preferences: OfficePreferences }) {
  const { size } = useThree()
  const avatars = useRef(new Map<string, Group>())
  const center = layout.seats.find(seat => seat.agent.id === selected)?.position || layout.sectors[0]?.center || [0, 0, 0]
  const target: [number, number, number] = overview ? [layout.width / 2, 1, layout.depth / 2] : [center[0], 1, center[2]]
  // Use the actual canvas size so every room fits on screen as the campus grows.
  // Keep enough room for badges while framing small shared offices tightly.
  // Fixed oversized margins made 1-4 agent teams appear miniature.
  const campusWidth = layout.width * .78 + layout.depth * .63 + 5.5
  const campusHeight = layout.width * .42 + layout.depth * .47 + 4.5
  const overviewZoom = Math.max(.1, Math.min(size.width * .89 / campusWidth, size.height * .86 / campusHeight))
  const cameraKey = overview ? `campus-${layout.width}-${layout.depth}` : `agent-${selected}`
  return <>
    <color attach="background" args={[preferences.theme === 'midnight' ? '#111b2e' : preferences.theme === 'warm' ? '#efe6df' : '#edf5fa']} />
    <ambientLight intensity={1.3} color="#d8e7ff" />
    <hemisphereLight args={['#aac6eb', '#293852', 1.7]} />
    <directionalLight position={[7, 14, 12]} intensity={2.4} color="#f4ecdc" />
    <OfficeCampus layout={layout} preferences={preferences}/>
    {visibleSeats.map(seat => <Workstation key={seat.agent.id} seat={seat} sector={layout.sectors.find(sector => sector.id === seat.sector)!} ordinal={layout.seats.filter(item => item.sector === seat.sector).findIndex(item => item.agent.id === seat.agent.id)} selected={selected === seat.agent.id} pose={resolveAgentPose(selectAgentTask(tasks, seat.agent.id, now), now)} onSelect={() => onSelect(seat.agent.id)} preferences={preferences} avatars={avatars}/>)}
    <BadgeProjector overlayId={overlayId} seats={visibleSeats} sectors={layout.sectors} avatars={avatars}/>
    <OrthographicCamera key={cameraKey} makeDefault position={[target[0] + 15, target[1] + 17, target[2] + 19]} zoom={overview ? overviewZoom : 42} near={.1} far={Math.max(250, layout.width + layout.depth + 100)} />
    <OrbitControls key={cameraKey} target={target} minPolarAngle={.25} maxPolarAngle={1.46} enablePan enableDamping dampingFactor={.08} minZoom={overview ? Math.min(2, overviewZoom) : 12} maxZoom={165} />
  </>
}

export default function OfficeScene({ selected, tasks, onSelect, overview = false }: { selected: AgentId; tasks: OfficeTask[]; onSelect: (value: AgentId) => void; overview?: boolean }) {
  const { t: tr } = useLanguage()
  const agents = useAgents()
  const { preferences } = useOfficePreferences()
  const layout = useMemo(() => makeOfficeLayout(agents, preferences.spacing), [agents, preferences.spacing])
  // Keep nearby stations detailed at large team sizes; focus another agent to inspect their wing.
  const visibleSeats = useMemo(() => {
    if (layout.seats.length <= 50) return layout.seats
    const selectedSeat = layout.seats.find(seat => seat.agent.id === selected) || layout.seats[0]
    return [...layout.seats].sort((a, b) => {
      const dist = (seat: Seat) => (seat.position[0] - selectedSeat.position[0]) ** 2 + (seat.position[2] - selectedSeat.position[2]) ** 2
      return dist(a) - dist(b)
    }).slice(0, 50)
  }, [layout, selected])
  const overlayId = useId()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(Date.now()), 0)
    return () => window.clearTimeout(timeout)
  }, [tasks])
  useEffect(() => {
    const current = Date.now()
    const expiries = tasks.filter(task => ['completed', 'failed', 'interrupted'].includes(task.status))
      .map(task => Date.parse(task.finishedAt || '') + TERMINAL_POSE_MS)
      .filter(expiry => Number.isFinite(expiry) && expiry > current)
    if (!expiries.length) return
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.min(...expiries) - current + 25)
    return () => window.clearTimeout(timeout)
  }, [tasks, now])
  return <div className="office-3d-shell" data-office-theme={preferences.theme} data-office-motion={preferences.motion}>
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }} onPointerMissed={() => { }}>
      <Studio selected={selected} tasks={tasks} onSelect={onSelect} now={now} overlayId={overlayId} layout={layout} visibleSeats={visibleSeats} overview={overview} preferences={preferences}/>
    </Canvas>
    <div id={overlayId} className={`scene-phase-overlay${overview ? ' is-overview' : ''}`} aria-label={tr('Current phase')}>
      {visibleSeats.map(({ agent }) => {
        const task = selectAgentTask(tasks, agent.id, now)
        const pose = resolveAgentPose(task, now)
        const text = pose === 'celebrating' ? statusName.completed : pose === 'error' ? statusName[task?.status || 'failed'] : phaseName[pose]
        return <span key={agent.id} className={`scene-phase-label phase-${pose}${overview && pose === 'idle' ? ' overview-idle' : ''}`} data-agent={agent.id} data-pose={pose}>
          <i aria-hidden="true" />{tr(text)}
        </span>
      })}
      {layout.sectors.map(sector => <span key={sector.id} className="scene-sector-label" data-sector={sector.id}>
        <i style={{ background: preferences.sectorColors[sector.id] || DEPARTMENTS.find(dep => dep.id === sector.id)?.color }}/>{overview ? tr(DEPARTMENTS.find(dep => dep.id === sector.id)?.name || sector.id).split(/[ &]+/)[0] : tr(DEPARTMENTS.find(dep => dep.id === sector.id)?.name || sector.id)} · {sector.count}
      </span>)}
    </div>
  </div>
}
