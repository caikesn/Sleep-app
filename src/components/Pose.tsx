import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../theme';
import {
  DIM_OPACITY,
  HEAD_R,
  POSE_VIEW_BOX,
  WEIGHTS,
  poseArt,
  posePath,
} from '../poseArt';
import type { PoseName } from '../poseArt';

/**
 * A person, doing one stretch.
 *
 * Deliberately dumb: the drawing lives in `poseArt.ts` and this only renders it,
 * the same split `flame.ts` / `Flame.tsx` uses. Thirty figures as JSX would be
 * thirty components to keep in step; as data they are one table you can diff.
 *
 * Monochrome and tinted by the caller, like `Icon` — that is what keeps the
 * no-blue rule intact and lets one drawing sit on both the dark session ground
 * and the lighter library rows without a second version of it.
 *
 * Decorative on purpose. Every step already carries a `description` that says
 * what to do in words, and that is what a screen reader should read; alt text
 * here would only say it twice, worse.
 */
export default function Pose({
  name,
  size = 64,
  color = theme.text,
  flip,
  style,
}: {
  name: PoseName;
  size?: number;
  color?: string;
  /**
   * Mirror the drawing. Every two-sided pose is drawn on the left, so the
   * second half of one is the same figure flipped — which is exactly what the
   * instruction "other side" means, and cheaper than drawing thirty more.
   */
  flip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // Weights are authored against the 64-box and the viewBox scales them with
  // everything else, so a figure keeps its proportions at any size — which is
  // the reason to draw in one at all.
  const art = poseArt(name);

  return (
    // The accessibility props ride on a wrapper rather than on the drawing,
    // the way `Flame` does it: react-native-svg passes what it doesn't
    // recognise straight through to the DOM on web, and these two came out as
    // unknown attributes and a React warning per figure — thirty of them on the
    // library screen.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[{ width: size, height: size }, style]}
    >
      <Svg
        width={size}
        height={size}
        viewBox={POSE_VIEW_BOX}
        style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
      >
      {art.floor !== undefined && (
        <Path
          d={`M 5 ${art.floor} L 59 ${art.floor}`}
          stroke={color}
          strokeWidth={WEIGHTS.dim}
          strokeLinecap="round"
          opacity={DIM_OPACITY}
        />
      )}

      {art.strokes.map((stroke, i) => (
        <Path
          key={i}
          d={posePath(stroke.p as any, stroke.closed)}
          stroke={color}
          strokeWidth={stroke.dim ? WEIGHTS.dim : stroke.body ? WEIGHTS.body : WEIGHTS.limb}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={stroke.dim ? DIM_OPACITY : 1}
        />
      ))}

      {/* Drawn last so it sits over the neck end of the torso rather than being
          cut into by it — the torso runs up under the head by design, which is
          what stops a gap opening between the two at small sizes. */}
        <Circle cx={art.head[0]} cy={art.head[1]} r={HEAD_R} fill={color} />
      </Svg>
    </View>
  );
}
