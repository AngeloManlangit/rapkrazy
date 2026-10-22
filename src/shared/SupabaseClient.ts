// src/shared/SupabaseClient.ts  (match whatever casing your file already has)
// If a teammate already created a Supabase client, delete this file and import theirs instead.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// null until the keys are in .env, so the app still runs without a Supabase project.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
