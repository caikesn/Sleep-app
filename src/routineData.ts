import type { IconName } from './components/Icon';

export type RoutineStep = {
  id: string;
  name: string;
  seconds: number;
  /** Describes the movement, not the pose. See Icon.tsx. */
  icon: IconName;
  description: string;
};

export const defaultRoutine: RoutineStep[] = [
  {
    id: 'breathing',
    name: 'Box Breathing',
    seconds: 60,
    icon: 'breathe',
    description: 'Sit cross-legged. Inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat, letting your shoulders drop.',
  },
  {
    id: 'neck-rolls',
    name: 'Neck Rolls',
    seconds: 30,
    icon: 'rotate',
    description: 'Slowly roll your head in a full circle, 5 times each direction. Keep shoulders relaxed.',
  },
  {
    id: 'cat-cow',
    name: 'Cat-Cow',
    seconds: 45,
    icon: 'arch',
    description: 'On hands and knees, arch your back up on the exhale, dip it down on the inhale. Slow and controlled.',
  },
  {
    id: 'childs-pose',
    name: "Child's Pose",
    seconds: 60,
    icon: 'fold',
    description: 'Kneel and fold forward, arms extended or by your sides. Breathe deeply into your lower back.',
  },
  {
    id: 'seated-forward-fold',
    name: 'Seated Forward Fold',
    seconds: 45,
    icon: 'reach',
    description: 'Sit with legs extended, hinge at the hips and reach for your feet. Let your neck relax.',
  },
  {
    id: 'figure-four',
    name: 'Figure-Four Stretch',
    seconds: 60,
    icon: 'cross',
    description: 'Lie on your back, cross one ankle over the opposite knee, pull the standing leg toward your chest. Switch sides halfway.',
  },
  {
    id: 'legs-up-wall',
    name: 'Legs Up the Wall',
    seconds: 120,
    icon: 'elevate',
    description: 'Lie on your back with legs resting up a wall. Rest your arms out to the sides and breathe slowly.',
  },
  {
    id: 'final-relaxation',
    name: 'Final Relaxation',
    seconds: 90,
    icon: 'rest',
    description: 'Lie flat on your back in savasana. Let your whole body sink and settle. Slow your breathing.',
  },
];
