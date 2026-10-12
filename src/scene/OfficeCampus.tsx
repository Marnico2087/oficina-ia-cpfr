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

function Panel({ x, z, w, h, color = '#5e87ab' }: { x: number; y: number; z: number; w: number; h: number; color?: string }) {
  // Compact freestanding team noticeboard, sized like office furniture rather
  // than a wall-sized monitor. Its legs make the prop physically plausible.
  const boardW = Math.min(w, 1.55), boardH = Math.min(h, .72)
  return <group position={[x, 1.65, z]}>
    {[-boardW * .36, boardW * .36].map(offset => <mesh key={offset} position={[offset, -.82, -.035]}>
      <boxGeometry args={[.06, 1.65, .07]}/><meshStandardMaterial color="#8a9cab" metalness={.32}/>
    </mesh>)}
    <RoundedBox args={[boardW, boardH, .075]} radius={.035}><meshStandardMaterial color="#ecf2f5" roughness={.84}/></RoundedBox>
    <mesh position={[0, .18, .041]}><planeGeometry args={[boardW * .89, .12]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>
    {Array.from({ length: 3 }, (_, i) => <mesh key={i} position={[-boardW * .15, .038 - i * .12, .041]}>
      <planeGeometry args={[boardW * (.54 + i * .07), .022]}/><meshBasicMaterial color="#889eaf"/>
    </mesh>)}
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
    {/* One continuous office floor, with subtle team-colored zoning only. */}
    <mesh position={[0, -.041, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width - .28, depth - .28]}/>
      <meshStandardMaterial color={palette.floor} transparent opacity={.18} roughness={.92} depthWrite={false}/>
    </mesh>
    <mesh position={[0, -.027, -depth / 2 + .27]}><boxGeometry args={[width - .55, .018, .13]}/><meshStandardMaterial color={accent} transparent opacity={.65}/></mesh>
    <pointLight position={[0, 3.7, 0]} intensity={depth > 13 ? 2.4 : 1.6} distance={Math.max(9, depth * .9)} color="#e8f4ff"/>
    <DepartmentProps id={id} width={width} depth={depth}/>
    <Planter x={width / 2 - .8} z={-depth / 2 + .75}/>
  </group>
}

function SharedLounge({ x, z, theme }: { x: number; z: number; theme: OfficePreferences['theme'] }) {
  const tabletop = theme === 'midnight' ? '#9e8a7d' : theme === 'warm' ? '#d3ab86' : '#d6c4ac'
  return <group position={[x, 0, z]}>
    {/* The meeting spot is outside all workstation routes and chair footprints. */}
    <RoundedBox position={[0, .72, 0]} args={[2.25, .13, .98]} radius={.11} castShadow>
      <meshStandardMaterial color={tabletop} roughness={.76}/>
    </RoundedBox>
    {[-.73, .73].map(x => <mesh key={x} position={[x, .36, 0]}>
      <cylinderGeometry args={[.055, .07, .68, 10]}/><meshStandardMaterial color="#748395" metalness={.5}/>
    </mesh>)}
    {[-1, 1].map(side => <group key={side} position={[side * 1.62, 0, 0]} rotation={[0, side * Math.PI / 2, 0]}>
      <RoundedBox position={[0, .47, 0]} args={[.7, .12, .72]} radius={.1} castShadow><meshStandardMaterial color="#758da3"/></RoundedBox>
      <RoundedBox position={[0, .78, .31]} args={[.75, .63, .11]} radius={.075} castShadow><meshStandardMaterial color="#7897ac"/></RoundedBox>
      <mesh position={[0, .23, 0]}><cylinderGeometry args={[.055, .08, .45, 8]}/><meshStandardMaterial color="#677a8b"/></mesh>
    </group>)}
    <mesh position={[0, .82, 0]}><cylinderGeometry args={[.16, .16, .055, 12]}/><meshStandardMaterial color="#f6f8f8"/></mesh>
  </group>
}

function CoffeePoint({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <RoundedBox position={[0, .53, 0]} args={[1.35, 1.06, .7]} radius={.07} castShadow>
      <meshStandardMaterial color="#8298a8" roughness={.76}/>
    </RoundedBox>
    <RoundedBox position={[0, 1.09, 0]} args={[1.48, .12, .8]} radius={.04} castShadow>
      <meshStandardMaterial color="#d6c2a8" roughness={.73}/>
    </RoundedBox>
    <RoundedBox position={[-.27, 1.25, -.12]} args={[.47, .28, .3]} radius={.035}>
      <meshStandardMaterial color="#2e455b" metalness={.25}/>
    </RoundedBox>
    <mesh position={[-.27, 1.38, .05]}><boxGeometry args={[.18, .025, .15]}/><meshStandardMaterial color="#b9d6df"/></mesh>
    <mesh position={[.37, 1.17, .04]}><cylinderGeometry args={[.1, .095, .13, 12]}/><meshStandardMaterial color="#f7f1e6"/></mesh>
  </group>
}

function FocusNook({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <RoundedBox position={[0, .48, -.15]} args={[1.35, .14, .76]} radius={.1} castShadow>
      <meshStandardMaterial color="#7088a3"/>
    </RoundedBox>
    <RoundedBox position={[0, .91, -.49]} args={[1.35, .82, .12]} radius={.1} castShadow>
      <meshStandardMaterial color="#6b829b"/>
    </RoundedBox>
    {[-.56, .56].map(side => <RoundedBox key={side} position={[side, .65, -.1]} args={[.13, .35, .83]} radius={.06}>
      <meshStandardMaterial color="#7088a3"/>
    </RoundedBox>)}
    <mesh position={[0, .13, -.2]}><boxGeometry args={[1.12, .22, .54]}/><meshStandardMaterial color="#53687f"/></mesh>
    <mesh position={[0, 1.46, -.55]}><boxGeometry args={[1.62, .075, .13]}/><meshStandardMaterial color="#b8d7e0" emissive="#6e99ad" emissiveIntensity={.14}/></mesh>
  </group>
}

// The glass facade sits on the far edges of the floor, away from the
// viewer-facing sides. It frames the office as a real corporate storey without
// obstructing agents or their circulation routes.
function GlassFacade({ width, depth, theme }: { width: number; depth: number; theme: OfficePreferences['theme'] }) {
  const dark = theme === 'midnight'
  const frame = dark ? '#6c849f' : '#a4b7ca'
  const glass = dark ? '#426d92' : '#a7d8ec'
  const backPanels = Math.max(1, Math.ceil(width / 3.6))
  const sidePanels = Math.max(1, Math.ceil(depth / 3.6))
  return <group>
    {Array.from({ length: backPanels }, (_, index) => {
      const widthPer = width / backPanels
      return <group key={`back-${index}`} position={[(index + .5) * widthPer, 0, -.38]}>
        <mesh position={[0, 1.62, 0]}><boxGeometry args={[widthPer - .1, 2.95, .07]}/><meshStandardMaterial color={glass} transparent opacity={.22} depthWrite={false} metalness={.13} roughness={.18}/></mesh>
        <mesh position={[-widthPer / 2, 1.65, .015]}><boxGeometry args={[.075, 3.25, .1]}/><meshStandardMaterial color={frame} metalness={.5}/></mesh>
        <mesh position={[0, 2.15, .02]}><boxGeometry args={[widthPer, .045, .09]}/><meshStandardMaterial color={frame} metalness={.45}/></mesh>
      </group>
    })}
    {Array.from({ length: sidePanels }, (_, index) => {
      const length = depth / sidePanels
      return <group key={`side-${index}`} position={[-.38, 0, (index + .5) * length]}>
        <mesh position={[0, 1.62, 0]}><boxGeometry args={[.07, 2.95, length - .1]}/><meshStandardMaterial color={glass} transparent opacity={.22} depthWrite={false} roughness={.18}/></mesh>
        <mesh position={[.015, 1.65, -length / 2]}><boxGeometry args={[.1, 3.25, .075]}/><meshStandardMaterial color={frame} metalness={.5}/></mesh>
      </group>
    })}
    <mesh position={[width / 2, 3.3, -.38]}><boxGeometry args={[width + .07, .14, .16]}/><meshStandardMaterial color={frame} metalness={.4}/></mesh>
    <mesh position={[-.38, 3.3, depth / 2]}><boxGeometry args={[.16, .14, depth + .07]}/><meshStandardMaterial color={frame} metalness={.4}/></mesh>
  </group>
}

export function OfficeCampus({ layout, preferences }: { layout: OfficeLayout; preferences: OfficePreferences }) {
  const palette = THEMES[preferences.theme]
  return <group>
    <mesh position={[layout.width / 2, -.46, layout.depth / 2]} receiveShadow><boxGeometry args={[layout.width + 2.2, .7, layout.depth + 1.8]}/><meshStandardMaterial color={palette.outer} roughness={.98}/></mesh>
    {/* One continuous ground plane connects every team bay into a shared studio. */}
    <mesh position={[layout.width / 2, -.13, layout.depth / 2]} receiveShadow><boxGeometry args={[layout.width + 1.8, .16, layout.depth + 1.5]}/><meshStandardMaterial color={palette.tile} roughness={.91}/></mesh>
    {layout.passages.map((passage, index) => <group key={index} position={[passage.x, -.1, passage.z]}>
      <RoundedBox args={[passage.width, .18, passage.depth]} radius={.07} receiveShadow><meshStandardMaterial color={palette.tile}/></RoundedBox>
      <mesh position={[0, .096, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[Math.max(.35, passage.width - .45), Math.max(.35, passage.depth - .45)]}/><meshStandardMaterial color={preferences.accent} transparent opacity={.16}/></mesh>
    </group>)}
    {layout.sectors.map(sector => <SectorRoom key={sector.id} sector={sector} preferences={preferences}/>)}
    {layout.amenities.map(amenity => amenity.id === 'meeting'
      ? <SharedLounge key={amenity.id} x={amenity.x} z={amenity.z} theme={preferences.theme}/>
      : amenity.id === 'coffee'
        ? <CoffeePoint key={amenity.id} x={amenity.x} z={amenity.z}/>
        : <FocusNook key={amenity.id} x={amenity.x} z={amenity.z}/>)}
    <GlassFacade width={layout.width} depth={layout.depth} theme={preferences.theme}/>
    <ambientLight intensity={.47} color="#e5efff"/>
  </group>
}
