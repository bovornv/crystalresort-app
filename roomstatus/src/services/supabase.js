import { createClient } from '@supabase/supabase-js'

// Supabase configuration using environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Check if environment variables are set
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== '' && supabaseAnonKey !== '' &&
  !supabaseUrl.includes('your-project') && !supabaseAnonKey.includes('your-anon-key')

// Only log Supabase status in development mode to reduce console noise
if (import.meta.env.DEV) {
  if (isSupabaseConfigured) {
    console.log('✅ Supabase environment variables detected')
  } else {
    console.warn('⚠️ Supabase not configured - app requires Supabase to function')
  }
}

// Create a single Supabase client instance
// Use dummy values if not configured to prevent errors
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export default supabase
