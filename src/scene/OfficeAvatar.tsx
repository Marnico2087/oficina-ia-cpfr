import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import { MathUtils, Vector3, type Group, type Mesh } from 'three'
import type { OfficeAgent } from '../types'
import type { AgentPose } from './agentBehavior'
import { makeAvatarRigPose, type RigPoint } from './avatarRig'

const UP = new Vector3(0, 1, 0)

// Every animated limb is a continuous joint-to-joint bone. Connecting the
// segments to the same elbow/knee coordinates prevents floating hands and gaps.
function fitBone(mesh: Mesh | undefined, start: RigPoint, end: RigPoint) {
  if (!mesh) return
  const a = new Vector3(...start)
  const direction = new Vector3(...end).sub(a)
  const length = direction.length()
  mesh.position.copy(a.addScaledVector(direction, .5))
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize())
  mesh.scale.y = length
}

export function OfficeAvatar({ agent, pose, selected, onSelect, walkRef, gaitRef, seatedRef, socialRef }: {
  agent: OfficeAgent; pose: AgentPose; selected: boolean; onSelect: () => void
  walkRef: RefObject<number>; gaitRef: RefObject<number>; seatedRef: RefObject<number>; socialRef: RefObject<boolean>
}) {
  const model = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const head = useRef<Group>(null)
  const upperArms = useRef<Mesh[]>([])
  const lowerArms = useRef<Mesh[]>([])
  const hands = useRef<Group[]>([])
  const elbows = useRef<Mesh[]>([])
  const thighs = useRef<Mesh[]>([])
  const shins = useRef<Mesh[]>([])
  const knees = useRef<Mesh[]>([])
  const shoes = useRef<Mesh[]>([])
  const halo = useRef<Mesh>(null)
  const socialBlend = useRef(0)
  const thinkingBlend = useRef(0)
  const walkBlend = useRef(0)
  const skin = agent.id === 'sentinel' ? '#c48c70' : agent.id === 'pixel' ? '#efc8ab' : '#dbad8c'
  const hair = agent.id === 'nova' ? '#2b4058' : agent.id === 'pixel' ? '#894f47' : agent.id === 'sentinel' ? '#41332f' : '#282b43'

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    socialBlend.current = MathUtils.damp(socialBlend.current, socialRef.current ? 1 : 0, 5, Math.min(delta, .05))
    thinkingBlend.current = MathUtils.damp(thinkingBlend.current, pose === 'thinking' ? 1 : 0, 4, Math.min(delta, .05))
    walkBlend.current = MathUtils.damp(walkBlend.current, walkRef.current, 8, Math.min(delta, .05))
    const rig = makeAvatarRigPose(seatedRef.current, walkBlend.current, t, pose, socialBlend.current, thinkingBlend.current, gaitRef.current)
    if (model.current) model.current.position.y = rig.bob + (pose === 'celebrating' && seatedRef.current < .01 ? Math.abs(Math.sin(t * 5)) * .035 : 0)
    if (torso.current) {
      torso.current.position.y = -rig.torsoDrop
      torso.current.rotation.x = MathUtils.damp(torso.current.rotation.x, pose === 'error' ? .1 : 0, 7, Math.min(delta, .05))
    }
    if (head.current) {
      head.current.rotation.x = MathUtils.damp(head.current.rotation.x, rig.headPitch, 7, Math.min(delta, .05))
      head.current.rotation.z = MathUtils.damp(head.current.rotation.z, rig.headRoll, 7, Math.min(delta, .05))
    }
    rig.arms.forEach((arm, index) => {
      fitBone(upperArms.current[index], arm.shoulder, arm.elbow)
      fitBone(lowerArms.current[index], arm.elbow, arm.wrist)
      if (elbows.current[index]) elbows.current[index].position.set(...arm.elbow)
      if (hands.current[index]) hands.current[index].position.set(...arm.wrist)
    })
    rig.legs.forEach((leg, index) => {
      fitBone(thighs.current[index], leg.hip, leg.knee)
      fitBone(shins.current[index], leg.knee, leg.ankle)
      if (knees.current[index]) knees.current[index].position.set(...leg.knee)
      if (shoes.current[index]) {
        shoes.current[index].position.set(...leg.foot)
        shoes.current[index].rotation.x = rig.shoePitch[index]
      }
    })
    if (halo.current) halo.current.rotation.z = t * .3
  })

  return <group onClick={event => { event.stopPropagation(); onSelect() }}
    onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
    onPointerOut={() => { document.body.style.cursor = 'auto' }}>
    {selected && <mesh ref={halo} position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.57, .028, 8, 48]}/><meshBasicMaterial color={agent.color} toneMapped={false}/>
    </mesh>}
    <group ref={model}>
      <group ref={torso}>
        <RoundedBox position={[0, 1.155, -.045]} args={[.7, .70, .48]} radius={.21} castShadow>
          <meshStandardMaterial color={agent.color} roughness={.88}/>
        </RoundedBox>
        <RoundedBox position={[0, .825, -.055]} args={[.54, .23, .42]} radius={.09} castShadow>
          <meshStandardMaterial color="#344b66" roughness={.9}/>
        </RoundedBox>
        <mesh position={[0, 1.397, .214]}><boxGeometry args={[.13, .075, .014]}/><meshStandardMaterial color="#e9eef4"/></mesh>
        {[-1, 1].map(side => <RoundedBox key={side} position={[side * .365, 1.38, -.02]} args={[.245, .255, .32]} radius={.105} castShadow>
          <meshStandardMaterial color={agent.color} roughness={.9}/>
        </RoundedBox>)}
        <mesh position={[0, 1.54, -.015]}><cylinderGeometry args={[.105, .105, .19, 10]}/><meshStandardMaterial color={skin}/></mesh>
        <group ref={head} position={[0, 1.745, 0]}>
          <mesh castShadow><sphereGeometry args={[.275, 20, 16]}/><meshStandardMaterial color={skin} roughness={.83}/></mesh>
          <mesh position={[0, .105, -.018]} castShadow><sphereGeometry args={[.287, 20, 14, 0, Math.PI * 2, 0, Math.PI * .55]}/><meshStandardMaterial color={hair} roughness={.91}/></mesh>
          {[-1, 1].map(side => <group key={side}>
            <mesh position={[side * .117, .013, .247]} scale={[.8, 1.2, .65]}><sphereGeometry args={[.023, 9, 7]}/><meshStandardMaterial color="#172638"/></mesh>
            <mesh position={[side * .117, .09, .235]} rotation={[0, 0, side * -.14]}><boxGeometry args={[.085, .018, .017]}/><meshStandardMaterial color={hair}/></mesh>
            <mesh position={[side * .271, -.04, 0]}><sphereGeometry args={[.062, 8, 8]}/><meshStandardMaterial color={skin}/></mesh>
          </group>)}
          <mesh position={[0, -.048, .269]}><sphereGeometry args={[.036, 9, 7]}/><meshStandardMaterial color={skin}/></mesh>
          <mesh position={[0, -.132, .242]} rotation={[0, 0, Math.PI]}><torusGeometry args={[.06, .008, 5, 16, Math.PI]}/><meshStandardMaterial color="#814d4a"/></mesh>
        </group>
      </group>
      {[-1, 1].map((side, index) => <group key={`arm-${side}`}>
        <mesh ref={node => { if (node) upperArms.current[index] = node }} castShadow>
          <cylinderGeometry args={[.108, .112, 1, 10]}/><meshStandardMaterial color={agent.color} roughness={.88}/>
        </mesh>
        <mesh ref={node => { if (node) elbows.current[index] = node }} castShadow>
          <sphereGeometry args={[.084, 10, 8]}/><meshStandardMaterial color={skin} roughness={.87}/>
        </mesh>
        <mesh ref={node => { if (node) lowerArms.current[index] = node }} castShadow>
          <cylinderGeometry args={[.079, .086, 1, 10]}/><meshStandardMaterial color={skin} roughness={.86}/>
        </mesh>
        <group ref={node => { if (node) hands.current[index] = node }}>
          <RoundedBox args={[.16, .085, .145]} radius={.034} castShadow>
            <meshStandardMaterial color={skin} roughness={.86}/>
          </RoundedBox>
          {[-.056, -.019, .019, .056].map((x, finger) => <RoundedBox key={finger}
            position={[x, -.012, .103 + (finger === 1 || finger === 2 ? .012 : 0)]}
            args={[.031, .047, finger === 1 || finger === 2 ? .112 : .09]} radius={.015} castShadow>
            <meshStandardMaterial color={skin} roughness={.86}/>
          </RoundedBox>)}
          <RoundedBox position={[side * .102, -.026, .012]} rotation={[0, side * .3, 0]}
            args={[.058, .061, .085]} radius={.025} castShadow>
            <meshStandardMaterial color={skin} roughness={.86}/>
          </RoundedBox>
        </group>
      </group>)}
      {[-1, 1].map((side, index) => <group key={`leg-${side}`}>
        <mesh ref={node => { if (node) thighs.current[index] = node }} castShadow>
          <cylinderGeometry args={[.134, .145, 1, 10]}/><meshStandardMaterial color="#344961" roughness={.9}/>
        </mesh>
        <mesh ref={node => { if (node) knees.current[index] = node }} castShadow>
          <sphereGeometry args={[.122, 10, 8]}/><meshStandardMaterial color="#344961" roughness={.9}/>
        </mesh>
        <mesh ref={node => { if (node) shins.current[index] = node }} castShadow>
          <cylinderGeometry args={[.105, .125, 1, 10]}/><meshStandardMaterial color="#344961" roughness={.9}/>
        </mesh>
        <RoundedBox ref={node => { if (node) shoes.current[index] = node }} args={[.275, .12, .39]} radius={.045} castShadow>
          <meshStandardMaterial color="#233248" roughness={.86}/>
          {/* Raised shoe collar overlaps the ankle and shin on every frame. */}
          <RoundedBox position={[0, .105, -.075]} args={[.205, .205, .22]} radius={.054} castShadow>
            <meshStandardMaterial color="#233248" roughness={.86}/>
          </RoundedBox>
          <mesh position={[0, -.055, .022]}><boxGeometry args={[.29, .035, .405]}/><meshStandardMaterial color="#c1cbd6" roughness={.84}/></mesh>
          <mesh position={[0, .062, .07]}><boxGeometry args={[.16, .011, .12]}/><meshStandardMaterial color="#dce4ed" roughness={.87}/></mesh>
        </RoundedBox>
      </group>)}
    </group>
  </group>
}
