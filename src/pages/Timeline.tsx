import { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import ReactCountryFlag from "react-country-flag";
import TimelineTrack, { getTrackViewBoxHeight } from "../components/TimelineTrack";
import TimelineNode, { type NodeStatus } from "../components/TimelineNode";
import {
  supabase, bgUrl, getCompanyBrand,
  progressFromTasks, worksheetLabel,
  type NodeRow, type TaskRow, type WorksheetRow,
} from "../lib/supabase";
import { decodeWorksheetSlug } from "../lib/worksheets";

// ─── Pure helpers ────────────────────────────────────────────────────────────

function getNodeStatus(progress: number, date: string): NodeStatus {
  const past = new Date(date).getTime() <= Date.now();
  if (progress === 100 && past) return "success";
  if (progress === 100)         return "default";
  if (past && progress > 50)    return "warning";
  if (past)                     return "danger";
  return "default";
}

function getNodeFill(status: NodeStatus, idx: number) {
  if (status === "success") return { fill: "url(#gSuccess)", stroke: "#86efac" };
  if (status === "warning") return { fill: "url(#gWarning)", stroke: "#fcd34d" };
  if (status === "danger")  return { fill: "url(#gDanger)",  stroke: "#fca5a5" };
  return idx % 2 === 0
    ? { fill: "url(#gGold)", stroke: "#fbe48c" }
    : { fill: "url(#gBlue)", stroke: "#5a7ad8" };
}

function findCurrentIdx(nodes: NodeRow[]): number {
  const now = Date.now();
  const idx = nodes.findIndex((n) => new Date(n.date).getTime() > now);
  return idx < 0 ? nodes.length - 1 : idx;
}

const COUNTRY_CODES: Record<string, string> = { "النيجر": "NE", "مصر": "EG", "باكستان": "PK" };
const getCountryCode = (c?: string | null) => (c ? COUNTRY_CODES[c] ?? null : null);

const todayHijri = new Intl.DateTimeFormat("ar-SA", {
  calendar: "islamic-umalqura", day: "numeric", month: "long", year: "numeric",
}).format(new Date());

// ─── Types ────────────────────────────────────────────────────────────────────

type TrackItem =
  | { type: "node"; node: NodeRow; nodeIdx: number }
  | { type: "task"; task: TaskRow; nodeIdx: number; taskOrder: number };

// ─── Component ────────────────────────────────────────────────────────────────

export default function Timeline() {
  const navigate       = useNavigate();
  const { company, worksheetSlug } = useParams();
  const currentCompany = company || "alrajhi";
  const brand          = getCompanyBrand(currentCompany);
  const companyName    = currentCompany === "saudia" ? "السعودية" : "الراجحي";
  const resolvedSlug   = decodeWorksheetSlug(worksheetSlug);

  const pathRef = useRef<SVGPathElement>(null);
  const [points,    setPoints]    = useState<[number, number][]>([]);
  const [nodes,     setNodes]     = useState<NodeRow[]>([]);
  const [worksheet, setWorksheet] = useState<WorksheetRow | null>(null);
  const [loading,   setLoading]   = useState(true);

  const showSubtasks = currentCompany === "saudia" && (worksheet?.show_subtasks ?? true);

  // Sub-tasks interleaved before their parent node
  const trackItems = useMemo<TrackItem[]>(() => {
    if (!showSubtasks) return [];
    const items: TrackItem[] = [];
    nodes.forEach((node, ni) => {
      (node.tasks ?? []).forEach((task, order) => items.push({ type: "task", task, nodeIdx: ni, taskOrder: order }));
      items.push({ type: "node", node, nodeIdx: ni });
    });
    return items;
  }, [nodes, showSubtasks]);

  const itemCount = showSubtasks && trackItems.length > 0 ? trackItems.length : nodes.length;

  // ─── Data fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    supabase
      .from("worksheets")
      .select("id,name,slug,label,country,company,show_subtasks")
      .eq("slug", resolvedSlug)
      .eq("company", currentCompany)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) { setWorksheet(null); setNodes([]); setLoading(false); return; }
        setWorksheet(data as WorksheetRow);
        const { data: nodeData } = await supabase
          .from("timeline_nodes")
          .select("*, tasks:timeline_tasks(*)")
          .eq("worksheet_id", data.id)
          .order("date", { ascending: true });
        setNodes((nodeData ?? []) as NodeRow[]);
        setLoading(false);
      });
  }, [resolvedSlug, currentCompany]);

  useEffect(() => {
    if (!worksheet?.id) return;
    supabase
      .from("timeline_nodes")
      .select("*, tasks:timeline_tasks(*)")
      .eq("worksheet_id", worksheet.id)
      .order("date", { ascending: true })
      .then(({ data }) => { if (data) setNodes(data as NodeRow[]); });

    const ch = supabase
      .channel(`timeline-rt-${worksheet.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.some((x) => x.id === (n as NodeRow).id)
          ? prev
          : [...prev, { ...n as NodeRow, tasks: [] }].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.map((x) => x.id === (n as NodeRow).id ? { ...x, ...n as NodeRow } : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ old: o }) => {
        setNodes((prev) => prev.filter((x) => x.id !== (o as NodeRow).id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_tasks" }, ({ new: n }) => {
        setNodes((prev) => prev.map((node) =>
          node.id === n.node_id ? { ...node, tasks: [...(node.tasks || []), n as any] } : node));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_tasks" }, ({ new: n }) => {
        setNodes((prev) => prev.map((node) =>
          node.id === n.node_id ? { ...node, tasks: (node.tasks || []).map((t) => (t.id === n.id ? n as any : t)) } : node));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_tasks" }, ({ old: o }) => {
        setNodes((prev) => prev.map((node) => ({ ...node, tasks: (node.tasks || []).filter((t) => t.id !== o.id) })));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [worksheet?.id]);

  // ─── Point layout ─────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (!nodes.length) return;
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const N  = 500;
    const dt = total / N;

    const ranges: [number, number][] = [];
    let segStart = -1;
    for (let i = 1; i <= N; i++) {
      const prev = path.getPointAtLength((i - 1) * dt);
      const curr = path.getPointAtLength(i * dt);
      const flat = Math.abs(curr.y - prev.y) < 5;
      if (flat && segStart < 0)  segStart = (i - 1) * dt;
      if (!flat && segStart >= 0) { ranges.push([segStart, (i - 1) * dt]); segStart = -1; }
    }
    if (segStart >= 0) ranges.push([segStart, total]);

    const straightLen = ranges.reduce((s, [a, b]) => s + (b - a), 0);
    const step = straightLen / Math.max(itemCount - 1, 1);
    const pts: [number, number][] = [];

    for (let i = 0; i < itemCount; i++) {
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
  }, [nodes, trackItems, itemCount]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const currentIdx = nodes.length > 0 ? findCurrentIdx(nodes) : 0;
  const svgHeight  = getTrackViewBoxHeight(itemCount);
  const pageTitle  = `${worksheet ? worksheetLabel(worksheet) : "الجدول الزمني"} - ${companyName}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl()}')` }}>
        <Helmet><title>{`جاري التحميل - ${companyName}`}</title><link rel="icon" href={brand.logo} /></Helmet>
        <div className="text-2xl font-bold text-white animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl()}')` }}>
        <Helmet><title>{`Worksheet غير موجود - ${companyName}`}</title><link rel="icon" href={brand.logo} /></Helmet>
        <div className="bg-white/95 rounded-2xl shadow-xl p-8 text-center" dir="rtl">
          <h1 className="text-xl font-bold mb-2" style={{ color: brand.primary }}>الـ Worksheet غير موجود</h1>
          <p className="text-sm text-gray-500 mb-5">تأكد من الرابط أو أنشئ Worksheet جديد من لوحة التحكم.</p>
          <button onClick={() => navigate(`/${currentCompany}/dashboard`)}
            className="px-4 py-2 rounded-xl text-white font-bold text-sm cursor-pointer"
            style={{ background: brand.primary }}>
            الذهاب إلى لوحة التحكم
          </button>
        </div>
      </div>
    );
  }

  const headerPt = points[points.length - 1];
  const hx = headerPt ? headerPt[0] / 2 : 270;
  const hy = headerPt ? headerPt[1]     : 210;

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('${bgUrl()}')` }}>
      <Helmet><title>{pageTitle}</title><link rel="icon" href={brand.logo} /></Helmet>

      <div className="w-full max-w-[1990px] mx-auto lg:pr-15 lg:pl-25 pl-5 md:pl-10">
        <svg viewBox={`0 0 1600 ${svgHeight}`} xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet" direction="ltr">
          <TimelineTrack pathRef={pathRef} company={currentCompany} nodeCount={itemCount} />

          {/* Header card */}
          <g className="header-fade">
            <rect x={hx - 155} y={hy - 145} width="310" height="260" rx="16"
              fill="white" opacity="0.95" filter="url(#fShadow)" />
            <image href={brand.logo} x={hx - 130} y={hy - 135} width="260" height="120"
              className="cursor-pointer" onClick={() => navigate(`/${currentCompany}/dashboard`)} />
            <foreignObject x={hx - 140} y={hy + 2} width="280" height="76">
              <div className="flex flex-col items-center justify-center" style={{ color: brand.primary }}>
                <div className="text-[26px] font-bold leading-tight">الجدول الزمني لمهام</div>
                <div className="text-[26px] font-bold leading-tight flex items-center gap-2">
                  {worksheetLabel(worksheet)}
                  {getCountryCode(worksheet.country) && (
                    <ReactCountryFlag svg countryCode={getCountryCode(worksheet.country)!}
                      style={{ width: "1.1em", height: "1.1em" }}
                      aria-label={worksheet.country ?? ""} title={worksheet.country ?? ""} />
                  )}
                </div>
              </div>
            </foreignObject>
            <text x={hx} y={hy + 90} fontSize="14" fontWeight="700"
              fill={brand.primary} textAnchor="middle">{todayHijri}</text>
          </g>

          {/* Nodes & sub-tasks */}
          {points.map(([cx, cy], i) => {
            if (showSubtasks && trackItems.length > 0) {
              const item = trackItems[i];
              if (!item) return null;

              if (item.type === "node") {
                const { node, nodeIdx } = item;
                const prog   = progressFromTasks(node);
                const status = getNodeStatus(prog, node.date);
                const { fill, stroke } = getNodeFill(status, nodeIdx);
                return (
                  <TimelineNode key={`node-${node.id}`}
                    cx={cx} cy={cy} title={node.title} date={node.date}
                    icon={node.icon} fill={fill} stroke={stroke}
                    progress={prog} status={status} index={nodeIdx}
                    isCurrent={nodeIdx === currentIdx} company={currentCompany} />
                );
              }

              const { task, nodeIdx, taskOrder } = item;
              const isDone     = !!task.is_done;
              const dueTime    = new Date(nodes[nodeIdx]?.date ?? "").getTime();
              const isOverdue  = Number.isFinite(dueTime) && dueTime <= Date.now();
              const taskStatus: NodeStatus = isDone ? "success" : (isOverdue ? "danger" : "default");
              const { fill, stroke } = getNodeFill("default", nodeIdx);
              const adj = trackItems[i - 1]?.type === "node" || trackItems[i + 1]?.type === "node";
              return (
                <TimelineNode key={`task-${task.id}`}
                  cx={cx} cy={cy} title={task.title}
                  icon={task.icon ?? ""} fill={fill} stroke={stroke}
                  progress={isDone ? 100 : 0} status={taskStatus}
                  index={i} isCurrent={false} company={currentCompany}
                  nodeScale={0.58}
                  titlePlacement={taskOrder % 2 === 0 ? "top" : "bottom"}
                  titleFontScale={1.75}
                  titleShiftY={adj ? 5 : 0}
                  showProgress={false}
                  showStatusRing={taskStatus !== "default"}
                  animate={false} />
              );
            }

            // Standard (non-saudia or subtasks hidden)
            const node     = nodes[i];
            const prog     = currentCompany === "saudia" ? progressFromTasks(node) : node.progress;
            const status   = getNodeStatus(prog, node.date);
            const { fill, stroke } = getNodeFill(status, i);
            return (
              <TimelineNode key={node.id}
                cx={cx} cy={cy} title={node.title} date={node.date}
                icon={node.icon} fill={fill} stroke={stroke}
                progress={prog} status={status} index={i}
                isCurrent={i === currentIdx} company={currentCompany} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
