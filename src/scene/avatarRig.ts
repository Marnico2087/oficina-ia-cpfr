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
  arms: [Arm, Arm]
  legs: [Leg, Leg]
}

export function makeAvatarRigPose(seatedInput: number, walking: boolean, seconds: number,
  activity: 'idle' | 'thinking' | 'coding' | 'researching' | 'finishing' | 'celebrating' | 'error',
  socialBlend = 0): AvatarRigPose {
  const seated = Math.max(0, Math.min(1, seatedInput))
  const stride = (walking ? 1 - seated : 0)
  const typing = seated > .94 && activity === 'coding'
  // Small conversational gestures are part of the actual arm rig, never
  // floating speech props. Sitting or walking always suppresses the gesture.
  const gesture = Math.max(0, Math.min(1, socialBlend)) * (1 - seated) * (walking ? 0 : 1)
  const arms = [-1, 1].map(side => {
    const phase = Math.sin(seconds * 9 + (side === 1 ? Math.PI : 0)) * stride
    const talking = side === 1 ? gesture * (.82 + .18 * Math.sin(seconds * 3)) : 0
    // The workstation faces -Z, so its local +X mouse is on the avatar's -X.
    const wristX = side === -1 ? -.4 - seated * .33 : .4
    return {
      shoulder: [side * .37, 1.39 - seated * .08, -.02] as RigPoint,
      elbow: [side * (.44 + seated * .06), 1.055 + seated * .06 + talking * .09,
        .025 + seated * .39 - phase * .08 + talking * .09] as RigPoint,
      wrist: [wristX - talking * .045, .82 + seated * .32 + talking * .43 + (typing ? Math.sin(seconds * 12 + side) * .008 : 0),
        .12 + seated * .835 + phase * .2 + talking * .35] as RigPoint,
    }
  }) as [Arm, Arm]
  const legs = [-1, 1].map(side => {
    const phase = Math.sin(seconds * 9 + (side === 1 ? Math.PI : 0)) * stride
    return {
      hip: [side * .165, .81 - seated * .085, -.04] as RigPoint,
      knee: [side * .17, .47 + seated * .115 + phase * .075, .025 + seated * .545 + phase * .12] as RigPoint,
      ankle: [side * .17, .145 + Math.max(0, phase) * .07, .025 + seated * .63 - phase * .14] as RigPoint,
      foot: [side * .17, .095 + Math.max(0, phase) * .07, .205 + seated * .63 - phase * .14] as RigPoint,
    }
  }) as [Leg, Leg]
  return {
    torsoDrop: seated * .08,
    headPitch: activity === 'researching' ? -.09 : activity === 'error' ? .14 : 0,
    headRoll: activity === 'thinking' ? Math.sin(seconds * 1.2) * .035 : gesture * Math.sin(seconds * 1.7) * .045,
    bob: stride * Math.abs(Math.sin(seconds * 9)) * .018,
    arms,
    legs,
  }
}
