import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TimelineTrack from "../components/TimelineTrack";
import TimelineNode, { type NodeStatus } from "../components/TimelineNode";
import { supabase, bgUrl, LOGO, type NodeRow } from "../lib/supabase";

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

export default function Timeline() {
  const navigate = useNavigate();
  const pathRef = useRef<SVGPathElement>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("timeline_nodes")
      .select("*")
      .order("date", { ascending: true })
      .then(({ data }) => { if (data) setNodes(data); setLoading(false); });

    const ch = supabase
      .channel("timeline-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "timeline_nodes" }, ({ new: n }) => {
        setNodes((prev) => prev.some((x) => x.id === (n as NodeRow).id) ? prev : [...prev, n as NodeRow].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "timeline_nodes" }, ({ new: n }) => {
        setNodes((prev) => prev.map((x) => x.id === (n as NodeRow).id ? (n as NodeRow) : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "timeline_nodes" }, ({ old: o }) => {
        setNodes((prev) => prev.filter((x) => x.id !== (o as NodeRow).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

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
                <text x={hx} y={hy + 20} fontSize="26" fontWeight="700" fill="#1E4483" textAnchor="middle">
                  الجدول الزمني لمهام
                  <tspan x={hx} dy="1.3em">مكاتب شؤون الحج</tspan>
                </text>
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
