import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils, Vector3 } from 'three'
import { type AgentId, type OfficeTask, type OfficeAgent } from '../types'
import { DEPARTMENTS, useAgents } from '../agents'
import { OfficeCampus } from './OfficeCampus'
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

function Avatar({ agent, pose, selected, onSelect, walkRef, seatedRef }: {
  agent: OfficeAgent; pose: AgentPose; selected: boolean; onSelect: () => void; walkRef: RefObject<number>; seatedRef: RefObject<number>
}) {
  const group = useRef<Group>(null)
  const upper = useRef<Group>(null)
  const head = useRef<Group>(null)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const legs = useRef<Group[]>([])
  const shins = useRef<Group[]>([])
  const halo = useRef<Mesh>(null)
  const working = pose !== 'idle' && pose !== 'celebrating' && pose !== 'error'
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const speed = Math.min(delta, .05)
    const coding = pose === 'coding'
    const research = pose === 'researching'
    const success = pose === 'celebrating'
    const failed = pose === 'error'
    const seated = seatedRef.current
    if (group.current) {
      group.current.position.y = MathUtils.damp(group.current.position.y, success && !seated ? Math.abs(Math.sin(t * 7)) * .055 : 0, 8, speed)
    }
    if (upper.current) {
      upper.current.position.y = -seated * .24 + (working && seated ? Math.sin(t * 1.8 + agent.name.length) * .009 : 0)
      upper.current.rotation.x = MathUtils.damp(upper.current.rotation.x, failed ? .12 : research ? -.06 : 0, 6, speed)
    }
    if (head.current) {
      head.current.rotation.z = MathUtils.damp(head.current.rotation.z, pose === 'thinking' ? -.19 + Math.sin(t * 1.1) * .04 : failed ? .18 : 0, 6, speed)
      head.current.rotation.x = MathUtils.damp(head.current.rotation.x, research ? -.2 + Math.sin(t * 2) * .07 : pose === 'finishing' ? Math.sin(t * 3) * .09 : 0, 6, speed)
    }
    if (left.current) {
      left.current.rotation.x = MathUtils.damp(left.current.rotation.x, seated ? -.15 + (coding ? Math.sin(t * 11) * .06 : 0) : success ? -2.2 : failed ? .25 : 0, 10, speed)
      left.current.rotation.z = MathUtils.damp(left.current.rotation.z, success ? -.45 : failed ? -.15 : 0, 8, speed)
      left.current.position.z = seated * .28
      left.current.children[0].position.y = -.22 + seated * .24
      left.current.children[1].position.y = -.38 + seated * .45
      left.current.children[1].position.z = .41 + seated * .24
    }
    if (right.current) {
      right.current.rotation.x = MathUtils.damp(right.current.rotation.x, seated ? -.15 + (coding ? Math.cos(t * 12) * .06 : 0) : success ? -2.2 : failed ? .25 : 0, 10, speed)
      right.current.rotation.z = MathUtils.damp(right.current.rotation.z, success ? .45 : failed ? .15 : 0, 8, speed)
      right.current.position.z = seated * .28
      right.current.children[0].position.y = -.22 + seated * .24
      right.current.children[1].position.y = -.38 + seated * .45
      right.current.children[1].position.z = .41 + seated * .24
    }
    legs.current.forEach((leg, index) => {
      if (leg) {
        leg.position.y = .85 - seated * .17
        leg.rotation.x = MathUtils.damp(leg.rotation.x, -seated * 1.4 + (1 - seated) * walkRef.current * Math.sin(t * 8.5 + index * Math.PI) * .42, 10, speed)
      }
      if (shins.current[index]) {
        shins.current[index].rotation.x = MathUtils.damp(shins.current[index].rotation.x, seated * 1.4, 10, speed)
        shins.current[index].children[1].position.y = -.36 - seated * .13
      }
    })
    if (halo.current) halo.current.rotation.z = t * .35
  })
  const color = agent.color
  return <group onClick={event => { event.stopPropagation(); onSelect() }}
    onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
    onPointerOut={() => { document.body.style.cursor = 'auto' }}>
    {selected && <mesh ref={halo} position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.66, .027, 8, 56]} /><meshBasicMaterial color={color} toneMapped={false} />
    </mesh>}
    <group ref={group}>
      {[-1, 1].map((side, index) => <group key={side} ref={node => { if (node) legs.current[index] = node }} position={[side * .16, .85, -.13]}>
        <mesh position={[0, -.20, 0]} castShadow><capsuleGeometry args={[.112, .23, 5, 8]}/><meshStandardMaterial color="#354961"/></mesh>
        <group ref={node => { if (node) shins.current[index] = node }} position={[0, -.42, 0]}>
          <mesh position={[0, -.18, 0]} castShadow><capsuleGeometry args={[.105, .20, 5, 8]}/><meshStandardMaterial color="#354961"/></mesh>
          <mesh position={[0, -.36, .12]} castShadow><boxGeometry args={[.24, .12, .38]}/><meshStandardMaterial color="#27364c"/></mesh>
        </group>
      </group>)}
      <group ref={upper}>
      <group position={[0, 1.0, -.15]}>
        <mesh castShadow><capsuleGeometry args={[.3, .28, 5, 10]} /><meshStandardMaterial color={color} roughness={.76} /></mesh>
        <mesh position={[0, -.16, .265]}><boxGeometry args={[.15, .12, .03]} /><meshStandardMaterial color="#d5e5ee" /></mesh>
      </group>
      {[-1, 1].map(side => <group key={side} ref={side === -1 ? left : right} position={[side * .34, 1.17, .0]}>
        <mesh position={[side * .1, -.22, .24]} rotation={[.85, 0, side * -.17]} castShadow>
          <capsuleGeometry args={[.105, .31, 5, 9]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[side * .16, -.38, .41]}><sphereGeometry args={[.105, 9, 7]} /><meshStandardMaterial color="#eac7a5" /></mesh>
      </group>)}
      <group ref={head} position={[0, 1.68, 0]}>
        <mesh castShadow><sphereGeometry args={[.285, 16, 12]} /><meshStandardMaterial color={agent.id === 'sentinel' ? '#b87e5d' : '#e8bfa0'} roughness={.75} /></mesh>
        <mesh position={[0, .15, -.035]} castShadow><sphereGeometry args={[.294, 16, 9, 0, Math.PI * 2, 0, Math.PI * .52]} /><meshStandardMaterial color={agent.id === 'nova' ? '#35475a' : agent.id === 'pixel' ? '#8b4b42' : '#25263b'} /></mesh>
        <mesh position={[.115, .02, .241]}><sphereGeometry args={[.021, 8, 6]} /><meshBasicMaterial color="#28344b" /></mesh>
        <mesh position={[-.115, .02, .241]}><sphereGeometry args={[.021, 8, 6]} /><meshBasicMaterial color="#28344b" /></mesh>
      </group>
      </group>
    </group>
  </group>
}

