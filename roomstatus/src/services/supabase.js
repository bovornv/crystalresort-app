import { createClient } from '@supabase/supabase-js'

// Check authentication before initializing Supabase
const isAuthenticated = typeof window !== 'undefined' && 
  localStorage.getItem("crystal_roomstatus_auth") === "true";

// Supabase configuration using environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Check if environment variables are set
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== '' && supabaseAnonKey !== '' &&
  !supabaseUrl.includes('your-project') && !supabaseAnonKey.includes('your-anon-key') &&
  !supabaseUrl.includes('placeholder') && !supabaseAnonKey.includes('placeholder-key')

// Only log Supabase status in development mode to reduce console noise
if (import.meta.env.DEV) {
  if (isSupabaseConfigured) {
    console.log('✅ Supabase environment variables detected')
  } else {
    console.warn('⚠️ Supabase not configured - app requires Supabase to function')
  }
}

// Create a single Supabase client instance
// Only create client if authenticated AND configured, otherwise create a no-op client that won't attempt connections
let supabaseClient;

if (isAuthenticated && isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Create a minimal client that won't attempt realtime connections
  // Use a valid-looking but non-functional URL to prevent connection attempts
  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    realtime: {
      // Disable realtime completely for placeholder client
      transport: 'websocket',
      params: {
        eventsPerSecond: 0
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Replace realtime with a mock object to prevent any connection attempts
  if (supabaseClient.realtime) {
    // Disconnect any existing connection first
    try {
      supabaseClient.realtime.disconnect();
    } catch (e) {
      // Ignore errors
    }
    
    // Replace realtime with a mock that prevents all connection attempts
    supabaseClient.realtime = {
      connect: function() {
        // No-op: don't attempt to connect with placeholder values
        return this;
      },
      disconnect: function() {
        return this;
      },
      channel: function(name, opts) {
        // Return a mock channel that won't attempt connections
        return {
          on: function() { return this; },
          subscribe: function() { return this; },
          unsubscribe: function() { return this; },
          send: function() { return this; }
        };
      },
      removeChannel: function() { return this; },
      removeAllChannels: function() { return this; },
      isConnected: function() { return false; }
    };
  }
}

export const supabase = supabaseClient;

export default supabase
