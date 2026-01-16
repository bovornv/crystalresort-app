// Crystal Resort Procurement Board
// Crystal Resort Internal Tools

// Supabase Configuration
// TODO: Replace with your Supabase project URL and anon key
// Get these from your Supabase project settings: https://app.supabase.com/project/_/settings/api
const SUPABASE_URL = 'https://kfyjuzmruutgltpytrqm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmeWp1em1ydXV0Z2x0cHl0cnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTA1NTIsImV4cCI6MjA4Mzk4NjU1Mn0.ZP3DYdKc5RZiwOJBqim-yiFD_lJH-SxNYXcJtqV8doo';

// Initialize Supabase client
// Use a scoped variable name to avoid conflicts with any global supabase variable
let supabaseClientInstance = null;

// Function to initialize Supabase client (called after script loads)
// CRITICAL: Create client ONCE globally, never recreate
function initializeSupabaseClient() {
    // If client already exists, don't recreate
    if (supabaseClientInstance) {
        return;
    }
    
    // Check for both 'supabase' (CDN global) and 'supabaseClient' (module)
    const supabaseLib = typeof supabase !== 'undefined' ? supabase : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    
    // Wait for Supabase script to load
    if (!supabaseLib) {
        // Try again after a short delay (max 50 retries = 5 seconds)
        if (!window.supabaseInitRetries) window.supabaseInitRetries = 0;
        if (window.supabaseInitRetries < 50) {
            window.supabaseInitRetries++;
            setTimeout(initializeSupabaseClient, 100);
        } else {
            console.error('❌ Supabase script failed to load after 5 seconds');
        }
        return;
    }
    
try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY && 
            SUPABASE_URL.startsWith('https://') && 
            SUPABASE_ANON_KEY.startsWith('eyJ')) {
            // Create client ONCE - never recreate
            supabaseClientInstance = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            window.supabaseInitRetries = 0; // Reset retry counter on success
    }
} catch (e) {
        console.error('❌ Error creating Supabase client:', e);
    }
}

// Initialize after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeSupabaseClient, 100);
    });
} else {
    // DOM already loaded
    setTimeout(initializeSupabaseClient, 100);
}

// Database sync state
let isOnline = navigator.onLine;
let syncInProgress = false;
let realtimeSubscriptions = [];
let realtimeSubscribed = false; // Track if subscriptions are active
let useSupabase = false;

// Generate unique client ID to prevent feedback loops
// This ID is used to tag local updates and ignore our own real-time events
const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
let lastLocalUpdateIds = new Set(); // Track recently saved item IDs to ignore our own updates

// User state
let currentUser = null;
let userRole = 'staff'; // 'admin', 'manager', or 'staff'
let presenceUpdateInterval = null;

// Check if Supabase is configured (silent check - no logging)
function checkSupabaseConfig() {
    if (supabaseClientInstance && SUPABASE_URL && SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.startsWith('eyJ')) {
        useSupabase = true;
        return true;
    }
    return false;
}

// Supabase Database Functions
// Load purchase_items from Supabase (active board items)
async function loadItemsFromSupabase() {
    if (!checkSupabaseConfig()) return null;
    
    try {
        const { data, error } = await supabaseClientInstance
            .from('purchase_items')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error loading items from Supabase:', e);
        return null;
    }
}

// Track last save per item to prevent duplicates
const lastSaveState = new Map();

async function saveItemToSupabase(item, source = 'user') {
    // CRITICAL: Skip save if this update came from real-time (prevent echo)
    if (item._fromRealtime) {
        return false; // Silent skip - real-time updates should not trigger saves
    }
    
    if (!checkSupabaseConfig()) {
        return false;
    }
    
    // Debounce: Skip if same item + same status was just saved
    const saveKey = `${item.id}:${item.status}`;
    const lastSave = lastSaveState.get(saveKey);
    const now = Date.now();
    if (lastSave && (now - lastSave) < 1000) {
        return false; // Skip duplicate save within 1 second
    }
    lastSaveState.set(saveKey, now);
    
    try {
        // Try to get user, but don't fail if not authenticated
        let user = null;
        try {
            const { data: { user: authUser }, error: authError } = await supabaseClientInstance.auth.getUser();
            if (!authError && authUser) {
                user = authUser;
            }
        } catch (authErr) {
            // User not authenticated - that's okay
        }
        
        // CRITICAL: item_name is NOT NULL - must always be included in UPSERT
        // If local name is invalid, fetch existing value from database to preserve it
        let itemName = item.name;
        const isValidName = itemName && 
                           itemName.trim() !== '' && 
                           itemName !== 'Unknown Item' &&
                           !itemName.startsWith('Unknown');
        
        // If name is invalid, fetch existing value from database (log once only)
        if (!isValidName) {
            const nameFetchKey = `name_fetch_${item.id}`;
            if (!lastSaveState.has(nameFetchKey)) {
                lastSaveState.set(nameFetchKey, true);
                try {
                    const { data: existingItem, error: fetchError } = await supabaseClientInstance
                        .from('purchase_items')
                        .select('item_name')
                        .eq('id', item.id)
                        .single();
                    
                    if (!fetchError && existingItem?.item_name && existingItem.item_name.trim() !== '') {
                        itemName = existingItem.item_name;
                        item.name = itemName; // Update local item too
                    } else {
                        // If we can't get a valid name, use a safe fallback
                        itemName = itemName || 'Item ' + item.id.substring(0, 8);
                    }
                } catch (fetchErr) {
                    // Use safe fallback if fetch fails
                    itemName = itemName || 'Item ' + item.id.substring(0, 8);
                }
            }
        }
        
        // Build itemData - ALWAYS include item_name (NOT NULL constraint)
        // Map JavaScript property names to database column names
        const itemData = {
            id: item.id,
            item_name: itemName, // ALWAYS include - required NOT NULL column
            quantity: item.quantity || 0,
            unit: item.unit || '',
            supplier: item.supplier || '',
            status: item.status,
            updated_at: new Date().toISOString()
        };
        
        // Add optional columns only if they have values (to avoid schema errors)
        if (item.requested_qty !== undefined || item.quantity !== undefined) {
            itemData.requested_qty = item.requested_qty || item.quantity || 0;
        }
        if (item.received_qty !== undefined) {
            itemData.received_qty = item.received_qty || 0;
        }
        if (item.urgency !== undefined) {
            itemData.urgency = item.urgency || 'normal';
        }
        if (item.issue_type !== undefined && item.issue_type !== null) {
            itemData.issue_type = item.issue_type;
        }
        if (item.issueReason !== undefined && item.issueReason !== null) {
            itemData.issue_reason = item.issueReason; // Map camelCase to snake_case
        }
        if (user?.id) {
            itemData.updated_by = user.id;
        }
        
        // Track updated_by nickname for display (save to database)
        if (currentUser?.nickname) {
            item.updated_by_nickname = currentUser.nickname;
            itemData.updated_by_nickname = currentUser.nickname; // Save to database
        }
        
        // Only set created_by if this is a new item
        if (!item.created_by && user?.id) {
            itemData.created_by = user.id;
            if (currentUser?.nickname) {
                item.created_by_nickname = currentUser.nickname;
                itemData.created_by_nickname = currentUser.nickname; // Save to database
            }
        }
        
        // UPSERT with onConflict - must include all NOT NULL columns
        let { data, error } = await supabaseClientInstance
            .from('purchase_items')
            .upsert(itemData, { onConflict: 'id' });
        
        // If error is about missing columns, try again with minimal columns (but ALWAYS include item_name)
        if (error && error.code === 'PGRST204') {
            const minimalData = {
                id: item.id,
                item_name: itemName, // ALWAYS include - NOT NULL constraint
                quantity: item.quantity || 0,
                unit: item.unit || '',
                supplier: item.supplier || '',
                status: item.status
            };
            const retryResult = await supabaseClientInstance
                .from('purchase_items')
                .upsert(minimalData, { onConflict: 'id' });
            if (retryResult.error) {
                console.error('❌ Supabase save error (minimal retry):', retryResult.error);
                throw retryResult.error;
            }
            data = retryResult.data;
            error = null;
        }
        
        if (error) {
            console.error('❌ Supabase save error:', error);
            throw error;
        }
        
        // Track this as a local update to prevent processing our own real-time events
        lastLocalUpdateIds.add(item.id);
        // Clear after 2 seconds to allow legitimate remote updates
        setTimeout(() => {
            lastLocalUpdateIds.delete(item.id);
        }, 2000);
        
        // When status changes to 'received', insert snapshot into purchase_history
        if (item.status === 'received') {
            await insertPurchaseHistory(item, user?.id || null);
        }
        
        return true;
    } catch (e) {
        console.error('❌ Error saving item to Supabase:', e);
        return false;
    }
}

// Insert immutable snapshot into purchase_history when item is received
async function insertPurchaseHistory(item, userId) {
    if (!checkSupabaseConfig()) return false;
    
    try {
        // Check if history record already exists for this item to avoid duplicates
        // Look for records with same item_id created in the last minute (prevents rapid duplicate saves)
        // Note: If created_at column doesn't exist, skip duplicate check
        try {
            const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
            const { data: existing, error: checkError } = await supabaseClientInstance
                .from('purchase_history')
                .select('id')
                .eq('item_id', item.id)
                .gte('created_at', oneMinuteAgo)
                .limit(1);
            
            // Only skip if column exists and we found a recent record
            if (!checkError && existing && existing.length > 0) {
                return true; // Already recorded recently
            }
        } catch (e) {
            // If created_at column doesn't exist (code 42703), continue with insert
            // Otherwise, log the error but continue
            if (e.code !== '42703') {
                console.warn('Warning checking for duplicate history record:', e);
            }
        }
        
        // DO NOT include id - let Supabase auto-generate UUID
        const historyData = {
            item_id: item.id,
            item_name: item.name,
            supplier: item.supplier,
            quantity: item.received_qty || item.requested_qty || item.quantity || 0,
            unit: item.unit,
            status: item.issue ? 'Issue' : 'OK',
            issue_type: item.issue_type || null,
            issue_reason: item.issueReason || null,
            created_at: new Date().toISOString()
        };
        
        // Only include receiver and created_by if columns exist (optional fields)
        if (currentUser) {
            // Try to include receiver, but don't fail if column doesn't exist
            try {
                historyData.receiver = JSON.stringify({
                    nickname: currentUser.nickname || currentUser.email?.split('@')[0] || 'Unknown',
                    email: currentUser.email || null
                });
            } catch (e) {
                // Skip receiver if it causes issues
            }
        }
        if (userId) {
            historyData.created_by = userId;
        }
        
        let { error } = await supabaseClientInstance
            .from('purchase_history')
            .insert(historyData);
        
        // If error is about missing receiver column, retry without it
        if (error && error.code === 'PGRST204' && error.message?.includes('receiver')) {
            console.warn('⚠️ receiver column missing, retrying without it');
            delete historyData.receiver;
            const retryResult = await supabaseClientInstance
                .from('purchase_history')
                .insert(historyData);
            if (retryResult.error) {
                console.error('Error inserting purchase history:', retryResult.error);
                return false;
            }
            return true;
        }
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error inserting purchase history:', e);
        return false;
    }
}

async function deleteItemFromSupabase(itemId) {
    if (!checkSupabaseConfig()) return false;
    
    try {
        const { error } = await supabaseClientInstance
            .from('purchase_items')
            .delete()
            .eq('id', itemId);
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error deleting item from Supabase:', e);
        return false;
    }
}

async function loadPurchaseRecordsFromSupabase() {
    if (!checkSupabaseConfig()) return null;
    
    try {
        // Try ordering by created_at first, fallback to id if column doesn't exist
        let query = supabaseClientInstance
            .from('purchase_history')
            .select('*');
        
        // Try to order by created_at, but handle if column doesn't exist
        try {
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error && error.code === '42703') {
                // Column doesn't exist, try ordering by id instead (ids are timestamp-based)
                console.warn('⚠️ created_at column not found, ordering by id instead');
                const { data: data2, error: error2 } = await supabaseClientInstance
                    .from('purchase_history')
                    .select('*')
                    .order('id', { ascending: false });
                if (error2) throw error2;
                return data2 || [];
            }
            if (error) throw error;
            return data || [];
        } catch (e) {
            // If ordering fails, try without order or by id
            if (e.code === '42703') {
        const { data, error } = await supabaseClientInstance
                    .from('purchase_history')
            .select('*')
                    .order('id', { ascending: false });
        if (error) throw error;
        return data || [];
            }
            throw e;
        }
    } catch (e) {
        console.error('Error loading purchase history from Supabase:', e);
        return null;
    }
}

async function savePurchaseRecordToSupabase(record) {
    if (!checkSupabaseConfig()) return false;
    
    try {
        // Try to get user, but don't fail if not authenticated
        let user = null;
        try {
            const { data: { user: authUser }, error: authError } = await supabaseClientInstance.auth.getUser();
            if (!authError && authUser) {
                user = authUser;
            }
        } catch (authErr) {
            // User not authenticated - that's okay
        }
        
        // DO NOT include id - let Supabase auto-generate UUID
        const recordData = {
            item_id: record.itemId || null,
            item_name: record.itemName,
            supplier: record.supplier,
            quantity: record.quantity,
            unit: record.unit,
            status: record.status,
            issue_type: record.issueType || null,
            issue_reason: record.issueReason || null,
            created_at: new Date(record.date).toISOString()
        };
        
        // Only include receiver if column exists (optional field)
        if (record.receiver) {
            try {
                recordData.receiver = JSON.stringify(record.receiver);
            } catch (e) {
                // Skip receiver if it causes issues
            }
        }
        
        // Only include created_by if user exists (optional field)
        if (user?.id) {
            recordData.created_by = user.id;
        }
        
        // Insert without id - let Supabase auto-generate UUID
        let { error } = await supabaseClientInstance
            .from('purchase_history')
            .insert(recordData);
        
        // If error is about missing created_by or receiver column, retry without them
        if (error && error.code === 'PGRST204') {
            if (error.message?.includes('created_by')) {
                console.warn('⚠️ created_by column missing, retrying without it');
                delete recordData.created_by;
            }
            if (error.message?.includes('receiver')) {
                console.warn('⚠️ receiver column missing, retrying without it');
                delete recordData.receiver;
            }
            const retryResult = await supabaseClientInstance
                .from('purchase_history')
                .insert(recordData);
            if (retryResult.error) {
                console.error('Error saving purchase history to Supabase:', retryResult.error);
                return false;
            }
            return true;
        }
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error saving purchase history to Supabase:', e);
        return false;
    }
}

// Presence tracking functions
async function updatePresence() {
    if (!checkSupabaseConfig() || !currentUser) return;
    
    try {
        const { error } = await supabaseClientInstance
            .from('presence')
            .upsert({
                user_id: currentUser.id,
                last_seen: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });
        
        if (error) throw error;
    } catch (e) {
        console.error('Error updating presence:', e);
    }
}

async function getOnlineUsersCount() {
    if (!checkSupabaseConfig()) return 0;
    
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count, error } = await supabaseClientInstance
            .from('presence')
            .select('*', { count: 'exact', head: true })
            .gte('last_seen', fiveMinutesAgo);
        
        if (error) throw error;
        return count || 0;
    } catch (e) {
        console.error('Error getting online users count:', e);
        return 0;
    }
}

function startPresenceTracking() {
    if (!checkSupabaseConfig() || !currentUser) return;
    
    // Update presence immediately
    updatePresence();
    
    // Update presence every 30 seconds
    if (presenceUpdateInterval) {
        clearInterval(presenceUpdateInterval);
    }
    
    presenceUpdateInterval = setInterval(() => {
        updatePresence();
        updatePresenceIndicator();
    }, 30000);
    
    // Update presence indicator immediately
    updatePresenceIndicator();
}

async function updatePresenceIndicator() {
    // Presence indicator removed - function kept for compatibility but does nothing
    // const count = await getOnlineUsersCount();
    // Presence elements removed from UI
}

// Setup real-time subscriptions with improved error handling
// CRITICAL: Only create subscriptions ONCE, after data load
// CRITICAL: Never recreate subscriptions - check if already subscribed
function setupRealtimeSubscriptions() {
    if (!checkSupabaseConfig()) {
        return;
    }
    
    // Prevent duplicate subscriptions - if already subscribed, don't recreate
    if (realtimeSubscribed && realtimeSubscriptions.length > 0) {
        return;
    }
    
    // Clean up any existing subscriptions first
    realtimeSubscriptions.forEach(sub => {
        try {
        supabaseClientInstance.removeChannel(sub);
        } catch (e) {
            // Silent cleanup
        }
    });
    realtimeSubscriptions = [];
    realtimeSubscribed = false;
    
    // Subscribe to purchase_items changes (realtime updates for active board)
    // This enables instant updates across all devices when items are added/updated/deleted
    const itemsChannel = supabaseClientInstance
        .channel('purchase-items-changes', {
            config: {
                broadcast: { self: true }
            }
        })
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'purchase_items',
                filter: undefined
            },
            async (payload) => {
                // Real-time update - update UI ONLY, NEVER write back to Supabase
                const itemId = payload.new?.id || payload.old?.id;
                
                // Prevent feedback loops: ignore our own updates
                if (lastLocalUpdateIds.has(itemId)) {
                    return; // This is our own update, ignore it
                }
                
                // Log once when applying remote change
                if (!window.realtimeApplyLogged) {
                    console.log('✅ Applying remote change to UI');
                    window.realtimeApplyLogged = true;
                }
                
                if (payload.eventType === 'INSERT') {
                    // Real-time INSERT → add item to state
                    const newItem = migrateItemToV2(payload.new);
                    newItem._fromRealtime = true; // Mark to prevent echo save
                    
                    // Only add if it has a valid name
                    const hasValidName = newItem.name && 
                                       newItem.name.trim() !== '' && 
                                       newItem.name !== 'Unknown Item';
                    if (hasValidName) {
                        items.push(newItem);
                        // Log operation once
                        if (!window.realtimeInsertLogged) {
                            console.log(`✅ Remote INSERT: ${newItem.id} - ${newItem.name}`);
                            window.realtimeInsertLogged = true;
                        }
                        renderBoard();
                        updatePresenceIndicator();
                    }
                } else if (payload.eventType === 'UPDATE') {
                    // Real-time UPDATE → update item in state
                    const updatedItem = migrateItemToV2(payload.new);
                    updatedItem._fromRealtime = true; // Mark to prevent echo save
                    
                    const index = items.findIndex(i => i.id === updatedItem.id);
                    if (index >= 0) {
                        const existingItem = items[index];
                        
                        // CRITICAL: Don't overwrite if local change is very recent (within 500ms)
                        // This prevents bouncing back when user just moved an item
                        const localChangeTime = existingItem.lastUpdated || 0;
                        const now = Date.now();
                        if ((now - localChangeTime) < 500 && !existingItem._fromRealtime) {
                            // Local change is very recent, ignore this remote update
                            return;
                        }
                        
                        // Validate name from update
                        const updateHasValidName = updatedItem.name && 
                                                  updatedItem.name.trim() !== '' && 
                                                  updatedItem.name !== 'Unknown Item' &&
                                                  !updatedItem.name.startsWith('Unknown');
                        
                        // Validate existing name
                        const existingHasValidName = existingItem.name && 
                                                    existingItem.name.trim() !== '' && 
                                                    existingItem.name !== 'Unknown Item' &&
                                                    !existingItem.name.startsWith('Unknown');
                        
                        // Use update name if valid, otherwise preserve existing
                        let finalName = existingItem.name;
                        if (updateHasValidName) {
                            finalName = updatedItem.name;
                        } else if (!existingHasValidName && updateHasValidName) {
                            finalName = updatedItem.name;
                        }
                        
                        // CRITICAL: Mutate state using same logic as local updates
                        // Merge: preserve local-only fields, update with database fields
                        items[index] = {
                            ...existingItem,
                            ...updatedItem,
                            name: finalName,
                            _fromRealtime: true,
                            // Preserve local-only fields
                            history: existingItem.history || updatedItem.history,
                            statusTimestamps: updatedItem.statusTimestamps || existingItem.statusTimestamps || {}
                        };
                        
                        // Auto-detect issue status (same as local updates)
                        detectAndUpdateIssueStatus(items[index]);
                        
                        // Log operation once
                        if (!window.realtimeUpdateLogged) {
                            console.log(`✅ Remote UPDATE: ${updatedItem.id} - status: ${updatedItem.status}`);
                            window.realtimeUpdateLogged = true;
                        }
                        
                        // CRITICAL: Re-render UI to reflect state changes
                    renderBoard();
                        updatePresenceIndicator();
                        
                        // Refresh views if active (same as local updates)
                        if (currentView === 'dashboard') {
                            renderDashboard();
                        } else if (currentView === 'mobile') {
                            renderMobileView();
                        }
                    }
                } else if (payload.eventType === 'DELETE') {
                    // Real-time DELETE → remove item from state
                    const deletedId = payload.old.id;
                    items = items.filter(i => i.id !== deletedId);
                    
                    // Log operation once
                    if (!window.realtimeDeleteLogged) {
                        console.log(`✅ Remote DELETE: ${deletedId}`);
                        window.realtimeDeleteLogged = true;
                    }
                    
                    // CRITICAL: Re-render UI to reflect state changes
                    renderBoard();
                    updatePresenceIndicator();
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                realtimeSubscribed = true;
                // Real-time subscription successful (no console log to reduce noise)
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                realtimeSubscribed = false;
                console.error('❌ Real-time subscription error:', status, err);
            }
        });
    
    realtimeSubscriptions.push(itemsChannel);
    
    // Subscribe to purchase_history changes (immutable records)
    // This updates the history view when new records are added
    const purchaseChannel = supabaseClientInstance
        .channel('purchase-history-changes', {
            config: {
                broadcast: { self: true }
            }
        })
        .on('postgres_changes',
            { 
                event: '*', 
                schema: 'public', 
                table: 'purchase_history' 
            },
            (payload) => {
                // Real-time history update - update UI only (silent)
                if (payload.eventType === 'INSERT') {
                const record = {
                    id: payload.new.id,
                        date: new Date(payload.new.created_at).getTime(),
                    itemName: payload.new.item_name,
                    supplier: payload.new.supplier,
                    quantity: payload.new.quantity,
                    unit: payload.new.unit,
                    status: payload.new.status,
                    receiver: payload.new.receiver ? JSON.parse(payload.new.receiver) : null,
                    issueType: payload.new.issue_type,
                    issueReason: payload.new.issue_reason,
                    itemId: payload.new.item_id
                };
                purchaseRecords.push(record);
                    
                // Update UI if purchase history modal is open
                    if (document.getElementById('statsModal')?.classList.contains('active')) {
                    renderStatsDashboard();
                }
                    updatePresenceIndicator();
                } else if (payload.eventType === 'DELETE') {
                    purchaseRecords = purchaseRecords.filter(r => r.id !== payload.old.id);
                    if (document.getElementById('statsModal')?.classList.contains('active')) {
                        renderStatsDashboard();
                    }
                    updatePresenceIndicator();
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                // Silent success - real-time is working
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                console.error('❌ purchase_history subscription error:', status, err);
            }
        });
    
    realtimeSubscriptions.push(purchaseChannel);
    
    // Subscribe to presence changes for online users count
    const presenceChannel = supabaseClientInstance
        .channel('presence-changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'presence'
            },
            () => {
                updatePresenceIndicator();
            }
        )
        .subscribe();
    
    realtimeSubscriptions.push(presenceChannel);
}

// Network status monitoring and lifecycle handling
// Reconnect real-time on network reconnect
window.addEventListener('online', () => {
    isOnline = true;
    if (checkSupabaseConfig() && supabaseClientInstance) {
        // Reconnect real-time subscriptions if not already subscribed
        if (!realtimeSubscribed) {
        setupRealtimeSubscriptions();
        }
        loadData().catch(err => console.error('Error loading data on online:', err));
    }
});

// Handle page visibility changes (mobile backgrounding/foregrounding)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && checkSupabaseConfig() && supabaseClientInstance) {
        // Page became visible - reconnect if needed
        if (!realtimeSubscribed) {
            setupRealtimeSubscriptions();
        }
    }
});

