import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://msqglwmdsizgnfqsutrp.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcWdsd21kc2l6Z25mcXN1dHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODcxNzAsImV4cCI6MjA4NzM2MzE3MH0.R4xVh0e6lxBRyA9afUvzbF3ldb59EfoQqAlX0sBTuM4";

export const supabase = createClient(url, key);

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TaskRow {
  id: number;
  node_id: number;
  title: string;
  is_done: boolean;
  icon?: string | null;
  sort_order?: number | null;
  created_at?: string;
}

export interface NodeRow {
  id: number;
  title: string;
  date: string;
  icon: string;
  progress: number;
  worksheet_id: string;
  tasks?: TaskRow[];
}

export interface WorksheetRow {
  id: string;
  name: string;
  slug: string;
  label?: string | null;
  country?: string | null;
  company: string;
  show_subtasks?: boolean;
}

export interface CompanyBrand {
  primary: string;
  secondary: string;
  logo: string;
}

// ─── URLs ─────────────────────────────────────────────────────────────────────

const render = (bucket: string, path: string, opts: string) =>
  `${url}/storage/v1/render/image/public/${bucket}/${path}?${opts}`;

export const iconUrl = (name?: string | null) =>
  render("icons", `${(name || "document").trim() || "document"}.png`, "width=64&height=64&resize=contain");

export const bgUrl = (company?: string) =>
  company === "saudia" ? "/backgroundsaudia.jpeg" : "/backgroundalrajhi.jpeg";

export const LOGO    = "/logorajhi.webp";

// ─── Brand ───────────────────────────────────────────────────────────────────

export function getCompanyBrand(company?: string): CompanyBrand {
  if (company === "saudia") {
    return { primary: "#046A38", secondary: "#FFFEFF", logo: "/logosaudia.jpg" };
  }
  return { primary: "#1E4483", secondary: "#B99A57", logo: LOGO };
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

/** Progress percentage derived from sub-tasks (for Saudia nodes). */
export function progressFromTasks(node: NodeRow): number {
  const total = node.tasks?.length ?? 0;
  if (!total) return 0;
  const done = node.tasks?.filter((t) => t.is_done).length ?? 0;
  return Math.round((done / total) * 100);
}

/** Display label for a worksheet (label takes priority over name). */
export function worksheetLabel(worksheet?: WorksheetRow | null): string {
  return worksheet?.label?.trim() || worksheet?.name || "";
}

/** Stable ordering for sub-tasks (priority first, then created/id fallback). */
export function sortTasks(tasks?: TaskRow[] | null): TaskRow[] {
  return [...(tasks ?? [])].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    const at = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (at !== bt) return at - bt;
    return a.id - b.id;
  });
}
