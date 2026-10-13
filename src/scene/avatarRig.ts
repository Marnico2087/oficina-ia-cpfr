// Character space always faces +Z. Workstations rotate the whole character
// toward -Z, where the desk and monitor are located. The same connected joints
// are used for standing, walking, typing and the complete sitting transition.
export type RigPoint = [number, number, number]
type Arm = { shoulder: RigPoint; elbow: RigPoint; wrist: RigPoint }
type Leg = { hip: RigPoint; knee: RigPoint; ankle: RigPoint; foot: RigPoint }
export type AvatarRigPose = {
  torsoDrop: number
  headPitch: number
  headRoll: number
  bob: number
  shoePitch: [number, number]
  arms: [Arm, Arm]
  legs: [Leg, Leg]
}

export function makeAvatarRigPose(seatedInput: number, walking: boolean | number, seconds: number,
  activity: 'idle' | 'thinking' | 'coding' | 'researching' | 'finishing' | 'celebrating' | 'error',
  socialBlend = 0, thinkingProgress = activity === 'thinking' ? 1 : 0, gaitPhase = seconds * 9): AvatarRigPose {
  // Ease the body into and out of the chair so the hips and torso do not
  // stop or start at full speed. All joints share this same transition.
  const seatProgress = Math.max(0, Math.min(1, seatedInput))
  const seated = seatProgress * seatProgress * (3 - 2 * seatProgress)
  const stride = (typeof walking === 'boolean' ? Number(walking) : Math.max(0, Math.min(1, walking))) * (1 - seated)
  const typing = seated > .94 && activity === 'coding'
  const thinking = seated * Math.max(0, Math.min(1, thinkingProgress))
  // Small conversational gestures are part of the actual arm rig, never
  // floating speech props. Sitting or walking always suppresses the gesture.
  const gesture = Math.max(0, Math.min(1, socialBlend)) * (1 - seated) * (1 - stride)
  const arms = [-1, 1].map(side => {
    const phase = Math.sin(gaitPhase + (side === 1 ? Math.PI : 0)) * stride
    const talking = side === 1 ? gesture * (.82 + .18 * Math.sin(seconds * 3)) : 0
    // The workstation faces -Z, so its local +X mouse is on the avatar's -X.
    // The mouse is on the worker's left after the workstation's 180 degree
    // rotation. Neither seated hand needs to extend an entire metre.
    const wristX = side === -1 ? -.4 - seated * .19 : .4 - seated * .14
    const contemplation = side === 1 ? thinking : 0
    // Bring the free hand to the chin while thinking. The other hand stays on
    // the mouse, and the forearm remains connected to its moving elbow.
    const baseWristY = 1.02 + seated * .065 + talking * .43
    const baseWristZ = .12 + seated * .66 + phase * .2 + talking * .35
    return {
      // The shoulders and pelvis descend together as a single body when the
      // character sits. The forearms then reach the fixed desktop height.
      shoulder: [side * .37, 1.66 - seated * .4, -.02] as RigPoint,
      elbow: [side * (.44 + seated * .06) - contemplation * .04,
        1.28 - seated * .24 + talking * .09 + contemplation * .16,
        .025 + seated * .43 - phase * .08 + talking * .09 + contemplation * .07] as RigPoint,
      wrist: [wristX - talking * .045 - contemplation * .26,
        baseWristY + contemplation * (1.50 - baseWristY) + (typing && side === 1 ? Math.sin(seconds * 12) * .016 : 0),
        baseWristZ + contemplation * (.27 - baseWristZ) + (typing && side === 1 ? Math.cos(seconds * 12) * .014 : 0)] as RigPoint,
    }
  }) as [Arm, Arm]
  const shoePitch: [number, number] = [0, 0]
  const legs = [-1, 1].map((side, index) => {
    const phase = gaitPhase + (side === 1 ? Math.PI : 0)
    const step = Math.sin(phase)
    // Feet stay on the ground during the support phase. Only the swinging
    // leg lifts, using a smooth arc tied to actual distance traveled.
    const lift = Math.pow(Math.max(0, step), 1.5) * .105 * stride
    const footZ = .11 - Math.cos(phase) * .145 * stride
    // The ankle sits INSIDE the shoe collar instead of behind the heel. The
    // standing pelvis is high enough for nearly straight legs, while the
    // seated pelvis drops to the chair cushion without detaching the thigh.
    // The shoe bottom is ~.073 below its origin; .078 keeps the outsole on
    // the floor. The ankle meets the collar exactly .105 above the shoe.
    const ankle: RigPoint = [side * .17, .183 + lift, (footZ - .075) * (1 - seated) + .60 * seated]
    const hip: RigPoint = [side * .165, 1.16 - seated * .4, -.04]
    // Solve the same two fixed-length bones for standing, walking and sitting.
    // Interpolating an arbitrary seated knee used to stretch the limbs.
    const dy = ankle[1] - hip[1], dz = ankle[2] - hip[2]
    const distance = Math.max(.0001, Math.hypot(dy, dz))
    const femur = .51, shin = .50
    const along = (femur * femur - shin * shin + distance * distance) / (2 * distance)
    const reach = Math.sqrt(Math.max(0, femur * femur - along * along))
    const normalY = -dz / distance, normalZ = dy / distance
    const walkingKnee: RigPoint = [side * .17,
      hip[1] + dy / distance * along - normalY * reach,
      hip[2] + dz / distance * along - normalZ * reach]
    // Settle the shoe before and after walking; keep the toe down in the
    // support phase rather than spinning the entire limb on every frame.
    // Only swing-phase shoes pitch: a planted sole must stay flat and avoid
    // clipping through the floor at heel/toe as the walk cycle changes.
    shoePitch[index] = -Math.min(.045, lift * .42)
    return {
      hip,
      knee: walkingKnee,
      ankle,
      foot: [side * .17, .078 + lift, footZ * (1 - seated) + .675 * seated] as RigPoint,
    }
  }) as [Leg, Leg]
  return {
    torsoDrop: seated * .4,
    headPitch: activity === 'researching' ? -.09 : activity === 'error' ? .14 : stride * Math.sin(gaitPhase * 2) * .018,
    headRoll: activity === 'thinking' ? Math.sin(seconds * 1.2) * .035 : gesture * Math.sin(seconds * 1.7) * .045 + stride * Math.sin(gaitPhase) * .018,
    bob: 0,
    shoePitch,
    arms,
    legs,
  }
}