// Handle page focus (desktop tab switching)
window.addEventListener('focus', () => {
    if (checkSupabaseConfig() && supabaseClientInstance) {
        // Page focused - reconnect if needed
        if (!realtimeSubscribed) {
            setupRealtimeSubscriptions();
        }
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('Offline mode - changes will sync when online', 'info');
});

// Simple nickname-based authentication (matching roomstatus pattern)
function loadUser() {
    // Check localStorage for nickname (matching roomstatus pattern)
    const storedNickname = localStorage.getItem('crystal_nickname') || localStorage.getItem('nickname');
    const loginTimestamp = localStorage.getItem('crystal_login_timestamp');
    const logoutTimestamp = localStorage.getItem('crystal_logout_timestamp');
    
    // Check if user was logged out on another device/tab
    if (storedNickname && loginTimestamp && logoutTimestamp) {
        const loginTime = parseInt(loginTimestamp);
        const logoutTime = parseInt(logoutTimestamp);
        
        // If logout happened after login, user is logged out
        if (logoutTime > loginTime) {
            localStorage.removeItem('crystal_nickname');
            localStorage.removeItem('nickname');
            localStorage.removeItem('crystal_login_timestamp');
            currentUser = null;
            userRole = 'staff';
            return false;
        }
    }
    
    if (storedNickname) {
        currentUser = { nickname: storedNickname };
        userRole = 'staff';
        return true;
    }
    
    currentUser = null;
    userRole = 'staff';
    return false;
}

// Sign up new user
async function signUp(email, password, nickname, role = 'staff') {
    if (!checkSupabaseConfig()) {
        // Fallback to localStorage
        currentUser = { nickname, email };
        userRole = role;
        localStorage.setItem('kitchen_procurement_user', JSON.stringify({ nickname, email, role }));
        return { success: true };
    }
    
    try {
        const { data, error } = await supabaseClientInstance.auth.signUp({
            email,
            password,
            options: {
                data: {
        nickname: nickname,
                    role: role
                }
            }
        });
        
        if (error) throw error;
        
        if (data.user) {
            currentUser = data.user;
            userRole = role;
            startPresenceTracking();
            return { success: true, user: data.user };
        }
        
        return { success: false, message: 'Please check your email to confirm your account' };
    } catch (e) {
        console.error('Error signing up:', e);
        return { success: false, message: e.message };
    }
}

// Sign in user
async function signIn(email, password) {
    if (!checkSupabaseConfig()) {
        // Fallback: simple nickname-based auth
        currentUser = { nickname: email, email };
        userRole = 'staff';
        localStorage.setItem('kitchen_procurement_user', JSON.stringify({ nickname: email, email, role: 'staff' }));
        return { success: true };
    }
    
    try {
        const { data, error } = await supabaseClientInstance.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        if (data.user) {
            currentUser = data.user;
            
            // Load user profile and role
            const { data: profile } = await supabaseClientInstance
                .from('users')
                .select('nickname, role')
                .eq('id', data.user.id)
                .single();
            
            if (profile) {
                userRole = profile.role || 'staff';
                currentUser.nickname = profile.nickname || data.user.email?.split('@')[0] || 'User';
            } else {
                userRole = 'staff';
                currentUser.nickname = data.user.email?.split('@')[0] || 'User';
            }
            
            startPresenceTracking();
            return { success: true, user: data.user };
        }
        
        return { success: false, message: 'Login failed' };
    } catch (e) {
        console.error('Error signing in:', e);
        return { success: false, message: e.message };
    }
}

// Sign out user
async function signOut() {
    if (presenceUpdateInterval) {
        clearInterval(presenceUpdateInterval);
        presenceUpdateInterval = null;
    }
    
    if (checkSupabaseConfig()) {
        await supabaseClientInstance.auth.signOut();
    }
    
    currentUser = null;
    userRole = 'staff';
    localStorage.removeItem('kitchen_procurement_user');
}

// Check if user is logged in (matching roomstatus pattern)
function isLoggedIn() {
    return currentUser !== null && currentUser !== undefined && currentUser.nickname;
}

// Check if user has admin/manager role
function isAdminOrManager() {
    return userRole === 'admin' || userRole === 'manager';
}

// Check if user is admin
function isAdmin() {
    return userRole === 'admin';
}

// Get user initials for display
function getUserInitials(nickname) {
    if (!nickname) return 'U';
    const words = nickname.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return nickname.substring(0, 2).toUpperCase();
}

// Show login modal
function showLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('nicknameInput').focus();
}

// Close login modal
function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginForm').reset();
}

// Handle login (matching roomstatus pattern)
function handleLogin(event) {
    event.preventDefault();
    const nicknameInput = document.getElementById('nicknameInput');
    
    if (!nicknameInput) {
        return;
    }
    
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
        return;
    }
    
    // Simple nickname-based login (matching roomstatus)
    const trimmedNickname = nickname.trim();
    const loginTimestamp = new Date().getTime();
    
    currentUser = { nickname: trimmedNickname };
    userRole = 'staff';
    
    // Store in localStorage (matching roomstatus pattern)
    localStorage.setItem('crystal_nickname', trimmedNickname);
    localStorage.setItem('crystal_login_timestamp', loginTimestamp.toString());
    
    // Clean up old storage keys for consistency
    localStorage.removeItem('kitchen_procurement_user');
    localStorage.removeItem('crystal_logout_timestamp');
    
    closeLoginModal();
    updateUserUI();
    showAllContent();
    
    // Ensure board view is visible
    const boardView = document.getElementById('boardView');
    if (boardView) {
        boardView.style.display = 'block';
    }
    
    // Load data from Supabase if configured (but don't block on it)
    loadData().then(() => {
        loadTemplates();
        switchView('board');
        renderBoard(); // Render board after data loads
    }).catch((error) => {
        // Silently continue even if data load fails
        loadTemplates();
        switchView('board');
        renderBoard(); // Render board even if data load fails
    });
}

// Handle logout (matching roomstatus pattern)
function handleLogout(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Close dropdown immediately
    closeUserMenu();
    
    // Simple logout (matching roomstatus pattern)
    const logoutTimestamp = new Date().getTime();
    
    // Clear user state
    currentUser = null;
    userRole = 'staff';
    
    // Store logout timestamp to sync across devices/tabs
    localStorage.setItem('crystal_logout_timestamp', logoutTimestamp.toString());
    localStorage.removeItem('crystal_nickname');
    localStorage.removeItem('nickname');
    localStorage.removeItem('crystal_login_timestamp');
    
    // Clean up old storage keys
    localStorage.removeItem('kitchen_procurement_user');
    
    // Update UI immediately
    updateUserUI();
    
    // Hide content and show login modal
    hideAllContent();
    showLoginModal();
}

// Update user UI elements (matching roomstatus pattern)
function updateUserUI() {
    const userMenuContainer = document.getElementById('userMenuContainer');
    const loginBtnTop = document.getElementById('loginBtnTop');
    const userMenuName = document.getElementById('userMenuName');
    const userMenuNickname = document.getElementById('userMenuNickname');
    
    if (isLoggedIn() && currentUser && currentUser.nickname) {
        const displayName = currentUser.nickname;
        
        // Show user menu, hide login button
        if (userMenuContainer) {
            userMenuContainer.style.display = 'flex';
            userMenuContainer.style.visibility = 'visible';
            userMenuContainer.style.opacity = '1';
            userMenuContainer.style.width = 'auto';
            userMenuContainer.style.height = 'auto';
            userMenuContainer.style.margin = '';
            userMenuContainer.style.padding = '';
            userMenuContainer.style.overflow = 'visible';
        }
        if (loginBtnTop) {
            loginBtnTop.style.display = 'none';
            loginBtnTop.style.visibility = 'hidden';
            loginBtnTop.style.opacity = '0';
        }
        if (userMenuName) userMenuName.textContent = displayName;
        if (userMenuNickname) userMenuNickname.textContent = displayName;
        
        // Show app content
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.display = 'block';
            appContainer.style.visibility = 'visible';
        }
        
        // Ensure board view is visible
        const boardView = document.getElementById('boardView');
        if (boardView) {
            boardView.style.display = 'block';
        }
        
        // Ensure bottom actions bar (footer) is visible
        const bottomActionsBar = document.querySelector('.bottom-actions-bar');
        if (bottomActionsBar) {
            bottomActionsBar.style.display = 'flex';
            bottomActionsBar.style.visibility = 'visible';
        }
    } else {
        // Hide user menu, show login button
        if (userMenuContainer) {
            userMenuContainer.style.display = 'none';
            userMenuContainer.style.visibility = 'hidden';
            userMenuContainer.style.opacity = '0';
            userMenuContainer.style.width = '0';
            userMenuContainer.style.height = '0';
            userMenuContainer.style.margin = '0';
            userMenuContainer.style.padding = '0';
            userMenuContainer.style.overflow = 'hidden';
            closeUserMenu();
        }
        if (loginBtnTop) {
            loginBtnTop.style.display = 'flex';
            loginBtnTop.style.visibility = 'visible';
            loginBtnTop.style.opacity = '1';
        }
        // Clear all user-related text
        if (userMenuNickname) userMenuNickname.textContent = '';
        if (userMenuName) userMenuName.textContent = '';
        
        // Hide app content (but keep login button visible)
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
            appContainer.style.display = 'none';
            appContainer.style.visibility = 'hidden';
        }
        
        // Hide bottom actions bar (footer)
        const bottomActionsBar = document.querySelector('.bottom-actions-bar');
        if (bottomActionsBar) {
            bottomActionsBar.style.display = 'none';
            bottomActionsBar.style.visibility = 'hidden';
        }
    }
}

// Toggle user menu dropdown
function toggleUserMenu(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const dropdown = document.getElementById('userMenuDropdown');
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        // Close all dropdowns first
        dropdown.classList.remove('active');
        // Then toggle if it wasn't active
        if (!isActive) {
            setTimeout(() => {
                dropdown.classList.add('active');
            }, 10);
        }
    }
}

// Close user menu dropdown
function closeUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// Hide all content when not logged in
function hideAllContent() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.style.display = 'none';
        appContainer.style.visibility = 'hidden';
    }
    
    // Hide bottom actions bar (footer)
    const bottomActionsBar = document.querySelector('.bottom-actions-bar');
    if (bottomActionsBar) {
        bottomActionsBar.style.display = 'none';
        bottomActionsBar.style.visibility = 'hidden';
    }
}

function showAllContent() {
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.style.display = 'block';
        appContainer.style.visibility = 'visible';
    }
    
    // Ensure board view is visible
    const boardView = document.getElementById('boardView');
    if (boardView) {
        boardView.style.display = 'block';
    }
    
    // Ensure bottom actions bar (footer) is visible
    const bottomActionsBar = document.querySelector('.bottom-actions-bar');
    if (bottomActionsBar) {
        bottomActionsBar.style.display = 'flex';
        bottomActionsBar.style.visibility = 'visible';
    }
}

// Authentication check wrapper for functions that modify data
function requireAuth(callback) {
    if (!isLoggedIn()) {
        showNotification(t('pleaseLogin'), 'error');
        showLoginModal();
        return false;
    }
    return callback();
}

// Column mapping (will use translations)
function getColumnLabel(status) {
    const keyMap = {
        'need-to-buy': 'needToBuy',
        'ordered': 'ordered',
        'bought': 'bought',
        'received': 'received',
        'verified': 'verified'
    };
    return t(keyMap[status] || status);
}

// Column flow order
const COLUMN_ORDER = ['need-to-buy', 'ordered', 'bought']; // Removed 'received' and 'verified' - now action buttons

// Issue type labels for display (will use translations)
function getIssueTypeLabel(issueType) {
    if (!issueType) return '';
    const keyMap = {
        'wrong_weight': 'wrongWeight',
        'not_fresh': 'notFresh',
        'wrong_item': 'wrongItem',
        'overpriced': 'overpriced',
        'other': 'other'
    };
    return t(keyMap[issueType] || issueType);
}

// Status transition rules (forward-only)
const STATUS_TRANSITIONS = {
    'need-to-buy': ['ordered'],
    'ordered': ['bought'],
    'bought': ['received'],
    'received': ['verified'],
    'verified': [] // Terminal state
};

// Delay thresholds (in milliseconds)
const DELAY_THRESHOLDS = {
    'ordered': 6 * 60 * 60 * 1000,      // 6 hours
    'bought': 12 * 60 * 60 * 1000,      // 12 hours
    'received': 2 * 60 * 60 * 1000      // 2 hours
};

// Data storage key
const STORAGE_KEY = 'kitchen_procurement_board';
const LANGUAGE_STORAGE_KEY = 'kitchen_procurement_language';
const PURCHASE_RECORDS_KEY = 'kitchen_purchase_records';

// Language translations (Thai default)
const translations = {
    th: {
        // Top bar
        'title': 'บอร์ดจัดซื้อของ คริสตัลรีสอร์ต',
        'totalToday': 'รวมวันนี้',
        'pending': 'รอดำเนินการ',
        'issues': 'มีปัญหา',
        
        // View toggles
        'procurementBoard': 'บอร์ดจัดซื้อ',
        'managerDashboard': 'แดชบอร์ดผู้จัดการ',
        'managerView': 'มุมมองผู้จัดการ',
        
        // Board columns
        'needToBuy': 'ขั้นที่0: เตรียมสั่ง',
        'ordered': 'ขั้นที่1: พร้อมสั่งซื้อ',
        'bought': 'ขั้นที่2: ซื้อแล้ว / กำลังขนส่ง',
        'received': 'รับแล้ว',
        'verified': 'มีปัญหา',
        
        // Filters
        'searchItems': 'ค้นหารายการ...',
        'supplier': 'ร้านค้า',
        'all': 'ทั้งหมด',
        'status': 'สถานะ',
        'allStatus': 'ทุกสถานะ',
        'category': 'หมวดหมู่',
        'allCategories': 'ทุกหมวดหมู่',
        'assignedTo': 'มอบหมายให้',
        'allAssigned': 'ทุกคน',
        
        // Supplier names
        'supplierMakro': 'แม็คโคร',
        'supplierFreshMarket': 'ตลาด',
        'supplierBakery': 'สุนิษา',
        
        // Categories
        'vegetables': 'ผัก',
        'fruits': 'ผลไม้',
        'meat': 'เนื้อสัตว์',
        'seafood': 'อาหารทะเล',
        'dairy': 'ผลิตภัณฑ์นม',
        'bakery': 'เบเกอรี่',
        'beverages': 'เครื่องดื่ม',
        'dryGoods': 'ของแห้ง',
        'spices': 'เครื่องเทศ',
        'other': 'อื่นๆ',
        
        // Actions
        'addItem': '+ เพิ่มรายการ',
        'addItemButton': 'เพิ่มรายการ',
        'select': 'เลือก',
        'actions': 'การดำเนินการ',
        'templates': 'เทมเพลต',
        'stats': 'สถิติ',
        'checklist': 'รายการตรวจสอบ',
        'quick': 'ด่วน',
        'shortcuts': 'คีย์ลัด',
        'print': 'พิมพ์',
        'export': 'ส่งออก',
        'import': 'นำเข้า',
        
        // Item fields
        'itemName': 'ชื่อรายการ',
        'quantity': 'จำนวน',
        'unit': 'หน่วย',
        'unitKg': 'กก.',
        'unitBottle': 'ขวด',
        'unitPiece': 'ชิ้น',
        'unitPack': 'แพ็ค/ มัด',
        'unitBox': 'กล่อง',
        'unitLiter': 'ลิตร',
        'unitBag': 'ถุง',
        'supplier': 'ร้านค้า',
        'urgency': 'ความเร่งด่วน',
        'normal': 'ปกติ',
        'urgent': 'ด่วน 🔥',
        'urgencyHint': 'ค่าเริ่มต้นคือ ปกติ. ติ๊กเพื่อทำเครื่องหมายว่าด่วน',
        'assignedTo': 'มอบหมายให้',
        'notes': 'หมายเหตุ',
        'requestedQty': 'จำนวนที่ขอ',
        'receivedQty': 'รับของถูกต้อง',
        'qualityCheck': 'ตรวจสอบคุณภาพ',
        'ok': 'ดี',
        'notOk': 'ไม่ดี',
        'issueType': 'ประเภทปัญหา',
        'issueReason': 'เหตุผล',
        
        // Issue types
        'wrongWeight': 'น้ำหนักผิด',
        'notFresh': 'ไม่สด',
        'wrongItem': 'รายการผิด',
        'overpriced': 'ราคาแพงเกินไป',
        'other': 'อื่นๆ',
        
        // Status actions
        'move': 'ย้าย',
        'receive': 'รับ',
        'verify': 'ตรวจสอบ',
        'edit': 'แก้ไข',
        'delete': 'ลบ',
        'duplicate': 'ทำซ้ำ',
        'history': 'ประวัติ',
        'editNotes': 'แก้ไขหมายเหตุ',
        
        // Modals
        'addNewItem': 'เพิ่มรายการใหม่',
        'editItem': 'แก้ไขรายการ',
        'receiving': 'การรับสินค้า',
        'itemDetails': 'รายละเอียดรายการ',
        'itemHistory': 'ประวัติรายการ',
        'bulkActions': 'การดำเนินการแบบกลุ่ม',
        'templates': 'เทมเพลตรายการ',
        'statistics': 'สถิติ',
        'receivingChecklist': 'รายการตรวจสอบการรับสินค้า',
        'keyboardShortcuts': 'คีย์ลัด',
        'importData': 'นำเข้าข้อมูล',
        'exportData': 'ส่งออกข้อมูล',
        
        // Dashboard
        'managerDashboardTitle': 'แดชบอร์ดผู้จัดการ – จัดซื้อของ คริสตัลรีสอร์ต',
        'today': 'วันนี้',
        'last7Days': '7 วันล่าสุด',
        'last30Days': '30 วันล่าสุด',
        'pendingItems': 'รายการรอดำเนินการ',
        'issues': 'ปัญหา',
        'urgentItems': 'รายการด่วน 🔥',
        'delayedStuckItems': 'รายการล่าช้า / ติดขัด',
        'supplierIssues': 'ปัญหาร้านค้า',
        'teamWorkload': 'ภาระงานทีม',
        'itemsAssignedPerPerson': 'รายการที่มอบหมายต่อคน',
        'noAssignedItems': 'ไม่มีรายการที่มอบหมาย',
        'total': 'รวม',
        
        // Mobile view
        'kitchenOps': 'การดำเนินงานครัว',
        'lastUpdated': 'อัปเดตล่าสุด',
        'needsAttention': 'ต้องให้ความสนใจ',
        'teamLoad': 'ภาระงานทีม',
        'dashboard': 'แดชบอร์ด',
        'allItemsUpToDate': 'รายการทั้งหมดเป็นปัจจุบัน',
        'noSupplierIssues': 'ไม่มีปัญหาร้านค้า',
        'urgentDelayed': 'ด่วน + ล่าช้า',
        'delayed': 'ล่าช้า',
        '7days': '7 วัน',
        '30days': '30 วัน',
        
        // Authentication
        'login': 'เข้าสู่ระบบ',
        'logout': 'ออกจากระบบ',
        'nickname': 'ชื่อเล่น',
        'loggedInUser': 'ผู้ใช้ที่เข้าสู่ระบบ',
        'pleaseLogin': 'กรุณาเข้าสู่ระบบ',
        'pleaseEnterNickname': 'กรุณากรอกชื่อเล่น',
        'loginSuccess': 'เข้าสู่ระบบสำเร็จ',
        'logoutSuccess': 'ออกจากระบบสำเร็จ',
        'loginInstruction': 'กรุณากรอกชื่อเล่นเพื่อเข้าสู่ระบบ',
        
        // Common
        'user': 'ผู้ใช้',
        'save': 'บันทึก',
        'saveChanges': 'บันทึกการเปลี่ยนแปลง',
        'save': 'บันทึก',
        'cancel': 'ยกเลิก',
        'close': 'ปิด',
        'yes': 'ใช่',
        'no': 'ไม่',
        'confirm': 'ยืนยัน',
        'loading': 'กำลังโหลด...',
        'noItems': 'ไม่มีรายการ',
        'noData': 'ไม่มีข้อมูล',
        'unknown': 'ไม่ทราบ',
        'invalid': 'ไม่ถูกต้อง',
        'unassigned': 'ยังไม่ได้มอบหมาย',
        'requested': 'จำนวนที่ขอ',
        'received': 'รับของถูกต้อง',
        'difference': 'ส่วนต่าง',
        'quality': 'คุณภาพ',
        'freshOk': 'สด / ดี',
        'issue': 'ปัญหา',
        'previouslyReceived': 'รับไปแล้ว',
        'receivedQuantityThisTime': 'จำนวนที่รับครั้งนี้',
        'enterQuantityReceived': 'กรอกจำนวนที่รับในการส่งมอบครั้งนี้',
        'selectIssueType': 'เลือกประเภทปัญหา',
        'additionalDetails': 'รายละเอียดเพิ่มเติมเกี่ยวกับปัญหา...',
        'confirmReceiving': 'ยืนยันการรับสินค้า',
        'assignUnassigned': 'มอบหมายรายการที่ยังไม่ได้มอบหมาย',
        'markAllReceivedOk': 'ทำเครื่องหมายรับทั้งหมด OK',
        'moveAllToNextStage': 'ย้ายทั้งหมดไปขั้นตอนถัดไป',
        'clearCompleted': 'ล้างรายการที่เสร็จแล้ว',
        
        // Notifications
        'itemAddedSuccess': 'เพิ่มรายการสำเร็จ',
        'itemUpdatedSuccess': 'อัปเดตรายการสำเร็จ',
        'itemDeletedSuccess': 'ลบรายการสำเร็จ',
        'itemsDeletedSuccess': 'ลบรายการสำเร็จ',
        'confirmDeleteItem': 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?',
        'confirmDeleteItems': 'ลบรายการที่เลือก',
        'confirmDeleteTemplate': 'ลบเทมเพลตนี้?',
        'confirmClearCompleted': 'ลบรายการที่เสร็จสมบูรณ์ที่เก่ากว่า 7 วัน?',
        'dataExportedSuccess': 'ส่งออกข้อมูลสำเร็จ!',
        'dataImportedSuccess': 'นำเข้าข้อมูลสำเร็จ',
        'importFailed': 'นำเข้าข้อมูลล้มเหลว',
        'pleasePasteJson': 'กรุณาวางข้อมูล JSON',
        'templateCreatedSuccess': 'สร้างเทมเพลตสำเร็จ',
        'itemDuplicatedSuccess': 'ทำซ้ำรายการสำเร็จ',
        'itemsMoved': 'ย้ายรายการสำเร็จ',
        'itemsAssigned': 'มอบหมายรายการสำเร็จ',
        'urgencyUpdated': 'อัปเดตความเร่งด่วนสำเร็จ',
        'itemsVerified': 'ตรวจสอบรายการสำเร็จ',
        'itemsAssignedToUser': 'มอบหมายรายการสำเร็จ',
        'completedItemsCleared': 'ล้างรายการที่เสร็จสมบูรณ์สำเร็จ',
        'selectedItemsAtFinalStage': 'รายการที่เลือกอยู่ที่ขั้นตอนสุดท้ายแล้ว',
        'noReceivedItemsToVerify': 'ไม่มีรายการที่รับเพื่อตรวจสอบ',
        'errorLoadingMobileView': 'เกิดข้อผิดพลาดในการโหลดมุมมองมือถือ',
        'errorLoadingDashboard': 'เกิดข้อผิดพลาดในการโหลดแดชบอร์ด',
        'noUnassignedItems': 'ไม่มีรายการที่ยังไม่ได้มอบหมาย',
        
        // Validation errors
        'itemNameMinLength': 'ชื่อรายการต้องมีอย่างน้อย 2 ตัวอักษร',
        'quantityMustBePositive': 'จำนวนต้องมากกว่า 0',
        'unitRequired': 'หน่วยจำเป็นต้องระบุ',
        'supplierRequired': 'ร้านค้าจำเป็นต้องระบุ',
        
        // Quick Receive
        'quickReceiveUndo': 'ยกเลิก',
        'quickReceiveSuccess': 'รับสินค้าสำเร็จ',
        
        // Analysis Views
        'weekly': 'รายสัปดาห์',
        'monthly': 'รายเดือน',
        'frequentlyBought': 'ซื้อบ่อย',
        'highVolume': 'ปริมาณสูง',
        'repeatedIssues': 'ปัญหาซ้ำ',
        'weeklySummary': 'สรุปรายสัปดาห์ (7 วันล่าสุด)',
        'monthlySummary': 'สรุปรายเดือน (30 วันล่าสุด)',
        'frequentlyBoughtItems': 'รายการที่ซื้อบ่อย (30 วันล่าสุด)',
        'highVolumeItems': 'รายการปริมาณสูง (30 วันล่าสุด)',
        'itemsWithRepeatedIssues': 'รายการที่มีปัญหาซ้ำ (30 วันล่าสุด)',
        'totalPurchases': 'รวมการซื้อ',
        'purchaseCount': 'จำนวนครั้งที่ซื้อ',
        'totalQuantity': 'ปริมาณรวม',
        'issueCount': 'จำนวนปัญหา',
        'noRepeatedIssues': 'ไม่พบปัญหาซ้ำ',
        'date': 'วันที่',
        'item': 'รายการ',
        'status': 'สถานะ',
        'receiver': 'ผู้รับ',
        'noPurchaseRecords': 'ยังไม่มีบันทึกการซื้อ',
        'noPurchaseRecordsDesc': 'บันทึกการซื้อจะปรากฏที่นี่เมื่อคุณรับสินค้า',
        'procurementStatistics': 'สถิติการจัดซื้อ',
        'purchaseHistory': 'ประวัติการซื้อ',
        'viewPurchaseHistory': 'ดูประวัติการซื้อ',
        'allPurchases': 'การซื้อทั้งหมด',
        'allPurchasesDesc': 'รายการการซื้อทั้งหมดที่บันทึกไว้',
        'howToRecordPurchase': 'วิธีบันทึกการซื้อ:',
        'howToRecordStep1': '1. ย้ายรายการจาก "ต้องซื้อ" → "พร้อมสั่งซื้อ" → "ซื้อแล้ว / กำลังขนส่ง"',
        'howToRecordStep2': '2. คลิกปุ่ม "รับ" บนรายการในคอลัมน์ "ซื้อแล้ว / กำลังขนส่ง"',
        'howToRecordStep3': '3. กรอกจำนวนที่รับ และเลือกคุณภาพ (ดี / มีปัญหา)',
        'howToRecordStep4': '4. คลิก "ยืนยันการรับสินค้า" - บันทึกจะถูกสร้างอัตโนมัติ',
        'dateRange': 'ช่วงวันที่',
        'startDate': 'วันที่เริ่มต้น',
        'endDate': 'วันที่สิ้นสุด',
        'filter': 'กรอง',
        'clearFilter': 'ล้างตัวกรอง',
        'weeklyReview': 'สรุปรายสัปดาห์',
        'viewWeeklyReview': 'ดูสรุปรายสัปดาห์',
        'weekOf': 'สัปดาห์ของ',
        'totalPurchaseCount': 'จำนวนการซื้อทั้งหมด',
        'uniqueItems': 'รายการที่ซื้อ',
        'mostUsedSupplier': 'ซัพพลายเออร์ที่ใช้มากที่สุด',
        'issueCount': 'จำนวนปัญหา',
        'frequentlyBoughtItems': 'รายการที่ซื้อบ่อย',
        'highVolumeItems': 'รายการที่ซื้อจำนวนมาก',
        'issuesThisWeek': 'ปัญหาของสัปดาห์นี้',
        'weeklyInsights': 'ข้อมูลเชิงลึก',
        'purchaseCount': 'จำนวนครั้ง',
        'noIssuesThisWeek': 'ไม่มีปัญหาสำหรับสัปดาห์นี้',
        'noDataThisWeek': 'ไม่มีข้อมูลสำหรับสัปดาห์นี้',
        'summary': 'สรุป',
        'exportCSV': 'ส่งออก CSV',
        'exportJSON': 'ส่งออก JSON',
        'dataExportedSuccess': 'ส่งออกข้อมูลสำเร็จ',
    },
    en: {
        // Top bar
        'title': 'Crystal Resort Procurement Board',
        'totalToday': 'Total Today',
        'pending': 'Pending',
        'issues': 'Issues',
        
        // View toggles
        'procurementBoard': 'Procurement Board',
        'managerDashboard': 'Manager Dashboard',
        'managerView': 'Manager View',
        
        // Board columns
        'needToBuy': 'Need to Buy',
        'ordered': 'Ready to Order',
        'bought': 'Bought / In Transit',
        'received': 'Received',
        'verified': 'Problem',
        
        // Filters
        'searchItems': 'Search items...',
        'supplier': 'Supplier',
        'all': 'All',
        'status': 'Status',
        'allStatus': 'All Status',
        'category': 'Category',
        'allCategories': 'All Categories',
        'assignedTo': 'Assigned To',
        'allAssigned': 'All',
        
        // Categories
        'vegetables': 'Vegetables',
        'fruits': 'Fruits',
        'meat': 'Meat',
        'seafood': 'Seafood',
        'dairy': 'Dairy',
        'bakery': 'Bakery',
        'beverages': 'Beverages',
        'dryGoods': 'Dry Goods',
        'spices': 'Spices',
        'other': 'Other',
        
        // Actions
        'addItem': '+ Add Item',
        'addItemButton': 'Add Item',
        'select': 'Select',
        'actions': 'Actions',
        'templates': 'Templates',
        'stats': 'Stats',
        'checklist': 'Checklist',
        'quick': 'Quick',
        'shortcuts': 'Shortcuts',
        'print': 'Print',
        'export': 'Export',
        'import': 'Import',
        
        // Item fields
        'itemName': 'Item Name',
        'quantity': 'Quantity',
        'unit': 'Unit',
        'unitKg': 'kg',
        'unitBottle': 'bottle',
        'unitPiece': 'piece',
        'unitPack': 'pack',
        'unitBox': 'box',
        'unitLiter': 'liter',
        'unitBag': 'Bag',
        'supplier': 'Supplier',
        // Supplier names
        'supplierMakro': 'Makro',
        'supplierFreshMarket': 'Market',
        'supplierBakery': 'Sunisa',
        'receive': 'Receive',
        'verify': 'Verify',
        'urgency': 'Urgency',
        'normal': 'Normal',
        'urgent': 'Urgent 🔥',
        'urgencyHint': 'Default is Normal. Check to mark as Urgent.',
        'assignedTo': 'Assigned To',
        'notes': 'Notes',
        'requestedQty': 'Requested Qty',
        'receivedQty': 'Received Qty',
        'qualityCheck': 'Quality Check',
        'ok': 'OK',
        'notOk': 'Not OK',
        'issueType': 'Issue Type',
        'issueReason': 'Issue Reason',
        
        // Issue types
        'wrongWeight': 'Wrong weight',
        'notFresh': 'Not fresh',
        'wrongItem': 'Wrong item',
        'overpriced': 'Overpriced',
        'other': 'Other',
        
        // Status actions
        'move': 'Move',
        'receive': 'Receive',
        'edit': 'Edit',
        'delete': 'Delete',
        'duplicate': 'Duplicate',
        'history': 'History',
        'editNotes': 'Edit Notes',
        
        // Modals
        'addNewItem': 'Add New Item',
        'editItem': 'Edit Item',
        'receiving': 'Receiving',
        'itemDetails': 'Item Details',
        'itemHistory': 'Item History',
        'bulkActions': 'Bulk Actions',
        'templates': 'Item Templates',
        'statistics': 'Statistics',
        'receivingChecklist': 'Receiving Checklist',
        'keyboardShortcuts': 'Keyboard Shortcuts',
        'importData': 'Import Data',
        'exportData': 'Export Data',
        
        // Dashboard
        'managerDashboardTitle': 'Manager Dashboard – Crystal Resort Procurement',
        'today': 'Today',
        'last7Days': 'Last 7 Days',
        'last30Days': 'Last 30 Days',
        'pendingItems': 'Pending Items',
        'issues': 'Issues',
        'urgentItems': 'Urgent Items 🔥',
        'delayedStuckItems': 'Delayed / Stuck Items',
        'supplierIssues': 'Supplier Issues',
        'teamWorkload': 'Team Workload & Accountability',
        'itemsAssignedPerPerson': 'Items assigned per person',
        'noAssignedItems': 'No assigned items',
        'total': 'Total',
        
        // Mobile view
        'kitchenOps': 'Kitchen Ops',
        'lastUpdated': 'Last updated',
        'needsAttention': 'Needs Attention',
        'teamLoad': 'Team Load',
        'dashboard': 'Dashboard',
        'allItemsUpToDate': 'All items are up to date',
        'noSupplierIssues': 'No supplier issues',
        'urgentDelayed': 'Urgent + Delayed',
        'delayed': 'Delayed',
        '7days': '7 Days',
        '30days': '30 Days',
        
        // Authentication
        'login': 'Login',
        'logout': 'Log out',
        'nickname': 'Nickname',
        'loggedInUser': 'Logged-in user',
        'pleaseLogin': 'Please login',
        'pleaseEnterNickname': 'Please enter nickname',
        'loginSuccess': 'Login successful',
        'logoutSuccess': 'Logged out successfully',
        'loginInstruction': 'Please enter your nickname to edit room information',
        
        // Common
        'user': 'User',
        'save': 'Save',
        'cancel': 'Cancel',
        'close': 'Close',
        'yes': 'Yes',
        'no': 'No',
        'confirm': 'Confirm',
        'loading': 'Loading...',
        'noItems': 'No items',
        'noData': 'No data',
        'unknown': 'Unknown',
        'invalid': 'Invalid',
        'unassigned': 'Unassigned',
        'requested': 'Requested',
        'received': 'Received',
        'difference': 'Difference',
        'quality': 'Quality',
        'freshOk': 'Fresh / OK',
        'issue': 'Issue',
        'previouslyReceived': 'Previously Received',
        'receivedQuantityThisTime': 'Received Quantity This Time',
        'enterQuantityReceived': 'Enter quantity received in this delivery',
        'selectIssueType': 'Select issue type...',
        'additionalDetails': 'Additional details about the issue...',
        'confirmReceiving': 'Confirm Receiving',
        'assignUnassigned': 'Assign Unassigned',
        'markAllReceivedOk': 'Mark All Received OK',
        'moveAllToNextStage': 'Move All to Next Stage',
        'clearCompleted': 'Clear Completed',
        
        // Notifications
        'itemAddedSuccess': 'Item added successfully',
        'itemUpdatedSuccess': 'Item updated successfully',
        'itemDeletedSuccess': 'Item deleted successfully',
        'itemsDeletedSuccess': 'Items deleted successfully',
        'confirmDeleteItem': 'Are you sure you want to delete this item?',
        'confirmDeleteItems': 'Delete selected items?',
        'confirmDeleteTemplate': 'Delete this template?',
        'confirmClearCompleted': 'Delete completed items older than 7 days?',
        'dataExportedSuccess': 'Data exported successfully!',
        'dataImportedSuccess': 'Data imported successfully',
        'importFailed': 'Import failed',
        'pleasePasteJson': 'Please paste JSON data',
        'templateCreatedSuccess': 'Template created successfully',
        'itemDuplicatedSuccess': 'Item duplicated successfully',
        'itemsMoved': 'Items moved successfully',
        'itemsAssigned': 'Items assigned successfully',
        'urgencyUpdated': 'Urgency updated successfully',
        'itemsVerified': 'Items verified successfully',
        'itemsAssignedToUser': 'Items assigned successfully',
        'completedItemsCleared': 'Completed items cleared successfully',
        'selectedItemsAtFinalStage': 'Selected items are already at final stage',
        'noReceivedItemsToVerify': 'No received items to verify',
        'errorLoadingMobileView': 'Error loading mobile view',
        'errorLoadingDashboard': 'Error loading dashboard',
        
        // Validation errors
        'itemNameMinLength': 'Item name must be at least 2 characters',
        'quantityMustBePositive': 'Quantity must be greater than 0',
        'unitRequired': 'Unit is required',
        'supplierRequired': 'Supplier is required',
        
        // Quick Receive
        'quickReceiveUndo': 'Undo',
        'quickReceiveSuccess': 'Item received successfully',
        
        // Analysis Views
        'weekly': 'Weekly',
        'monthly': 'Monthly',
        'frequentlyBought': 'Frequently Bought',
        'highVolume': 'High Volume',
        'repeatedIssues': 'Repeated Issues',
        'weeklySummary': 'Weekly Summary (Last 7 Days)',
        'monthlySummary': 'Monthly Summary (Last 30 Days)',
        'frequentlyBoughtItems': 'Frequently Bought Items (Last 30 Days)',
        'highVolumeItems': 'High Volume Items (Last 30 Days)',
        'itemsWithRepeatedIssues': 'Items with Repeated Issues (Last 30 Days)',
        'totalPurchases': 'Total Purchases',
        'purchaseCount': 'Purchase Count',
        'totalQuantity': 'Total Quantity',
        'issueCount': 'Issue Count',
        'noRepeatedIssues': 'No repeated issues found',
        'date': 'Date',
        'item': 'Item',
        'status': 'Status',
        'receiver': 'Receiver',
        'noPurchaseRecords': 'No purchase records yet',
        'noPurchaseRecordsDesc': 'Purchase records will appear here when you receive items',
        'procurementStatistics': 'Procurement Statistics',
        'purchaseHistory': 'Purchase History',
        'viewPurchaseHistory': 'View Purchase History',
        'allPurchases': 'All Purchases',
        'allPurchasesDesc': 'All purchase records that have been saved',
        'howToRecordPurchase': 'How to Record Purchases:',
        'howToRecordStep1': '1. Move items from "Need to Buy" → "Ready to Order" → "Bought / In Transit"',
        'howToRecordStep2': '2. Click the "Receive" button on items in the "Bought / In Transit" column',
        'howToRecordStep3': '3. Enter the received quantity and select quality (OK / Issue)',
        'howToRecordStep4': '4. Click "Confirm Receiving" - record will be created automatically',
        'dateRange': 'Date Range',
        'startDate': 'Start Date',
        'endDate': 'End Date',
        'filter': 'Filter',
        'clearFilter': 'Clear Filter',
        'weeklyReview': 'Weekly Review',
        'viewWeeklyReview': 'View Weekly Review',
        'weekOf': 'Week of',
        'totalPurchaseCount': 'Total Purchases',
        'uniqueItems': 'Unique Items',
        'mostUsedSupplier': 'Most Used Supplier',
        'issueCount': 'Issues',
        'frequentlyBoughtItems': 'Frequently Bought Items',
        'highVolumeItems': 'High Volume Items',
        'issuesThisWeek': 'Issues This Week',
        'weeklyInsights': 'Weekly Insights',
        'purchaseCount': 'Count',
        'noIssuesThisWeek': 'No issues this week',
        'noDataThisWeek': 'No data for this week',
        'summary': 'Summary',
        'exportCSV': 'Export CSV',
        'exportJSON': 'Export JSON',
        'dataExportedSuccess': 'Data exported successfully',
    }
};

