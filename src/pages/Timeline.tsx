import { useLayoutEffect, useRef, useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import ReactCountryFlag from "react-country-flag";
import TimelineTrack, { getTrackViewBoxHeight } from "../components/TimelineTrack";
import TimelineNode, { type NodeStatus } from "../components/TimelineNode";
import { supabase, bgUrl, getCompanyBrand, type NodeRow, type TaskRow, type WorksheetRow } from "../lib/supabase";
import { decodeWorksheetSlug } from "../lib/worksheets";

function getNodeStatus(progress: number, date: string): NodeStatus {
  const past = new Date(date).getTime() <= Date.now();
  if (progress === 100 && past) return "success";
  if (progress === 100) return "default";
  if (past && progress > 50) return "warning";
  if (past) return "danger";
  return "default";
}

function getNodeFill(status: NodeStatus, i: number, company?: string) {
  const isSaudia = company === "saudia";
  if (status === "success") return { fill: "url(#gSuccess)", stroke: "#86efac" };
  if (status === "warning") return { fill: "url(#gWarning)", stroke: "#fcd34d" };
  if (status === "danger")  return { fill: "url(#gDanger)",  stroke: "#fca5a5" };
  const useGold = i % 2 === 0;
  if (isSaudia) {
    return useGold
      ? { fill: "url(#gBlue)", stroke: "#ffffff" }
      : { fill: "url(#gBlue)", stroke: "#8ed6b4" };
  }
  return useGold
    ? { fill: "url(#gGold)", stroke: "#fbe48c" }
    : { fill: "url(#gBlue)", stroke: "#5a7ad8" };
}

function findCurrentIdx(nodes: NodeRow[]) {
  const now = Date.now();
  const idx = nodes.findIndex((n) => new Date(n.date).getTime() > now);
  if (idx < 0) return nodes.length - 1;
  return idx;
}

function progressFromTasks(node: NodeRow) {
  const total = node.tasks?.length ?? 0;
  if (!total) return 0;
  const done = node.tasks?.filter((t) => t.is_done).length ?? 0;
  return Math.round((done / total) * 100);
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

type TrackItem =
  | { type: "node"; node: NodeRow; nodeIdx: number }
  | { type: "task"; task: TaskRow; nodeIdx: number; taskOrder: number };

export default function Timeline() {
  const navigate = useNavigate();
  const { company, worksheetSlug } = useParams();
  const currentCompany = company || "alrajhi";
  const brand = getCompanyBrand(currentCompany);
  const companyName = currentCompany === "saudia" ? "السعودية" : "الراجحي";
  const resolvedSlug = decodeWorksheetSlug(worksheetSlug);
  const pathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [worksheet, setWorksheet] = useState<WorksheetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const showSaudiaSubtasks = currentCompany === "saudia" && (worksheet?.show_subtasks ?? true);

  // For Saudia: put sub-tasks first, then main node on the same track
  const trackItems = useMemo<TrackItem[]>(() => {
    if (!showSaudiaSubtasks) return [];
    const items: TrackItem[] = [];
    nodes.forEach((node, ni) => {
      (node.tasks ?? []).forEach((task, taskOrder) => {
        items.push({ type: "task", task, nodeIdx: ni, taskOrder });
      });
      items.push({ type: "node", node, nodeIdx: ni });
    });
    return items;
  }, [nodes, showSaudiaSubtasks]);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("worksheets")
      .select("id,name,slug,label,country,company,show_subtasks")
      .eq("slug", resolvedSlug)
      .eq("company", currentCompany)
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
        setNodes((prev) => prev.some((x) => x.id === (n as NodeRow).id) ? prev : [...prev, { ...n as NodeRow, tasks: [] }].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ new: n }) => {
        setNodes((prev) => prev.map((x) => x.id === (n as NodeRow).id ? { ...x, ...n as NodeRow } : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_nodes", filter: `worksheet_id=eq.${worksheet.id}` }, ({ old: o }) => {
        setNodes((prev) => prev.filter((x) => x.id !== (o as NodeRow).id));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_tasks" }, ({ new: n }) => {
        setNodes((prev) => prev.map(node => node.id === n.node_id ? { ...node, tasks: [...(node.tasks || []), n as any] } : node));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_tasks" }, ({ new: n }) => {
        setNodes((prev) => prev.map(node => node.id === n.node_id ? { ...node, tasks: (node.tasks || []).map(t => t.id === n.id ? n as any : t) } : node));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_tasks" }, ({ old: o }) => {
        setNodes((prev) => prev.map(node => ({ ...node, tasks: (node.tasks || []).filter(t => t.id !== o.id) })));
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
    const itemCount = showSaudiaSubtasks && trackItems.length > 0 ? trackItems.length : nodes.length;
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
  }, [nodes, trackItems, showSaudiaSubtasks]);

  const currentIdx = nodes.length > 0 ? findCurrentIdx(nodes) : 0;
  const itemCount  = showSaudiaSubtasks && trackItems.length > 0
    ? trackItems.length
    : nodes.length;
  const svgHeight  = getTrackViewBoxHeight(itemCount);
  const pageTitle = `${worksheet ? worksheetLabelText(worksheet) : "الجدول الزمني"} - ${companyName}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl()}')` }}>
        <Helmet>
          <title>{`جاري التحميل - ${companyName}`}</title>
          <link rel="icon" href={brand.logo} />
        </Helmet>
        <div className="text-2xl font-bold text-white animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${bgUrl()}')` }}>
        <Helmet>
          <title>{`Worksheet غير موجود - ${companyName}`}</title>
          <link rel="icon" href={brand.logo} />
        </Helmet>
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

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('${bgUrl()}')` }}>
      <Helmet>
        <title>{pageTitle}</title>
        <link rel="icon" href={brand.logo} />
      </Helmet>
      <div className="w-full max-w-[1990px] mx-auto lg:pr-15 lg:pl-25 pl-5 md:pl-10">
        <svg viewBox={`0 0 1600 ${svgHeight}`} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" direction="ltr">
          <TimelineTrack pathRef={pathRef} company={currentCompany} nodeCount={itemCount} />

          {(() => {
            const hasPoints = points.length > 0;
            const hy = hasPoints ? points[points.length - 1][1] : 210;
            const hx = hasPoints ? points[points.length - 1][0] / 2 : 270;

            return (
              <g className="header-fade">
                <rect x={hx - 155} y={hy - 145} width="310" height="260" rx="16" fill="white" opacity="0.95" filter="url(#fShadow)" />
                <image href={brand.logo} x={hx - 130} y={hy - 135} width="260" height="120"
                  className="cursor-pointer" onClick={() => navigate(`/${currentCompany}/dashboard`)} />
                <foreignObject x={hx - 140} y={hy + 2} width="280" height="76">
                  <div className="flex flex-col items-center justify-center" style={{ color: brand.primary }}>
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
                <text x={hx} y={hy + 90} fontSize="14" fontWeight="700" fill={brand.primary} textAnchor="middle">
                  {todayHijri}
                </text>
              </g>
            );
          })()}

          {showSaudiaSubtasks && trackItems.length > 0
            ? points.map(([cx, cy], i) => {
                const item = trackItems[i];
                if (!item) return null;

                if (item.type === "node") {
                  const { node, nodeIdx } = item;
                  const nodeProgress = progressFromTasks(node);
                  const status = getNodeStatus(nodeProgress, node.date);
                  const { fill, stroke } = getNodeFill(status, nodeIdx, currentCompany);
                  return (
                    <TimelineNode key={`node-${node.id}`} cx={cx} cy={cy}
                      title={node.title} date={node.date}
                      icon={node.icon} fill={fill} stroke={stroke}
                      progress={nodeProgress} status={status} index={nodeIdx}
                      isCurrent={nodeIdx === currentIdx} company={currentCompany} />
                  );
                }

                // Sub-task: same node look but smaller
                const { task, nodeIdx: tNodeIdx, taskOrder } = item;
                const isDone = !!task.is_done;
                const dueTime = new Date(nodes[tNodeIdx]?.date ?? "").getTime();
                const isOverdue = Number.isFinite(dueTime) && dueTime <= Date.now();
                const taskStatus: NodeStatus = isDone ? "success" : (isOverdue ? "danger" : "default");
                const taskFill = getNodeFill("default", tNodeIdx, currentCompany).fill;
                const taskStroke = getNodeFill("default", tNodeIdx, currentCompany).stroke;
                const prevItem = trackItems[i - 1];
                const nextItem = trackItems[i + 1];
                const adjacentToMainNode = prevItem?.type === "node" || nextItem?.type === "node";
                return (
                  <TimelineNode
                    key={`task-${task.id}`}
                    cx={cx} cy={cy}
                    title={task.title}
                    icon={task.icon ?? ""}
                    fill={taskFill}
                    stroke={taskStroke}
                    progress={isDone ? 100 : 0}
                    status={taskStatus}
                    index={i}
                    isCurrent={false}
                    company={currentCompany}
                    nodeScale={0.58}
                    titlePlacement={taskOrder % 2 === 0 ? "top" : "bottom"}
                    titleFontScale={1.75}
                    titleShiftY={adjacentToMainNode ? 5 : 0}
                    showProgress={false}
                    showStatusRing={taskStatus !== "default"}
                    statusRingStatic
                    animate={false}
                  />
                );
              })
            : points.map(([cx, cy], i) => {
                const node = nodes[i];
                const nodeProgress = currentCompany === "saudia" ? progressFromTasks(node) : node.progress;
                const status = getNodeStatus(nodeProgress, node.date);
                const { fill, stroke } = getNodeFill(status, i, currentCompany);
                return (
                  <TimelineNode key={node.id} cx={cx} cy={cy} title={node.title} date={node.date}
                    icon={node.icon} fill={fill} stroke={stroke}
                    progress={nodeProgress} status={status} index={i}
                    isCurrent={i === currentIdx} company={currentCompany} />
                );
              })}
        </svg>
      </div>
    </div>
  );
}