function PhaseEffects({ pose, color, seatedRef }: { pose: AgentPose; color: string; seatedRef: RefObject<number> }) {
  const orbit = useRef<Group>(null)
  const anchor = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (anchor.current) anchor.current.position.y = -seatedRef.current * .3
    if (!orbit.current) return
    orbit.current.rotation.y = clock.elapsedTime * (pose === 'celebrating' ? 2.8 : .8)
    orbit.current.position.y = Math.sin(clock.elapsedTime * 2.5) * .045
  })
  return <group ref={anchor}>
    {pose === 'thinking' && <group ref={orbit} position={[0, 1.93, 0]}>
      {[0, 1, 2].map(i => <mesh key={i} position={[Math.cos(i * Math.PI * 2 / 3) * .25, i * .1, Math.sin(i * Math.PI * 2 / 3) * .25]}>
        <sphereGeometry args={[.055 + i * .014, 10, 8]} /><meshBasicMaterial color="#f9d58a" toneMapped={false} />
      </mesh>)}
    </group>}
    {pose === 'coding' && <group position={[0, 2.04, 0]}>
      <mesh><boxGeometry args={[.53, .23, .04]}/><meshBasicMaterial color="#172b42" /></mesh>
      {[-.08, 0, .08].map((y, i) => <mesh key={i} position={[-.08 + i * .025, y, .026]}>
        <planeGeometry args={[.24 - i * .05, .024]}/><meshBasicMaterial color={i === 1 ? '#8df3c2' : '#5dc6e9'} />
      </mesh>)}
    </group>}
    {pose === 'researching' && <group position={[.46, 1.74, .1]} rotation={[0, -.3, -.1]}>
      <mesh><boxGeometry args={[.5, .57, .035]} /><meshBasicMaterial color="#263c60" /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[-.025, .17 - i * .11, .022]}>
        <planeGeometry args={[.32 - (i % 2) * .09, .025]} /><meshBasicMaterial color={i === 0 ? '#d7c6ff' : '#729cce'} />
      </mesh>)}
    </group>}
    {(pose === 'finishing' || pose === 'celebrating') && <group ref={orbit} position={[0, 1.9, 0]}>
      <mesh rotation={[Math.PI / 2.5, 0, 0]}><torusGeometry args={[.36, .022, 6, 32]} /><meshBasicMaterial color="#7df2bc" toneMapped={false} /></mesh>
      {(pose === 'celebrating' ? [0, 1, 2, 3, 4] : [0, 2]).map(i => <mesh key={i} position={[Math.cos(i * Math.PI * 2 / 5) * .45, Math.sin(i * Math.PI * 2 / 5) * .28, 0]}>
        <octahedronGeometry args={[.09, 0]}/><meshBasicMaterial color={i % 2 ? '#fbe28b' : color} toneMapped={false} />
      </mesh>)}
    </group>}
    {pose === 'error' && <group position={[0, 1.96, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.28, .035, 8, 32]}/><meshBasicMaterial color="#ff748d" toneMapped={false}/></mesh>
      <mesh position={[0, 0, .03]}><boxGeometry args={[.035, .2, .03]}/><meshBasicMaterial color="#ffafbb" /></mesh>
      <mesh position={[0, -.145, .03]}><sphereGeometry args={[.027, 8, 8]}/><meshBasicMaterial color="#ffafbb" /></mesh>
    </group>}
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
  const speech = useRef<Group>(null)
  const walkRef = useRef(0)
  const seatedRef = useRef(0)
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
    if (speech.current) speech.current.visible = Boolean(preferences.social && !working && frame.social && sector.count > 1)
  })
  return <group position={position}>
    <Desk color={agent.color} active={working} theme={preferences.theme} />
    <group ref={node => { traveler.current = node; if (node) avatars.current.set(agent.id, node); else avatars.current.delete(agent.id) }} position={[0, 0, STAND_Z]} rotation={[0, Math.PI, 0]}>
      <Avatar agent={agent} pose={pose} selected={selected} onSelect={onSelect} walkRef={walkRef} seatedRef={seatedRef}/>
      <PhaseEffects pose={pose} color={agent.color} seatedRef={seatedRef}/>
      <group ref={speech} visible={false} position={[0, 2.36, 0]}>
        <mesh><sphereGeometry args={[.26, 12, 9]}/><meshStandardMaterial color="#f9fdff" emissive="#badbf0" emissiveIntensity={.2}/></mesh>
        {[-.12, 0, .12].map(x => <mesh key={x} position={[x, 0, .25]}><sphereGeometry args={[.035, 8, 6]}/><meshBasicMaterial color={agent.color}/></mesh>)}
      </group>
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
    <OrbitControls key={cameraKey} target={target} minPolarAngle={.25} maxPolarAngle={1.46} enablePan enableDamping dampingFactor={.08} minZoom={overview ? Math.min(2, overviewZoom) : 12} maxZoom={75} />
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
