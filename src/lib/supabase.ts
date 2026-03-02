import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://msqglwmdsizgnfqsutrp.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcWdsd21kc2l6Z25mcXN1dHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODcxNzAsImV4cCI6MjA4NzM2MzE3MH0.R4xVh0e6lxBRyA9afUvzbF3ldb59EfoQqAlX0sBTuM4";

export const supabase = createClient(url, key);

export interface TaskRow {
  id: number;
  node_id: number;
  title: string;
  is_done: boolean;
  progress?: number;
  icon?: string | null;
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
}

const render = (bucket: string, path: string, opts: string) =>
  `${url}/storage/v1/render/image/public/${bucket}/${path}?${opts}`;

export const iconUrl = (name: string) => render("icons", `${name}.png`, "width=64&height=64&resize=contain");
export const bgUrl = () => render("assets", "background.jpeg", "width=1920&quality=90");
export const LOGO = "/logorajhi.webp";
export const BG_KEY = "background.jpeg";

export interface CompanyBrand {
  primary: string;
  secondary: string;
  logo: string;
}

export function getCompanyBrand(company?: string): CompanyBrand {
  if (company === "saudia") {
    return {
      primary: "#046A38",
      secondary: "#FFFEFF",
      logo: "/logosaudia.jpg",
    };
  }

  return {
    primary: "#1E4483",
    secondary: "#B99A57",
    logo: LOGO,
  };
}
