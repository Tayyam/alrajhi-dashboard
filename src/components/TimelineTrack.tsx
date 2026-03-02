import { type RefObject } from "react";

// ─── Track geometry constants ───────────────────────────────────────────────
const START_X  = 560;
const RIGHT_X  = 1370;
const LEFT_X   = 130;
const START_Y  = 245;
const SPACING  = 260;  // arc diameter (radius 130)
const MIN_ROWS = 3;
const EXTRA_ROW_THRESHOLD = 30;  // add a row for every 30 items beyond this

// ─── Exported utilities (used by Timeline.tsx for dynamic viewBox) ───────────

export function getTrackRowCount(nodeCount: number): number {
  if (nodeCount <= EXTRA_ROW_THRESHOLD) return MIN_ROWS;
  return MIN_ROWS + Math.ceil((nodeCount - EXTRA_ROW_THRESHOLD) / EXTRA_ROW_THRESHOLD);
}

export function getTrackViewBoxHeight(nodeCount: number): number {
  const rows = getTrackRowCount(nodeCount);
  // For 3 rows: 245 + 2×260 + 119 = 884  (original viewBox height)
  return START_Y + (rows - 1) * SPACING + 119;
}

/** Build the SVG path d-string for `numRows` rows. */
function buildTrackPath(numRows: number): string {
  let d = `M ${START_X},${START_Y} H ${RIGHT_X}`;
  let side: "right" | "left" = "right";

  for (let row = 1; row < numRows; row++) {
    const y = START_Y + row * SPACING;
    if (side === "right") {
      // Arc curves around right edge, then row goes left
      d += ` A 130 130 0 1 1 ${RIGHT_X},${y} H ${LEFT_X}`;
      side = "left";
    } else {
      // Arc curves around left edge, then row goes right
      d += ` A 110 130 0 1 0 ${LEFT_X},${y} H ${RIGHT_X}`;
      side = "right";
    }
  }

  return d;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  pathRef: RefObject<SVGPathElement | null>;
  company?: string;
  /** Total track items (nodes + sub-tasks). Controls how many rows are generated. */
  nodeCount?: number;
}

export default function TimelineTrack({ pathRef, company, nodeCount = 0 }: Props) {
  const isSaudia    = company === "saudia";
  const baseStroke  = isSaudia ? "#046A38" : "#253c8e";
  const accentStroke = isSaudia ? "#D5F2E1" : "#c9a227";
  const glowStroke  = isSaudia ? "#FFFEFF" : "#fde68a";

  const numRows = getTrackRowCount(nodeCount);
  const TRACK   = buildTrackPath(numRows);

  return (
    <>
      <defs>
        <radialGradient id="gBlue" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor={isSaudia ? "#3EA977" : "#5b82e0"} />
          <stop offset="55%"  stopColor={isSaudia ? "#0C7A4A" : "#2a4ab0"} />
          <stop offset="100%" stopColor={isSaudia ? "#046A38" : "#142060"} />
        </radialGradient>
        <radialGradient id="gGold" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor={isSaudia ? "#EAF8F1" : "#f3d16f"} />
          <stop offset="55%"  stopColor={isSaudia ? "#BFE5D0" : "#9B7619"} />
          <stop offset="100%" stopColor={isSaudia ? "#86C8A5" : "#C8AA5D"} />
        </radialGradient>
        <radialGradient id="gSuccess" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="55%"  stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="gWarning" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#fbbf24" />
          <stop offset="55%"  stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        <radialGradient id="gDanger" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#f87171" />
          <stop offset="55%"  stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
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
          <stop offset="0%"   stopColor={glowStroke} />
          <stop offset="40%"  stopColor={accentStroke} stopOpacity="0.6" />
          <stop offset="100%" stopColor={accentStroke} stopOpacity="0" />
        </radialGradient>
      </defs>

      <path ref={pathRef} id="trackPath" d={TRACK}
        fill="none" stroke={baseStroke} strokeWidth="27.72" strokeLinecap="round" />

      <path d={TRACK} fill="none" stroke={accentStroke} strokeWidth="2.31" strokeLinecap="round" />

      <path d={TRACK} fill="none" stroke={glowStroke} strokeWidth="1.5"
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
