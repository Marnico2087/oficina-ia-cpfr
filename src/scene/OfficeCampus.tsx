import { RoundedBox } from '@react-three/drei'
import { DEPARTMENTS } from '../agents'
import type { Department } from '../types'
import type { OfficeLayout, Sector } from './officeLayout'
import type { OfficePreferences } from './officePreferences'

const THEMES = {
  daylight: { floor: '#e7edf3', tile: '#f7f9fc', wall: '#e9f0f7', outline: '#b7c9d8', frame: '#e5edf4', window: '#9dcae7', outer: '#dbe5ef', furniture: '#b9a493' },
  midnight: { floor: '#26364a', tile: '#304156', wall: '#182941', outline: '#6a8ca8', frame: '#16273d', window: '#6a98bd', outer: '#172538', furniture: '#a48b78' },
  warm: { floor: '#ecdfd2', tile: '#f8efe4', wall: '#f0e4d9', outline: '#d3b6a0', frame: '#e5d5c5', window: '#add5e5', outer: '#e8d8c8', furniture: '#b89980' },
} as const

function Planter({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, .25, 0]}><cylinderGeometry args={[.27, .18, .5, 8]}/><meshStandardMaterial color="#6d7888" roughness={.75}/></mesh>
    {[0, 1, 2, 3, 4, 5].map(i => <mesh key={i} position={[Math.sin(i * 2.4) * .23, .69 + i % 3 * .1, Math.cos(i * 2.4) * .2]} rotation={[.2 * i, 0, .15 * i]}>
      <sphereGeometry args={[.2, 7, 6]}/><meshStandardMaterial color={i % 2 ? '#51a98b' : '#4c826f'}/>
    </mesh>)}
  </group>
}

function Panel({ x, y, z, w, h, color = '#5e87ab' }: { x: number; y: number; z: number; w: number; h: number; color?: string }) {
  return <group position={[x, y, z]}>
    <RoundedBox args={[w, h, .09]} radius={.05}><meshStandardMaterial color="#18263b" metalness={.32}/></RoundedBox>
    <mesh position={[0, 0, .057]}><planeGeometry args={[w * .88, h * .78]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.18} roughness={.6}/></mesh>
    {Array.from({ length: 3 }, (_, i) => <mesh key={i} position={[-w * .2, h * .22 - i * h * .18, .065]}><boxGeometry args={[w * (.28 + i * .08), .027, .015]}/><meshBasicMaterial color="#d7e7f2"/></mesh>)}
  </group>
}

function Bookshelf({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, 1.05, 0]}><boxGeometry args={[1.5, 2.1, .48]}/><meshStandardMaterial color="#515369"/></mesh>
    {[0, 1, 2, 3].map(row => <group key={row} position={[0, .34 + row * .46, .27]}>
      <mesh><boxGeometry args={[1.41, .055, .1]}/><meshStandardMaterial color="#c1a484"/></mesh>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[-.58 + i * .19, .21, 0]}><boxGeometry args={[.13, .32 + (i % 3) * .038, .18]}/><meshStandardMaterial color={['#d2b18a', '#7aabaf', '#a6a1cc', '#6c829c'][i % 4]}/></mesh>)}
    </group>)}
  </group>
}

function DepartmentProps({ id, width, depth }: { id: Department; width: number; depth: number }) {
  const back = -depth / 2 + .42
  if (id === 'research') return <><Bookshelf x={-width / 2 + 1.35} z={back + 1}/><Bookshelf x={width / 2 - 1.45} z={back + 1}/><Panel x={0} y={2.12} z={back} w={2.25} h={1.1} color="#b3a3fa"/></>
  if (id === 'engineering') return <><group position={[width / 2 - .95, 0, back + 1]}>{[0, 1, 2].map(i => <mesh key={i} position={[0, .47 + i * .65, 0]}><boxGeometry args={[.92, .58, .56]}/><meshStandardMaterial color="#1a304c" emissive="#215374" emissiveIntensity={.22}/></mesh>)}{[0, 1, 2].map(i => <mesh key={i} position={[.3, .44 + i * .65, .32]}><sphereGeometry args={[.036, 8, 8]}/><meshBasicMaterial color="#5de0c8"/></mesh>)}</group><Panel x={0} y={2.12} z={back} w={2.3} h={1.25} color="#287fa5"/></>
  if (id === 'design') return <><group position={[width / 2 - 1.2, 0, back + 1]}><mesh position={[0, 1, 0]} rotation={[-.1, 0, 0]}><boxGeometry args={[1.13, 1.6, .08]}/><meshStandardMaterial color="#c7a594"/></mesh>{['#eea3a2', '#dbd18d', '#82bec5'].map((color, i) => <mesh key={color} position={[0, 1.5 - i * .45, .08]}><boxGeometry args={[.8, .32, .022]}/><meshStandardMaterial color={color}/></mesh>)}</group><Panel x={0} y={2.1} z={back} w={2.1} h={1.12} color="#bc8a87"/></>
  if (id === 'quality') return <><Panel x={0} y={2.15} z={back} w={2.7} h={1.24} color="#3f966f"/><group position={[width / 2 - 1.4, 0, back + .9]}>{[0, 1, 2].map(i => <mesh key={i} position={[0, .5 + i * .44, 0]}><boxGeometry args={[1.6, .25, .55]}/><meshStandardMaterial color={i === 2 ? '#779a89' : '#535e71'}/></mesh>)}</group></>
  if (id === 'architecture') return <><Panel x={0} y={2.1} z={back} w={3.4} h={1.5} color="#687fc0"/><mesh position={[width / 2 - 1.45, .79, back + .85]}><boxGeometry args={[1.7, 1.6, .08]}/><meshStandardMaterial color="#cfd7d8"/></mesh></>
  if (id === 'operations') return <><Panel x={-1.4} y={2.1} z={back} w={2.2} h={1.28} color="#c9aa53"/><Panel x={1.4} y={2.1} z={back} w={2.2} h={1.28} color="#6a96ad"/></>
  if (id === 'security') return <><Panel x={-1.5} y={2.15} z={back} w={2.3} h={1.25} color="#b7657f"/><Panel x={1.5} y={2.15} z={back} w={2.3} h={1.25} color="#5e8ba7"/><mesh position={[width / 2 - 1.1, .8, back + 1]}><boxGeometry args={[.85, 1.6, .65]}/><meshStandardMaterial color="#1c2a3e"/></mesh></>
  if (id === 'data') return <><Panel x={-1.4} y={2.1} z={back} w={2.25} h={1.32} color="#408da5"/><Panel x={1.4} y={2.1} z={back} w={2.25} h={1.32} color="#6397a7"/><Bookshelf x={width / 2 - 1.1} z={back + 1}/></>
  return <><Panel x={0} y={2.12} z={back} w={2.6} h={1.1} color="#758da9"/></>
}

