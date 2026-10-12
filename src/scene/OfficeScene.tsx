import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, OrthographicCamera, RoundedBox, Stars } from '@react-three/drei'
import { useEffect, useId, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils, Vector3 } from 'three'
import { AGENTS, type AgentId, type OfficeTask, type OfficeAgent } from '../types'
import { useLanguage } from '../locales/i18n'
import { phaseName, statusName } from '../components/taskDisplay'
import { resolveAgentPose, selectAgentTask, TERMINAL_POSE_MS, type AgentPose } from './agentBehavior'

const desks: Record<AgentId, [number, number, number]> = {
  atlas: [-3.65, 0, -1.65], nova: [0.95, 0, -1.65],
  pixel: [-3.65, 0, 2.05], sentinel: [0.95, 0, 2.05],
}

// Project world positions to the existing React DOM layer without creating
// separate React roots inside Three.js (which can race during unmount).
function BadgeProjector({ overlayId }: { overlayId: string }) {
  const point = useRef(new Vector3())
  const labels = useRef<Partial<Record<AgentId, HTMLSpanElement | null>>>({})
  useEffect(() => {
    const overlay = document.getElementById(overlayId)
    for (const agent of AGENTS) {
      labels.current[agent.id] = overlay?.querySelector<HTMLSpanElement>(`[data-agent="${agent.id}"]`) || null
    }
    return () => { labels.current = {} }
  }, [overlayId])
  useFrame(({ camera, size }) => {
    for (const agent of AGENTS) {
      const label = labels.current[agent.id]
      if (!label) continue
      const desk = desks[agent.id]
      point.current.set(desk[0], desk[1] + 2.48, desk[2] + 1.06).project(camera)
      label.style.left = `${(point.current.x + 1) * size.width / 2}px`
      label.style.top = `${(1 - point.current.y) * size.height / 2}px`
      label.style.visibility = Math.abs(point.current.x) > 1 || Math.abs(point.current.y) > 1 || point.current.z > 1 ? 'hidden' : 'visible'
    }
  })
  return null
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, .28, 0]} castShadow><cylinderGeometry args={[.29, .2, .56, 8]} /><meshStandardMaterial color="#5a596a" roughness={.75} /></mesh>
    <mesh position={[0, .61, 0]}><cylinderGeometry args={[.035, .05, .65, 6]} /><meshStandardMaterial color="#437369" /></mesh>
    {Array.from({ length: 8 }, (_, i) => {
      const a = i * Math.PI / 4
      return <mesh key={i} position={[Math.cos(a) * .25, .85 + (i % 3) * .1, Math.sin(a) * .25]} rotation={[Math.sin(a) * .25, 0, -Math.cos(a) * .6]} castShadow>
        <sphereGeometry args={[.16, 8, 7]} /><meshStandardMaterial color={i % 2 ? '#408c83' : '#6aab8e'} roughness={.9} />
      </mesh>
    })}
  </group>
}