// Current language (default: Thai)
// Force Thai language - language switcher is hidden
let currentLanguage = 'th';
// Clear any stored English preference
localStorage.removeItem(LANGUAGE_STORAGE_KEY);

// Translation function
function t(key) {
    return translations[currentLanguage][key] || translations.en[key] || key;
}

// Get supplier display name (translated based on current language)
function getSupplierDisplayName(supplier) {
    if (currentLanguage === 'th') {
        const thaiMap = {
            'Makro': 'แม็คโคร',
            'Fresh Market': 'ตลาด',
            'Bakery': 'สุนิษา',
            'Other': t('other')
        };
        return thaiMap[supplier] || supplier;
    } else {
        const englishMap = {
            'Makro': 'Makro',
            'Fresh Market': 'Market',
            'Bakery': 'Sunisa',
            'Other': t('other')
        };
        return englishMap[supplier] || supplier;
    }
}

// Get unit display name (translated based on current language)
function getUnitDisplayName(unit) {
    if (!unit) return '';
    const unitMap = {
        'kg': currentLanguage === 'th' ? t('unitKg') : 'kg',
        'bottle': currentLanguage === 'th' ? t('unitBottle') : 'bottle',
        'piece': currentLanguage === 'th' ? t('unitPiece') : 'piece',
        'pack': currentLanguage === 'th' ? t('unitPack') : 'pack',
        'box': currentLanguage === 'th' ? t('unitBox') : 'box',
        'liter': currentLanguage === 'th' ? t('unitLiter') : 'liter',
        'bag': currentLanguage === 'th' ? t('unitBag') : 'Bag'
    };
    return unitMap[unit] || unit;
}

// Switch language
function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    
    // Update language button states
    const langBtnTh = document.getElementById('langBtnTh');
    const langBtnEn = document.getElementById('langBtnEn');
    if (langBtnTh) langBtnTh.classList.toggle('active', lang === 'th');
    if (langBtnEn) langBtnEn.classList.toggle('active', lang === 'en');
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update date format
    updateTodayDate();
    
    updateUI();
}

// Update all UI text
function updateUI() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && el.textContent !== undefined) {
            const translatedText = t(key);
            // Preserve asterisk (*) for required fields
            // Check if associated input/select has required attribute
            let needsAsterisk = false;
            if (el.tagName === 'LABEL') {
                const forAttr = el.getAttribute('for');
                if (forAttr) {
                    const associatedInput = document.getElementById(forAttr);
                    if (associatedInput && associatedInput.hasAttribute('required')) {
                        needsAsterisk = true;
                    }
                }
            }
            // Also check if original text had asterisk (for labels without for attribute)
            const originalText = el.textContent;
            if (originalText.includes('*') && !translatedText.includes('*')) {
                needsAsterisk = true;
            }
            
            el.textContent = needsAsterisk ? translatedText + ' *' : translatedText;
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.placeholder = t(key);
        }
    });
    
    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
            el.title = t(key);
        }
    });
    
    // Update select options
    document.querySelectorAll('select option[data-i18n]').forEach(option => {
        const key = option.getAttribute('data-i18n');
        if (key) {
            option.textContent = t(key);
        }
    });
    
    // Update column headers dynamically
    COLUMN_ORDER.forEach(status => {
        const headerEl = document.querySelector(`[data-column="${status}"] h2`);
        if (headerEl) {
            const countEl = headerEl.querySelector('.item-count');
            const count = countEl ? countEl.textContent : '0';
            const spanEl = headerEl.querySelector('span[data-i18n]');
            if (spanEl) {
                spanEl.textContent = getColumnLabel(status);
            } else {
                headerEl.innerHTML = `<span data-i18n="${status === 'need-to-buy' ? 'needToBuy' : status}">${getColumnLabel(status)}</span> <span class="item-count" id="count-${status}">${count}</span>`;
            }
        }
    });
    
    // Re-render views
    if (currentView === 'board') {
        renderBoard();
    } else if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'mobile') {
        renderMobileView();
    }
}

// Initialize app
let items = [];
let currentSearchTerm = '';
let currentSupplierFilter = 'all';
let currentStatusFilter = 'all';
let bulkSelectMode = false;
let selectedItems = new Set();
let templates = [];
const TEMPLATES_STORAGE_KEY = 'kitchen_procurement_templates';

// Manager Dashboard state
let currentView = 'board';
let dashboardTimeRange = 'today';
let mobileTimeRange = 'today';

// Purchase Records System
let purchaseRecords = [];

// Load purchase records from localStorage
function loadPurchaseRecords() {
    const stored = localStorage.getItem(PURCHASE_RECORDS_KEY);
    if (stored) {
        try {
            purchaseRecords = JSON.parse(stored);
        } catch (e) {
            console.error('Error loading purchase records:', e);
            purchaseRecords = [];
        }
    }
}

// Save purchase records to localStorage
function savePurchaseRecords() {
    try {
        localStorage.setItem(PURCHASE_RECORDS_KEY, JSON.stringify(purchaseRecords));
    } catch (e) {
        console.error('Error saving purchase records:', e);
    }
}

