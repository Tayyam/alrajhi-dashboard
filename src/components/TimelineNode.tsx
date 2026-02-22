export type NodeStatus = "success" | "warning" | "danger" | "default";

interface TimelineNodeProps {
  cx: number;
  cy: number;
  t1: string;
  t2: string;
  date: string;
  icon: string;
  fill: string;
  stroke: string;
  progress: number;
  status: NodeStatus;
  index: number;
  isCurrent: boolean;
}

const hijriFormatter = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const toHijri = (d: string) => hijriFormatter.format(new Date(d));

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

export default function TimelineNode({ cx, cy, t1, t2, date, icon, fill, stroke, progress, status, index, isCurrent }: TimelineNodeProps) {
  const hijriDate = toHijri(date);
  const textColor = statusTextColor[status];
  const ringColor = statusRingColor[status];

  return (
    <g className="timeline-node" style={{ animationDelay: `${index * 0.06}s` }}>
      <text x={cx} y={cy - 105} textAnchor="middle">
        <tspan fontSize="16" fontWeight="700" x={cx} dy="0">{t1}</tspan>
        <tspan fontSize="16" fontWeight="700" x={cx} dy="1.4em">{t2}</tspan>
        <tspan fontSize="15" fontWeight="700" fill="#b87200" x={cx} dy="1.4em">{hijriDate}</tspan>
      </text>

      {isCurrent && (
        <circle cx={cx} cy={cy} r="45" stroke="#C8AA5D" strokeWidth="5" fill="none"
          strokeLinecap="round" strokeDasharray="50 30"
          style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
      )}

      {(status === "warning" || status === "danger") && (
        <>
          <circle cx={cx} cy={cy} r="50" fill={ringColor} opacity="0.15" className="pulse-ring" />
          <circle cx={cx} cy={cy} r="45" stroke={ringColor} strokeWidth="5" fill="none"
            strokeLinecap="round" strokeDasharray="50 30"
            style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
        </>
      )}

      <circle cx={cx} cy={cy} r="40" fill={fill} stroke={stroke}
        strokeWidth="4.2" filter="url(#fShadow)" />

      <image x={cx - 16} y={cy - 16} width="32" height="32"
        href={`/icons/${icon}.png`} style={{ filter: "brightness(0) invert(1)" }} />

      <text x={cx} y={cy + 68} textAnchor="middle"
        fontSize="14" fontWeight="700" fill={textColor}>
        %{progress}
      </text>
    </g>
  );
}
