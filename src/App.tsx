import { useLayoutEffect, useRef, useState } from "react";
import TimelineTrack from "./components/TimelineTrack";
import TimelineNode from "./components/TimelineNode";

// [t1, t2, date, icon]
type NodeData = [string, string, string, string];

const nodes: NodeData[] = [
  ["بداية وصول",              "الحجاج",                       "2026-04-18", "pilgrim"],
  ["استلام المخيمات",          "جاهزة",                        "2026-04-18", "camping"],
  ["ادخال بيانات",             "الاستعداد المسبق",             "2026-03-25", "approved"],
  ["اصدار",                    "التأشيرات",                    "2026-03-20", "passport"],
  ["رفع بيانات الحجاج",        "وتكوين المجموعات",             "2026-02-08", "group"],
  ["الانتهاء من التعاقدات",     "على خدمات النقل",              "2026-02-01", "logistic"],
  ["الانتهاء من التعاقدات",     "على السكن",                    "2026-02-01", "home"],
  ["تحويل الأموال للسكن",       "وخدمات النقل",                 "2026-01-20", "accommodation"],
  ["تعيين الناقلات الجوية",     "وجدولة الرحلات",               "2026-01-04", "airplane"],
  ["التعاقد على حزم الخدمات",   "ودفع قيمتها",                  "2026-01-04", "box"],
  ["تحويل الأموال المطلوبة",    "للتعاقد على الخدمات الأساسية", "2025-12-21", "credit-card"],
  ["توقيع اتفاقية",            "رغبات التفويج",                "2025-11-09", "application"],
  ["توثيق التعاقدات",           "مع الشركات في مؤتمر الحج",     "2025-11-09", "contract"],
  ["توقيع اتفاقياة",           "وترتيب شؤون الحجاج",           "2025-11-09", "agreement"],
  ["الموعد النهائي لإعلان",     "تسجيل الحجاج",                 "2025-10-12", "calendar"],
  ["بدأ الاجتماعات",            "التحضيرية",                    "2025-10-12", "people"],
  ["تأكيد الاحتفاظ بالمخيمات",  "من الموسم السابق",             "2025-08-23", "folder"],
  ["الاطلاع على بيانات المخيمات","عبر منصة نسك مسار",            "2025-07-26", "data"],
  ["استلام نموذج التوعية",      "للضيوف الرحمن",                "2025-06-08", "checklist"],
  ["استلام وثيقة",             "الترتيبات الأولية والبرنامج",   "2025-06-08", "document"],
];

function nodeStyle(i: number) {
  const ri = nodes.length - 1 - i;
  const gold = (ri >= 4 && ri < 8) || (ri >= 12 && ri < 16);
  return gold
    ? { fill: "url(#gGold)", stroke: "#fbe48c" }
    : { fill: "url(#gBlue)", stroke: "#5a7ad8" };
}

function findCurrentStage() {
  const now = Date.now();
  const firstPastIdx = nodes.findIndex(([, , d]) => new Date(d).getTime() <= now);
  if (firstPastIdx <= 0) return { idx: 0, pct: 0 };
  const idx = firstPastIdx - 1;
  const prev = new Date(nodes[firstPastIdx][2]).getTime();
  const next = new Date(nodes[idx][2]).getTime();
  const pct = Math.round(((now - prev) / (next - prev)) * 100);
  return { idx, pct: Math.max(0, Math.min(100, pct)) };
}

const { idx: currentIdx, pct: progress } = findCurrentStage();

const todayHijri = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const todayGregorian = new Intl.DateTimeFormat("ar-SA", {
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
    <div className="w-full max-w-[1990px] mx-auto lg:pr-15 lg:pl-25 pl-5 md:pl-10 relative">
      <svg viewBox="0 0 1600 884" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" direction="ltr">
        <TimelineTrack pathRef={pathRef} />

        {points.length > 0 && (() => {
          const hx = points[0][0] / 2;
          const hy = points[0][1];
          return (
            <g className="header-fade">
              <image href="/logo-4.png" x={hx - 120} y={hy - 120} width="240" height="110" />
              <text x={hx} y={hy + 10} fontSize="26" fontWeight="700" fill="#334278" textAnchor="middle">
                الجدول الزمني لمهام
                <tspan x={hx} dy="1.3em">مكاتب شؤون الحج</tspan>
              </text>

              <rect x={hx - 100} y={hy + 55} width="200" height="52" rx="10"
                fill="#f8f4e8" stroke="#c9a227" strokeWidth="1" />
              <text x={hx} y={hy + 76} fontSize="13" fontWeight="700" fill="#334278" textAnchor="middle">
                {todayHijri}
              </text>
              <text x={hx} y={hy + 96} fontSize="12" fontWeight="600" fill="#8a7a4a" textAnchor="middle">
                {todayGregorian}
              </text>
            </g>
          );
        })()}

        {points.map(([cx, cy], i) => {
          const [t1, t2, date, icon] = nodes[i];
          const { fill, stroke } = nodeStyle(i);
          return (
            <TimelineNode key={i} cx={cx} cy={cy} t1={t1} t2={t2} date={date}
              icon={icon} fill={fill} stroke={stroke}
              progress={i === currentIdx ? progress : undefined} index={i} />
          );
        })}
      </svg>
    </div>
  );
}
