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
  // Create a completely no-op client that won't attempt any connections
  // Mock all methods to prevent network requests
  const mockQueryBuilder = {
    select: function() { return this; },
    insert: function() { return this; },
    update: function() { return this; },
    upsert: function() { return this; },
    delete: function() { return this; },
    eq: function() { return this; },
    neq: function() { return this; },
    gt: function() { return this; },
    gte: function() { return this; },
    lt: function() { return this; },
    lte: function() { return this; },
    like: function() { return this; },
    ilike: function() { return this; },
    is: function() { return this; },
    in: function() { return this; },
    contains: function() { return this; },
    containedBy: function() { return this; },
    rangeGt: function() { return this; },
    rangeGte: function() { return this; },
    rangeLt: function() { return this; },
    rangeLte: function() { return this; },
    rangeAdjacent: function() { return this; },
    overlaps: function() { return this; },
    textSearch: function() { return this; },
    match: function() { return this; },
    not: function() { return this; },
    or: function() { return this; },
    filter: function() { return this; },
    order: function() { return this; },
    limit: function() { return this; },
    range: function() { return this; },
    abortSignal: function() { return this; },
    single: function() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle: function() { return Promise.resolve({ data: null, error: null }); },
    csv: function() { return Promise.resolve({ data: null, error: null }); },
    geojson: function() { return Promise.resolve({ data: null, error: null }); },
    explain: function() { return Promise.resolve({ data: null, error: null }); },
    rollback: function() { return Promise.resolve({ data: null, error: null }); },
    returns: function() { return this; },
    then: function(resolve) { 
      return Promise.resolve({ data: null, error: null }).then(resolve); 
    },
    catch: function(reject) { 
      return Promise.resolve({ data: null, error: null }).catch(reject); 
    }
  };

  // Mock channel object that matches Supabase's channel API
  const mockChannel = {
    on: function() { return this; },
    subscribe: function(callback) { 
      // If callback provided, call it with a safe status
      if (typeof callback === 'function') {
        // Use setTimeout to make it async like real Supabase
        setTimeout(() => callback('CLOSED'), 0);
      }
      return this; 
    },
    unsubscribe: function() { return this; },
    send: function() { return this; }
  };

  supabaseClient = {
    from: function() { return mockQueryBuilder; },
    rpc: function() { return Promise.resolve({ data: null, error: null }); },
    rest: function() { return mockQueryBuilder; },
    channel: function() { return mockChannel; },
    auth: {
      getUser: function() { return Promise.resolve({ data: { user: null }, error: null }); },
      getSession: function() { return Promise.resolve({ data: { session: null }, error: null }); },
      signUp: function() { return Promise.resolve({ data: { user: null, session: null }, error: null }); },
      signInWithPassword: function() { return Promise.resolve({ data: { user: null, session: null }, error: null }); },
      signInWithOtp: function() { return Promise.resolve({ data: null, error: null }); },
      signInWithOAuth: function() { return Promise.resolve({ data: null, error: null }); },
      signOut: function() { return Promise.resolve({ error: null }); },
      verifyOtp: function() { return Promise.resolve({ data: { user: null, session: null }, error: null }); },
      refreshSession: function() { return Promise.resolve({ data: { session: null }, error: null }); },
      setSession: function() { return Promise.resolve({ data: { session: null }, error: null }); },
      onAuthStateChange: function() { return { data: { subscription: null }, error: null }; }
    },
    realtime: {
      connect: function() { return this; },
      disconnect: function() { return this; },
      channel: function(name, opts) {
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
    },
    storage: {
      from: function() {
        return {
          upload: function() { return Promise.resolve({ data: null, error: null }); },
          download: function() { return Promise.resolve({ data: null, error: null }); },
          list: function() { return Promise.resolve({ data: null, error: null }); },
          remove: function() { return Promise.resolve({ data: null, error: null }); },
          createSignedUrl: function() { return Promise.resolve({ data: null, error: null }); },
          getPublicUrl: function() { return { data: { publicUrl: '' } }; }
        };
      }
    },
    functions: {
      invoke: function() { return Promise.resolve({ data: null, error: null }); }
    }
  };
}

export const supabase = supabaseClient;

export default supabase
