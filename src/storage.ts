import { createClient } from "@supabase/supabase-js";
import type { Lead } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export function read<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(localStorage.getItem(`leadfind:${key}`) || "null") ?? fallback
    );
  } catch {
    return fallback;
  }
}
export function write(key: string, data: unknown) {
  localStorage.setItem(`leadfind:${key}`, JSON.stringify(data));
}
export async function syncLeads(leads: Lead[]) {
  if (!supabase)
    throw new Error("Supabase is not configured. Local saving is available.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first to sync your leads.");
  const { error } = await supabase
    .from("leadfind_data")
    .upsert({ user_id: user.id, leads, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function loadCloud() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { data, error } = await supabase
    .from("leadfind_data")
    .select("leads")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.leads || []) as Lead[];
}
