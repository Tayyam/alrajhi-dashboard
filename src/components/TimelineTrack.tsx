import { type RefObject } from "react";

export const TRACK = "M 560,245 H 1370 A 130 130 0 1 1 1370,505 H 130 A 110 130 0 1 0 130,765 H 1370";

interface Props {
  pathRef: RefObject<SVGPathElement | null>;
}

export default function TimelineTrack({ pathRef }: Props) {
  return (
    <>
      <defs>
        <radialGradient id="gBlue" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#5b82e0" />
          <stop offset="55%" stopColor="#2a4ab0" />
          <stop offset="100%" stopColor="#142060" />
        </radialGradient>
        <radialGradient id="gGold" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f3d16f" />
          <stop offset="55%" stopColor="#9B7619" />
          <stop offset="100%" stopColor="#C8AA5D" />
        </radialGradient>
        <filter id="fShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="7" floodColor="#00000044" />
        </filter>
        <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="glowDot">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="40%" stopColor="#c9a227" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#c9a227" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path ref={pathRef} id="trackPath" d={TRACK}
        fill="none" stroke="#253c8e" strokeWidth="27.72" strokeLinecap="round" />

      <path d={TRACK} fill="none" stroke="#c9a227" strokeWidth="2.31" strokeLinecap="round" />

      <path d={TRACK} fill="none" stroke="#fde68a" strokeWidth="1.5"
        strokeLinecap="round" filter="url(#fGlow)" className="path-glow" />

      <circle r="18" fill="url(#glowDot)" filter="url(#fGlow)">
        <animateMotion dur="8s" repeatCount="indefinite"
          keyPoints="1;0" keyTimes="0;1" calcMode="linear">
          <mpath href="#trackPath" />
        </animateMotion>
      </circle>

      <circle r="10" fill="url(#glowDot)" opacity="0.4" filter="url(#fGlow)">
        <animateMotion dur="12s" repeatCount="indefinite" begin="-4s"
          keyPoints="1;0" keyTimes="0;1" calcMode="linear">
          <mpath href="#trackPath" />
        </animateMotion>
      </circle>
    </>
  );
}
