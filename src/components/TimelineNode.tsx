import { iconUrl, type TaskRow } from "../lib/supabase";

export type NodeStatus = "success" | "warning" | "danger" | "default";

interface TimelineNodeProps {
  cx: number;
  cy: number;
  title: string;
  date: string;
  icon: string;
  fill: string;
  stroke: string;
  progress: number;
  status: NodeStatus;
  index: number;
  isCurrent: boolean;
  tasks?: TaskRow[];
  company?: string;
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

export default function TimelineNode({ cx, cy, title, date, icon, fill, stroke, progress, status, index, isCurrent, tasks, company }: TimelineNodeProps) {
  const isSaudia = company === "saudia";
  const brandPrimary = isSaudia ? "#046A38" : "#C8AA5D";
  const hijriDate = toHijri(date);
  const textColor = status === "default" && isSaudia ? "#046A38" : statusTextColor[status];
  const ringColor = status === "default" && isSaudia ? "#46A974" : statusRingColor[status];
  const [line1, line2] = splitTitle(title);

  const ORBIT_RADIUS = 85;

  return (
    <g className="timeline-node" style={{ animationDelay: `${index * 0.06}s` }}>
      {/* Draw task connection lines first so they are under the main node */}
      {tasks && tasks.length > 0 && tasks.map((task, i) => {
        const angle = (i / tasks.length) * 2 * Math.PI - Math.PI / 2;
        const tx = cx + Math.cos(angle) * ORBIT_RADIUS;
        const ty = cy + Math.sin(angle) * ORBIT_RADIUS;
        return <line key={`line-${task.id}`} x1={cx} y1={cy} x2={tx} y2={ty} stroke={isSaudia ? "#7FC6A1" : "#cbd5e1"} strokeWidth="2" strokeDasharray="4 2" />;
      })}

      <text x={cx} y={cy - 105} textAnchor="middle">
        <tspan fontSize="15" fontWeight="700" x={cx} dy="0">{line1}</tspan>
        <tspan fontSize="15" fontWeight="700" x={cx} dy="1.4em">{line2}</tspan>
        <tspan fontSize="14" fontWeight="700" fill={isSaudia ? "#046A38" : "#b87200"} x={cx} dy="1.4em">{hijriDate}</tspan>
      </text>

      {isCurrent && (
        <circle cx={cx} cy={cy} r="45" stroke={brandPrimary} strokeWidth="5" fill="none"
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
        href={iconUrl(icon)} style={{ filter: "brightness(0) invert(1)" }} />

      <text x={cx} y={cy + 68} textAnchor="middle"
        fontSize="14" fontWeight="700" fill={textColor}>
        %{progress}
      </text>

      {/* Draw tasks */}
      {tasks && tasks.length > 0 && tasks.map((task, i) => {
        const angle = (i / tasks.length) * 2 * Math.PI - Math.PI / 2;
        const tx = cx + Math.cos(angle) * ORBIT_RADIUS;
        const ty = cy + Math.sin(angle) * ORBIT_RADIUS;
        const isTaskComplete = !!task.is_done;
        const taskFill = isTaskComplete ? "#16a34a" : (isSaudia ? "#046A38" : "#6b7280");

        return (
          <g key={`task-${task.id}`}>
            <circle cx={tx} cy={ty} r="16" fill={taskFill} stroke="#fff" strokeWidth="2" filter="url(#fShadow)" />
            {task.icon ? (
              <image x={tx - 8} y={ty - 8} width="16" height="16" href={iconUrl(task.icon)} style={{ filter: "brightness(0) invert(1)" }} />
            ) : (
              <text x={tx} y={ty + 4} fontSize="10" fill="#fff" textAnchor="middle" fontWeight="bold">{isTaskComplete ? "1" : "0"}</text>
            )}
            <title>{task.title} - {isTaskComplete ? "true" : "false"}</title>
          </g>
        );
      })}
    </g>
  );
}
