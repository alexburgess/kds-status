import { File } from "node:buffer";
import { createRequire } from "node:module";
import type * as SupabaseJs from "@supabase/supabase-js";

const require = createRequire(import.meta.url);

if (!("File" in globalThis)) {
  Object.defineProperty(globalThis, "File", {
    value: File,
    configurable: true
  });
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  const { createClient } = require("@supabase/supabase-js") as typeof SupabaseJs;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
