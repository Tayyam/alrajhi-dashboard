import { iconUrl, type TaskRow } from "../lib/supabase";

export type NodeStatus = "success" | "warning" | "danger" | "default";

interface TimelineNodeProps {
  cx: number;
  cy: number;
  title: string;
  date?: string;
  icon: string;
  fill: string;
  stroke: string;
  progress: number;
  status: NodeStatus;
  index: number;
  isCurrent: boolean;
  tasks?: TaskRow[];
  company?: string;
  /** Scale factor: 1 = full size, <1 = smaller (e.g. 0.6 for sub-tasks) */
  nodeScale?: number;
  /** Title position around the node */
  titlePlacement?: "top" | "bottom";
  /** Extra multiplier for title font size only */
  titleFontScale?: number;
  /** Hide % label under the node */
  showProgress?: boolean;
  /** Force showing a status ring (used for sub-tasks) */
  showStatusRing?: boolean;
  /** Disable all node animations */
  animate?: boolean;
  /** Status ring without spin animation */
  statusRingStatic?: boolean;
  /** Vertical nudge for title block (negative moves up) */
  titleShiftY?: number;
}

const hijriFormatter = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const toHijri = (d: string) => hijriFormatter.format(new Date(d));

function splitTitle(text: string): [string, string] {
  const words = text.split(" ");
  if (words.length <= 1) return [text, "\u200B"];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

const statusTextColor: Record<NodeStatus, string> = {
  success: "#16a34a",
  warning: "#d97706",
  danger:  "#dc2626",
  default: "#b87200",
};

const statusRingColor: Record<NodeStatus, string> = {
  success: "#4ade80",
  warning: "#fbbf24",
  danger:  "#f87171",
  default: "#C8AA5D",
};

export default function TimelineNode({
  cx, cy, title, date, icon, fill, stroke, progress, status, index, isCurrent, company,
  nodeScale = 1, titlePlacement = "top", titleFontScale = 1, showProgress = true, showStatusRing = false,
  animate = true, statusRingStatic = false, titleShiftY = 0,
}: TimelineNodeProps) {
  const isSaudia = company === "saudia";
  const brandPrimary = isSaudia ? "#046A38" : "#C8AA5D";
  const hijriDate = date ? toHijri(date) : null;
  const textColor = status === "default" && isSaudia ? "#046A38" : statusTextColor[status];
  const ringColor = status === "default" && isSaudia ? "#46A974" : statusRingColor[status];
  const [line1, line2] = splitTitle(title);

  const s = nodeScale;
  const R      = Math.round(40 * s);
  const Rspin  = Math.round(45 * s);
  const Rpulse = Math.round(50 * s);
  const iconSz = Math.round(32 * s);
  const sw     = +(4.2 * s).toFixed(1);
  const titleY = titlePlacement === "top"
    ? cy - Math.round(105 * s)
    : cy + Math.round(96 * s);
  const titlePosY = titleY + titleShiftY;
  const progY  = cy + Math.round(68 * s);
  const fontSize = Math.round(15 * s * titleFontScale);
  const progFs   = Math.round(14 * s);
  const dateFs   = Math.round(14 * s);

  return (
    <g className={animate ? "timeline-node" : undefined} style={animate ? { animationDelay: `${index * 0.06}s` } : undefined}>
      <text x={cx} y={titlePosY} textAnchor="middle">
        <tspan fontSize={fontSize} fontWeight="700" x={cx} dy="0">{line1}</tspan>
        <tspan fontSize={fontSize} fontWeight="700" x={cx} dy="1.4em">{line2}</tspan>
        {hijriDate && (
          <tspan fontSize={dateFs} fontWeight="700" fill={isSaudia ? "#046A38" : "#b87200"} x={cx} dy="1.4em">
            {hijriDate}
          </tspan>
        )}
      </text>

      {isCurrent && (
        <circle cx={cx} cy={cy} r={Rspin} stroke={brandPrimary} strokeWidth={5 * s} fill="none"
          strokeLinecap="round" strokeDasharray={`${50 * s} ${30 * s}`}
          style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
      )}

      {showStatusRing && (
        <circle cx={cx} cy={cy} r={Rspin} stroke={ringColor} strokeWidth={5 * s} fill="none"
          strokeLinecap="round" strokeDasharray={`${50 * s} ${30 * s}`}
          style={{ transformOrigin: `${cx}px ${cy}px` }} className={statusRingStatic ? undefined : "spin-circle"} />
      )}

      {!showStatusRing && (status === "warning" || status === "danger") && (
        <>
          <circle cx={cx} cy={cy} r={Rpulse} fill={ringColor} opacity="0.15" className="pulse-ring" />
          <circle cx={cx} cy={cy} r={Rspin} stroke={ringColor} strokeWidth={5 * s} fill="none"
            strokeLinecap="round" strokeDasharray={`${50 * s} ${30 * s}`}
            style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
        </>
      )}

      <circle cx={cx} cy={cy} r={R} fill={fill} stroke={stroke}
        strokeWidth={sw} filter="url(#fShadow)" />

      <image
        x={cx - iconSz / 2} y={cy - iconSz / 2}
        width={iconSz} height={iconSz}
        href={iconUrl(icon)} style={{ filter: "brightness(0) invert(1)" }} />

      {showProgress && (
        <text x={cx} y={progY} textAnchor="middle"
          fontSize={progFs} fontWeight="700" fill={textColor}>
          %{progress}
        </text>
      )}
    </g>
  );
}
