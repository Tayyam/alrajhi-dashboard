interface TimelineNodeProps {
  cx: number;
  cy: number;
  t1: string;
  t2: string;
  date: string;
  icon: string;
  fill: string;
  stroke: string;
  progress?: number;
  index: number;
}

const hijriFormatter = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const toHijri = (d: string) => hijriFormatter.format(new Date(d));

export default function TimelineNode({ cx, cy, t1, t2, date, icon, fill, stroke, progress, index }: TimelineNodeProps) {
  const hijriDate = toHijri(date);

  return (
    <g className="timeline-node" style={{ animationDelay: `${index * 0.06}s` }}>
      <text x={cx} y={cy - 90} textAnchor="middle">
        <tspan fontSize="14" fontWeight="700" x={cx} dy="0">{t1}</tspan>
        <tspan fontSize="14" fontWeight="700" x={cx} dy="1.4em">{t2}</tspan>
        <tspan fontSize="13" fontWeight="700" fill="#b87200" x={cx} dy="1.4em">{hijriDate}</tspan>
      </text>

      {progress != null && (
        <>
          <circle cx={cx} cy={cy} r="50" fill="#C8AA5D" opacity="0.15" className="pulse-ring" />
          <circle cx={cx} cy={cy} r="45" stroke="#C8AA5D" strokeWidth="5" fill="none"
            strokeLinecap="round" strokeDasharray="50 30"
            style={{ transformOrigin: `${cx}px ${cy}px` }} className="spin-circle" />
          <text x={cx} y={cy + 68} textAnchor="middle"
            fontSize="13" fontWeight="700" fill="#b87200">
            {progress}% اكتمل
          </text>
        </>
      )}

      <circle cx={cx} cy={cy} r="40" fill={fill} stroke={stroke}
        strokeWidth="4.2" filter="url(#fShadow)" />

      <image x={cx - 16} y={cy - 16} width="32" height="32"
        href={`/icons/${icon}.png`} style={{ filter: "brightness(0) invert(1)" }} />
    </g>
  );
}