function CeilingLight({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <mesh castShadow><boxGeometry args={[2.3, .1, .28]} /><meshStandardMaterial color="#d2e5ee" emissive="#71c8f1" emissiveIntensity={.8} /></mesh>
    <pointLight intensity={12} color="#84b9ff" distance={6} decay={2} />
  </group>
}

function Room() {
  return <group>
    <RoundedBox args={[13.8, .36, 9.6]} radius={.2} position={[-.2, -.26, -.1]} receiveShadow>
      <meshStandardMaterial color="#202c43" roughness={.9} />
    </RoundedBox>
    {Array.from({ length: 12 }, (_, x) => Array.from({ length: 8 }, (_, z) => (
      <mesh key={`${x}-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[-6.25 + x * 1.1, -.069, -4.15 + z * 1.12]} receiveShadow>
        <planeGeometry args={[1.07, 1.09]} />
        <meshStandardMaterial color={(x + z) % 3 === 0 ? '#27364d' : '#243047'} roughness={.94} />
      </mesh>
    )))}
    <mesh position={[-.2, 1.8, -4.83]} receiveShadow><boxGeometry args={[13.9, 3.8, .23]} /><meshStandardMaterial color="#1a2b44" roughness={.8} /></mesh>
    <mesh position={[-7.03, 1.8, -.1]} receiveShadow><boxGeometry args={[.22, 3.8, 9.6]} /><meshStandardMaterial color="#1b2940" /></mesh>
    <mesh position={[-.2, 3.68, -4.79]}><boxGeometry args={[13.8, .14, .25]} /><meshStandardMaterial color="#45536a" metalness={.4} /></mesh>

    {/* Windows, stylized evening city skyline. */}
    {[-4.25, -.1, 4].map((x, i) => <group key={x} position={[x, 2.25, -4.69]}>
      <mesh><boxGeometry args={[3.4, 2.12, .13]} /><meshStandardMaterial color="#0b1a36" emissive="#0d2851" emissiveIntensity={.45} /></mesh>
      <mesh position={[0, 0, .075]}><boxGeometry args={[3.18, 1.94, .009]} /><meshStandardMaterial color="#284565" transparent opacity={.47} roughness={.25} metalness={.6} /></mesh>
      {[-1.02, -.22, .55, 1.1].map((dx, ix) => <mesh key={dx} position={[dx, -.72, .11]}>
        <boxGeometry args={[.39 + (ix % 2) * .15, .65 + ((ix + i) % 3) * .24, .04]} />
        <meshStandardMaterial color="#172743" emissive="#152e4e" emissiveIntensity={.5} />
      </mesh>)}
      <mesh position={[0, 0, .16]}><boxGeometry args={[.065, 2.1, .09]} /><meshStandardMaterial color="#5a708d" metalness={.6} /></mesh>
      <mesh position={[0, 0, .16]}><boxGeometry args={[3.42, .055, .09]} /><meshStandardMaterial color="#5a708d" metalness={.6} /></mesh>
      {[-1.74, 1.74].map(edge => <mesh key={edge} position={[edge, 0, .16]}><boxGeometry args={[.08, 2.2, .1]} /><meshStandardMaterial color="#5a708d" /></mesh>)}
    </group>)}

    <RoundedBox position={[-1.36, -.047, .14]} args={[8.7, .032, 7.25]} radius={.25} receiveShadow>
      <meshStandardMaterial color="#304055" roughness={1} />
    </RoundedBox>
    <mesh position={[-1.35, -.026, .15]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[8.4, 6.96]} /><meshStandardMaterial color="#293a50" roughness={1} />
    </mesh>

    {/* Feature wall signage. */}
    <group position={[-6.85, 2.6, -1]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[2.65, 1.2, .08]} radius={.06}><meshStandardMaterial color="#101b30" emissive="#23365b" emissiveIntensity={.2} /></RoundedBox>
      <mesh position={[0, .2, .056]}><boxGeometry args={[1.85, .085, .012]}/><meshStandardMaterial color="#a8a1fa" emissive="#a8a1fa" emissiveIntensity={.45}/></mesh>
      <mesh position={[0, -.18, .056]}><boxGeometry args={[1.15, .05, .012]}/><meshStandardMaterial color="#78dad2" emissive="#78dad2" emissiveIntensity={.35}/></mesh>
    </group>

    <CeilingLight position={[-3.3, 3.75, -.5]} />
    <CeilingLight position={[2.2, 3.75, -.5]} />
    <Plant position={[-6.17, 0, -3.85]} />
    <Plant position={[5.5, 0, -3.9]} scale={1.25} />
    <Plant position={[5.95, 0, 3.65]} scale={.85} />

    {/* Coffee & lounge corner. */}
    <group position={[4.55, 0, 1.05]}>
      <RoundedBox args={[1.8, .16, 1.1]} radius={.1} position={[0, .62, 0]} castShadow><meshStandardMaterial color="#9a7b67" /></RoundedBox>
      {[-.68, .68].map(x => [-.37, .37].map(z => <mesh key={`${x}-${z}`} position={[x, .31, z]}><boxGeometry args={[.1, .6, .1]} /><meshStandardMaterial color="#323b51" /></mesh>))}
      <mesh position={[-.45, .77, -.1]}><cylinderGeometry args={[.12, .13, .15, 12]} /><meshStandardMaterial color="#e4c7a8" /></mesh>
      <mesh position={[.25, .8, 0]}><boxGeometry args={[.42, .17, .32]} /><meshStandardMaterial color="#4ec9cc" emissive="#137a85" emissiveIntensity={.2} /></mesh>
    </group>
    <group position={[4.65, 0, 3.5]}>
      <RoundedBox args={[2.25, .5, .95]} radius={.18} position={[0, .47, 0]} castShadow><meshStandardMaterial color="#475c79" /></RoundedBox>
      <RoundedBox args={[2.25, .8, .2]} radius={.08} position={[0, .95, -.42]}><meshStandardMaterial color="#506984" /></RoundedBox>
      {[-.84, .84].map(x => <mesh key={x} position={[x, .92, .0]}><boxGeometry args={[.35, .3, .65]} /><meshStandardMaterial color="#7791a6" /></mesh>)}
    </group>
    <ContactShadows position={[0, -.062, 0]} opacity={.38} scale={16} blur={2.8} far={7} color="#070c1b" />
  </group>
}

function Desk({ color, active }: { color: string; active: boolean }) {
  const monitor = useRef<Mesh>(null)
  useFrame(state => {
    if (monitor.current) (monitor.current.material as { emissiveIntensity?: number }).emissiveIntensity = active ? .33 + Math.sin(state.clock.elapsedTime * 2.7) * .14 : .08
  })
  return <group>
    <RoundedBox position={[0, .95, -.22]} args={[2.5, .16, 1.32]} radius={.065} castShadow receiveShadow><meshStandardMaterial color="#a48b78" roughness={.72} /></RoundedBox>
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

function Avatar({ agent, pose, selected, onSelect }: {
  agent: OfficeAgent; pose: AgentPose; selected: boolean; onSelect: () => void
}) {
  const group = useRef<Group>(null)
  const head = useRef<Group>(null)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const halo = useRef<Mesh>(null)
  const working = pose !== 'idle' && pose !== 'celebrating' && pose !== 'error'
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const speed = Math.min(delta, .05)
    const coding = pose === 'coding'
    const research = pose === 'researching'
    const success = pose === 'celebrating'
    const failed = pose === 'error'
    if (group.current) {
      const bounce = success ? Math.abs(Math.sin(t * 7)) * .12 : working ? Math.sin(t * 1.8 + agent.name.length) * .025 : 0
      group.current.position.y = MathUtils.damp(group.current.position.y, bounce, 8, speed)
      group.current.rotation.x = MathUtils.damp(group.current.rotation.x, failed ? .22 : research ? -.09 : 0, 6, speed)
    }
    if (head.current) {
      head.current.rotation.z = MathUtils.damp(head.current.rotation.z, pose === 'thinking' ? -.19 + Math.sin(t * 1.1) * .04 : failed ? .18 : 0, 6, speed)
      head.current.rotation.x = MathUtils.damp(head.current.rotation.x, research ? -.2 + Math.sin(t * 2) * .07 : pose === 'finishing' ? Math.sin(t * 3) * .09 : 0, 6, speed)
    }
    if (left.current) {
      left.current.rotation.x = MathUtils.damp(left.current.rotation.x, coding ? Math.sin(t * 11) * .23 : research ? -.55 : pose === 'thinking' ? -.32 : success ? -2.7 : failed ? .25 : 0, 10, speed)
      left.current.rotation.z = MathUtils.damp(left.current.rotation.z, success ? -.45 : failed ? -.15 : 0, 8, speed)
    }
    if (right.current) {
      right.current.rotation.x = MathUtils.damp(right.current.rotation.x, coding ? Math.cos(t * 12) * .25 : research ? -.32 : success ? -2.7 : failed ? .25 : 0, 10, speed)
      right.current.rotation.z = MathUtils.damp(right.current.rotation.z, success ? .45 : failed ? .15 : 0, 8, speed)
    }
    if (halo.current) halo.current.rotation.z = t * .35
  })
  const color = agent.color
  return <group position={[0, 0, 1.06]} onClick={event => { event.stopPropagation(); onSelect() }}
    onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
    onPointerOut={() => { document.body.style.cursor = 'auto' }}>
    {selected && <mesh ref={halo} position={[0, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.66, .027, 8, 56]} /><meshBasicMaterial color={color} toneMapped={false} />
    </mesh>}
    <group ref={group}>
      <group position={[0, .33, -.08]}>
        <mesh castShadow><boxGeometry args={[.68, .09, .75]} /><meshStandardMaterial color="#45536e" /></mesh>
        <mesh position={[0, .43, .3]} castShadow><boxGeometry args={[.69, .84, .12]} /><meshStandardMaterial color="#45536e" /></mesh>
        <mesh position={[0, -.17, 0]}><cylinderGeometry args={[.07, .07, .31, 8]} /><meshStandardMaterial color="#66758a" /></mesh>
      </group>
      <group position={[0, .72, -.15]}>
        <mesh castShadow><capsuleGeometry args={[.3, .28, 5, 10]} /><meshStandardMaterial color={color} roughness={.76} /></mesh>
        <mesh position={[0, -.16, .265]}><boxGeometry args={[.15, .12, .03]} /><meshStandardMaterial color="#d5e5ee" /></mesh>
      </group>
      {[-.23, .23].map(x => <mesh key={x} position={[x, .41, .31]} rotation={[.4, 0, 0]} castShadow>
        <capsuleGeometry args={[.095, .35, 4, 8]} /><meshStandardMaterial color="#253349" /></mesh>)}
      {[-1, 1].map(side => <group key={side} ref={side === -1 ? left : right} position={[side * .34, .85, .0]}>
        <mesh position={[side * .1, -.22, .24]} rotation={[.85, 0, side * -.17]} castShadow>
          <capsuleGeometry args={[.105, .31, 5, 9]} /><meshStandardMaterial color={color} /></mesh>
        <mesh position={[side * .16, -.38, .41]}><sphereGeometry args={[.105, 9, 7]} /><meshStandardMaterial color="#eac7a5" /></mesh>
      </group>)}
      <group ref={head} position={[0, 1.39, 0]}>
        <mesh castShadow><sphereGeometry args={[.285, 16, 12]} /><meshStandardMaterial color={agent.id === 'sentinel' ? '#b87e5d' : '#e8bfa0'} roughness={.75} /></mesh>
        <mesh position={[0, .15, -.035]} castShadow><sphereGeometry args={[.294, 16, 9, 0, Math.PI * 2, 0, Math.PI * .52]} /><meshStandardMaterial color={agent.id === 'nova' ? '#35475a' : agent.id === 'pixel' ? '#8b4b42' : '#25263b'} /></mesh>
        <mesh position={[.115, .02, .241]}><sphereGeometry args={[.021, 8, 6]} /><meshBasicMaterial color="#28344b" /></mesh>
        <mesh position={[-.115, .02, .241]}><sphereGeometry args={[.021, 8, 6]} /><meshBasicMaterial color="#28344b" /></mesh>
      </group>
    </group>
  </group>
}

function PhaseEffects({ pose, color }: { pose: AgentPose; color: string }) {
  const orbit = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!orbit.current) return
    orbit.current.rotation.y = clock.elapsedTime * (pose === 'celebrating' ? 2.8 : .8)
    orbit.current.position.y = Math.sin(clock.elapsedTime * 2.5) * .045
  })
  return <group position={[0, 0, 1.06]}>
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

function Workstation({ agent, selected, pose, onSelect }: { agent: OfficeAgent; selected: boolean; pose: AgentPose; onSelect: () => void }) {
  const working = pose === 'thinking' || pose === 'coding' || pose === 'researching' || pose === 'finishing'
  return <group position={desks[agent.id]}>
    <Desk color={agent.color} active={working} />
    <Avatar agent={agent} pose={pose} selected={selected} onSelect={onSelect} />
    <PhaseEffects pose={pose} color={agent.color} />
  </group>
}

function Studio({ selected, tasks, onSelect, now, overlayId }: { selected: AgentId; tasks: OfficeTask[]; onSelect: (value: AgentId) => void; now: number; overlayId: string }) {
  return <>
    <color attach="background" args={['#111b2e']} />
    <fog attach="fog" args={['#111b2e', 19, 36]} />
    <ambientLight intensity={1.6} color="#d8e7ff" />
    <hemisphereLight args={['#9abce7', '#293852', 1.9]} />
    <directionalLight castShadow position={[4, 9, 7]} intensity={2.3} color="#f5e7d8" shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
    <pointLight position={[-5, 3, 2]} intensity={18} color="#8b9efc" distance={9} decay={2} />
    <Stars radius={55} depth={10} count={85} factor={1.6} fade speed={.25} />
    <Room />
    {AGENTS.map(agent => <Workstation key={agent.id} agent={agent} selected={selected === agent.id} pose={resolveAgentPose(selectAgentTask(tasks, agent.id, now), now)} onSelect={() => onSelect(agent.id)} />)}
    <BadgeProjector overlayId={overlayId} />
    <OrthographicCamera makeDefault position={[16, 16.2, 19]} zoom={47} near={.1} far={100} />
    <OrbitControls target={[-.1, 1, -.2]} minPolarAngle={.38} maxPolarAngle={1.38} minAzimuthAngle={-.5} maxAzimuthAngle={1.9} enablePan={false} enableDamping dampingFactor={.08} minZoom={30} maxZoom={78} />
  </>
}

export default function OfficeScene({ selected, tasks, onSelect }: { selected: AgentId; tasks: OfficeTask[]; onSelect: (value: AgentId) => void }) {
  const { t: tr } = useLanguage()
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
  return <div className="office-3d-shell">
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }} onPointerMissed={() => { }}>
      <Studio selected={selected} tasks={tasks} onSelect={onSelect} now={now} overlayId={overlayId} />
    </Canvas>
    <div id={overlayId} className="scene-phase-overlay" aria-label={tr('Current phase')}>
      {AGENTS.map(agent => {
        const task = selectAgentTask(tasks, agent.id, now)
        const pose = resolveAgentPose(task, now)
        const text = pose === 'celebrating' ? statusName.completed : pose === 'error' ? statusName[task?.status || 'failed'] : phaseName[pose]
        return <span key={agent.id} className={`scene-phase-label phase-${pose}`} data-agent={agent.id} data-pose={pose}>
          <i aria-hidden="true" />{tr(text)}
        </span>
      })}
    </div>
  </div>
}
