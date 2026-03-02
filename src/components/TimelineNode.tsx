import { iconUrl } from "../lib/supabase";

export type NodeStatus = "success" | "warning" | "danger" | "default";

interface Props {
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
  company?: string;
  nodeScale?: number;
  titlePlacement?: "top" | "bottom";
  titleFontScale?: number;
  showProgress?: boolean;
  /** Show a static status ring around the node (used for sub-tasks) */
  showStatusRing?: boolean;
  animate?: boolean;
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

const STATUS_TEXT: Record<NodeStatus, string> = {
  success: "#16a34a",
  warning: "#d97706",
  danger:  "#dc2626",
  default: "#b87200",
};

const STATUS_RING: Record<NodeStatus, string> = {
  success: "#4ade80",
  warning: "#fbbf24",
  danger:  "#f87171",
  default: "#C8AA5D",
};

export default function TimelineNode({
  cx, cy, title, date, icon, fill, stroke, progress, status, index, isCurrent,
  nodeScale = 1, titlePlacement = "top", titleFontScale = 1,
  showProgress = true, showStatusRing = false, animate = true, titleShiftY = 0,
}: Props) {
  const brandColor  = "#C8AA5D";
  const textColor   = STATUS_TEXT[status];
  const ringColor   = STATUS_RING[status];
  const hijriDate   = date ? toHijri(date) : null;
  const [line1, line2] = splitTitle(title);

  const s      = nodeScale;
  const R      = Math.round(40 * s);
  const Rspin  = Math.round(45 * s);
  const Rpulse = Math.round(50 * s);
  const iconSz = Math.round(32 * s);
  const sw     = +(4.2 * s).toFixed(1);
  const fs     = Math.round(14 * s);                 // shared small font size
  const titleFs = Math.round(fs * titleFontScale);
  const titlePosY = (titlePlacement === "top"
    ? cy - Math.round(105 * s)
    : cy + Math.round(96 * s)) + titleShiftY;
  const progY  = cy + Math.round(68 * s);

  return (
    <g
      className={animate ? "timeline-node" : undefined}
      style={animate ? { animationDelay: `${index * 0.06}s` } : undefined}
    >
      {/* Title */}
      <text x={cx} y={titlePosY} textAnchor="middle">
        <tspan fontSize={titleFs} fontWeight="700" x={cx} dy="0">{line1}</tspan>
        <tspan fontSize={titleFs} fontWeight="700" x={cx} dy="1.4em">{line2}</tspan>
        {hijriDate && (
          <tspan fontSize={fs} fontWeight="700" fill="#b87200" x={cx} dy="1.4em">
            {hijriDate}
          </tspan>
        )}
      </text>

      {/* Spinning ring for current node */}
      {isCurrent && (
        <circle cx={cx} cy={cy} r={Rspin} stroke={brandColor} strokeWidth={5 * s} fill="none"
          strokeLinecap="round" strokeDasharray={`${50 * s} ${30 * s}`}
          style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
      )}

      {/* Static status ring for sub-tasks */}
      {showStatusRing && (
        <circle cx={cx} cy={cy} r={Rspin} stroke={ringColor} strokeWidth={5 * s}
          fill="none" strokeLinecap="round" />
      )}

      {/* Animated warning/danger ring for main nodes */}
      {!showStatusRing && (status === "warning" || status === "danger") && (
        <>
          <circle cx={cx} cy={cy} r={Rpulse} fill={ringColor} opacity="0.15" className="pulse-ring" />
          <circle cx={cx} cy={cy} r={Rspin} stroke={ringColor} strokeWidth={5 * s} fill="none"
            strokeLinecap="round" strokeDasharray={`${50 * s} ${30 * s}`}
            style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
        </>
      )}

      {/* Main circle */}
      <circle cx={cx} cy={cy} r={R} fill={fill} stroke={stroke} strokeWidth={sw} filter="url(#fShadow)" />

      {/* Icon */}
      <image x={cx - iconSz / 2} y={cy - iconSz / 2} width={iconSz} height={iconSz}
        href={iconUrl(icon)} style={{ filter: "brightness(0) invert(1)" }} />

      {/* Progress % */}
      {showProgress && (
        <text x={cx} y={progY} textAnchor="middle" fontSize={fs} fontWeight="700" fill={textColor}>
          %{progress}
        </text>
      )}
    </g>
  );
}