// Record a purchase (append-only)
// Record purchase snapshot in purchase_history (immutable record)
async function recordPurchase(item, status) {
    const record = {
        id: `purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: Date.now(),
        itemName: item.name || 'Unknown',
        supplier: item.supplier || 'Unknown',
        quantity: item.received_qty || item.requested_qty || item.quantity || 0,
        unit: item.unit || 'piece',
        status: status, // 'OK' or 'Issue'
        receiver: currentUser,
        issueType: item.issue_type || null,
        issueReason: item.issueReason || null,
        itemId: item.id // Track which item this record belongs to
    };
    
    purchaseRecords.push(record);
    
    // Save to Supabase purchase_history table if configured
    if (checkSupabaseConfig()) {
        await savePurchaseRecordToSupabase(record);
    } else {
        // Fallback to localStorage
    savePurchaseRecords();
    }
    
    return record.id; // Return record ID for potential undo
}

// Load data from Supabase or localStorage (async)
async function loadData() {
    if (checkSupabaseConfig()) {
        // Try loading from Supabase first
        const supabaseItems = await loadItemsFromSupabase();
        if (supabaseItems !== null) {
            items = supabaseItems.map(item => migrateItemToV2(item));
        } else {
            // Fallback to localStorage
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                try {
                    items = JSON.parse(stored).map(item => migrateItemToV2(item));
                } catch (e) {
                    console.error('Error loading data:', e);
                    items = [];
                }
            }
        }
        
        // Load purchase history from Supabase
        const supabaseRecords = await loadPurchaseRecordsFromSupabase();
        if (supabaseRecords !== null) {
            purchaseRecords = supabaseRecords.map(record => ({
                id: record.id,
                date: new Date(record.created_at).getTime(),
                itemName: record.item_name,
                supplier: record.supplier,
                quantity: record.quantity,
                unit: record.unit,
                status: record.status,
                receiver: record.receiver ? JSON.parse(record.receiver) : null,
                issueType: record.issue_type,
                issueReason: record.issue_reason,
                itemId: record.item_id
            }));
        } else {
            loadPurchaseRecords();
        }
        
        // Setup real-time subscriptions
        setupRealtimeSubscriptions();
    } else {
        // Use localStorage fallback (synchronous)
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                items = JSON.parse(stored);
                items = items.map(item => migrateItemToV2(item));
            } catch (e) {
                console.error('Error loading data:', e);
                items = [];
            }
        }
        loadPurchaseRecords();
    }
    
    // Return a resolved promise for consistent async handling
    return Promise.resolve();
}

// Migrate item to v2 data model (silent - no logging)
function migrateItemToV2(item) {
    // Map snake_case database columns to camelCase JavaScript properties
    // Map item_name (database) to name (JavaScript)
    // CRITICAL: Never use fallbacks - preserve existing name or use DB name if valid
    const dbName = item.item_name;
    const existingName = item.name;
    
    // Validate names (reject empty strings and fallback values)
    const dbNameValid = dbName && dbName.trim() !== '' && dbName !== 'Unknown Item' && !dbName.startsWith('Unknown');
    const existingNameValid = existingName && existingName.trim() !== '' && existingName !== 'Unknown Item' && !existingName.startsWith('Unknown');
    
    // Determine the best name to use - prefer existing, then DB, but never fallback
    if (existingNameValid) {
        // Keep existing name if valid
        item.name = existingName;
    } else if (dbNameValid) {
        // Use DB name if existing is invalid but DB is valid
        item.name = dbName;
    } else {
        // Both invalid - keep existing (even if invalid) to avoid overwriting with fallback
        item.name = existingName || dbName || ''; // Empty string is better than 'Unknown Item'
    }
    
    // Map issue_reason (database) to issueReason (JavaScript)
    if (item.issue_reason !== undefined && item.issueReason === undefined) {
        item.issueReason = item.issue_reason;
    }
    
    // Ensure v2 fields exist
    if (!item.requested_qty) item.requested_qty = item.quantity || 0;
    if (!item.received_qty) item.received_qty = item.actualQuantity || 0;
    if (!item.urgency) item.urgency = 'normal';
    if (!item.issue_type) item.issue_type = null;
    if (!item.statusTimestamps) item.statusTimestamps = {};
    if (!item.qualityCheck) item.qualityCheck = null;
    
    // Preserve nickname fields if they exist
    // These are stored locally and not in database, so preserve them during migration
    if (item.updated_by_nickname === undefined && item.updated_by_nickname === null) {
        // Keep existing value if present
    }
    if (item.created_by_nickname === undefined && item.created_by_nickname === null) {
        // Keep existing value if present
    }
    
    // Set current status timestamp if not exists
    if (!item.statusTimestamps[item.status]) {
        item.statusTimestamps[item.status] = item.lastUpdated || Date.now();
    }
    
    // Set requested timestamp if not exists
    if (!item.statusTimestamps['need-to-buy']) {
        item.statusTimestamps['need-to-buy'] = item.lastUpdated || Date.now();
    }
    
    // Auto-detect and update issue status
    item = detectAndUpdateIssueStatus(item);
    
    return item;
}

// ============================================================================
// DATA SELECTORS & CALCULATION LOGIC
// ============================================================================

/**
 * Detect if an item has an issue (automatic detection)
 * An item is considered an issue if:
 * 1. Status is explicitly marked as "issue"
 * 2. Received quantity is less than requested quantity
 * 3. Issue type is present
 */
function detectIssueStatus(item) {
    const requestedQty = item.requested_qty || item.quantity || 0;
    const receivedQty = item.received_qty || 0;
    
    // Explicit issue flag
    if (item.issue === true) {
        return true;
    }
    
    // Received less than requested
    if (item.status === 'received' && receivedQty < requestedQty) {
        return true;
    }
    
    // Issue type present
    if (item.issue_type) {
        return true;
    }
    
    return false;
}

/**
 * Update item issue status automatically
 */
function detectAndUpdateIssueStatus(item) {
    const hasIssue = detectIssueStatus(item);
    
    // Auto-update issue flag if detected
    if (hasIssue && !item.issue) {
        item.issue = true;
        // If received less than requested, set issue type
        if (!item.issue_type) {
            const requestedQty = item.requested_qty || item.quantity || 0;
            const receivedQty = item.received_qty || 0;
            if (receivedQty < requestedQty) {
                item.issue_type = 'wrong_weight';
            }
        }
    }
    
    return item;
}

/**
 * Check if item is delayed/stuck based on status and time thresholds
 */
function isItemDelayed(item) {
    const now = Date.now();
    const statusTime = item.statusTimestamps?.[item.status] || item.lastUpdated;
    const timeSinceStatus = now - statusTime;
    
    // Check delay threshold for current status
    const threshold = DELAY_THRESHOLDS[item.status];
    if (!threshold) {
        return false; // No delay threshold for this status
    }
    
    // Don't mark verified items as delayed
    if (item.status === 'verified') {
        return false;
    }
    
    return timeSinceStatus > threshold;
}

/**
 * Check if item is urgent
 */
function isItemUrgent(item) {
    return item.urgency === 'urgent' && item.status !== 'verified';
}

/**
 * Validate status transition (forward-only)
 */
function isValidStatusTransition(currentStatus, newStatus) {
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
    
    // Allow staying in same status
    if (currentStatus === newStatus) {
        return true;
    }
    
    // Check if transition is allowed
    return allowedTransitions.includes(newStatus);
}

/**
 * Get time range boundaries for filtering
 */
function getTimeRangeBoundaries(range) {
    const now = Date.now();
    let startTime;
    
    switch (range) {
        case 'today':
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startTime = today.getTime();
            break;
        case '7days':
            startTime = now - (7 * 24 * 60 * 60 * 1000);
            break;
        case '30days':
            startTime = now - (30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startTime = 0; // All time
    }
    
    return { startTime, endTime: now };
}

/**
 * Check if item falls within time range (based on requested date)
 */
function isItemInTimeRange(item, range) {
    if (range === 'all') {
        return true;
    }
    
    const { startTime } = getTimeRangeBoundaries(range);
    const requestedTime = item.statusTimestamps?.['need-to-buy'] || item.lastUpdated;
    
    return requestedTime >= startTime;
}

/**
 * Filter items by supplier
 */
function filterBySupplierSelector(items, supplier) {
    if (supplier === 'all') {
        return items;
    }
    return items.filter(item => item.supplier === supplier);
}

/**
 * Filter items by status
 */
function filterByStatusSelector(items, status) {
    if (status === 'all') {
        return items;
    }
    return items.filter(item => item.status === status);
}



/**
 * Filter items by search term
 */
function filterBySearchSelector(items, searchTerm) {
    if (!searchTerm) {
        return items;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return items.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        (item.notes && item.notes.toLowerCase().includes(searchLower)) ||
        item.supplier.toLowerCase().includes(searchLower)
    );
}

/**
 * Get pending items (not verified/issue)
 */
function getPendingItemsSelector(items) {
    return items.filter(item => 
        ['need-to-buy', 'ordered', 'bought', 'received'].includes(item.status)
    );
}

/**
 * Get items with issues
 */
function getIssuesSelector(items) {
    return items.filter(item => detectIssueStatus(item));
}

/**
 * Get urgent items
 */
function getUrgentItemsSelector(items) {
    return items.filter(item => isItemUrgent(item));
}

/**
 * Get delayed/stuck items
 */
function getDelayedItemsSelector(items) {
    return items.filter(item => isItemDelayed(item));
}

/**
 * Group items by supplier
 */
function groupBySupplierSelector(items) {
    const grouped = {};
    items.forEach(item => {
        const supplier = item.supplier || 'Unknown';
        if (!grouped[supplier]) {
            grouped[supplier] = [];
        }
        grouped[supplier].push(item);
    });
    return grouped;
}

/**
 * Group items by status
 */
function groupByStatusSelector(items) {
    const grouped = {};
    items.forEach(item => {
        const status = item.status || 'unknown';
        if (!grouped[status]) {
            grouped[status] = [];
        }
        grouped[status].push(item);
    });
    return grouped;
}

/**
 * Group items by issue type
 */
function groupByIssueTypeSelector(items) {
    const issues = getIssuesSelector(items);
    const grouped = {};
    
    issues.forEach(item => {
        const issueType = item.issue_type || 'other';
        if (!grouped[issueType]) {
            grouped[issueType] = [];
        }
        grouped[issueType].push(item);
    });
    
    return grouped;
}

/**
 * Group issues by supplier
 */
function groupIssuesBySupplierSelector(items) {
    const issues = getIssuesSelector(items);
    return groupBySupplierSelector(issues);
}

/**
 * Calculate team workload per person
 */
function calculateTeamWorkloadSelector(items) {
    const workload = {};
    
    // Team workload removed - assigned functionality deleted
    return {};
}

/**
 * Get items ready for receiving (bought or received status)
 */
function getReceivingItemsSelector(items) {
    return items.filter(item => 
        item.status === 'bought' || item.status === 'received'
    );
}

/**
 * Count items by status
 */
function countByStatusSelector(items) {
    const counts = {};
    COLUMN_ORDER.forEach(status => {
        counts[status] = items.filter(item => item.status === status).length;
    });
    return counts;
}

/**
 * Count issues by type
 */
function countIssuesByTypeSelector(items) {
    const grouped = groupByIssueTypeSelector(items);
    const counts = {};
    
    Object.keys(grouped).forEach(type => {
        counts[type] = grouped[type].length;
    });
    
    return counts;
}

// ============================================================================
// SHARED DASHBOARD DATA SELECTOR
// Single source of truth for all dashboard calculations
// ============================================================================

/**
 * Compute dashboard data from raw items and time range
 * This is the single source of truth for all dashboard metrics
 * 
 * @param {Array} allItems - All procurement items from storage
 * @param {string} timeRange - Time range filter ('today', '7days', '30days', 'all')
 * @returns {Object} dashboardData - Complete dashboard data structure
 */
function computeDashboardData(allItems, timeRange) {
    const now = Date.now();
    
    // Ensure allItems is an array
    if (!Array.isArray(allItems)) {
        allItems = [];
    }
    
    // Filter items by time range (based on requested date)
    const filteredItems = allItems.filter(item => {
        try {
            return isItemInTimeRange(item, timeRange);
        } catch (e) {
            console.error('Error filtering item:', e, item);
            return false;
        }
    });
    
    // Auto-detect and update issue status for all filtered items
    filteredItems.forEach(item => {
        try {
            detectAndUpdateIssueStatus(item);
        } catch (e) {
            console.error('Error detecting issue status:', e, item);
        }
    });
    
    // Get base selectors
    const pendingItems = getPendingItemsSelector(filteredItems);
    const issues = getIssuesSelector(filteredItems);
    const urgentItems = getUrgentItemsSelector(filteredItems);
    const delayedItems = getDelayedItemsSelector(filteredItems);
    
    // Priority sorting: Urgent+Delayed > Issue > Delayed > Normal
    const needsAttention = [...filteredItems]
        .filter(item => {
            // Include items that need attention
            const isUrgent = isItemUrgent(item);
            const isDelayed = isItemDelayed(item);
            const hasIssue = detectIssueStatus(item);
            const isPending = ['need-to-buy', 'ordered', 'bought', 'received'].includes(item.status);
            
            return (isUrgent || isDelayed || hasIssue) && isPending;
        })
        .map(item => {
            // Assign priority score
            const isUrgent = isItemUrgent(item);
            const isDelayed = isItemDelayed(item);
            const hasIssue = detectIssueStatus(item);
            
            let priority = 4; // Normal pending
            
            if (isUrgent && isDelayed) {
                priority = 1; // Highest priority
            } else if (hasIssue) {
                priority = 2;
            } else if (isDelayed) {
                priority = 3;
            }
            
            return {
                ...item,
                _priority: priority,
                _isUrgent: isUrgent,
                _isDelayed: isDelayed,
                _hasIssue: hasIssue
            };
        })
        .sort((a, b) => {
            // Sort by priority first
            if (a._priority !== b._priority) {
                return a._priority - b._priority;
            }
            // Then by time (oldest first)
            const aTime = a.statusTimestamps?.[a.status] || a.lastUpdated;
            const bTime = b.statusTimestamps?.[b.status] || b.lastUpdated;
            return aTime - bTime;
        });
    
    // Group issues by supplier
    const issuesBySupplier = groupIssuesBySupplierSelector(filteredItems);
    const issuesBySupplierCounts = {};
    Object.keys(issuesBySupplier).forEach(supplier => {
        issuesBySupplierCounts[supplier] = issuesBySupplier[supplier].length;
    });
    
    // Calculate team workload
    const workload = calculateTeamWorkloadSelector(filteredItems);
    const teamWorkload = Object.entries(workload)
        .map(([person, stats]) => ({
            person,
            total: stats.total,
            pending: stats.pending,
            issues: stats.issues
        }))
        .sort((a, b) => b.total - a.total); // Sort by total descending
    
    // Build dashboard data structure
    const dashboardData = {
        meta: {
            timeRange: timeRange,
            lastComputedAt: now,
            totalItems: filteredItems.length
        },
        
        counts: {
            pending: pendingItems.length || 0,
            issues: issues.length || 0,
            urgent: urgentItems.length || 0,
            delayed: delayedItems.length || 0
        },
        
        needsAttention: needsAttention || [],
        
        issuesBySupplier: {
            Makro: issuesBySupplierCounts['Makro'] || 0,
            FreshMarket: issuesBySupplierCounts['Fresh Market'] || 0,
            Bakery: issuesBySupplierCounts['Bakery'] || 0,
            Other: issuesBySupplierCounts['Other'] || 0
        },
        
        urgentItems: (urgentItems || []).map(item => ({
            ...item,
            _isDelayed: isItemDelayed(item)
        })),
        
        delayedItems: (delayedItems || []).sort((a, b) => {
            const aTime = a.statusTimestamps?.[a.status] || a.lastUpdated;
            const bTime = b.statusTimestamps?.[b.status] || b.lastUpdated;
            return aTime - bTime; // Oldest first
        }),
        
        teamWorkload: teamWorkload || []
    };
    
    return dashboardData;
}

// Save data to Supabase or localStorage
async function saveData() {
    if (checkSupabaseConfig()) {
        // Save all items to Supabase
        try {
            for (const item of items) {
                // Skip items from real-time to prevent echo saves
                if (!item._fromRealtime) {
                    await saveItemToSupabase(item, 'saveData');
                }
            }
        } catch (e) {
            console.error('Error saving to Supabase:', e);
            // Fallback to localStorage
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            } catch (e2) {
                console.error('Error saving to localStorage:', e2);
            }
        }
    } else {
        // Use localStorage fallback
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            console.error('Error saving data:', e);
        }
    }
}

// Generate unique ID for items
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Render all items (with auto-issue detection and performance optimization)
function renderBoard() {
    // Auto-detect and update issue status for all items
    items.forEach(item => {
        detectAndUpdateIssueStatus(item);
    });
    
    // Clear all columns
    COLUMN_ORDER.forEach(colId => {
        const container = document.getElementById(`${colId}-items`);
        if (container) {
            container.innerHTML = '';
        }
    });

    // Filter items based on search and filters (using selectors)
    const filteredItems = getFilteredItems();

    // Sort items: urgent first, then by last updated
    const sortedItems = filteredItems.sort((a, b) => {
        const aUrgent = isItemUrgent(a);
        const bUrgent = isItemUrgent(b);
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    });

    // Render items in their respective columns (batch DOM updates)
    const fragmentMap = {};
    COLUMN_ORDER.forEach(colId => {
        fragmentMap[colId] = document.createDocumentFragment();
    });

    // Check if mobile view
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    // Helper function to render items grouped by supplier
    function renderGroupedBySupplier(items, fragment) {
        if (!items || items.length === 0) return;
        
        // Group items by supplier
        const supplierGroups = {};
        items.forEach(item => {
            const supplier = item.supplier || 'Other';
            if (!supplierGroups[supplier]) {
                supplierGroups[supplier] = [];
            }
            supplierGroups[supplier].push(item);
        });
        
        // Define supplier order: ตลาด, แม็คโคร, สุนิษา, อื่นๆ
        const supplierOrder = ['Fresh Market', 'Makro', 'Bakery', 'Other'];
        
        // Render suppliers in specified order
        supplierOrder.forEach(supplierKey => {
            // Find matching supplier in groups
            const matchingSupplier = Object.keys(supplierGroups).find(s => {
                if (supplierKey === 'Fresh Market') return s === 'Fresh Market';
                if (supplierKey === 'Makro') return s === 'Makro';
                if (supplierKey === 'Bakery') return s === 'Bakery';
                if (supplierKey === 'Other') return s === 'Other' || !['Fresh Market', 'Makro', 'Bakery'].includes(s);
                return false;
            });
            
            if (matchingSupplier && supplierGroups[matchingSupplier]) {
                const groupItems = supplierGroups[matchingSupplier];
                if (groupItems.length > 0) {
                    // Create supplier header
                    const supplierHeader = document.createElement('div');
                    supplierHeader.className = 'supplier-group-header-mobile';
                    supplierHeader.innerHTML = `<span class="supplier-group-name">${getSupplierDisplayName(matchingSupplier)}</span> <span class="supplier-group-count">${groupItems.length}</span>`;
                    fragment.appendChild(supplierHeader);
                    
                    // Add items for this supplier
                    groupItems.forEach(item => {
                        fragment.appendChild(createItemCard(item));
                    });
                }
            }
        });
        
        // Render any remaining suppliers not in the order list
        Object.keys(supplierGroups).forEach(supplier => {
            if (!supplierOrder.some(key => {
                if (key === 'Fresh Market') return supplier === 'Fresh Market';
                if (key === 'Makro') return supplier === 'Makro';
                if (key === 'Bakery') return supplier === 'Bakery';
                if (key === 'Other') return supplier === 'Other' || !['Fresh Market', 'Makro', 'Bakery'].includes(supplier);
                return false;
            })) {
                const groupItems = supplierGroups[supplier];
                if (groupItems.length > 0) {
                    const supplierHeader = document.createElement('div');
                    supplierHeader.className = 'supplier-group-header';
                    supplierHeader.innerHTML = `<span class="supplier-group-name">${getSupplierDisplayName(supplier)}</span> <span class="supplier-group-count">${groupItems.length}</span>`;
                    fragment.appendChild(supplierHeader);
                    
                    groupItems.forEach(item => {
                        fragment.appendChild(createItemCard(item));
                    });
                }
            }
        });
    }

    // Sections that should be grouped by supplier (mobile, tablet, and desktop)
    const groupedSections = ['need-to-buy', 'ordered', 'bought', 'received'];

        // Separate items by status
        const groupedSectionItems = {};
        const otherItems = [];
        
        sortedItems.forEach(item => {
            if (groupedSections.includes(item.status)) {
                if (!groupedSectionItems[item.status]) {
                    groupedSectionItems[item.status] = [];
                }
                groupedSectionItems[item.status].push(item);
            } else {
                otherItems.push(item);
            }
        });
        
    // Render grouped sections (for all screen sizes)
        groupedSections.forEach(status => {
            const fragment = fragmentMap[status];
            const items = groupedSectionItems[status] || [];
            if (fragment && items.length > 0) {
                renderGroupedBySupplier(items, fragment);
            }
        });
        
        // Render other items normally
        otherItems.forEach(item => {
            const fragment = fragmentMap[item.status];
            if (fragment) {
                fragment.appendChild(createItemCard(item));
            }
        });

    // Append fragments to containers (single DOM operation per column)
    COLUMN_ORDER.forEach(colId => {
        const container = document.getElementById(`${colId}-items`);
        const fragment = fragmentMap[colId];
        if (container && fragment && fragment.hasChildNodes()) {
            container.appendChild(fragment);
        }
    });

    // Update column counts
    updateColumnCounts();
    
    // Update statistics
    updateStatistics();
    // updateTopBarStats(); // Removed - stat badges were deleted
    
    // Show alerts for urgent/delayed items
    // DISABLED: Urgent warning bar disabled per requirements
    // showUrgentAlerts();
}

// Show visual alerts for urgent/delayed items (using shared dashboard data)
// DISABLED: Urgent warning bar disabled per requirements - function short-circuited to prevent rendering
function showUrgentAlerts() {
    // Early return - urgent warning bar is disabled
    // Remove any existing alert badge that might have been created before
    const existingAlert = document.getElementById('urgentAlertBadge');
    if (existingAlert) {
        existingAlert.remove();
    }
    return; // Exit early - do not render urgent alert bar
    
    /* ORIGINAL CODE - DISABLED (kept for easy re-enable)
    // Use shared dashboard data for consistency
    const dashboardData = computeDashboardData(items, 'all'); // Use 'all' to show all urgent/delayed
    
    // Remove existing alert badge
    const existingAlert = document.getElementById('urgentAlertBadge');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    if (dashboardData.counts.urgent > 0 || dashboardData.counts.delayed > 0) {
        const alert = document.createElement('div');
        alert.id = 'urgentAlertBadge';
        alert.className = 'alert-badge show';
        
        if (dashboardData.counts.urgent > 0 && dashboardData.counts.delayed > 0) {
            alert.className += ' urgent';
            alert.textContent = `⚠️ ${dashboardData.counts.urgent} urgent, ${dashboardData.counts.delayed} delayed items`;
        } else if (dashboardData.counts.urgent > 0) {
            alert.className += ' urgent';
            alert.textContent = `🔥 ${dashboardData.counts.urgent} urgent item${dashboardData.counts.urgent > 1 ? 's' : ''}`;
        } else {
            alert.className += ' delayed';
            alert.textContent = `⏱️ ${dashboardData.counts.delayed} delayed item${dashboardData.counts.delayed > 1 ? 's' : ''}`;
        }
        
        alert.onclick = () => {
            if (currentView !== 'mobile') {
                switchView('mobile');
            }
            alert.remove();
        };
        
        document.body.appendChild(alert);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 300);
            }
        }, 10000);
    }
    */
}

// Get filtered items based on search and all filters (using selectors)
function getFilteredItems() {
    let filtered = items;

    // Apply filters using selector functions
    filtered = filterBySearchSelector(filtered, currentSearchTerm);
    filtered = filterBySupplierSelector(filtered, currentSupplierFilter);
    filtered = filterByStatusSelector(filtered, currentStatusFilter);

    return filtered;
}

// Update column item counts
function updateColumnCounts() {
    COLUMN_ORDER.forEach(colId => {
        const countElement = document.getElementById(`count-${colId}`);
        if (countElement) {
            const count = items.filter(item => item.status === colId).length;
            countElement.textContent = count;
        }
    });
    
    // Update action button states based on selection
    updateActionButtonStates();
}

// Update statistics summary
function updateStatistics() {
    const statsElement = document.getElementById('statsSummary');
    if (!statsElement) return;

    const totalItems = items.length;
    const issuesCount = items.filter(item => item.issue).length;
    const needToBuyCount = items.filter(item => item.status === 'need-to-buy').length;
    const inProgressCount = items.filter(item => 
        ['ordered', 'bought', 'received'].includes(item.status)
    ).length;

    statsElement.innerHTML = `
        <div class="stat-item">
            <span>Total:</span>
            <span class="stat-value">${totalItems}</span>
        </div>
        <div class="stat-item">
            <span>Need to Buy:</span>
            <span class="stat-value">${needToBuyCount}</span>
        </div>
        <div class="stat-item">
            <span>In Progress:</span>
            <span class="stat-value">${inProgressCount}</span>
        </div>
        <div class="stat-item" style="${issuesCount > 0 ? 'background-color: rgba(231, 76, 60, 0.3);' : ''}">
            <span>Issues:</span>
            <span class="stat-value">${issuesCount}</span>
        </div>
    `;
}

// Update top bar statistics v2
function updateTopBarStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    
    // Items created or updated today
    const totalToday = items.filter(item => {
        const itemDate = new Date(item.lastUpdated);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate.getTime() >= todayStart;
    }).length;
    
    // Pending items (not verified)
    const pendingItems = items.filter(item => item.status !== 'verified').length;
    
    // Issues count
    const issuesCount = items.filter(item => item.issue).length;
    
    // Stat badges removed from top bar
}

// Update today's date in top bar
// Format Thai date: วันพฤหัส 15 มค 69
function formatThaiDate(date) {
    const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัส', 'วันศุกร์', 'วันเสาร์'];
    const thaiMonths = ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย', 
                        'กค', 'สค', 'กย', 'ตค', 'พย', 'ธค'];
    
    const dayName = thaiDays[date.getDay()];
    const day = date.getDate();
    const monthName = thaiMonths[date.getMonth()];
    const buddhistYear = (date.getFullYear() + 543).toString().slice(-2); // Convert to Buddhist Era and get last 2 digits
    
    return `${dayName} ${day} ${monthName} ${buddhistYear}`;
}

// Format time: Thai format (24-hour, no seconds, with น.) or English format (12-hour, no seconds)
function formatTime(date) {
    if (currentLanguage === 'th') {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} น.`;
    } else {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
}

function updateTodayDate() {
    const dateEl = document.getElementById('todayDate');
    if (dateEl) {
        const now = new Date();
        let dateTimeText = '';
        
        if (currentLanguage === 'th') {
            const dateText = formatThaiDate(now);
            const timeText = formatTime(now);
            dateTimeText = `${dateText} : ${timeText}`;
        } else {
            const dateText = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeText = formatTime(now);
            dateTimeText = `${dateText} : ${timeText}`;
        }
        
        dateEl.textContent = dateTimeText;
    }
}

// Create item card element v2
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.itemId = item.id;
    card.dataset.status = item.status;
    
    // Add urgency class
    if (item.urgency === 'urgent') {
        card.classList.add('urgent');
    }
    
    // Add selected class for bulk selection
    if (selectedItems.has(item.id)) {
        card.classList.add('selected');
    }
    
    // Add issue/partial classes
    if (item.issue) {
        card.classList.add('issue');
    } else if (item.status === 'verified' && !item.issue) {
        card.classList.add('item-card-ok');
    } else if (item.status === 'received' && item.received_qty && item.received_qty < item.requested_qty) {
        card.classList.add('partial');
    }

    const requestedQty = item.requested_qty || item.quantity || 0;
    const receivedQty = item.received_qty || 0;
    const unit = item.unit || 'piece';
    
    const supplierBadge = `<span class="item-supplier">${getSupplierDisplayName(item.supplier)}</span>`;
    
    // Status icon
    const statusIcon = `<span class="status-icon ${item.status}${item.issue ? ' issue' : ''}"></span>`;
    
    // Quality badge
    let qualityBadge = '';
    if (item.qualityCheck === 'ok') {
        qualityBadge = '<span class="quality-badge ok">✔ Fresh / OK</span>';
    } else if (item.qualityCheck === 'issue') {
        qualityBadge = '<span class="quality-badge issue">⚠ Issue</span>';
    }
    
    // Quantity display
    const unitDisplay = getUnitDisplayName(unit);
    const quantityDisplay = receivedQty > 0 
        ? `${receivedQty} / ${requestedQty} ${unitDisplay}`
        : `${requestedQty} ${unitDisplay}`;

    // Highlight search term
    const highlightedName = highlightSearchTerm(item.name);
    const highlightedSupplier = highlightSearchTerm(item.supplier);

    // Bulk select checkbox
    const bulkCheckbox = bulkSelectMode ? `
        <div class="bulk-select-checkbox">
            <input type="checkbox" class="item-select-checkbox" data-item-id="${item.id}" 
                   ${selectedItems.has(item.id) ? 'checked' : ''} 
                   onchange="toggleItemSelection('${item.id}')">
        </div>
    ` : '';

    // Check if mobile view (screen width <= 640px)
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
    
    // Check if Quick Receive is eligible (available on all screen sizes)
    const isQuickReceiveEligible = item.status === 'bought' && 
        (item.requested_qty || item.quantity) > 0 && 
        !item.issue &&
        currentView === 'board';
    
    // Urgency badge for mobile
    const urgencyBadge = item.urgency === 'urgent' 
        ? `<span class="item-urgency-badge-mobile">${currentLanguage === 'th' ? 'ด่วน' : 'Urgent'}</span>` 
        : '';
    
    if (isMobile) {
        // Mobile-optimized card layout - single row
        // Format: item name space unit space supplier
        const unitDisplay = getUnitDisplayName(item.unit);
        const requestedQty = item.requested_qty || item.quantity || 0;
        const quantityText = `${requestedQty} ${unitDisplay}`;
        
        card.innerHTML = `
            ${bulkCheckbox}
            <div class="item-card-row-mobile">
                <div class="item-card-left">
                    <div class="item-name-info-mobile">
                        <span class="item-name-mobile">${highlightedName}</span>
                        <span class="item-unit-mobile">${quantityText}</span>
                    </div>
                </div>
                <div class="item-card-right">
                    ${urgencyBadge}
                    ${item.status !== 'received' ? `
                    <div class="item-mobile-actions">
                        <button class="item-mobile-btn item-edit-btn" onclick="editItem('${item.id}')" title="${t('editItem')}">✏️</button>
                    </div>
                    ` : ''}
                    ${isQuickReceiveEligible ? `
                    <div class="quick-receive-buttons-row">
                        <button class="quick-receive-btn quick-receive-ok" onclick="quickReceive('${item.id}')">
                            ok
                        </button>
                        <button class="quick-receive-btn quick-receive-issue" onclick="showQuickIssueSheet('${item.id}')">
                            ⚠ ${t('issue')}
                        </button>
                    </div>
                    ` : item.status !== 'received' ? `
                    <div class="item-actions-row-mobile">
                        ${getActionButtons(item)}
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="item-card-expanded-content">
                ${getExpandedContent(item)}
            </div>
        `;
    } else {
        // Desktop/Tablet card layout - single row layout similar to mobile
        const actionButtons = getActionButtons(item);
        const unitDisplay = getUnitDisplayName(item.unit);
        const requestedQty = item.requested_qty || item.quantity || 0;
        const quantityText = `${requestedQty} ${unitDisplay}`;
        
        card.innerHTML = `
            ${bulkCheckbox}
            <div class="item-card-row-desktop">
                <div class="item-card-left-desktop">
                    <div class="item-name-info-desktop">
                        <span class="item-name-desktop">${highlightedName}</span>
                        <span class="item-unit-desktop">${quantityText}</span>
                    </div>
                </div>
                <div class="item-card-right-desktop">
                    ${urgencyBadge}
                    ${item.status !== 'received' ? `
                    <div class="item-desktop-actions">
                        <button class="item-desktop-btn item-edit-btn" onclick="editItem('${item.id}')" title="${t('editItem')}">✏️</button>
                    </div>
                    ` : ''}
                    ${isQuickReceiveEligible ? `
                    <div class="quick-receive-buttons-row">
                        <button class="quick-receive-btn quick-receive-ok" onclick="quickReceive('${item.id}')">
                            ok
                        </button>
                        <button class="quick-receive-btn quick-receive-issue" onclick="showQuickIssueSheet('${item.id}')">
                            ⚠ ${t('issue')}
                        </button>
                    </div>
                    ` : item.status !== 'received' ? `
                    <div class="item-actions-row-desktop">
                        ${actionButtons}
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="item-card-expanded-content">
                ${getExpandedContent(item)}
            </div>
        `;
    }

    // Add click handler for expand/collapse
    const cardHeader = isMobile 
        ? card.querySelector('.item-card-row-mobile')
        : card.querySelector('.item-card-row-desktop');
    if (cardHeader) {
        cardHeader.addEventListener('click', function(e) {
            // Don't expand if clicking buttons, checkbox, or quick receive buttons
            if (e.target.closest('.item-actions') || 
                e.target.closest('.bulk-select-checkbox') || 
                e.target.closest('.quick-receive-buttons') ||
                e.target.closest('.quick-receive-buttons-row') ||
                e.target.closest('.item-actions-row-mobile') ||
                e.target.closest('.item-actions-row-desktop') ||
                e.target.closest('.item-card-right') ||
                e.target.closest('.item-card-right-desktop') ||
                e.target.closest('.item-card-actions-desktop') ||
                e.target.closest('.item-mobile-actions') ||
                e.target.closest('.item-desktop-actions')) return;
            if (!bulkSelectMode) {
                card.classList.toggle('expanded');
            }
        });
    }
    
    // Prevent card expansion when clicking buttons (all screen sizes)
    const actionBtns = card.querySelectorAll('.action-btn-mobile, .action-btn-desktop, .quick-receive-btn, .item-mobile-btn, .item-desktop-btn, .item-actions-row-desktop, .item-actions-row-mobile');
    actionBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent card expansion
        });
    });

    return card;
}

