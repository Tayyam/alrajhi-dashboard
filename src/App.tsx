import { useLayoutEffect, useRef, useState } from "react";
import TimelineTrack from "./components/TimelineTrack";
import TimelineNode, { type NodeStatus } from "./components/TimelineNode";

// [t1, t2, date, icon, progress]
type NodeData = [string, string, string, string, number];

const nodes: NodeData[] = [
  ["بداية وصول",              "الحجاج",                       "2026-04-18", "pilgrim",     0],
  ["استلام المخيمات",          "جاهزة",                        "2026-04-18", "camping",     0],
  ["ادخال بيانات",             "الاستعداد المسبق",             "2026-03-25", "approved",    0],
  ["اصدار",                    "التأشيرات",                    "2026-03-20", "passport",    0],
  ["رفع بيانات الحجاج",        "وتكوين المجموعات",             "2026-02-08", "group",       100],
  ["الانتهاء من التعاقدات",     "على خدمات النقل",              "2026-02-01", "logistic",    100],
  ["الانتهاء من التعاقدات",     "على السكن",                    "2026-02-01", "home",        100],
  ["تحويل الأموال للسكن",       "وخدمات النقل",                 "2026-01-20", "accommodation",100],
  ["تعيين الناقلات الجوية",     "وجدولة الرحلات",               "2026-01-04", "airplane",    100],
  ["التعاقد على حزم الخدمات",   "ودفع قيمتها",                  "2026-01-04", "box",         100],
  ["تحويل الأموال المطلوبة",    "للتعاقد على الخدمات الأساسية", "2025-12-21", "credit-card", 100],
  ["توقيع اتفاقية",            "رغبات التفويج",                "2025-11-09", "application", 100],
  ["توثيق التعاقدات",           "مع الشركات في مؤتمر الحج",     "2025-11-09", "contract",    100],
  ["توقيع اتفاقياة",           "وترتيب شؤون الحجاج",           "2025-11-09", "agreement",   100],
  ["الموعد النهائي لإعلان",     "تسجيل الحجاج",                 "2025-10-12", "calendar",    100],
  ["بدأ الاجتماعات",            "التحضيرية",                    "2025-10-12", "people",      100],
  ["تأكيد الاحتفاظ بالمخيمات",  "من الموسم السابق",             "2025-08-23", "folder",      100],
  ["الاطلاع على بيانات المخيمات","عبر منصة نسك مسار",            "2025-07-26", "data",        100],
  ["استلام نموذج التوعية",      "للضيوف الرحمن",                "2025-06-08", "checklist",   100],
  ["استلام وثيقة",             "الترتيبات الأولية والبرنامج",   "2025-06-08", "document",    100],
];

function getNodeStatus(progress: number, date: string): NodeStatus {
  const pastDue = new Date(date).getTime() <= Date.now();
  if (progress === 100 && pastDue) return "success";
  if (progress === 100) return "default";
  if (pastDue && progress > 50) return "warning";
  if (pastDue) return "danger";
  return "default";
}

function getNodeFill(status: NodeStatus, i: number): { fill: string; stroke: string } {
  if (status === "success") return { fill: "url(#gSuccess)", stroke: "#86efac" };
  if (status === "warning") return { fill: "url(#gWarning)", stroke: "#fcd34d" };
  if (status === "danger")  return { fill: "url(#gDanger)",  stroke: "#fca5a5" };
  const ri = nodes.length - 1 - i;
  const gold = (ri >= 4 && ri < 8) || (ri >= 12 && ri < 16);
  return gold
    ? { fill: "url(#gGold)", stroke: "#fbe48c" }
    : { fill: "url(#gBlue)", stroke: "#5a7ad8" };
}

const currentIdx = (() => {
  const now = Date.now();
  const firstPastIdx = nodes.findIndex(([, , d]) => new Date(d).getTime() <= now);
  if (firstPastIdx <= 0) return 0;
  return firstPastIdx - 1;
})();

const todayHijri = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());


export default function App() {
  const pathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<[number, number][]>([]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const N = 500;
    const dt = total / N;

    // Detect straight (horizontal) segments by sampling
    const ranges: [number, number][] = [];
    let segStart = -1;

    for (let i = 1; i <= N; i++) {
      const prev = path.getPointAtLength((i - 1) * dt);
      const curr = path.getPointAtLength(i * dt);
      const flat = Math.abs(curr.y - prev.y) < 5;

      if (flat && segStart < 0) segStart = (i - 1) * dt;
      if (!flat && segStart >= 0) {
        ranges.push([segStart, (i - 1) * dt]);
        segStart = -1;
      }
    }
    if (segStart >= 0) ranges.push([segStart, total]);

    // Distribute nodes evenly across straight segments only
    const straightLen = ranges.reduce((s, [a, b]) => s + (b - a), 0);
    const step = straightLen / (nodes.length - 1);

    const pts: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) {
      let target = step * i;
      let len = 0;
      for (const [a, b] of ranges) {
        const segLen = b - a;
        if (target <= segLen + 0.001) {
          len = a + target;
          break;
        }
        target -= segLen;
      }
      const { x, y } = path.getPointAtLength(len);
      pts.push([Math.round(x), Math.round(y)]);
    }

    setPoints(pts);
  }, []);

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/background.jpeg')" }}>
      <div className="w-full max-w-[1990px] mx-auto lg:pr-15 lg:pl-25 pl-5 md:pl-10">
        <svg viewBox="0 0 1600 884" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" direction="ltr">
          <TimelineTrack pathRef={pathRef} />

          {points.length > 0 && (() => {
            const hx = points[0][0] / 2;
            const hy = points[0][1];
            return (
              <g className="header-fade">
                <rect x={hx - 155} y={hy - 145} width="310" height="260" rx="16"
                  fill="white" opacity="0.95" filter="url(#fShadow)" />

                <image href="/logorajhi.png" x={hx - 130} y={hy - 135} width="260" height="120" />

                <text x={hx} y={hy + 20} fontSize="26" fontWeight="700" fill="#334278" textAnchor="middle">
                  الجدول الزمني لمهام
                  <tspan x={hx} dy="1.3em">مكاتب شؤون الحج</tspan>
                </text>

                <text x={hx} y={hy + 90} fontSize="14" fontWeight="700" fill="#8a7a4a" textAnchor="middle">
                  {todayHijri}
                </text>
              </g>
            );
          })()}

          {points.map(([cx, cy], i) => {
            const [t1, t2, date, icon, prog] = nodes[i];
            const status = getNodeStatus(prog, date);
            const { fill, stroke } = getNodeFill(status, i);
            return (
              <TimelineNode key={i} cx={cx} cy={cy} t1={t1} t2={t2} date={date}
                icon={icon} fill={fill} stroke={stroke}
                progress={prog} status={status} index={i}
                isCurrent={i === currentIdx} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
