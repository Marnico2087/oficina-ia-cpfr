import { useLayoutEffect, useRef } from 'react'
import { Color, Object3D, type InstancedMesh } from 'three'
import type { Seat } from './officeLayout'
import { CHAIR_Z, STAND_SIDE_X, STAND_Z } from './officeMotion'
import type { OfficePreferences } from './officePreferences'

// Distant departments keep all their desks and people. Only the nearest fifty
// workstations use the expensive articulated character rig; this batch uses
// five GPU instancing calls regardless of the number of other agents.
export function OfficeCrowdLOD({ seats, theme, working, onSelect }: {
  seats: Seat[]
  theme: OfficePreferences['theme']
  working: ReadonlySet<string>
  onSelect: (agentId: string) => void
}) {
  const tabletops = useRef<InstancedMesh>(null)
  const deskLegs = useRef<InstancedMesh>(null)
  const chairs = useRef<InstancedMesh>(null)
  const chairBacks = useRef<InstancedMesh>(null)
  const monitors = useRef<InstancedMesh>(null)
  const torsos = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const hair = useRef<InstancedMesh>(null)
  const arms = useRef<InstancedMesh>(null)
  const legs = useRef<InstancedMesh>(null)
  const shoes = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const temp = new Object3D()
    for (const [index, seat] of seats.entries()) {
      const [x, , z] = seat.position
      const put = (mesh: InstancedMesh | null, px: number, py: number, pz: number,
        targetIndex = index, scale: [number, number, number] = [1, 1, 1], angle = 0) => {
        if (!mesh) return
        temp.position.set(px, py, pz)
        temp.rotation.set(angle, 0, 0)
        temp.scale.set(...scale)
        temp.updateMatrix()
        mesh.setMatrixAt(targetIndex, temp.matrix)
      }
      const atDesk = working.has(seat.agent.id)
      const personX = x + (atDesk ? 0 : STAND_SIDE_X)
      const personZ = z + (atDesk ? CHAIR_Z + .04 : STAND_Z)
      const headY = atDesk ? 1.72 : 1.84
      put(tabletops.current, x, .95, z - .22)
      put(chairs.current, x, .65, z + CHAIR_Z)
      put(chairBacks.current, x, 1.05, z + CHAIR_Z + .43)
      put(monitors.current, x, 1.58, z - .64)
      for (const [corner, dx, dz] of [[0, -1.04, -.66], [1, 1.04, -.66],
        [2, -1.04, .25], [3, 1.04, .25]]) {
        put(deskLegs.current, x + dx, .48, z + dz, index * 4 + corner)
      }
      put(torsos.current, personX, atDesk ? 1.14 : 1.24, personZ)
      put(heads.current, personX, headY, personZ)
      put(hair.current, personX, headY + .15, personZ - .012, index, [1, .47, 1])
      for (const side of [-1, 1]) {
        const limb = index * 2 + (side === 1 ? 1 : 0)
        put(arms.current, personX + side * .365, atDesk ? 1.06 : 1.17,
          personZ - (atDesk ? .24 : 0), limb, [1, 1, 1], atDesk ? -.65 : 0)
        put(legs.current, personX + side * .16, atDesk ? .43 : .53,
          personZ - (atDesk ? .27 : 0), limb, [1, atDesk ? .74 : 1, 1], atDesk ? .18 : 0)
        put(shoes.current, personX + side * .16, .10, personZ - (atDesk ? .44 : -.09), limb)
      }
      torsos.current?.setColorAt(index, new Color(seat.agent.color))
    }
    for (const mesh of [tabletops.current, deskLegs.current, chairs.current, chairBacks.current,
      monitors.current, torsos.current, heads.current, hair.current, arms.current, legs.current, shoes.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [seats, working])

  if (!seats.length) return null
  const select = (event: { instanceId?: number; stopPropagation: () => void }) => {
    if (event.instanceId === undefined) return
    event.stopPropagation()
    const agent = seats[event.instanceId]?.agent
    if (agent) onSelect(agent.id)
  }
  return <group>
    <instancedMesh ref={tabletops} args={[undefined, undefined, seats.length]} receiveShadow>
      <boxGeometry args={[2.5, .16, 1.32]}/>
      <meshStandardMaterial color={theme === 'midnight' ? '#b8a28f' : '#e3e9f1'} roughness={.74}/>
    </instancedMesh>
    <instancedMesh ref={deskLegs} args={[undefined, undefined, seats.length * 4]}>
      <boxGeometry args={[.09, .92, .09]}/><meshStandardMaterial color="#596d83" metalness={.35}/>
    </instancedMesh>
    <instancedMesh ref={chairs} args={[undefined, undefined, seats.length]}>
      <boxGeometry args={[.8, .13, .82]}/><meshStandardMaterial color="#526b85"/>
    </instancedMesh>
    <instancedMesh ref={chairBacks} args={[undefined, undefined, seats.length]}>
      <boxGeometry args={[.86, .76, .13]}/><meshStandardMaterial color="#526b85"/>
    </instancedMesh>
    <instancedMesh ref={monitors} args={[undefined, undefined, seats.length]}>
      <boxGeometry args={[1.4, .87, .08]}/><meshStandardMaterial color="#25374c"/>
    </instancedMesh>
    <instancedMesh ref={torsos} args={[undefined, undefined, seats.length]} onClick={select}>
      <capsuleGeometry args={[.29, .44, 4, 8]}/><meshStandardMaterial roughness={.86}/>
    </instancedMesh>
    <instancedMesh ref={heads} args={[undefined, undefined, seats.length]} onClick={select}>
      <sphereGeometry args={[.255, 10, 8]}/><meshStandardMaterial color="#dbad8c" roughness={.86}/>
    </instancedMesh>
    <instancedMesh ref={hair} args={[undefined, undefined, seats.length]}>
      <sphereGeometry args={[.262, 12, 9]}/><meshStandardMaterial color="#354359" roughness={.9}/>
    </instancedMesh>
    <instancedMesh ref={arms} args={[undefined, undefined, seats.length * 2]}>
      <capsuleGeometry args={[.09, .24, 4, 7]}/><meshStandardMaterial color="#cfaa91" roughness={.85}/>
    </instancedMesh>
    <instancedMesh ref={legs} args={[undefined, undefined, seats.length * 2]}>
      <capsuleGeometry args={[.125, .53, 4, 7]}/><meshStandardMaterial color="#273a55" roughness={.84}/>
    </instancedMesh>
    <instancedMesh ref={shoes} args={[undefined, undefined, seats.length * 2]}>
      <boxGeometry args={[.3, .19, .38]}/><meshStandardMaterial color="#233248" roughness={.9}/>
    </instancedMesh>
  </group>
}