// Highlight search term in text
function highlightSearchTerm(text) {
    if (!currentSearchTerm || !text) return text;
    const regex = new RegExp(`(${currentSearchTerm})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// Get expanded card content
function getExpandedContent(item) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
    const requestedQty = item.requested_qty || item.quantity || 0;
    const receivedQty = item.received_qty || 0;
    const difference = receivedQty - requestedQty;
    const unit = item.unit || 'piece';
    const unitDisplay = getUnitDisplayName(unit);
    
    let differenceClass = '';
    let differenceText = '';
    if (difference > 0) {
        differenceClass = 'difference-positive';
        differenceText = `+${difference.toFixed(2)}`;
    } else if (difference < 0) {
        differenceClass = 'difference-negative';
        differenceText = difference.toFixed(2);
    } else {
        differenceText = '0';
    }
    
    const issueTypeLabels = {
        'wrong_weight': 'Wrong weight',
        'not_fresh': 'Not fresh',
        'wrong_item': 'Wrong item',
        'overpriced': 'Overpriced',
        'other': 'Other'
    };
    
    // Skip the requested/received/difference lines for all views
    const quantityLines = '';
    
    return `
        ${quantityLines}
        ${item.qualityCheck ? `
        <div class="expanded-details-row">
            <span class="expanded-details-label">${t('quality')}:</span>
            <span class="expanded-details-value">${item.qualityCheck === 'ok' ? '✔ ' + t('freshOk') : '⚠ ' + t('issue')}</span>
        </div>
        ` : ''}
        ${item.issue_type ? `
        <div class="expanded-details-row">
            <span class="expanded-details-label">${t('issueType')}:</span>
            <span class="expanded-details-value">${getIssueTypeLabel(item.issue_type) || item.issue_type}</span>
        </div>
        ` : ''}
        ${item.issueReason ? `
        <div class="expanded-details-row">
            <span class="expanded-details-label">${t('issueReason')}:</span>
            <span class="expanded-details-value">${item.issueReason}</span>
        </div>
        ` : ''}
        ${item.notes ? `
        <div class="expanded-details-row">
            <span class="expanded-details-label">${t('notes')}:</span>
            <span class="expanded-details-value">${item.notes}</span>
        </div>
        ` : ''}
    `;
}

// Get action buttons based on item status
function getActionButtons(item) {
    const buttons = [];
    const statusIndex = COLUMN_ORDER.indexOf(item.status);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

    // Move right button (except for last column)
    if (statusIndex < COLUMN_ORDER.length - 1) {
        const nextStatus = COLUMN_ORDER[statusIndex + 1];
        let nextStatusLabel = getColumnLabel(nextStatus);
        
        // Custom labels when moving from "need-to-buy" to "ordered"
        if (item.status === 'need-to-buy' && nextStatus === 'ordered') {
            nextStatusLabel = currentLanguage === 'th' ? 'พร้อมสั่ง' : 'Ready to Order';
        }
        // Custom labels when moving from "ordered" to "bought" (same for all screen sizes)
        else if (item.status === 'ordered' && nextStatus === 'bought') {
            nextStatusLabel = currentLanguage === 'th' ? 'สั่งแล้ว' : 'Bought';
        }
        
        // Use same labels for all screen sizes (no arrow prefix)
        const buttonClass = isMobile ? 'action-btn-mobile btn-move-right' : 'action-btn-desktop btn-move-right';
        const buttonText = nextStatusLabel;
        buttons.push(`<button class="${buttonClass}" onclick="moveItem('${item.id}', '${nextStatus}')">${buttonText}</button>`);
    }

    // Receive button for "bought" status
    if (item.status === 'bought') {
        const buttonClass = isMobile ? 'action-btn-mobile btn-receive' : 'action-btn-desktop btn-receive';
        buttons.push(`<button class="${buttonClass}" onclick="showReceivingModal('${item.id}')">${t('receive')}</button>`);
    }

    // Receive button for "received" status (to verify)
    if (item.status === 'received') {
        const buttonClass = isMobile ? 'action-btn-mobile btn-receive' : 'action-btn-desktop btn-receive';
        buttons.push(`<button class="${buttonClass}" onclick="showReceivingModal('${item.id}')">${t('verify')}</button>`);
    }

    return buttons.join('');
}

// Show add item modal
function showAddItemModal() {
    if (!requireAuth(() => true)) return;
    const modal = document.getElementById('addItemModal');
    modal.classList.add('active');
    document.getElementById('addItemForm').reset();
}

// Close add item modal
function closeAddItemModal() {
    const modal = document.getElementById('addItemModal');
    modal.classList.remove('active');
    // Reset urgency checkbox to unchecked (default is normal)
    const urgencyCheckbox = document.getElementById('itemUrgency');
    if (urgencyCheckbox) {
        urgencyCheckbox.checked = false;
    }
}

// Input validation
function validateItemInput(name, quantity, unit, supplier) {
    const errors = [];
    
    if (!name || name.trim().length < 2) {
        errors.push('Item name must be at least 2 characters');
    }
    
    if (!quantity || quantity <= 0) {
        errors.push('Quantity must be greater than 0');
    }
    
    if (!unit) {
        errors.push('Unit is required');
    }
    
    if (!supplier) {
        errors.push('Supplier is required');
    }
    
    return errors;
}

// Track form submission to prevent duplicates
let isSubmittingAddItem = false;

// Handle add item form submission v2
async function handleAddItem(event) {
    if (!requireAuth(() => true)) return;
    event.preventDefault();
    
    // Prevent duplicate submissions
    if (isSubmittingAddItem) {
        return;
    }
    isSubmittingAddItem = true;
    
    try {
    const name = document.getElementById('itemName').value.trim();
    const quantity = parseFloat(document.getElementById('itemQuantity').value);
    const unit = document.getElementById('itemUnit').value;
    const supplier = document.getElementById('itemSupplier').value;
    
    // Validate input
    const errors = validateItemInput(name, quantity, unit, supplier);
    if (errors.length > 0) {
        showNotification(errors.join(', '), 'error');
        return;
    }
    
    const now = Date.now();
    const newItem = {
        id: generateId(),
        name: name,
        quantity: quantity,
        requested_qty: quantity,
        unit: unit,
        supplier: supplier,
        urgency: document.getElementById('itemUrgency').checked ? 'urgent' : 'normal',
        notes: document.getElementById('itemNotes').value.trim() || null,
        status: 'need-to-buy',
        received_qty: 0,
        actualQuantity: 0, // Keep for backward compatibility
        issue: false,
        issue_type: null,
        issueReason: null,
        qualityCheck: null,
        statusTimestamps: {
            'need-to-buy': now
        },
            lastUpdated: now,
            created_by_nickname: currentUser?.nickname || null
    };

    items.push(newItem);
    
    // Track history
    addItemHistory(newItem.id, `Item created`, currentUser);
    
        // Save to Supabase if configured (single save)
    if (checkSupabaseConfig()) {
            await saveItemToSupabase(newItem, 'user');
    }
    
        // Save to localStorage (fallback only if Supabase not configured)
        if (!checkSupabaseConfig()) {
    saveData().catch(err => console.error('Error saving data:', err));
        }
    renderBoard();
    closeAddItemModal();
    showNotification(t('itemAddedSuccess'), 'success');
    } finally {
        // Reset flag after a short delay to allow form reset
        setTimeout(() => {
            isSubmittingAddItem = false;
        }, 1000);
    }
}

// Show edit item modal v2
function editItem(itemId) {
    if (!requireAuth(() => true)) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemQuantity').value = item.requested_qty || item.quantity;
    document.getElementById('editItemUnit').value = item.unit;
    document.getElementById('editItemSupplier').value = item.supplier;
    document.getElementById('editItemUrgency').checked = item.urgency === 'urgent';
    document.getElementById('editItemNotes').value = item.notes || '';
    
    // Show last edited by nickname
    const lastEditedBy = item.updated_by_nickname || item.created_by_nickname || null;
    const lastEditedByElement = document.getElementById('editItemLastEditedBy');
    const lastEditedByNicknameElement = document.getElementById('editItemLastEditedByNickname');
    if (lastEditedByElement && lastEditedByNicknameElement) {
        if (lastEditedBy) {
            lastEditedByNicknameElement.textContent = lastEditedBy;
            lastEditedByElement.style.display = 'block';
        } else {
            lastEditedByElement.style.display = 'none';
        }
    }

    const modal = document.getElementById('editItemModal');
    modal.classList.add('active');
}

// Handle delete from edit modal
async function handleDeleteFromEditModal() {
    const itemId = document.getElementById('editItemId').value;
    if (!itemId) return;
    
    closeEditItemModal();
    await deleteItem(itemId);
}

// Close edit item modal
function closeEditItemModal() {
    const modal = document.getElementById('editItemModal');
    modal.classList.remove('active');
    // Reset urgency checkbox to unchecked (default is normal)
    const urgencyCheckbox = document.getElementById('editItemUrgency');
    if (urgencyCheckbox) {
        urgencyCheckbox.checked = false;
    }
    // Hide last edited by field
    const lastEditedByElement = document.getElementById('editItemLastEditedBy');
    if (lastEditedByElement) {
        lastEditedByElement.style.display = 'none';
    }
}

// Handle edit item form submission v2
async function handleEditItem(event) {
    event.preventDefault();
    
    const itemId = document.getElementById('editItemId').value;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const name = document.getElementById('editItemName').value.trim();
    const quantity = parseFloat(document.getElementById('editItemQuantity').value);
    const unit = document.getElementById('editItemUnit').value;
    const supplier = document.getElementById('editItemSupplier').value;
    
    // Validate input
    const errors = validateItemInput(name, quantity, unit, supplier);
    if (errors.length > 0) {
        showNotification(errors.join(', '), 'error');
        return;
    }
    
    const newRequestedQty = quantity;
    
    const oldName = item.name;
    const oldUrgency = item.urgency;
    
    item.name = name;
    item.quantity = newRequestedQty; // Keep for backward compatibility
    item.requested_qty = newRequestedQty;
    item.unit = unit;
    item.supplier = supplier;
    item.urgency = document.getElementById('editItemUrgency').checked ? 'urgent' : 'normal';
    item.notes = document.getElementById('editItemNotes').value.trim() || null;
    item.lastUpdated = Date.now();
    
    // Update last edited by nickname
    if (currentUser?.nickname) {
        item.updated_by_nickname = currentUser.nickname;
    }

    // Track history for significant changes
    if (oldName !== item.name) {
        addItemHistory(item.id, `Name changed from "${oldName}" to "${item.name}"`, currentUser);
    }
    if (oldUrgency !== item.urgency) {
        addItemHistory(item.id, `Urgency changed to ${item.urgency}`, currentUser);
    }

    // Save to Supabase if configured
    if (checkSupabaseConfig()) {
        await saveItemToSupabase(item, 'user');
    }

    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    closeEditItemModal();
    showNotification(t('itemUpdatedSuccess'), 'success');
    
    // Refresh views if active
    if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'mobile') {
        renderMobileView();
    }
}

// Show receiving modal v2 (simplified - only issue selection)
function showReceivingModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('receivingItemId').value = item.id;
    
    // Set issue type and reason if they exist
        document.getElementById('issueType').value = item.issue_type || '';
        document.getElementById('issueReason').value = item.issueReason || '';

    const modal = document.getElementById('receivingModal');
    modal.classList.add('active');
}

// Close receiving modal
function closeReceivingModal() {
    const modal = document.getElementById('receivingModal');
    modal.classList.remove('active');
    document.getElementById('receivingForm').reset();
    
    // Clear selection after modal closes
    selectedItems.clear();
    updateActionButtonStates();
    renderBoard();
}

// Quick Receive - Instant verify (mobile only)
let quickReceiveUndoState = null;
let quickReceiveUndoTimer = null;

async function quickReceive(itemId) {
    if (!requireAuth(() => true)) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    // Safety check - only allow for eligible items (available on all screen sizes)
    if (item.status !== 'bought' || item.issue) {
        // Fallback to full receive flow
        showReceivingModal(itemId);
        return;
    }
    
    const requestedQty = item.requested_qty || item.quantity || 0;
    if (!requestedQty || requestedQty <= 0) {
        showReceivingModal(itemId);
        return;
    }
    
    // Save state for undo (including history)
    const historyLength = item.history ? item.history.length : 0;
    const now = Date.now();
    
    // Record purchase with OK status (quick receive assumes OK quality)
    const purchaseRecordId = await recordPurchase(item, 'OK');
    
    quickReceiveUndoState = {
        itemId: item.id,
        purchaseRecordId: purchaseRecordId, // Store record ID for undo
        previousStatus: item.status,
        previousReceivedQty: item.received_qty || 0,
        previousLastUpdated: item.lastUpdated,
        previousStatusTimestamps: JSON.parse(JSON.stringify(item.statusTimestamps || {})),
        previousQualityCheck: item.qualityCheck,
        previousIssue: item.issue,
        previousIssueType: item.issue_type,
        previousIssueReason: item.issueReason,
        previousHistoryLength: historyLength
    };
    
    // Update item - move to received (not verified)
    item.received_qty = requestedQty;
    item.qualityCheck = 'ok';
    item.issue = false;
    item.issue_type = null;
    item.issueReason = null;
    item.status = 'received'; // Move to received section, not verified
    
    // Update timestamps
    if (!item.statusTimestamps) item.statusTimestamps = {};
    item.statusTimestamps['received'] = now;
    item.lastUpdated = now;
    
    // Track history
    const unitDisplay = getUnitDisplayName(item.unit);
    addItemHistory(item.id, `Quick Receive: ${requestedQty} ${unitDisplay} - Quality OK`, currentUser);
    
    // Save to Supabase if configured
    if (checkSupabaseConfig()) {
        await saveItemToSupabase(item, 'user');
    }
    
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    
    // Show undo option for 5 seconds
    showQuickReceiveUndo();
    
    // Show success notification
    showNotification(t('quickReceiveSuccess'), 'success');
}

// Show undo option after quick receive
function showQuickReceiveUndo() {
    // Remove any existing undo notification
    const existingUndo = document.getElementById('quickReceiveUndo');
    if (existingUndo) {
        existingUndo.remove();
    }
    
    // Create undo notification
    const undoDiv = document.createElement('div');
    undoDiv.id = 'quickReceiveUndo';
    undoDiv.className = 'quick-receive-undo';
    undoDiv.innerHTML = `
        <span>${t('quickReceiveSuccess')}</span>
        <button onclick="undoQuickReceive()">${t('quickReceiveUndo')}</button>
    `;
    document.body.appendChild(undoDiv);
    
    // Auto-remove after 5 seconds
    quickReceiveUndoTimer = setTimeout(() => {
        if (undoDiv.parentNode) {
            undoDiv.remove();
        }
        quickReceiveUndoState = null;
    }, 5000);
}

// Undo quick receive
function undoQuickReceive() {
    if (!quickReceiveUndoState) return;
    
    const item = items.find(i => i.id === quickReceiveUndoState.itemId);
    if (item) {
        // Remove purchase record if it exists
        if (quickReceiveUndoState.purchaseRecordId) {
            const recordIndex = purchaseRecords.findIndex(r => r.id === quickReceiveUndoState.purchaseRecordId);
            if (recordIndex !== -1) {
                purchaseRecords.splice(recordIndex, 1);
                savePurchaseRecords();
            }
        }
        
        // Restore previous state
        item.status = quickReceiveUndoState.previousStatus;
        item.received_qty = quickReceiveUndoState.previousReceivedQty;
        item.lastUpdated = quickReceiveUndoState.previousLastUpdated;
        item.statusTimestamps = quickReceiveUndoState.previousStatusTimestamps;
        item.qualityCheck = quickReceiveUndoState.previousQualityCheck;
        item.issue = quickReceiveUndoState.previousIssue;
        item.issue_type = quickReceiveUndoState.previousIssueType;
        item.issueReason = quickReceiveUndoState.previousIssueReason;
        
        // Remove history entry (restore to previous length)
        if (item.history && item.history.length > quickReceiveUndoState.previousHistoryLength) {
            item.history = item.history.slice(0, quickReceiveUndoState.previousHistoryLength);
        }
        
        // Save data (fire-and-forget, don't await to avoid blocking UI)
        saveData().catch(err => console.error('Error saving data:', err));
        renderBoard();
    }
    
    // Clear undo state
    const undoDiv = document.getElementById('quickReceiveUndo');
    if (undoDiv) {
        undoDiv.remove();
    }
    if (quickReceiveUndoTimer) {
        clearTimeout(quickReceiveUndoTimer);
    }
    quickReceiveUndoState = null;
}

// Show Quick Issue Bottom Sheet (mobile only)
function showQuickIssueSheet(itemId) {
    // Hide quick issue sheet on tablet/desktop - redirect to full receiving modal
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
    if (!isMobile) {
        // On tablet/desktop, show the full receiving modal instead
        showReceivingModal(itemId);
        return;
    }
    
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    // Safety check
    if (item.status !== 'bought') {
        // Fallback to full receive flow
        showReceivingModal(itemId);
        return;
    }
    
    document.getElementById('quickIssueItemId').value = item.id;
    document.getElementById('quickIssueType').value = '';
    document.getElementById('quickIssueReason').value = '';
    
    const sheet = document.getElementById('quickIssueSheet');
    sheet.classList.add('active');
}

// Close Quick Issue Bottom Sheet
function closeQuickIssueSheet() {
    const sheet = document.getElementById('quickIssueSheet');
    sheet.classList.remove('active');
    document.getElementById('quickIssueForm').reset();
    
    // Clear selection after modal closes
    selectedItems.clear();
    updateActionButtonStates();
    renderBoard();
}

// Handle Quick Issue submission
async function handleQuickIssue(event) {
    if (!requireAuth(() => true)) return;
    event.preventDefault();
    
    const itemId = document.getElementById('quickIssueItemId').value;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const issueType = document.getElementById('quickIssueType').value;
    const issueReason = document.getElementById('quickIssueReason').value.trim() || null;
    
    if (!issueType) {
        showNotification(t('selectIssueType'), 'error');
        return;
    }
    
    const now = Date.now();
    const requestedQty = item.requested_qty || item.quantity || 0;
    
    // Update item - mark as issue
    item.received_qty = requestedQty; // Assume received but with issue
    item.qualityCheck = 'issue';
    item.issue = true;
    item.issue_type = issueType;
    item.issueReason = issueReason;
    item.status = 'verified'; // Move to verified/issue column
    
    // Update timestamps
    if (!item.statusTimestamps) item.statusTimestamps = {};
    if (!item.statusTimestamps['received']) {
        item.statusTimestamps['received'] = now;
    }
    item.statusTimestamps['verified'] = now;
    item.lastUpdated = now;
    
    // Track history
    const unitDisplay = getUnitDisplayName(item.unit);
    const issueTypeLabel = getIssueTypeLabel(issueType);
    const historyNote = issueReason 
        ? `${t('received')} ${requestedQty} ${unitDisplay} - ${t('issues')}: ${issueTypeLabel} (${issueReason})`
        : `${t('received')} ${requestedQty} ${unitDisplay} - ${t('issues')}: ${issueTypeLabel}`;
    addItemHistory(item.id, historyNote, currentUser);
    
    // Record purchase with issue status
    await recordPurchase(item, 'Issue');
    
    // Save to Supabase if configured
    if (checkSupabaseConfig()) {
        await saveItemToSupabase(item, 'user');
    }
    
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    closeQuickIssueSheet();
    showNotification(`${t('issues')}: ${issueTypeLabel}`, 'error');
}

// Handle receiving form submission v2
async function handleReceiving(event) {
    if (!requireAuth(() => true)) return;
    event.preventDefault();
    
    const itemId = document.getElementById('receivingItemId').value;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const issueType = document.getElementById('issueType').value;
    const issueReason = document.getElementById('issueReason').value.trim() || null;

    const now = Date.now();
    const requestedQty = item.requested_qty || item.quantity || 0;

    // Update received quantity to full requested quantity
    item.received_qty = requestedQty;
    item.actualQuantity = requestedQty; // Keep for backward compatibility
    
    // Always set as issue
    item.qualityCheck = 'issue';
    item.issue = true;
    item.issue_type = issueType;
    item.issueReason = issueReason;
    
    // Update status timestamps
    if (!item.statusTimestamps) item.statusTimestamps = {};
    if (!item.statusTimestamps['received']) {
        item.statusTimestamps['received'] = now;
    }
    
        // Move to verified/issue column
        item.status = 'verified';
        if (!item.statusTimestamps['verified']) {
            item.statusTimestamps['verified'] = now;
        }
    
    item.lastUpdated = now;

    // Track history
    const unitDisplay = getUnitDisplayName(item.unit);
    const action = `${t('received')} ${requestedQty} ${unitDisplay} - ${t('issues')}: ${getIssueTypeLabel(issueType) || issueType}`;
    addItemHistory(itemId, action, currentUser);

        // Record purchase with issue status
    await recordPurchase(item, 'Issue');

    // Save to Supabase if configured
    if (checkSupabaseConfig()) {
        await saveItemToSupabase(item, 'user');
    }

    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    closeReceivingModal();
    
    // Refresh views if active
    if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'mobile') {
        renderMobileView();
    }
}

// Move item to different column v2 (with status transition validation)
async function moveItem(itemId, newStatus) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const oldStatus = item.status;
    
    // Validate status transition (forward-only)
    if (!isValidStatusTransition(oldStatus, newStatus)) {
        showNotification(`${t('move')}: ${getColumnLabel(oldStatus)} → ${getColumnLabel(newStatus)}. ${t('invalid')}`, 'error');
        return;
    }
    
    const now = Date.now();
    item.status = newStatus;
    
    // Update status timestamps
    if (!item.statusTimestamps) item.statusTimestamps = {};
    item.statusTimestamps[newStatus] = now;
    
    item.lastUpdated = now;
    
    // Auto-detect issue status after status change
    detectAndUpdateIssueStatus(item);
    
    // Track history
    addItemHistory(itemId, `${t('move')}: ${getColumnLabel(oldStatus)} → ${getColumnLabel(newStatus)}`, currentUser);
    
    // Save to Supabase if configured (single save)
    if (checkSupabaseConfig()) {
        await saveItemToSupabase(item, 'user');
    }
    
    // Save to localStorage (fallback only if Supabase not configured)
    if (!checkSupabaseConfig()) {
    saveData().catch(err => console.error('Error saving data:', err));
    }
    renderBoard();
    
    // Refresh views if active
    if (currentView === 'dashboard') {
        renderDashboard();
    } else if (currentView === 'mobile') {
        renderMobileView();
    }
}

// Delete item
async function deleteItem(itemId) {
    if (!requireAuth(() => true)) return;
    
    // All logged-in users can delete items
    if (confirm(t('confirmDeleteItem'))) {
        const item = items.find(i => i.id === itemId);
        console.log('🗑️ Item deleted:', {
            id: itemId,
            name: item?.name || 'Unknown',
            status: item?.status || 'Unknown',
            user: currentUser?.nickname || 'Unknown'
        });
        
        // Delete from Supabase if configured
        if (checkSupabaseConfig()) {
            await deleteItemFromSupabase(itemId);
        }
        
        items = items.filter(i => i.id !== itemId);
        // Save data (fire-and-forget, don't await to avoid blocking UI)
        saveData().catch(err => console.error('Error saving data:', err));
        renderBoard();
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });
    
    // Close quick issue sheet when clicking backdrop
    const quickIssueSheet = document.getElementById('quickIssueSheet');
    if (quickIssueSheet && event.target === quickIssueSheet) {
        closeQuickIssueSheet();
    }
};

// Handle search input
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    currentSearchTerm = searchInput.value.trim();
    
    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.style.display = currentSearchTerm ? 'block' : 'none';
    }
    
    renderBoard();
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentSearchTerm = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    renderBoard();
}

// Filter by supplier
function filterBySupplier(supplier) {
    currentSupplierFilter = supplier;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.supplier === supplier) {
            btn.classList.add('active');
        }
    });
    
    renderBoard();
}

// Handle status filter
function handleStatusFilter() {
    currentStatusFilter = document.getElementById('statusFilter').value;
    renderBoard();
}



// Update assigned person filter dropdown
// updateAssignedFilter() removed - Assigned To filter was removed from UI


// Export data to JSON
function exportData() {
    const dataStr = JSON.stringify(items, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kitchen-procurement-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Show brief success message
    showNotification(t('dataExportedSuccess'), 'success');
}

// Show import modal
function showImportModal() {
    const modal = document.getElementById('importModal');
    modal.classList.add('active');
    document.getElementById('importData').value = '';
    document.getElementById('importReplace').checked = false;
}

// Close import modal
function closeImportModal() {
    const modal = document.getElementById('importModal');
    modal.classList.remove('active');
}

// Handle import
function handleImport(event) {
    event.preventDefault();
    
    const importData = document.getElementById('importData').value.trim();
    const replaceData = document.getElementById('importReplace').checked;
    
    if (!importData) {
        showNotification(t('pleasePasteJson'), 'error');
        return;
    }
    
    try {
        const importedItems = JSON.parse(importData);
        
        if (!Array.isArray(importedItems)) {
            throw new Error('Invalid data format');
        }
        
        // Validate items structure
        const validItems = importedItems.filter(item => 
            item.id && item.name && item.quantity !== undefined && item.status
        );
        
        if (validItems.length === 0) {
            throw new Error('No valid items found in import data');
        }
        
        if (replaceData) {
            items = validItems;
        } else {
            // Merge: add new items, update existing ones by ID
            validItems.forEach(importedItem => {
                const existingIndex = items.findIndex(i => i.id === importedItem.id);
                if (existingIndex >= 0) {
                    items[existingIndex] = importedItem;
                } else {
                    items.push(importedItem);
                }
            });
        }
        
        // Save data (fire-and-forget, don't await to avoid blocking UI)
        saveData().catch(err => console.error('Error saving data:', err));
        renderBoard();
        closeImportModal();
        showNotification(`${t('dataImportedSuccess')}: ${validItems.length} ${t('noItems')}`, 'success');
        
    } catch (e) {
        showNotification(t('importFailed') + ': ' + e.message, 'error');
        console.error('Import error:', e);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Bulk Selection Functions
function toggleBulkSelect() {
    bulkSelectMode = !bulkSelectMode;
    selectedItems.clear();
    
    const btn = document.getElementById('bulkSelectBtn');
    const actionsBtn = document.getElementById('bulkActionsBtn');
    
    if (bulkSelectMode) {
        btn.textContent = '✖️ Cancel';
        btn.classList.add('active');
        actionsBtn.style.display = 'inline-block';
    } else {
        btn.textContent = '☑️ Select';
        btn.classList.remove('active');
        actionsBtn.style.display = 'none';
    }
    
    renderBoard();
}

function toggleItemSelection(itemId) {
    if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }
    
    updateBulkActionsButton();
    updateActionButtonStates();
    
    // Update card visual state
    const card = document.querySelector(`[data-item-id="${itemId}"]`);
    if (card) {
        if (selectedItems.has(itemId)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }
}

function updateBulkActionsButton() {
    const count = selectedItems.size;
    const btn = document.getElementById('bulkActionsBtn');
    if (btn) {
        btn.textContent = `⚡ Actions (${count})`;
        btn.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

// Update action button states (receive/issue buttons)
function updateActionButtonStates() {
    const receiveBtn = document.getElementById('receiveBtn');
    const issueBtn = document.getElementById('issueBtn');
    const hasSelection = selectedItems.size > 0;
    
    if (receiveBtn) {
        receiveBtn.disabled = !hasSelection;
        receiveBtn.style.opacity = hasSelection ? '1' : '0.5';
        receiveBtn.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
    }
    
    if (issueBtn) {
        issueBtn.disabled = !hasSelection;
        issueBtn.style.opacity = hasSelection ? '1' : '0.5';
        issueBtn.style.cursor = hasSelection ? 'pointer' : 'not-allowed';
    }
}

// Handle receive action for selected items
async function handleReceiveSelected() {
    if (!requireAuth(() => true)) return;
    
    if (selectedItems.size === 0) {
        showNotification(t('selectItemsFirst') || 'Please select items first', 'info');
        return;
    }
    
    const selectedItemIds = Array.from(selectedItems);
    const eligibleItems = selectedItemIds
        .map(id => items.find(item => item.id === id))
        .filter(item => item && (item.status === 'bought' || item.status === 'ordered'));
    
    if (eligibleItems.length === 0) {
        showNotification(t('noEligibleItems') || 'No eligible items selected. Items must be in "Bought" or "Ordered" status.', 'info');
        return;
    }
    
    // If single item, show modal; if multiple, process all
    if (eligibleItems.length === 1) {
        const item = eligibleItems[0];
        if (item.status === 'bought' && !item.issue) {
            await quickReceive(item.id);
        } else {
            showReceivingModal(item.id);
        }
    } else {
        // Process multiple items
        for (const item of eligibleItems) {
            if (item.status === 'bought' && !item.issue) {
                await quickReceive(item.id);
            } else {
                // For items that need full receive flow, show modal for first one
                showReceivingModal(item.id);
                break; // Only show modal for first item
            }
        }
    }
    
    // Clear selection after processing
    selectedItems.clear();
    updateActionButtonStates();
    renderBoard();
}

// Handle issue action for selected items
function handleIssueSelected() {
    if (!requireAuth(() => true)) return;
    
    if (selectedItems.size === 0) {
        showNotification(t('selectItemsFirst') || 'Please select items first', 'info');
        return;
    }
    
    const selectedItemIds = Array.from(selectedItems);
    const eligibleItems = selectedItemIds
        .map(id => items.find(item => item.id === id))
        .filter(item => item && (item.status === 'bought' || item.status === 'ordered'));
    
    if (eligibleItems.length === 0) {
        showNotification(t('noEligibleItems') || 'No eligible items selected. Items must be in "Bought" or "Ordered" status.', 'info');
        return;
    }
    
    // Show issue modal for first selected item
    const firstItem = eligibleItems[0];
    if (firstItem.status === 'bought') {
        showQuickIssueSheet(firstItem.id);
    } else {
        showReceivingModal(firstItem.id);
    }
    
    // Note: Selection is kept so user can process multiple items if needed
    // Clear selection after modal closes (handled in modal close handlers)
}

function showBulkActions() {
    if (selectedItems.size === 0) return;
    const modal = document.getElementById('bulkActionsModal');
    document.getElementById('bulkSelectedCount').textContent = selectedItems.size;
    modal.classList.add('active');
}

function closeBulkActionsModal() {
    document.getElementById('bulkActionsModal').classList.remove('active');
}

function bulkMove() {
    const selected = Array.from(selectedItems);
    if (selected.length === 0) return;
    
    // Get unique next statuses
    const nextStatuses = new Set();
    selected.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
            const statusIndex = COLUMN_ORDER.indexOf(item.status);
            if (statusIndex < COLUMN_ORDER.length - 1) {
                nextStatuses.add(COLUMN_ORDER[statusIndex + 1]);
            }
        }
    });
    
    if (nextStatuses.size === 0) {
        showNotification('Selected items are already at final stage', 'error');
        return;
    }
    
    // Move all selected items
    selected.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
            const statusIndex = COLUMN_ORDER.indexOf(item.status);
            if (statusIndex < COLUMN_ORDER.length - 1) {
                moveItem(id, COLUMN_ORDER[statusIndex + 1]);
            }
        }
    });
    
    selectedItems.clear();
    toggleBulkSelect();
    closeBulkActionsModal();
    showNotification(`${t('itemsMoved')}: ${selected.length}`, 'success');
}


function bulkSetUrgency() {
    if (selectedItems.size === 0) return;
    document.getElementById('bulkUrgencyModal').classList.add('active');
}

function closeBulkUrgencyModal() {
    document.getElementById('bulkUrgencyModal').classList.remove('active');
}

function handleBulkUrgency(event) {
    event.preventDefault();
    const urgency = document.getElementById('bulkUrgency').value;
    
    const selected = Array.from(selectedItems);
    let count = 0;
    
    selected.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
            item.urgency = urgency;
            item.lastUpdated = Date.now();
            addItemHistory(item.id, `Urgency set to ${urgency}`, currentUser);
            count++;
        }
    });
    
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    selectedItems.clear();
    toggleBulkSelect();
    closeBulkUrgencyModal();
    renderBoard();
    showNotification(`Updated urgency for ${count} item(s)`, 'success');
}

function bulkDelete() {
    if (selectedItems.size === 0) return;
    
    if (!confirm(`${t('confirmDeleteItems')}: ${selectedItems.size}?`)) return;
    
    const selected = Array.from(selectedItems);
    items = items.filter(item => !selected.includes(item.id));
    
    selectedItems.clear();
    toggleBulkSelect();
    closeBulkActionsModal();
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    showNotification(`${t('itemsDeletedSuccess')}: ${selected.length}`, 'success');
}

// Item History Functions
function addItemHistory(itemId, action, user) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    if (!item.history) item.history = [];
    
    item.history.push({
        timestamp: Date.now(),
        action: action,
        user: user || currentUser
    });
    
    // Keep only last 50 history entries
    if (item.history.length > 50) {
        item.history = item.history.slice(-50);
    }
}

function showItemHistory(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const content = document.getElementById('itemHistoryContent');
    if (!item.history || item.history.length === 0) {
        content.innerHTML = '<p>No history available for this item.</p>';
    } else {
        const historyHtml = item.history.slice().reverse().map(entry => `
            <div class="history-entry">
                <div class="history-action">${entry.action}</div>
                <div class="history-meta">
                    <span class="history-user">${entry.user}</span>
                    <span class="history-time">${formatTimestamp(entry.timestamp)}</span>
                </div>
            </div>
        `).join('');
        content.innerHTML = historyHtml;
    }
    
    document.getElementById('itemHistoryModal').classList.add('active');
}

function closeItemHistoryModal() {
    document.getElementById('itemHistoryModal').classList.remove('active');
}

// Templates Functions
function loadTemplates() {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
        try {
            templates = JSON.parse(stored);
        } catch (e) {
            console.error('Error loading templates:', e);
            templates = [];
        }
    }
}

function saveTemplates() {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function showTemplatesModal() {
    renderTemplatesList();
    document.getElementById('templatesModal').classList.add('active');
}

function closeTemplatesModal() {
    document.getElementById('templatesModal').classList.remove('active');
}

function renderTemplatesList() {
    const list = document.getElementById('templatesList');
    if (templates.length === 0) {
        list.innerHTML = '<p style="padding: 20px; text-align: center; color: #7f8c8d;">No templates saved yet.</p>';
        return;
    }
    
    list.innerHTML = templates.map((template, index) => `
        <div class="template-item">
            <div class="template-info">
                <strong>${template.name}</strong>
                <span class="template-details">${template.quantity} ${getUnitDisplayName(template.unit)} • ${getSupplierDisplayName(template.supplier)}</span>
            </div>
            <div class="template-actions">
                <button class="template-btn" onclick="useTemplate(${index})" title="Use Template">✓ Use</button>
                <button class="template-btn" onclick="deleteTemplate(${index})" title="Delete">🗑️</button>
            </div>
        </div>
    `).join('');
}

function showAddTemplateModal() {
    document.getElementById('addTemplateModal').classList.add('active');
}

function closeAddTemplateModal() {
    document.getElementById('addTemplateModal').classList.remove('active');
    document.getElementById('templateName').value = '';
    document.getElementById('templateQuantity').value = '';
    document.getElementById('templateUnit').value = 'kg';
    document.getElementById('templateSupplier').value = 'Makro';
}

function handleAddTemplate(event) {
    event.preventDefault();
    
    const template = {
        id: generateId(),
        name: document.getElementById('templateName').value.trim(),
        quantity: parseFloat(document.getElementById('templateQuantity').value),
        unit: document.getElementById('templateUnit').value,
        supplier: document.getElementById('templateSupplier').value
    };
    
    templates.push(template);
    saveTemplates();
    renderTemplatesList();
    closeAddTemplateModal();
    showNotification(t('templateCreatedSuccess'), 'success');
}

function useTemplate(index) {
    const template = templates[index];
    if (!template) return;
    
    document.getElementById('itemName').value = template.name;
    document.getElementById('itemQuantity').value = template.quantity;
    document.getElementById('itemUnit').value = template.unit;
    document.getElementById('itemSupplier').value = template.supplier;
    
    closeTemplatesModal();
    showAddItemModal();
    document.getElementById('itemName').focus();
}

function deleteTemplate(index) {
    if (confirm(t('confirmDeleteTemplate'))) {
        templates.splice(index, 1);
        saveTemplates();
        renderTemplatesList();
    }
}

// Statistics Functions
function showStatsModal() {
    if (!isLoggedIn()) {
        showNotification(t('pleaseLogin'), 'error');
        return;
    }
    
    // All logged-in users can view purchase history
    try {
        renderStatsDashboard();
        const modal = document.getElementById('statsModal');
        if (modal) {
            modal.classList.add('active');
        } else {
            console.error('Stats modal not found');
        }
    } catch (error) {
        console.error('Error showing stats modal:', error);
        showNotification('Error loading purchase history', 'error');
    }
}

function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showWeeklyReviewModal() {
    if (!isLoggedIn()) {
        showNotification(t('pleaseLogin'), 'error');
        return;
    }
    
    // All users can view reports
    
    try {
        renderWeeklyReview();
        const modal = document.getElementById('weeklyReviewModal');
        if (modal) {
            modal.classList.add('active');
        } else {
            console.error('Weekly review modal not found');
        }
    } catch (error) {
        console.error('Error showing weekly review modal:', error);
        showNotification('Error loading weekly review', 'error');
    }
}

function closeWeeklyReviewModal() {
    document.getElementById('weeklyReviewModal').classList.remove('active');
}

function exportPurchaseRecords() {
    loadPurchaseRecords();
    
    if (purchaseRecords.length === 0) {
        showNotification(t('noPurchaseRecords'), 'error');
        return;
    }
    
    // Convert to CSV format
    const headers = [t('date'), t('item'), t('supplier'), t('quantity'), t('unit'), t('status')];
    const rows = purchaseRecords.map(r => [
        formatDate(r.date),
        r.itemName,
        getSupplierDisplayName(r.supplier),
        r.quantity,
        getUnitDisplayName(r.unit),
        r.status === 'OK' ? (currentLanguage === 'th' ? 'ดี' : 'OK') : (currentLanguage === 'th' ? 'ปัญหา' : 'Issue')
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `purchase-records-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(t('dataExportedSuccess') || 'Data exported successfully', 'success');
}

function exportPurchaseRecordsJSON() {
    loadPurchaseRecords();
    
    if (purchaseRecords.length === 0) {
        showNotification(t('noPurchaseRecords'), 'error');
        return;
    }
    
    const dataStr = JSON.stringify(purchaseRecords, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase-records-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification(t('dataExportedSuccess') || 'Data exported successfully', 'success');
}

// Analysis functions for purchase records
function getWeeklySummary() {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    return purchaseRecords.filter(r => r.date >= weekAgo);
}

function getMonthlySummary() {
    const now = Date.now();
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    return purchaseRecords.filter(r => r.date >= monthAgo);
}

function getFrequentlyBoughtItems(records, limit = 10) {
    const counts = {};
    records.forEach(r => {
        const key = `${r.itemName}|${r.supplier}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
        .map(([key, count]) => {
            const [itemName, supplier] = key.split('|');
            return { itemName, supplier, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

function getHighVolumeItems(records, limit = 10) {
    const volumes = {};
    records.forEach(r => {
        const key = `${r.itemName}|${r.supplier}`;
        if (!volumes[key]) {
            volumes[key] = { itemName: r.itemName, supplier: r.supplier, totalQuantity: 0, unit: r.unit };
        }
        volumes[key].totalQuantity += r.quantity;
    });
    return Object.values(volumes)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, limit);
}

function getItemsWithRepeatedIssues(records, minIssues = 2) {
    const issueCounts = {};
    records.filter(r => r.status === 'Issue').forEach(r => {
        const key = `${r.itemName}|${r.supplier}`;
        issueCounts[key] = (issueCounts[key] || 0) + 1;
    });
    return Object.entries(issueCounts)
        .filter(([key, count]) => count >= minIssues)
        .map(([key, count]) => {
            const [itemName, supplier] = key.split('|');
            return { itemName, supplier, issueCount: count };
        })
        .sort((a, b) => b.issueCount - a.issueCount);
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    if (currentLanguage === 'th') {
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = (date.getFullYear() + 543).toString().slice(-2);
        return `${day} ${month} ${year}`;
    } else {
        const day = date.getDate();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        return `${day}/${month}/${year}`;
    }
}

function formatDateRange(startDate, endDate) {
    if (currentLanguage === 'th') {
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else {
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
}

function getMostUsedSupplier(records) {
    const supplierCounts = {};
    records.forEach(r => {
        supplierCounts[r.supplier] = (supplierCounts[r.supplier] || 0) + 1;
    });
    const sorted = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
}

function getUniqueItems(records) {
    const unique = new Set();
    records.forEach(r => {
        unique.add(`${r.itemName}|${r.supplier}`);
    });
    return unique.size;
}

function generateWeeklyInsights(weeklyRecords, frequentItems, highVolumeItems, issues) {
    const insights = [];
    
    if (weeklyRecords.length === 0) {
        return [t('noDataThisWeek')];
    }
    
    // Insight 1: Most frequent item
    if (frequentItems.length > 0) {
        const topItem = frequentItems[0];
        if (currentLanguage === 'th') {
            insights.push(`"${topItem.itemName}" เป็นรายการที่ซื้อบ่อยที่สุด (${topItem.count} ครั้ง) จาก ${getSupplierDisplayName(topItem.supplier)}`);
        } else {
            insights.push(`"${topItem.itemName}" was purchased most frequently (${topItem.count} times) from ${getSupplierDisplayName(topItem.supplier)}`);
        }
    }
    
    // Insight 2: Supplier usage
    const mostUsed = getMostUsedSupplier(weeklyRecords);
    if (mostUsed) {
        const supplierCount = weeklyRecords.filter(r => r.supplier === mostUsed).length;
        const percentage = Math.round((supplierCount / weeklyRecords.length) * 100);
        if (currentLanguage === 'th') {
            insights.push(`${getSupplierDisplayName(mostUsed)} เป็นซัพพลายเออร์ที่ใช้มากที่สุด (${percentage}% ของการซื้อทั้งหมด)`);
        } else {
            insights.push(`${getSupplierDisplayName(mostUsed)} was the most used supplier (${percentage}% of all purchases)`);
        }
    }
    
    // Insight 3: Issues
    const issueCount = weeklyRecords.filter(r => r.status === 'Issue').length;
    if (issueCount > 0) {
        const issuePercentage = Math.round((issueCount / weeklyRecords.length) * 100);
        if (currentLanguage === 'th') {
            insights.push(`พบปัญหา ${issueCount} รายการ (${issuePercentage}% ของการซื้อทั้งหมด)`);
        } else {
            insights.push(`${issueCount} issues found (${issuePercentage}% of all purchases)`);
        }
    } else {
        if (currentLanguage === 'th') {
            insights.push('ไม่มีปัญหาสำหรับสัปดาห์นี้ - คุณภาพดี');
        } else {
            insights.push('No issues this week - quality maintained');
        }
    }
    
    return insights;
}

function renderWeeklyReview() {
    const content = document.getElementById('weeklyReviewContent');
    
    // Load purchase records
    loadPurchaseRecords();
    
    // Get weekly data
    const weeklyRecords = getWeeklySummary();
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const startDate = new Date(weekAgo);
    const endDate = new Date(now);
    
    // Calculate metrics
    const totalPurchases = weeklyRecords.length;
    const uniqueItems = getUniqueItems(weeklyRecords);
    const mostUsedSupplier = getMostUsedSupplier(weeklyRecords);
    const issueCount = weeklyRecords.filter(r => r.status === 'Issue').length;
    
    // Get top items
    const frequentItems = getFrequentlyBoughtItems(weeklyRecords, 5);
    const highVolumeItems = getHighVolumeItems(weeklyRecords, 5);
    const issues = getItemsWithRepeatedIssues(weeklyRecords, 1);
    
    // Generate insights
    const insights = generateWeeklyInsights(weeklyRecords, frequentItems, highVolumeItems, issues);
    
    content.innerHTML = `
        <div class="weekly-review">
            <!-- Header -->
            <div class="weekly-review-header">
                <h1>${t('weeklyReview')}</h1>
                <div class="weekly-review-date-range">${t('weekOf')} ${formatDateRange(startDate, endDate)}</div>
            </div>
            
            ${weeklyRecords.length === 0 ? `
                <div class="weekly-review-empty">
                    <p>${t('noDataThisWeek')}</p>
                </div>
            ` : `
                <!-- Summary -->
                <div class="weekly-review-section">
                    <h2 class="weekly-review-section-title">${t('summary') || 'Summary'}</h2>
                    <div class="weekly-review-summary-grid">
                        <div class="weekly-review-summary-item">
                            <div class="weekly-review-summary-label">${t('totalPurchaseCount')}</div>
                            <div class="weekly-review-summary-value">${totalPurchases}</div>
                        </div>
                        <div class="weekly-review-summary-item">
                            <div class="weekly-review-summary-label">${t('uniqueItems')}</div>
                            <div class="weekly-review-summary-value">${uniqueItems}</div>
                        </div>
                        <div class="weekly-review-summary-item">
                            <div class="weekly-review-summary-label">${t('mostUsedSupplier')}</div>
                            <div class="weekly-review-summary-value">${mostUsedSupplier ? getSupplierDisplayName(mostUsedSupplier) : '-'}</div>
                        </div>
                        <div class="weekly-review-summary-item">
                            <div class="weekly-review-summary-label">${t('issueCount')}</div>
                            <div class="weekly-review-summary-value ${issueCount > 0 ? 'error' : 'success'}">${issueCount}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Frequently Bought Items -->
                <div class="weekly-review-section">
                    <h2 class="weekly-review-section-title">${t('frequentlyBoughtItems')}</h2>
                    ${frequentItems.length > 0 ? `
                        <div class="weekly-review-table">
                            <div class="weekly-review-table-header">
                                <div class="weekly-review-table-cell">${t('item')}</div>
                                <div class="weekly-review-table-cell">${t('purchaseCount')}</div>
                                <div class="weekly-review-table-cell">${t('supplier')}</div>
                            </div>
                            ${frequentItems.map(item => `
                                <div class="weekly-review-table-row">
                                    <div class="weekly-review-table-cell">${item.itemName}</div>
                                    <div class="weekly-review-table-cell">${item.count}</div>
                                    <div class="weekly-review-table-cell">${getSupplierDisplayName(item.supplier)}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<p class="weekly-review-empty-text">${t('noDataThisWeek')}</p>`}
                </div>
                
                <!-- High Volume Items -->
                <div class="weekly-review-section">
                    <h2 class="weekly-review-section-title">${t('highVolumeItems')}</h2>
                    ${highVolumeItems.length > 0 ? `
                        <div class="weekly-review-table">
                            <div class="weekly-review-table-header">
                                <div class="weekly-review-table-cell">${t('item')}</div>
                                <div class="weekly-review-table-cell">${t('totalQuantity')}</div>
                                <div class="weekly-review-table-cell">${t('unit')}</div>
                            </div>
                            ${highVolumeItems.map(item => `
                                <div class="weekly-review-table-row">
                                    <div class="weekly-review-table-cell">${item.itemName}</div>
                                    <div class="weekly-review-table-cell">${item.totalQuantity.toLocaleString()}</div>
                                    <div class="weekly-review-table-cell">${getUnitDisplayName(item.unit)}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<p class="weekly-review-empty-text">${t('noDataThisWeek')}</p>`}
                </div>
                
                <!-- Issues This Week -->
                <div class="weekly-review-section">
                    <h2 class="weekly-review-section-title">${t('issuesThisWeek')}</h2>
                    ${issues.length > 0 ? `
                        <div class="weekly-review-table">
                            <div class="weekly-review-table-header">
                                <div class="weekly-review-table-cell">${t('item')}</div>
                                <div class="weekly-review-table-cell">${t('supplier')}</div>
                                <div class="weekly-review-table-cell">${t('issueCount')}</div>
                            </div>
                            ${issues.map(item => `
                                <div class="weekly-review-table-row">
                                    <div class="weekly-review-table-cell">${item.itemName}</div>
                                    <div class="weekly-review-table-cell">${getSupplierDisplayName(item.supplier)}</div>
                                    <div class="weekly-review-table-cell error">${item.issueCount}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<p class="weekly-review-empty-text">${t('noIssuesThisWeek')}</p>`}
                </div>
                
                <!-- Weekly Insights -->
                <div class="weekly-review-section">
                    <h2 class="weekly-review-section-title">${t('weeklyInsights')}</h2>
                    <div class="weekly-review-insights">
                        ${insights.map(insight => `
                            <div class="weekly-review-insight-item">${insight}</div>
                        `).join('')}
                    </div>
                </div>
            `}
        </div>
    `;
}

// Global date range filter state
let dateRangeFilter = {
    startDate: null,
    endDate: null
};

function applyDateRangeFilter(records) {
    if (!dateRangeFilter.startDate && !dateRangeFilter.endDate) {
        return records;
    }
    
    return records.filter(r => {
        const recordDate = new Date(r.date);
        const start = dateRangeFilter.startDate ? new Date(dateRangeFilter.startDate) : null;
        const end = dateRangeFilter.endDate ? new Date(dateRangeFilter.endDate + 'T23:59:59') : null;
        
        if (start && recordDate < start) return false;
        if (end && recordDate > end) return false;
        return true;
    });
}

function renderStatsDashboard() {
    const dashboard = document.getElementById('statsDashboard');
    
    // Load purchase records to ensure we have latest data
    loadPurchaseRecords();
    
    const weeklyRecords = getWeeklySummary();
    const monthlyRecords = getMonthlySummary();
    // Sort: newest date first, then by supplier
    let allRecords = purchaseRecords.slice().sort((a, b) => {
        if (b.date !== a.date) return b.date - a.date; // Newest first
        return (a.supplier || '').localeCompare(b.supplier || ''); // Then by supplier
    });
    
    // Apply date range filter if set
    allRecords = applyDateRangeFilter(allRecords);
    // Apply same sorting to weekly and monthly
    const sortedWeeklyRecords = weeklyRecords.slice().sort((a, b) => {
        if (b.date !== a.date) return b.date - a.date;
        return (a.supplier || '').localeCompare(b.supplier || '');
    });
    const sortedMonthlyRecords = monthlyRecords.slice().sort((a, b) => {
        if (b.date !== a.date) return b.date - a.date;
        return (a.supplier || '').localeCompare(b.supplier || '');
    });
    const frequentItems = getFrequentlyBoughtItems(monthlyRecords);
    const highVolumeItems = getHighVolumeItems(monthlyRecords);
    const repeatedIssues = getItemsWithRepeatedIssues(monthlyRecords);
    
    const weeklyOK = sortedWeeklyRecords.filter(r => r.status === 'OK').length;
    const weeklyIssues = sortedWeeklyRecords.filter(r => r.status === 'Issue').length;
    const monthlyOK = sortedMonthlyRecords.filter(r => r.status === 'OK').length;
    const monthlyIssues = sortedMonthlyRecords.filter(r => r.status === 'Issue').length;
    const allOK = allRecords.filter(r => r.status === 'OK').length;
    const allIssues = allRecords.filter(r => r.status === 'Issue').length;
    
    dashboard.innerHTML = `
        <div class="analysis-header-actions">
            <div class="analysis-tabs">
                <button class="analysis-tab active" onclick="showAnalysisView('all')">${t('allPurchases')}</button>
                <button class="analysis-tab" onclick="showAnalysisView('weekly')">${t('weekly')}</button>
                <button class="analysis-tab" onclick="showAnalysisView('monthly')">${t('monthly')}</button>
                <button class="analysis-tab" onclick="showAnalysisView('frequent')">${t('frequentlyBought')}</button>
                <button class="analysis-tab" onclick="showAnalysisView('volume')">${t('highVolume')}</button>
                <button class="analysis-tab" onclick="showAnalysisView('issues')">${t('repeatedIssues')}</button>
            </div>
            ${purchaseRecords.length > 0 ? `
            <div class="analysis-export-actions">
                <button class="export-btn" onclick="exportPurchaseRecords()" title="Export as CSV">📥 ${t('exportCSV')}</button>
                <button class="export-btn" onclick="exportPurchaseRecordsJSON()" title="Export as JSON">📥 ${t('exportJSON')}</button>
            </div>
            ` : ''}
        </div>
        
        <div id="allView" class="analysis-view active">
            <h3>${t('allPurchases')}</h3>
            <div class="date-range-filter">
                <div class="date-range-inputs">
                    <div class="date-input-group">
                        <label for="startDateFilter">${t('startDate')}</label>
                        <input type="date" id="startDateFilter" value="${dateRangeFilter.startDate || ''}" onchange="updateDateRangeFilter()">
                    </div>
                    <div class="date-input-group">
                        <label for="endDateFilter">${t('endDate')}</label>
                        <input type="date" id="endDateFilter" value="${dateRangeFilter.endDate || ''}" onchange="updateDateRangeFilter()">
                    </div>
                    <div class="date-range-actions">
                        <button class="date-filter-btn" onclick="clearDateRangeFilter()">${t('clearFilter')}</button>
                    </div>
                </div>
            </div>
            <div class="analysis-summary">
                <div class="summary-item">
                    <span class="summary-label">${t('totalPurchases')}</span>
                    <span class="summary-value">${allRecords.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">${t('ok')}</span>
                    <span class="summary-value success">${allOK}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">${t('issues')}</span>
                    <span class="summary-value error">${allIssues}</span>
                </div>
            </div>
            ${allRecords.length > 0 ? `
            <div class="analysis-table">
                <div class="table-header">
                    <div class="table-cell">${t('date')}</div>
                    <div class="table-cell">${t('item')}</div>
                    <div class="table-cell">${t('supplier')}</div>
                    <div class="table-cell">${t('quantity')}</div>
                </div>
                ${allRecords.map(r => `
                    <div class="table-row">
                        <div class="table-cell">${formatDate(r.date)}</div>
                        <div class="table-cell">${r.itemName}</div>
                        <div class="table-cell">${getSupplierDisplayName(r.supplier)}</div>
                        <div class="table-cell">${r.quantity} ${getUnitDisplayName(r.unit)}</div>
                    </div>
                `).join('')}
            </div>
            ` : `
            <div style="padding: 40px; text-align: left; color: #787774; max-width: 600px; margin: 0 auto;">
                <p style="font-size: 16px; margin-bottom: 12px; font-weight: 600; color: #37352f;">${t('noPurchaseRecords')}</p>
                <p style="font-size: 14px; margin-bottom: 20px;">${t('noPurchaseRecordsDesc')}</p>
                <div style="background-color: #f7f6f3; padding: 20px; border-radius: 4px; border-left: 3px solid #9b9a97;">
                    <p style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #37352f;">${t('howToRecordPurchase')}</p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>${t('howToRecordStep1')}</li>
                        <li>${t('howToRecordStep2')}</li>
                        <li>${t('howToRecordStep3')}</li>
                        <li>${t('howToRecordStep4')}</li>
                    </ol>
                </div>
            </div>
            `}
        </div>
        
        <div id="weeklyView" class="analysis-view">
            <h3>${t('weeklySummary')}</h3>
            <div class="analysis-summary">
                <div class="summary-item">
                    <span class="summary-label">${t('totalPurchases')}</span>
                    <span class="summary-value">${sortedWeeklyRecords.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">${t('ok')}</span>
                    <span class="summary-value success">${weeklyOK}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">${t('issues')}</span>
                    <span class="summary-value error">${weeklyIssues}</span>
                </div>
            </div>
            ${sortedWeeklyRecords.length > 0 ? `
            <div class="analysis-table">
                <div class="table-header">
                    <div class="table-cell">${t('date')}</div>
                    <div class="table-cell">${t('item')}</div>
                    <div class="table-cell">${t('supplier')}</div>
                    <div class="table-cell">${t('quantity')}</div>
                </div>
                ${sortedWeeklyRecords.slice(0, 50).map(r => `
                    <div class="table-row">
                        <div class="table-cell">${formatDate(r.date)}</div>
                        <div class="table-cell">${r.itemName}</div>
                        <div class="table-cell">${getSupplierDisplayName(r.supplier)}</div>
                        <div class="table-cell">${r.quantity} ${getUnitDisplayName(r.unit)}</div>
                    </div>
                `).join('')}
            </div>
            ` : `
            <div style="padding: 40px; text-align: left; color: #787774; max-width: 600px; margin: 0 auto;">
                <p style="font-size: 16px; margin-bottom: 12px; font-weight: 600; color: #37352f;">${t('noPurchaseRecords')}</p>
                <p style="font-size: 14px; margin-bottom: 20px;">${t('noPurchaseRecordsDesc')}</p>
                <div style="background-color: #f7f6f3; padding: 20px; border-radius: 4px; border-left: 3px solid #9b9a97;">
                    <p style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #37352f;">${t('howToRecordPurchase')}</p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>${t('howToRecordStep1')}</li>
                        <li>${t('howToRecordStep2')}</li>
                        <li>${t('howToRecordStep3')}</li>
                        <li>${t('howToRecordStep4')}</li>
                    </ol>
                </div>
            </div>
            `}
        </div>
        
        <div id="monthlyView" class="analysis-view">
            <h3>${t('monthlySummary')}</h3>
            <div class="analysis-summary">
                <div class="summary-item">
                    <span class="summary-label">${t('totalPurchases')}</span>
                    <span class="summary-value">${sortedMonthlyRecords.length}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">${t('ok')}</span>
                    <span class="summary-value success">${monthlyOK}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">${t('issues')}</span>
                    <span class="summary-value error">${monthlyIssues}</span>
                </div>
            </div>
            ${sortedMonthlyRecords.length > 0 ? `
            <div class="analysis-table">
                <div class="table-header">
                    <div class="table-cell">${t('date')}</div>
                    <div class="table-cell">${t('item')}</div>
                    <div class="table-cell">${t('supplier')}</div>
                    <div class="table-cell">${t('quantity')}</div>
                </div>
                ${sortedMonthlyRecords.slice(0, 100).map(r => `
                    <div class="table-row">
                        <div class="table-cell">${formatDate(r.date)}</div>
                        <div class="table-cell">${r.itemName}</div>
                        <div class="table-cell">${getSupplierDisplayName(r.supplier)}</div>
                        <div class="table-cell">${r.quantity} ${getUnitDisplayName(r.unit)}</div>
                    </div>
                `).join('')}
            </div>
            ` : `
            <div style="padding: 40px; text-align: left; color: #787774; max-width: 600px; margin: 0 auto;">
                <p style="font-size: 16px; margin-bottom: 12px; font-weight: 600; color: #37352f;">${t('noPurchaseRecords')}</p>
                <p style="font-size: 14px; margin-bottom: 20px;">${t('noPurchaseRecordsDesc')}</p>
                <div style="background-color: #f7f6f3; padding: 20px; border-radius: 4px; border-left: 3px solid #9b9a97;">
                    <p style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #37352f;">${t('howToRecordPurchase')}</p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>${t('howToRecordStep1')}</li>
                        <li>${t('howToRecordStep2')}</li>
                        <li>${t('howToRecordStep3')}</li>
                        <li>${t('howToRecordStep4')}</li>
                    </ol>
                </div>
            </div>
            `}
        </div>
        
        <div id="frequentView" class="analysis-view">
            <h3>${t('frequentlyBoughtItems')}</h3>
            ${frequentItems.length > 0 ? `
            <div class="analysis-table">
                <div class="table-header">
                    <div class="table-cell">${t('item')}</div>
                    <div class="table-cell">${t('supplier')}</div>
                    <div class="table-cell">${t('purchaseCount')}</div>
                </div>
                ${frequentItems.map(item => `
                    <div class="table-row">
                        <div class="table-cell">${item.itemName}</div>
                        <div class="table-cell">${getSupplierDisplayName(item.supplier)}</div>
                        <div class="table-cell">${item.count}</div>
                    </div>
                `).join('')}
            </div>
            ` : `
            <div style="padding: 40px; text-align: left; color: #787774; max-width: 600px; margin: 0 auto;">
                <p style="font-size: 16px; margin-bottom: 12px; font-weight: 600; color: #37352f;">${t('noPurchaseRecords')}</p>
                <p style="font-size: 14px; margin-bottom: 20px;">${t('noPurchaseRecordsDesc')}</p>
                <div style="background-color: #f7f6f3; padding: 20px; border-radius: 4px; border-left: 3px solid #9b9a97;">
                    <p style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #37352f;">${t('howToRecordPurchase')}</p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>${t('howToRecordStep1')}</li>
                        <li>${t('howToRecordStep2')}</li>
                        <li>${t('howToRecordStep3')}</li>
                        <li>${t('howToRecordStep4')}</li>
                    </ol>
                </div>
            </div>
            `}
        </div>
        
        <div id="volumeView" class="analysis-view">
            <h3>${t('highVolumeItems')}</h3>
            ${highVolumeItems.length > 0 ? `
            <div class="analysis-table">
                <div class="table-header">
                    <div class="table-cell">${t('item')}</div>
                    <div class="table-cell">${t('supplier')}</div>
                    <div class="table-cell">${t('totalQuantity')}</div>
                </div>
                ${highVolumeItems.map(item => `
                    <div class="table-row">
                        <div class="table-cell">${item.itemName}</div>
                        <div class="table-cell">${getSupplierDisplayName(item.supplier)}</div>
                        <div class="table-cell">${item.totalQuantity} ${getUnitDisplayName(item.unit)}</div>
                    </div>
                `).join('')}
            </div>
            ` : `
            <div style="padding: 40px; text-align: left; color: #787774; max-width: 600px; margin: 0 auto;">
                <p style="font-size: 16px; margin-bottom: 12px; font-weight: 600; color: #37352f;">${t('noPurchaseRecords')}</p>
                <p style="font-size: 14px; margin-bottom: 20px;">${t('noPurchaseRecordsDesc')}</p>
                <div style="background-color: #f7f6f3; padding: 20px; border-radius: 4px; border-left: 3px solid #9b9a97;">
                    <p style="font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #37352f;">${t('howToRecordPurchase')}</p>
                    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>${t('howToRecordStep1')}</li>
                        <li>${t('howToRecordStep2')}</li>
                        <li>${t('howToRecordStep3')}</li>
                        <li>${t('howToRecordStep4')}</li>
                    </ol>
                </div>
            </div>
            `}
        </div>
        
        <div id="issuesView" class="analysis-view">
            <h3>${t('itemsWithRepeatedIssues')}</h3>
            <div class="analysis-table">
                <div class="table-header">
                    <div class="table-cell">${t('item')}</div>
                    <div class="table-cell">${t('supplier')}</div>
                    <div class="table-cell">${t('issueCount')}</div>
                </div>
                ${repeatedIssues.length > 0 ? repeatedIssues.map(item => `
                    <div class="table-row">
                        <div class="table-cell">${item.itemName}</div>
                        <div class="table-cell">${getSupplierDisplayName(item.supplier)}</div>
                        <div class="table-cell error">${item.issueCount}</div>
                    </div>
                `).join('') : `<div class="table-row"><div class="table-cell" colspan="3">${t('noRepeatedIssues')}</div></div>`}
            </div>
        </div>
    `;
}

function updateDateRangeFilter() {
    const startDate = document.getElementById('startDateFilter')?.value || null;
    const endDate = document.getElementById('endDateFilter')?.value || null;
    
    dateRangeFilter.startDate = startDate;
    dateRangeFilter.endDate = endDate;
    
    // Re-render the dashboard to apply filter
    renderStatsDashboard();
}

function clearDateRangeFilter() {
    dateRangeFilter.startDate = null;
    dateRangeFilter.endDate = null;
    
    if (document.getElementById('startDateFilter')) {
        document.getElementById('startDateFilter').value = '';
    }
    if (document.getElementById('endDateFilter')) {
        document.getElementById('endDateFilter').value = '';
    }
    
    // Re-render the dashboard
    renderStatsDashboard();
}

function showAnalysisView(view) {
    document.querySelectorAll('.analysis-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.analysis-tab').forEach(t => t.classList.remove('active'));
    
    const targetView = document.getElementById(`${view}View`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Find and activate the correct tab by matching onclick attribute
    document.querySelectorAll('.analysis-tab').forEach(tab => {
        const onclick = tab.getAttribute('onclick');
        if (onclick && onclick.includes(`'${view}'`)) {
            tab.classList.add('active');
        }
    });
}

// History tracking is integrated into existing functions

// Manager Dashboard Functions

// Switch between Board, Dashboard, and Mobile Manager views
function switchView(view) {
    currentView = view;
    
    const boardView = document.getElementById('boardView');
    const dashboardView = document.getElementById('dashboardView');
    const mobileView = document.getElementById('mobileView');
    const boardBtn = document.getElementById('boardViewBtn');
    const dashboardBtn = document.getElementById('dashboardViewBtn');
    const mobileBtn = document.getElementById('mobileViewBtn');
    
    // Get mobile bottom nav buttons
    const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
    const mobileDashboardBtn = Array.from(mobileNavBtns).find(btn => 
        btn.getAttribute('onclick')?.includes("switchView('mobile')") || 
        btn.getAttribute('data-i18n') === 'dashboard'
    );
    const mobileBoardBtn = Array.from(mobileNavBtns).find(btn => 
        btn.getAttribute('onclick')?.includes("switchView('board')") || 
        btn.getAttribute('data-i18n') === 'procurementBoard'
    );
    
    // Hide all views (with null checks) and remove force-show class
    if (boardView) {
        boardView.style.display = 'none';
        boardView.classList.remove('force-show');
    }
    if (dashboardView) {
        dashboardView.style.display = 'none';
        dashboardView.classList.remove('force-show');
    }
    if (mobileView) {
        mobileView.style.display = 'none';
        mobileView.classList.remove('force-show');
    }
    
    // Remove active class from all top toggle buttons (with null checks)
    if (boardBtn) boardBtn.classList.remove('active');
    if (dashboardBtn) dashboardBtn.classList.remove('active');
    if (mobileBtn) mobileBtn.classList.remove('active');
    
    // Remove active class from all mobile bottom nav buttons
    mobileNavBtns.forEach(btn => btn.classList.remove('active'));
    
    if (view === 'board') {
        if (boardView) {
            // Always add force-show class first
            boardView.classList.add('force-show');
            
            // Set inline styles as backup
            boardView.style.display = 'block';
            boardView.style.visibility = 'visible';
            boardView.style.opacity = '1';
            boardView.style.position = 'relative';
            
            // Also ensure app-container is visible
            const appContainer = document.querySelector('.app-container');
            if (appContainer) {
                appContainer.style.display = 'block';
                appContainer.style.visibility = 'visible';
                appContainer.style.padding = '0';
                appContainer.style.margin = '0';
                appContainer.style.width = '100%';
            }
            
            // Ensure board-container is visible on mobile
            const boardContainer = boardView.querySelector('.board-container');
            if (boardContainer) {
                boardContainer.style.display = 'flex';
                boardContainer.style.flexDirection = 'column';
                boardContainer.style.visibility = 'visible';
                boardContainer.style.opacity = '1';
                boardContainer.style.width = '100%';
                boardContainer.style.padding = '0';
                boardContainer.style.margin = '0';
                boardContainer.style.position = 'relative';
            }
            
            // Ensure all columns are visible
            const columns = boardView.querySelectorAll('.column');
            columns.forEach(column => {
                column.style.display = 'block';
                column.style.visibility = 'visible';
                column.style.opacity = '1';
                column.style.position = 'relative';
            });
        }
        if (boardBtn) boardBtn.classList.add('active');
        // Update mobile bottom nav button for board
        if (mobileBoardBtn) mobileBoardBtn.classList.add('active');
        renderBoard();
    } else if (view === 'dashboard') {
        if (dashboardView) {
            dashboardView.style.display = 'block';
            dashboardView.classList.add('force-show'); // Override CSS media query
        }
        if (dashboardBtn) dashboardBtn.classList.add('active');
        renderDashboard();
    } else if (view === 'mobile') {
        if (mobileView) {
            mobileView.style.display = 'block';
            mobileView.classList.add('force-show'); // Override CSS media query
        }
        if (mobileBtn) mobileBtn.classList.add('active');
        // Update mobile bottom nav button for dashboard
        if (mobileDashboardBtn) mobileDashboardBtn.classList.add('active');
        renderMobileView();
    }
}

// Set time range for mobile view
function setMobileTimeRange(range) {
    mobileTimeRange = range;
    
    // Update active button
    document.querySelectorAll('.mobile-time-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.range === range) {
            btn.classList.add('active');
        }
    });
    
    renderMobileView();
}

// Render Mobile Manager View (using shared dashboard data)
function renderMobileView() {
    try {
        console.log('Rendering mobile view...', { itemsCount: items.length, timeRange: mobileTimeRange });
        
        // Compute dashboard data from shared selector
        const dashboardData = computeDashboardData(items, mobileTimeRange);
        console.log('Dashboard data computed:', dashboardData);
        
        // Update last updated timestamp
        const now = new Date();
        const lastUpdatedEl = document.getElementById('mobileLastUpdated');
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = `${t('lastUpdated')}: ${formatTime(now)}`;
        } else {
            console.warn('mobileLastUpdated element not found');
        }
        
        // Render all sections using shared data (no calculations here)
        renderMobileHealthSnapshotFromData(dashboardData);
        renderMobileAttentionListFromData(dashboardData);
        renderMobileSupplierIssuesFromData(dashboardData);
        renderMobileTeamLoadFromData(dashboardData);
        
        console.log('Mobile view rendered successfully');
    } catch (error) {
        console.error('Error rendering mobile view:', error);
        console.error('Error stack:', error.stack);
        showNotification('Error loading mobile view: ' + error.message, 'error');
    }
}

// Render Mobile Health Snapshot (from shared dashboard data)
function renderMobileHealthSnapshotFromData(dashboardData) {
    // Read from shared data - no calculations
    const pendingEl = document.getElementById('mobilePendingCount');
    const issuesEl = document.getElementById('mobileIssuesCount');
    const urgentEl = document.getElementById('mobileUrgentCount');
    const delayedEl = document.getElementById('mobileDelayedCount');
    
    if (pendingEl) pendingEl.textContent = dashboardData.counts?.pending || 0;
    if (issuesEl) issuesEl.textContent = dashboardData.counts?.issues || 0;
    if (urgentEl) urgentEl.textContent = dashboardData.counts?.urgent || 0;
    if (delayedEl) delayedEl.textContent = dashboardData.counts?.delayed || 0;
}

// Render Mobile Needs Attention List (from shared dashboard data)
function renderMobileAttentionListFromData(dashboardData) {
    // Read from shared data - no calculations
    // Use top 5 items from needsAttention (already sorted by priority)
    const needsAttention = dashboardData.needsAttention || [];
    const displayItems = needsAttention.slice(0, 5);
    
    const list = document.getElementById('mobileAttentionList');
    if (!list) return;
    
    if (displayItems.length === 0) {
        list.innerHTML = `<div class="mobile-list-item" style="border-left-color: #27ae60;">${t('allItemsUpToDate')}</div>`;
    } else {
        list.innerHTML = displayItems.map(item => {
            let badge = '';
            if (item._isUrgent && item._isDelayed) {
                badge = `<span class="mobile-status-badge urgent">${t('urgentDelayed')}</span>`;
            } else if (item._isUrgent) {
                badge = `<span class="mobile-status-badge urgent">${t('urgent')}</span>`;
            } else if (item._hasIssue) {
                badge = `<span class="mobile-status-badge issue">${t('issues')}</span>`;
            } else if (item._isDelayed) {
                badge = `<span class="mobile-status-badge delayed">${t('delayed')}</span>`;
            }
            
            return `
                <div class="mobile-list-item ${item._isUrgent ? 'urgent' : item._isDelayed ? 'delayed' : ''}" 
                     onclick="showMobileItemDetail('${item.id}')">
                    <div class="mobile-list-item-header">
                        ${item.name}${badge}
                    </div>
                    <div class="mobile-list-item-details">
                        <span>${getSupplierDisplayName(item.supplier)}</span>
                        <span>•</span>
                        <span>${getColumnLabel(item.status)}</span>
                        <span>•</span>
                        <span>${formatTimeAgo(item.statusTimestamps?.[item.status] || item.lastUpdated)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Render Mobile Supplier Issues (from shared dashboard data)
function renderMobileSupplierIssuesFromData(dashboardData) {
    // Read from shared data - no calculations
    const list = document.getElementById('mobileSupplierList');
    if (!list) return;
    
    const suppliers = [
        { name: getSupplierDisplayName('Makro'), count: dashboardData.issuesBySupplier?.Makro || 0 },
        { name: getSupplierDisplayName('Fresh Market'), count: dashboardData.issuesBySupplier?.FreshMarket || 0 },
        { name: getSupplierDisplayName('Bakery'), count: dashboardData.issuesBySupplier?.Bakery || 0 },
        { name: getSupplierDisplayName('Other'), count: dashboardData.issuesBySupplier?.Other || 0 }
    ].filter(s => s.count > 0)
     .sort((a, b) => b.count - a.count); // Sort by count descending
    
    if (suppliers.length === 0) {
        list.innerHTML = `<div class="mobile-list-item" style="border-left-color: #27ae60;">${t('noSupplierIssues')}</div>`;
    } else {
        list.innerHTML = suppliers.map(supplier => `
            <div class="mobile-list-item" onclick="showMobileSupplierIssues('${supplier.name}')">
                <div class="mobile-list-item-header">${supplier.name}</div>
                <div class="mobile-list-item-details">
                    <span><strong>${supplier.count}</strong> issue${supplier.count > 1 ? 's' : ''}</span>
                </div>
            </div>
        `).join('');
    }
}

// Render Mobile Team Load (from shared dashboard data)
function renderMobileTeamLoadFromData(dashboardData) {
    // Read from shared data - no calculations
    const list = document.getElementById('mobileTeamList');
    if (!list) return;
    
    const teamWorkload = dashboardData.teamWorkload || [];
    
    if (teamWorkload.length === 0) {
        list.innerHTML = `<div class="mobile-list-item">${t('noAssignedItems')}</div>`;
    } else {
        list.innerHTML = teamWorkload.map(stats => `
            <div class="mobile-list-item">
                <div class="mobile-list-item-header">${stats.person || t('unknown')}</div>
                <div class="mobile-list-item-details">
                    <span>${t('total')}: <strong>${stats.total || 0}</strong></span>
                    <span>•</span>
                    <span>${t('pending')}: <strong>${stats.pending || 0}</strong></span>
                    ${(stats.issues || 0) > 0 ? `<span>•</span><span style="color: #e74c3c;">${t('issues')}: <strong>${stats.issues}</strong></span>` : ''}
                </div>
            </div>
        `).join('');
    }
}

// Show Mobile Item Detail (Read-Only)
function showMobileItemDetail(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const requestedQty = item.requested_qty || item.quantity || 0;
    const receivedQty = item.received_qty || 0;
    const difference = receivedQty - requestedQty;
    
    document.getElementById('mobileItemDetailTitle').textContent = item.name;
    
    const body = document.getElementById('mobileItemDetailBody');
    body.innerHTML = `
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">${t('status')}</div>
            <div class="mobile-detail-value">${getColumnLabel(item.status)}</div>
        </div>
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">${t('supplier')}</div>
            <div class="mobile-detail-value">${item.supplier}</div>
        </div>
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">${t('urgency')}</div>
            <div class="mobile-detail-value">${item.urgency === 'urgent' ? '🔥 ' + t('urgent') : t('normal')}</div>
        </div>
        ${item.issue ? `
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">${t('issueType')}</div>
            <div class="mobile-detail-value">${getIssueTypeLabel(item.issue_type) || item.issue_type || t('unknown')}</div>
        </div>
        ${item.issueReason ? `
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">${t('issueReason')}</div>
            <div class="mobile-detail-value">${item.issueReason}</div>
        </div>
        ` : ''}
        ` : ''}
        ${item.qualityCheck ? `
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">Quality Check</div>
            <div class="mobile-detail-value">${item.qualityCheck === 'ok' ? '✔ Fresh / OK' : '⚠ Issue'}</div>
        </div>
        ` : ''}
        ${item.notes ? `
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">Notes</div>
            <div class="mobile-detail-value">${item.notes}</div>
        </div>
        ` : ''}
        <div class="mobile-detail-row">
            <div class="mobile-detail-label">Last Updated</div>
            <div class="mobile-detail-value">${formatTimestamp(item.lastUpdated)}</div>
        </div>
    `;
    
    document.getElementById('mobileItemDetailModal').classList.add('active');
}

function closeMobileItemDetail() {
    document.getElementById('mobileItemDetailModal').classList.remove('active');
}

// Show supplier issues in mobile view (using shared dashboard data)
function showMobileSupplierIssues(supplier) {
    // Get issues from shared dashboard data
    const dashboardData = computeDashboardData(items, mobileTimeRange);
    const issues = dashboardData.needsAttention.filter(item => 
        item._hasIssue && item.supplier === supplier
    );
    
    if (issues.length === 0) {
        showNotification('No issues found for this supplier', 'info');
        return;
    }
    
    // Show first issue detail
    showMobileItemDetail(issues[0].id);
}

// Set time range for dashboard (using selector)
function setTimeRange(range) {
    dashboardTimeRange = range;
    
    // Update active button
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.range === range) {
            btn.classList.add('active');
        }
    });
    
    // Update label
    const labels = {
        'today': 'Today',
        '7days': 'Last 7 Days',
        '30days': 'Last 30 Days'
    };
    document.getElementById('issuesTimeRange').textContent = labels[range];
    
    // Re-render dashboard with new time range
    renderDashboard();
}

// Get time range boundaries
function getTimeRangeBoundaries() {
    const now = Date.now();
    let startTime;
    
    switch (dashboardTimeRange) {
        case 'today':
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            startTime = today.getTime();
            break;
        case '7days':
            startTime = now - (7 * 24 * 60 * 60 * 1000);
            break;
        case '30days':
            startTime = now - (30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startTime = 0;
    }
    
    return { startTime, endTime: now };
}

// Render Manager Dashboard (using shared dashboard data)
function renderDashboard() {
    try {
        // Compute dashboard data from shared selector
        const dashboardData = computeDashboardData(items, dashboardTimeRange);
        
        // Render all widgets using shared data (no calculations here)
        renderPendingItemsFromData(dashboardData);
        renderIssuesFromData(dashboardData);
        renderUrgentItemsFromData(dashboardData);
        renderDelayedItemsFromData(dashboardData);
        renderSupplierIssuesFromData(dashboardData);
        renderTeamWorkloadFromData(dashboardData);
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        showNotification(t('errorLoadingDashboard'), 'error');
    }
}

// Render Pending Items widget (from shared dashboard data)
function renderPendingItemsFromData(dashboardData) {
    // Read from shared data - no calculations
    const pendingCountEl = document.getElementById('pendingCount');
    if (pendingCountEl) {
        pendingCountEl.textContent = dashboardData.counts.pending || 0;
    }
    
    // Get delayed items from needs attention list
    const delayedItems = (dashboardData.needsAttention || []).filter(item => item._isDelayed);
    
    const stuckList = document.getElementById('pendingStuckItems');
    if (stuckList) {
        if (delayedItems.length === 0) {
            stuckList.innerHTML = '<div class="widget-list-item" style="border-left-color: #27ae60;">No stuck items</div>';
        } else {
            stuckList.innerHTML = delayedItems.slice(0, 5).map(item => `
                <div class="widget-list-item stuck" onclick="showItemDetails('${item.id}')">
                    <div class="widget-list-item-header">${item.name || 'Unknown'}</div>
                    <div class="widget-list-item-details">
                        <span>${getColumnLabel(item.status) || item.status}</span>
                        <span>•</span>
                        <span>${getSupplierDisplayName(item.supplier) || t('unknown')}</span>
                        <span>•</span>
                        <span>${formatTimeAgo(item.statusTimestamps?.[item.status] || item.lastUpdated)}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Render Issues widget (from shared dashboard data)
function renderIssuesFromData(dashboardData) {
    // Read from shared data - no calculations
    const issuesCountEl = document.getElementById('issuesCount');
    if (issuesCountEl) {
        issuesCountEl.textContent = dashboardData.counts.issues || 0;
    }
    
    // Get issues from needs attention list
    const issues = (dashboardData.needsAttention || []).filter(item => item._hasIssue);
    
    // Group by issue type
    const issuesByType = {};
    issues.forEach(item => {
        const type = item.issue_type || 'other';
        issuesByType[type] = (issuesByType[type] || 0) + 1;
    });
    
    const breakdown = document.getElementById('issuesBreakdown');
    if (breakdown) {
        if (dashboardData.counts.issues === 0) {
            breakdown.innerHTML = '<div class="widget-list-item" style="border-left-color: #27ae60;">No issues</div>';
        } else {
            breakdown.innerHTML = Object.entries(issuesByType).map(([type, count]) => `
                <div class="widget-list-item" onclick="showIssuesByType('${type}')">
                    <div class="widget-list-item-header">
                        <span class="issue-type-badge ${type}">${getIssueTypeLabel(type) || type}</span>
                        <span>${count}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Render Urgent Items widget (from shared dashboard data)
function renderUrgentItemsFromData(dashboardData) {
    // Read from shared data - no calculations
    const urgentCountEl = document.getElementById('urgentCount');
    if (urgentCountEl) {
        urgentCountEl.textContent = dashboardData.counts.urgent || 0;
    }
    
    const urgentList = document.getElementById('urgentItemsList');
    if (urgentList) {
        if (dashboardData.counts.urgent === 0) {
            urgentList.innerHTML = '<div class="widget-list-item" style="border-left-color: #27ae60;">No urgent items</div>';
        } else {
            urgentList.innerHTML = (dashboardData.urgentItems || []).slice(0, 5).map(item => `
                <div class="widget-list-item ${item._isDelayed ? 'urgent' : ''}" onclick="showItemDetails('${item.id}')">
                    <div class="widget-list-item-header">${item.name || 'Unknown'}</div>
                    <div class="widget-list-item-details">
                        <span>${getColumnLabel(item.status) || item.status}</span>
                        <span>•</span>
                        <span>${formatTimeAgo(item.statusTimestamps?.['need-to-buy'] || item.lastUpdated)}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Render Delayed Items widget (from shared dashboard data)
function renderDelayedItemsFromData(dashboardData) {
    // Read from shared data - no calculations
    const delayedCountEl = document.getElementById('delayedCount');
    if (delayedCountEl) {
        delayedCountEl.textContent = dashboardData.counts.delayed || 0;
    }
    
    const delayedList = document.getElementById('delayedItemsList');
    if (delayedList) {
        if (dashboardData.counts.delayed === 0) {
            delayedList.innerHTML = '<div class="widget-list-item" style="border-left-color: #27ae60;">No delayed items</div>';
        } else {
            delayedList.innerHTML = (dashboardData.delayedItems || []).slice(0, 10).map(item => `
                <div class="widget-list-item stuck" onclick="showItemDetails('${item.id}')">
                    <div class="widget-list-item-header">${item.name || 'Unknown'}</div>
                    <div class="widget-list-item-details">
                        <span>${getSupplierDisplayName(item.supplier) || t('unknown')}</span>
                        <span>•</span>
                        <span>${getColumnLabel(item.status) || item.status}</span>
                        <span>•</span>
                        <span>${formatTimeAgo(item.statusTimestamps?.[item.status] || item.lastUpdated)}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Render Supplier Issues widget (from shared dashboard data)
function renderSupplierIssuesFromData(dashboardData) {
    // Read from shared data - no calculations
    const supplierList = document.getElementById('supplierIssuesList');
    if (!supplierList) return;
    
    const suppliers = [
        { name: getSupplierDisplayName('Makro'), count: dashboardData.issuesBySupplier?.Makro || 0 },
        { name: getSupplierDisplayName('Fresh Market'), count: dashboardData.issuesBySupplier?.FreshMarket || 0 },
        { name: getSupplierDisplayName('Bakery'), count: dashboardData.issuesBySupplier?.Bakery || 0 },
        { name: getSupplierDisplayName('Other'), count: dashboardData.issuesBySupplier?.Other || 0 }
    ].filter(s => s.count > 0)
     .sort((a, b) => b.count - a.count); // Sort by count descending
    
    if (suppliers.length === 0) {
        supplierList.innerHTML = `<div class="widget-list-item" style="border-left-color: #27ae60;">${t('noSupplierIssues')}</div>`;
    } else {
        supplierList.innerHTML = suppliers.map(supplier => `
            <div class="widget-list-item" onclick="showIssuesBySupplier('${supplier.name}')">
                <div class="widget-list-item-header">
                    <span>${supplier.name}</span>
                    <strong>${supplier.count}</strong>
                </div>
            </div>
        `).join('');
    }
}

// Render Team Workload widget (from shared dashboard data)
function renderTeamWorkloadFromData(dashboardData) {
    // Read from shared data - no calculations
    const workloadList = document.getElementById('teamWorkloadList');
    if (!workloadList) return;
    
    const teamWorkload = dashboardData.teamWorkload || [];
    
    if (teamWorkload.length === 0) {
        workloadList.innerHTML = `<div class="widget-list-item">${t('noAssignedItems')}</div>`;
    } else {
        workloadList.innerHTML = teamWorkload.map(stats => `
            <div class="widget-list-item">
                <div class="widget-list-item-header">${stats.person || t('unknown')}</div>
                <div class="widget-list-item-details">
                    <span>${t('total')}: <strong>${stats.total || 0}</strong></span>
                    <span>•</span>
                    <span>${t('pending')}: <strong>${stats.pending || 0}</strong></span>
                    ${(stats.issues || 0) > 0 ? `<span>•</span><span style="color: #e74c3c;">${t('issues')}: <strong>${stats.issues}</strong></span>` : ''}
                </div>
            </div>
        `).join('');
    }
}

// Duplicate item
function duplicateItem(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const now = Date.now();
    const duplicatedItem = {
        ...item,
        id: generateId(),
        name: `${item.name} (Copy)`,
        status: 'need-to-buy',
        received_qty: 0,
        actualQuantity: 0,
        issue: false,
        issue_type: null,
        issueReason: null,
        qualityCheck: null,
        urgency: 'normal',
        statusTimestamps: {
            'need-to-buy': now
        },
        lastUpdated: now,
        history: []
    };
    
    items.push(duplicatedItem);
    addItemHistory(duplicatedItem.id, `Item duplicated from "${item.name}"`, currentUser);
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    showNotification(t('itemDuplicatedSuccess'), 'success');
}

// Toggle column expand/collapse
function toggleColumn(columnId) {
    const container = document.getElementById(`${columnId}-items`);
    const toggleBtn = document.querySelector(`.column-toggle-btn[data-column="${columnId}"]`);
    
    if (!container) return;
    
    const isCollapsed = container.classList.contains('collapsed');
    
    if (isCollapsed) {
        container.classList.remove('collapsed');
        if (toggleBtn) {
            toggleBtn.textContent = '▼';
            toggleBtn.classList.remove('collapsed');
        }
    } else {
        container.classList.add('collapsed');
        if (toggleBtn) {
            toggleBtn.textContent = '▶';
            toggleBtn.classList.add('collapsed');
        }
    }
}

// Toggle column expand/collapse
function toggleColumn(columnId) {
    const container = document.getElementById(`${columnId}-items`);
    const toggleBtn = document.querySelector(`.column-toggle-btn[data-column="${columnId}"]`);
    
    if (!container) return;
    
    const isCollapsed = container.classList.contains('collapsed');
    
    if (isCollapsed) {
        container.classList.remove('collapsed');
        if (toggleBtn) {
            toggleBtn.textContent = '▼';
            toggleBtn.classList.remove('collapsed');
        }
    } else {
        container.classList.add('collapsed');
        if (toggleBtn) {
            toggleBtn.textContent = '▶';
            toggleBtn.classList.add('collapsed');
        }
    }
}

// Print Board
function printBoard() {
    window.print();
}

// Show Receiving Checklist (using selector)
function showReceivingChecklist() {
    // Use selector to get items ready for receiving
    const itemsToReceive = getReceivingItemsSelector(items);
    
    if (itemsToReceive.length === 0) {
        showNotification('No items ready for receiving', 'info');
        return;
    }
    
    // Group by supplier
    const bySupplier = {};
    itemsToReceive.forEach(item => {
        if (!bySupplier[item.supplier]) {
            bySupplier[item.supplier] = [];
        }
        bySupplier[item.supplier].push(item);
    });
    
    const content = document.getElementById('receivingChecklistContent');
    const today = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    content.innerHTML = `
        <div class="checklist-header">
            <h3>Kitchen Receiving Checklist</h3>
            <p>Date: ${today}</p>
        </div>
        ${Object.entries(bySupplier).map(([supplier, supplierItems]) => `
            <div class="checklist-supplier-section">
                <h4>${supplier}</h4>
                <table class="checklist-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Requested</th>
                            <th>Received</th>
                            <th>Quality</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${supplierItems.map(item => `
                            <tr>
                                <td><strong>${item.name}</strong></td>
                                <td>${item.requested_qty || item.quantity} ${getUnitDisplayName(item.unit)}</td>
                                <td>${item.received_qty || 0} ${getUnitDisplayName(item.unit)}</td>
                                <td>
                                    ${item.qualityCheck === 'ok' ? '✔ OK' : item.qualityCheck === 'issue' ? '⚠ Issue' : '—'}
                                </td>
                                <td>${item.notes || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}
        <div class="checklist-footer">
            <p>Receiver Signature: _________________________</p>
            <p>Date: _________________________</p>
        </div>
    `;
    
    document.getElementById('receivingChecklistModal').classList.add('active');
}

function closeReceivingChecklist() {
    document.getElementById('receivingChecklistModal').classList.remove('active');
}

function printChecklist() {
    const checklistContent = document.getElementById('receivingChecklistContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receiving Checklist</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .checklist-header { text-align: center; margin-bottom: 30px; }
                .checklist-supplier-section { margin-bottom: 30px; page-break-inside: avoid; }
                .checklist-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .checklist-table th, .checklist-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .checklist-table th { background-color: #f5f5f5; font-weight: bold; }
                .checklist-footer { margin-top: 40px; }
                @media print {
                    .checklist-supplier-section { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            ${checklistContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// Quick Actions Functions
function showQuickActions() {
    document.getElementById('quickActionsModal').classList.add('active');
}

function closeQuickActions() {
    document.getElementById('quickActionsModal').classList.remove('active');
}

function quickActionMoveAllToNext() {
    const pendingStatuses = ['need-to-buy', 'ordered', 'bought', 'received'];
    let moved = 0;
    
    pendingStatuses.forEach(status => {
        const itemsInStatus = items.filter(item => item.status === status);
        itemsInStatus.forEach(item => {
            const statusIndex = COLUMN_ORDER.indexOf(status);
            if (statusIndex < COLUMN_ORDER.length - 1) {
                const nextStatus = COLUMN_ORDER[statusIndex + 1];
                if (isValidStatusTransition(status, nextStatus)) {
                    moveItem(item.id, nextStatus);
                    moved++;
                }
            }
        });
    });
    
    closeQuickActions();
    if (moved > 0) {
        showNotification(`${t('itemsMoved')}: ${moved}`, 'success');
    } else {
        showNotification('No items to move', 'info');
    }
}

function quickActionMarkAllReceived() {
    const receivedItems = items.filter(item => 
        item.status === 'received' && !item.issue
    );
    
    if (receivedItems.length === 0) {
        showNotification(t('noReceivedItemsToVerify'), 'info');
        closeQuickActions();
        return;
    }
    
    if (!confirm(`Mark ${receivedItems.length} received item(s) as verified?`)) {
        return;
    }
    
    const now = Date.now();
    receivedItems.forEach(item => {
        item.status = 'verified';
        if (!item.statusTimestamps) item.statusTimestamps = {};
        item.statusTimestamps['verified'] = now;
        item.lastUpdated = now;
        addItemHistory(item.id, 'Marked as verified (quick action)', currentUser);
    });
    
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'mobile') renderMobileView();
    closeQuickActions();
    showNotification(`${t('itemsVerified')}: ${receivedItems.length}`, 'success');
}


function quickActionClearCompleted() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const completedItems = items.filter(item => 
        item.status === 'verified' && 
        item.lastUpdated < sevenDaysAgo &&
        !item.issue
    );
    
    if (completedItems.length === 0) {
        showNotification('No completed items to clear', 'info');
        closeQuickActions();
        return;
    }
    
    if (!confirm(`${t('confirmClearCompleted')}: ${completedItems.length}?`)) {
        return;
    }
    
    const completedIds = completedItems.map(item => item.id);
    items = items.filter(item => !completedIds.includes(item.id));
    
    // Save data (fire-and-forget, don't await to avoid blocking UI)
    saveData().catch(err => console.error('Error saving data:', err));
    renderBoard();
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'mobile') renderMobileView();
    closeQuickActions();
    showNotification(`${t('completedItemsCleared')}: ${completedItems.length}`, 'success');
}

// Keyboard Shortcuts Functions
function showKeyboardShortcuts() {
    document.getElementById('keyboardShortcutsModal').classList.add('active');
}

function closeKeyboardShortcuts() {
    document.getElementById('keyboardShortcutsModal').classList.remove('active');
}

// Show item details in read-only modal
function showItemDetails(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const content = document.getElementById('itemDetailsContent');
    const requestedQty = item.requested_qty || item.quantity || 0;
    const receivedQty = item.received_qty || 0;
    const difference = receivedQty - requestedQty;
    
    content.innerHTML = `
        <div class="item-details-row">
            <span class="item-details-label">Item Name:</span>
            <span class="item-details-value">${item.name}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">Status:</span>
            <span class="item-details-value">${getColumnLabel(item.status)}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">${t('supplier')}:</span>
            <span class="item-details-value">${item.supplier}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">${t('requestedQty')}:</span>
            <span class="item-details-value">${requestedQty} ${getUnitDisplayName(item.unit)}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">${t('receivedQty')}:</span>
            <span class="item-details-value">${receivedQty} ${getUnitDisplayName(item.unit)}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">${t('difference')}:</span>
            <span class="item-details-value" style="color: ${difference < 0 ? '#e74c3c' : difference > 0 ? '#27ae60' : '#555'}">${difference > 0 ? '+' : ''}${difference} ${getUnitDisplayName(item.unit)}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">${t('urgency')}:</span>
            <span class="item-details-value">${item.urgency === 'urgent' ? '🔥 ' + t('urgent') : t('normal')}</span>
        </div>
        ${item.issue ? `
        <div class="item-details-row">
            <span class="item-details-label">${t('issueType')}:</span>
            <span class="item-details-value">${getIssueTypeLabel(item.issue_type) || item.issue_type || t('unknown')}</span>
        </div>
        <div class="item-details-row">
            <span class="item-details-label">${t('issueReason')}:</span>
            <span class="item-details-value">${item.issueReason || t('noData')}</span>
        </div>
        ` : ''}
        ${item.qualityCheck ? `
        <div class="item-details-row">
            <span class="item-details-label">${t('qualityCheck')}:</span>
            <span class="item-details-value">${item.qualityCheck === 'ok' ? '✔ ' + t('freshOk') : '⚠ ' + t('issue')}</span>
        </div>
        ` : ''}
        ${item.notes ? `
        <div class="item-details-row">
            <span class="item-details-label">${t('notes')}:</span>
            <span class="item-details-value">${item.notes}</span>
        </div>
        ` : ''}
        <div class="item-details-row">
            <span class="item-details-label">Last Updated:</span>
            <span class="item-details-value">${formatTimestamp(item.lastUpdated)}</span>
        </div>
    `;
    
    document.getElementById('itemDetailsModal').classList.add('active');
}

function closeItemDetailsModal() {
    document.getElementById('itemDetailsModal').classList.remove('active');
}

// Show issues filtered by type (using shared dashboard data)
function showIssuesByType(type) {
    // Get issues from shared dashboard data
    const dashboardData = computeDashboardData(items, dashboardTimeRange);
    const issues = dashboardData.needsAttention.filter(item => 
        item._hasIssue && item.issue_type === type
    );
    
    if (issues.length === 0) {
        showNotification('No issues found for this type', 'info');
        return;
    }
    
    // Show first issue details
    showItemDetails(issues[0].id);
}

// Show issues filtered by supplier (using shared dashboard data)
function showIssuesBySupplier(supplier) {
    // Get issues from shared dashboard data
    const dashboardData = computeDashboardData(items, dashboardTimeRange);
    const issues = dashboardData.needsAttention.filter(item => 
        item._hasIssue && item.supplier === supplier
    );
    
    if (issues.length === 0) {
        showNotification('No issues found for this supplier', 'info');
        return;
    }
    
    // Show first issue details
    showItemDetails(issues[0].id);
}

// Format time ago (e.g., "2 hours ago")
function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes < 1 ? 'Just now' : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
}

// Auto-detect mobile screen and switch view (disabled - default is board view)
function checkMobileScreen() {
    // Removed auto-switch to mobile - default view is always board
    // Users can manually switch to mobile view if needed
}

// Initialize app on load v2
document.addEventListener('DOMContentLoaded', function() {
    // Removed verbose console logs for cleaner console
    
    // Force Thai language - language switcher is hidden
    currentLanguage = 'th';
    document.documentElement.lang = 'th';
    
    // Initialize language switcher (hidden but set correctly)
    const langBtnTh = document.getElementById('langBtnTh');
    const langBtnEn = document.getElementById('langBtnEn');
    if (langBtnTh) langBtnTh.classList.toggle('active', true);
    if (langBtnEn) langBtnEn.classList.toggle('active', false);
    
    // Update UI with translations (must be called to translate header)
    updateUI();
    
    // Force update header text immediately
    setTimeout(() => {
        const titleElement = document.querySelector('h1[data-i18n="title"]');
        if (titleElement) {
            titleElement.textContent = t('title');
        }
    }, 50);
    
    // Check authentication (matching roomstatus pattern - synchronous)
    const wasLoggedIn = loadUser();
    
    // Always update UI to show correct login/logout state
    updateUserUI();
    
    if (!wasLoggedIn) {
        // User not logged in - hide content, don't auto-show login modal
        hideAllContent();
        // Don't auto-show login modal - user clicks button instead (matching roomstatus)
        // Login button should be visible (handled by updateUserUI)
    } else {
        // User logged in - show content
        showAllContent();
        
        // Ensure board view is visible immediately
        const boardView = document.getElementById('boardView');
        if (boardView) {
            boardView.style.display = 'block';
        }
    
    // Load data (async - will load from Supabase if configured)
        setTimeout(() => {
            loadData().then(() => {
                loadTemplates();
                switchView('board');
                renderBoard(); // Always render board after data loads
            }).catch((error) => {
                // Silently continue even if data load fails
                loadTemplates();
                switchView('board');
                renderBoard(); // Render board even if data load fails
            });
        }, 100);
    }
    
    // Check for logout events periodically (matching roomstatus pattern)
    setInterval(() => {
        const wasLoggedInBefore = isLoggedIn();
        const isLoggedInNow = loadUser();
        if (wasLoggedInBefore && !isLoggedInNow) {
            // User was logged out (e.g., on another tab)
            updateUserUI();
            hideAllContent();
        }
    }, 5000); // Check every 5 seconds
    
    updateTodayDate();
    // Update time every minute
    setInterval(updateTodayDate, 60000);
    
    // Auto-logout at midnight
    function scheduleMidnightLogout() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            if (isLoggedIn()) {
                handleLogout();
                showNotification('ออกจากระบบอัตโนมัติเมื่อเที่ยงคืน', 'info');
            }
            // Schedule next midnight logout
            scheduleMidnightLogout();
        }, msUntilMidnight);
    }
    
    // Start midnight logout scheduler
    scheduleMidnightLogout();
    
    // Update presence indicator periodically
    setInterval(() => {
        if (isLoggedIn()) {
            updatePresenceIndicator();
        }
    }, 60000); // Update every minute
    
    // Close user menu when clicking outside (with delay for mobile)
    let clickOutsideTimeout;
    document.addEventListener('click', function(event) {
        const userMenuContainer = document.getElementById('userMenuContainer');
        const userMenuDropdown = document.getElementById('userMenuDropdown');
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenuItem = event.target.closest('.user-menu-item');
        
        // Don't close if clicking on logout button - let its handler work
        if (userMenuItem && (userMenuItem.onclick || event.target.closest('[onclick*="handleLogout"]'))) {
            return; // Let the onclick handler handle it
        }
        
        if (userMenuContainer && userMenuDropdown && userMenuBtn) {
            const clickedInside = userMenuContainer.contains(event.target) || 
                                 userMenuDropdown.contains(event.target) ||
                                 userMenuBtn.contains(event.target);
            
            if (!clickedInside && userMenuDropdown.classList.contains('active')) {
                // Small delay for mobile to prevent immediate closing
                clearTimeout(clickOutsideTimeout);
                clickOutsideTimeout = setTimeout(() => {
            closeUserMenu();
                }, 150);
            } else {
                clearTimeout(clickOutsideTimeout);
            }
        }
    }, true); // Use capture phase to handle before other handlers
    
    // Also handle touch events for mobile
    document.addEventListener('touchstart', function(event) {
        const userMenuContainer = document.getElementById('userMenuContainer');
        const userMenuDropdown = document.getElementById('userMenuDropdown');
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userMenuItem = event.target.closest('.user-menu-item');
        
        // Don't close if touching logout button - let its handler work
        if (userMenuItem && (userMenuItem.onclick || event.target.closest('[onclick*="handleLogout"]'))) {
            return; // Let the onclick handler handle it
        }
        
        if (userMenuContainer && userMenuDropdown && userMenuBtn) {
            const touchedInside = userMenuContainer.contains(event.target) || 
                                 userMenuDropdown.contains(event.target) ||
                                 userMenuBtn.contains(event.target);
            
            if (!touchedInside && userMenuDropdown.classList.contains('active')) {
                clearTimeout(clickOutsideTimeout);
                clickOutsideTimeout = setTimeout(() => {
                    closeUserMenu();
                }, 200);
            } else {
                clearTimeout(clickOutsideTimeout);
            }
        }
    }, true); // Use capture phase
    
    // Listen for window resize to re-render cards with correct mobile/desktop layout
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            // Re-render board if it's currently active to update mobile/desktop card layouts
            if (currentView === 'board' && isLoggedIn()) {
                renderBoard();
            }
        }, 150); // Debounce resize events
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (currentView === 'board') {
                document.getElementById('searchInput').focus();
            }
        }
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
            // Close quick issue sheet
            const quickIssueSheet = document.getElementById('quickIssueSheet');
            if (quickIssueSheet && quickIssueSheet.classList.contains('active')) {
                closeQuickIssueSheet();
            }
            if (bulkSelectMode) {
                toggleBulkSelect();
            }
        }
        // Ctrl/Cmd + N to add new item (only in board view)
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.target.matches('input, textarea') && currentView === 'board') {
            e.preventDefault();
            showAddItemModal();
        }
        // Ctrl/Cmd + B for bulk select (only in board view)
        if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !e.target.matches('input, textarea') && currentView === 'board') {
            e.preventDefault();
            toggleBulkSelect();
        }
    });
});
