import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://vwytubmpegdumadzxmiq.supabase.co';
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WSbA9WeSmuyueB1KhxSjWg_o4LEqRgU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
