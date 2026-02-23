import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://msqglwmdsizgnfqsutrp.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zcWdsd21kc2l6Z25mcXN1dHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODcxNzAsImV4cCI6MjA4NzM2MzE3MH0.R4xVh0e6lxBRyA9afUvzbF3ldb59EfoQqAlX0sBTuM4";

export const supabase = createClient(url, key);

export interface NodeRow {
  id: number;
  title: string;
  date: string;
  icon: string;
  progress: number;
}

export const iconUrl = (name: string) => `${url}/storage/v1/object/public/icons/${name}.png`;
export const assetUrl = (name: string) => `${url}/storage/v1/object/public/assets/${name}`;
export const LOGO_KEY = "logo.png";
export const BG_KEY = "background.jpeg";
