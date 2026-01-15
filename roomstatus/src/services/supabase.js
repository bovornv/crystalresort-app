import { createClient } from '@supabase/supabase-js'

// Supabase configuration using environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Check if environment variables are set
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== '' && supabaseAnonKey !== '' &&
  !supabaseUrl.includes('your-project') && !supabaseAnonKey.includes('your-anon-key')

if (!isSupabaseConfigured) {
  console.error('❌ Supabase environment variables not set or invalid!')
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables')
  console.error('   Current values:', {
    url: supabaseUrl || 'MISSING',
    key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING'
  })
} else {
  console.log('✅ Supabase environment variables detected')
}

// Create a single Supabase client instance
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export default supabase