function SectorRoom({ sector, preferences }: { sector: Sector; preferences: OfficePreferences }) {
  const { center: [cx, , cz], width, depth, id } = sector
  const accent = preferences.sectorColors[id] || DEPARTMENTS.find(dep => dep.id === id)?.color || '#9aacc0'
  const palette = THEMES[preferences.theme]
  return <group position={[cx, 0, cz]}>
    <RoundedBox args={[width, .29, depth]} radius={.13} position={[0, -.21, 0]} receiveShadow><meshStandardMaterial color={palette.floor} roughness={.91}/></RoundedBox>
    <mesh position={[0, -.049, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[width - .55, depth - .55]}/><meshStandardMaterial color={palette.tile} roughness={.93}/></mesh>
    <mesh position={[0, .014, -depth / 2 + .18]}><boxGeometry args={[width, .05, .26]}/><meshStandardMaterial color={preferences.accent} emissive={preferences.accent} emissiveIntensity={.08}/></mesh>
    <mesh position={[0, .01, depth / 2 - .4]}><boxGeometry args={[width - 2, .035, .18]}/><meshStandardMaterial color={accent}/></mesh>
    <mesh position={[0, 1.7, -depth / 2]}><boxGeometry args={[width, 3.55, .22]}/><meshStandardMaterial color={palette.wall}/></mesh>
    {[-1, 0, 1].map(i => <group key={i} position={[i * 3.35, 2.55, -depth / 2 + .15]}>
      <mesh><boxGeometry args={[2.75, 1.35, .038]}/><meshStandardMaterial color={palette.frame} emissive="#233e65" emissiveIntensity={.08}/></mesh>
      <mesh position={[0, 0, .035]}><boxGeometry args={[2.58, 1.2, .015]}/><meshStandardMaterial color={palette.window} transparent opacity={.28} metalness={.6}/></mesh>
      <mesh position={[0, 0, .06]}><boxGeometry args={[.045, 1.36, .03]}/><meshStandardMaterial color="#a5b9cc"/></mesh>
    </group>)}
    <mesh position={[-width / 2, 1.25, 0]}><boxGeometry args={[.1, 2.5, depth]}/><meshStandardMaterial color={palette.outline} transparent opacity={.26}/></mesh>
    <mesh position={[width / 2, 1.25, 0]}><boxGeometry args={[.1, 2.5, depth]}/><meshStandardMaterial color={palette.outline} transparent opacity={.26}/></mesh>
    <mesh position={[-width / 2 + 1.5, 2.05, depth / 2 - .05]}><boxGeometry args={[3, 1.3, .07]}/><meshStandardMaterial color="#7394ab" transparent opacity={.18}/></mesh>
    <mesh position={[width / 2 - 1.5, 2.05, depth / 2 - .05]}><boxGeometry args={[3, 1.3, .07]}/><meshStandardMaterial color="#7394ab" transparent opacity={.18}/></mesh>
    <mesh position={[0, 3.76, 0]}><boxGeometry args={[width * .62, .07, .21]}/><meshStandardMaterial color="#e6f5ff" emissive="#84c8e4" emissiveIntensity={1}/></mesh>
    <pointLight position={[0, 3.5, 0]} intensity={depth > 13 ? 8 : 5} distance={Math.max(9, depth * .9)} color="#c3e2ff"/>
    <DepartmentProps id={id} width={width} depth={depth}/>
    <Planter x={-width / 2 + .85} z={depth / 2 - .7}/><Planter x={width / 2 - .85} z={depth / 2 - .7}/>
  </group>
}

export function OfficeCampus({ layout, preferences }: { layout: OfficeLayout; preferences: OfficePreferences }) {
  const palette = THEMES[preferences.theme]
  return <group>
    <mesh position={[layout.width / 2, -.46, layout.depth / 2]} receiveShadow><boxGeometry args={[layout.width + 3, .4, layout.depth + 3]}/><meshStandardMaterial color={palette.outer} roughness={.98}/></mesh>
    {layout.passages.map((passage, index) => <group key={index} position={[passage.x, -.1, passage.z]}>
      <RoundedBox args={[passage.width, .18, passage.depth]} radius={.07} receiveShadow><meshStandardMaterial color={palette.tile}/></RoundedBox>
      <mesh position={[0, .096, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[Math.max(.35, passage.width - .45), Math.max(.35, passage.depth - .45)]}/><meshStandardMaterial color={preferences.accent} transparent opacity={.16}/></mesh>
    </group>)}
    {layout.sectors.map(sector => <SectorRoom key={sector.id} sector={sector} preferences={preferences}/>)}
    <ambientLight intensity={.32} color="#b2d3f5"/>
  </group>
}
