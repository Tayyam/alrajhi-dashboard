import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactCountryFlag from "react-country-flag";
import TimelineTrack from "../components/TimelineTrack";
import TimelineNode, { type NodeStatus } from "../components/TimelineNode";
import { supabase, bgUrl, LOGO, type NodeRow, type WorksheetRow } from "../lib/supabase";
import { decodeWorksheetSlug } from "../lib/worksheets";

function getNodeStatus(progress: number, date: string): NodeStatus {
  const past = new Date(date).getTime() <= Date.now();
  if (progress === 100 && past) return "success";
  if (progress === 100) return "default";
  if (past && progress > 50) return "warning";
  if (past) return "danger";
  return "default";
}

function getNodeFill(status: NodeStatus, i: number) {
  if (status === "success") return { fill: "url(#gSuccess)", stroke: "#86efac" };
  if (status === "warning") return { fill: "url(#gWarning)", stroke: "#fcd34d" };
  if (status === "danger")  return { fill: "url(#gDanger)",  stroke: "#fca5a5" };
  const gold = (i >= 4 && i < 8) || (i >= 12 && i < 16);
  return gold
    ? { fill: "url(#gGold)", stroke: "#fbe48c" }
    : { fill: "url(#gBlue)", stroke: "#5a7ad8" };
}

function findCurrentIdx(nodes: NodeRow[]) {
  const now = Date.now();
  const idx = nodes.findIndex((n) => new Date(n.date).getTime() > now);
  if (idx < 0) return nodes.length - 1;
  return idx;
}

const todayHijri = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

function getCountryCode(country?: string | null) {
  if (!country) return null;
  const map: Record<string, string> = {
    "النيجر": "NE",
    "مصر": "EG",
    "باكستان": "PK",
  };
  return map[country] ?? null;
}

function worksheetLabelText(worksheet?: WorksheetRow | null) {
  if (!worksheet) return "";
  return worksheet.label?.trim() || worksheet.name;
}

export default function Timeline() {
  const navigate = useNavigate();
  const { worksheetSlug } = useParams();
  const resolvedSlug = decodeWorksheetSlug(worksheetSlug);
  const pathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [worksheet, setWorksheet] = useState<WorksheetRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("worksheets")
      .select("id,name,slug,label,country")
      .eq("slug", resolvedSlug)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setWorksheet(null);
          setNodes([]);
          setLoading(false);
          return;
        }
        setWorksheet(data as WorksheetRow);
        const { data: nodeData } = await supabase
          .from("timeline_nodes")
          .select("*")
          .eq("worksheet_id", data.id)
          .order("date", { ascending: true });
        setNodes((nodeData ?? []) as NodeRow[]);
        setLoading(false);
      });
  }, [resolvedSlug]);

  useEffect(() => {
    if (!worksheet?.id) return;

    supabase
      .from("timeline_nodes")
      .select("*")
      .eq("worksheet_id", worksheet.id)
      .order("date", { ascending: true })
      .then(({ data }) => { if (data) setNodes(data as NodeRow[]); });

    const ch = supabase
      .channel(`timeline-rt-${worksheet.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.some((x) => x.id === (n as NodeRow).id) ? prev : [...prev, n as NodeRow].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.map((x) => x.id === (n as NodeRow).id ? (n as NodeRow) : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ old: o }) => {
        setNodes((prev) => prev.filter((x) => x.id !== (o as NodeRow).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [worksheet?.id]);

  useLayoutEffect(() => {
    if (!nodes.length) return;
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const N = 500;
    const dt = total / N;

    const ranges: [number, number][] = [];
    let segStart = -1;
    for (let i = 1; i <= N; i++) {
      const prev = path.getPointAtLength((i - 1) * dt);
      const curr = path.getPointAtLength(i * dt);
      const flat = Math.abs(curr.y - prev.y) < 5;
      if (flat && segStart < 0) segStart = (i - 1) * dt;
      if (!flat && segStart >= 0) { ranges.push([segStart, (i - 1) * dt]); segStart = -1; }
    }
    if (segStart >= 0) ranges.push([segStart, total]);

    const straightLen = ranges.reduce((s, [a, b]) => s + (b - a), 0);
    const step = straightLen / (nodes.length - 1);
    const pts: [number, number][] = [];
    for (let i = 0; i < nodes.length; i++) {
      let target = step * i;
      let len = 0;
      for (const [a, b] of ranges) {
        const seg = b - a;
        if (target <= seg + 0.001) { len = a + target; break; }
        target -= seg;
      }
      const { x, y } = path.getPointAtLength(len);
      pts.push([Math.round(x), Math.round(y)]);
    }
    pts.reverse();
    setPoints(pts);
  }, [nodes]);

  const currentIdx = nodes.length > 0 ? findCurrentIdx(nodes) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl()}')` }}>
        <div className="text-2xl font-bold text-white animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl()}')` }}>
        <div className="bg-white/95 rounded-2xl shadow-xl p-8 text-center" dir="rtl">
          <h1 className="text-xl font-bold text-[#1E4483] mb-2">الـ Worksheet غير موجود</h1>
          <p className="text-sm text-gray-500 mb-5">تأكد من الرابط أو أنشئ Worksheet جديد من لوحة التحكم.</p>
          <button onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-xl bg-[#1E4483] text-white font-bold text-sm cursor-pointer">
            الذهاب إلى لوحة التحكم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${bgUrl()}')` }}>
      <div className="w-full max-w-[1990px] mx-auto lg:pr-15 lg:pl-25 pl-5 md:pl-10">
        <svg viewBox="0 0 1600 884" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" direction="ltr">
          <TimelineTrack pathRef={pathRef} />

          {points.length > 0 && (() => {
            const [, hy] = points[points.length - 1];
            const hx = points[points.length - 1][0] / 2;
            return (
              <g className="header-fade">
                <rect x={hx - 155} y={hy - 145} width="310" height="260" rx="16" fill="white" opacity="0.95" filter="url(#fShadow)" />
                <image href={LOGO} x={hx - 130} y={hy - 135} width="260" height="120"
                  className="cursor-pointer" onClick={() => navigate("/login")} />
                <foreignObject x={hx - 140} y={hy + 2} width="280" height="76">
                  <div className="flex flex-col items-center justify-center text-[#1E4483]">
                    <div className="text-[26px] font-bold leading-tight">الجدول الزمني لمهام</div>
                    <div className="text-[26px] font-bold leading-tight flex items-center gap-2">
                      {worksheetLabelText(worksheet)}
                      {getCountryCode(worksheet.country) && (
                        <ReactCountryFlag
                          svg
                          countryCode={getCountryCode(worksheet.country)!}
                          style={{ width: "1.1em", height: "1.1em" }}
                          aria-label={worksheet.country ?? ""}
                          title={worksheet.country ?? ""}
                        />
                      )}
                    </div>
                  </div>
                </foreignObject>
                <text x={hx} y={hy + 90} fontSize="14" fontWeight="700" fill="#B99A57" textAnchor="middle">
                  {todayHijri}
                </text>
              </g>
            );
          })()}

          {points.map(([cx, cy], i) => {
            const node = nodes[i];
            const status = getNodeStatus(node.progress, node.date);
            const { fill, stroke } = getNodeFill(status, i);
            return (
              <TimelineNode key={node.id} cx={cx} cy={cy} title={node.title} date={node.date}
                icon={node.icon} fill={fill} stroke={stroke}
                progress={node.progress} status={status} index={i}
                isCurrent={i === currentIdx} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
