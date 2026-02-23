import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function iconUrl(name: string) {
  return `${supabaseUrl}/storage/v1/object/public/icons/${name}.png`;
}

export function assetUrl(name: string) {
  return `${supabaseUrl}/storage/v1/object/public/assets/${name}`;
}

export const LOGO_KEY = "logo.png";
export const BG_KEY = "background.jpeg";
