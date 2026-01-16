// Shared Announcement Box for static HTML pages (Purchase, Dashboard)

(function() {
  'use strict';

  // Supabase Configuration (same as purchase.js)
  const SUPABASE_URL = 'https://kfyjuzmruutgltpytrqm.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmeWp1em1ydXV0Z2x0cHl0cnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MTA1NTIsImV4cCI6MjA4Mzk4NjU1Mn0.ZP3DYdKc5RZiwOJBqim-yiFD_lJH-SxNYXcJtqV8doo';

  let announcementBox = null;
  let isEditing = false;
  let supabaseClient = null;
  let realtimeSubscription = null;

  // Initialize Supabase client
  function initializeSupabaseClient() {
    if (supabaseClient) {
      return supabaseClient;
    }
    
    const supabaseLib = typeof supabase !== 'undefined' ? supabase : null;
    
    if (!supabaseLib) {
      // Wait for Supabase script to load (max 50 retries = 5 seconds)
      if (!window.announcementSupabaseInitRetries) window.announcementSupabaseInitRetries = 0;
      if (window.announcementSupabaseInitRetries < 50) {
        window.announcementSupabaseInitRetries++;
        setTimeout(initializeSupabaseClient, 100);
      } else {
        console.error('❌ Supabase script failed to load for announcement box');
      }
      return null;
    }
    
    try {
      if (SUPABASE_URL && SUPABASE_ANON_KEY && 
          SUPABASE_URL.startsWith('https://') && 
          SUPABASE_ANON_KEY.startsWith('eyJ')) {
        supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.announcementSupabaseInitRetries = 0;
        return supabaseClient;
      }
    } catch (e) {
      console.error('❌ Error creating Supabase client for announcement:', e);
    }
    return null;
  }

  // Load announcement from Supabase (with localStorage fallback)
  async function loadAnnouncement() {
    const client = initializeSupabaseClient();
    
    if (client) {
      try {
        const { data, error } = await client
          .from('announcements')
          .select('*')
          .eq('id', 'main')
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading announcement from Supabase:', error);
          // Fallback to localStorage
          return loadAnnouncementFromLocalStorage();
        }

        if (data) {
          // Always return data, even if text is empty (to show edit form)
          // Also save to localStorage as backup
          localStorage.setItem('crystal_announcement', JSON.stringify({
            text: data.text || '',
            updatedAt: data.updated_at
          }));
          return {
            text: data.text || '',
            updatedAt: data.updated_at
          };
        }
        return null;
      } catch (e) {
        console.error('Error loading announcement from Supabase:', e);
        // Fallback to localStorage
        return loadAnnouncementFromLocalStorage();
      }
    } else {
      // Fallback to localStorage if Supabase not available
      return loadAnnouncementFromLocalStorage();
    }
  }

  // Fallback: Load announcement from localStorage
  function loadAnnouncementFromLocalStorage() {
    try {
      const stored = localStorage.getItem('crystal_announcement');
      if (stored) {
        const data = JSON.parse(stored);
        return data;
      }
    } catch (e) {
      console.error('Error loading announcement from localStorage:', e);
    }
    return null;
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + ' น.';
  }

  function createEditForm(announcement) {
    const box = document.createElement('div');
    box.className = 'shared-announcement-box shared-announcement-box-editing';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'shared-announcement-edit-input';
    textarea.value = announcement?.text || '';
    textarea.placeholder = 'กรอกข้อความประกาศ...';
    textarea.rows = 2;
    textarea.maxLength = 200;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'shared-announcement-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'shared-announcement-btn shared-announcement-btn-save';
    saveBtn.textContent = 'บันทึก';
    saveBtn.onclick = async () => {
      const text = textarea.value.trim();
      const client = initializeSupabaseClient();
      
      try {
        if (text) {
          if (client) {
            // Save to Supabase
            const { data, error } = await client
              .from('announcements')
              .upsert({
                id: 'main',
                text: text,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id'
              })
              .select()
              .single();

            if (error) throw error;

            // Also save to localStorage as backup
            localStorage.setItem('crystal_announcement', JSON.stringify({
              text: data.text,
              updatedAt: data.updated_at
            }));
          } else {
            // Fallback to localStorage
            const newAnnouncement = {
              text: text,
              updatedAt: new Date().toISOString()
            };
            localStorage.setItem('crystal_announcement', JSON.stringify(newAnnouncement));
            window.dispatchEvent(new Event('storage'));
          }
        } else {
          // Clear announcement
          if (client) {
            const { error } = await client
              .from('announcements')
              .update({
                text: '',
                updated_at: new Date().toISOString()
              })
              .eq('id', 'main');

            if (error) throw error;
          }
          localStorage.removeItem('crystal_announcement');
          window.dispatchEvent(new Event('storage'));
        }
        renderAnnouncementBox();
      } catch (e) {
        console.error('Error saving announcement:', e);
        alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง');
        // Fallback to localStorage
        if (text) {
          const newAnnouncement = {
            text: text,
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem('crystal_announcement', JSON.stringify(newAnnouncement));
          window.dispatchEvent(new Event('storage'));
        } else {
          localStorage.removeItem('crystal_announcement');
          window.dispatchEvent(new Event('storage'));
        }
        renderAnnouncementBox();
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shared-announcement-btn shared-announcement-btn-delete';
    deleteBtn.textContent = 'ลบ';
    deleteBtn.onclick = async () => {
      if (window.confirm('คุณต้องการลบประกาศนี้หรือไม่?')) {
        const client = initializeSupabaseClient();
        
        try {
          if (client) {
            // Clear in Supabase
            const { error } = await client
              .from('announcements')
              .update({
                text: '',
                updated_at: new Date().toISOString()
              })
              .eq('id', 'main');

            if (error) throw error;
          }
          localStorage.removeItem('crystal_announcement');
          window.dispatchEvent(new Event('storage'));
          renderAnnouncementBox();
        } catch (e) {
          console.error('Error deleting announcement:', e);
          alert('เกิดข้อผิดพลาดในการลบ กรุณาลองอีกครั้ง');
          // Fallback to localStorage
          localStorage.removeItem('crystal_announcement');
          window.dispatchEvent(new Event('storage'));
          renderAnnouncementBox();
        }
      }
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'shared-announcement-btn shared-announcement-btn-cancel';
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.onclick = () => {
      renderAnnouncementBox();
    };

    actionsDiv.appendChild(saveBtn);
    if (announcement) {
      actionsDiv.appendChild(deleteBtn);
    }
    actionsDiv.appendChild(cancelBtn);

    box.innerHTML = `
      <div class="shared-announcement-content">
        <div class="shared-announcement-header">
          📢 ประกาศสำคัญ
        </div>
      </div>
    `;
    
    box.querySelector('.shared-announcement-content').appendChild(textarea);
    box.querySelector('.shared-announcement-content').appendChild(actionsDiv);

    return box;
  }

  function createDisplayBox(announcement) {
    const box = document.createElement('div');
    box.className = 'shared-announcement-box';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'shared-announcement-edit-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'แก้ไขประกาศ';
    editBtn.onclick = () => {
      renderAnnouncementBox(true);
    };

    // Convert text to bullet points (split by newlines)
    const formatBulletPoints = (text) => {
      if (!text) return '';
      const lines = text.split('\n').filter(line => line.trim() !== '');
      return lines.map(line => `
        <div class="shared-announcement-bullet-item">
          <span class="shared-announcement-bullet">•</span>
          <span class="shared-announcement-bullet-text">${line.trim()}</span>
        </div>
      `).join('');
    };

    box.innerHTML = `
      <div class="shared-announcement-content">
        <div class="shared-announcement-header-row">
          <div class="shared-announcement-header">
            📢 ประกาศสำคัญ
          </div>
        </div>
        <div class="shared-announcement-body">
          ${formatBulletPoints(announcement.text)}
        </div>
      </div>
    `;
    
    // Add edit button
    const headerRow = box.querySelector('.shared-announcement-header-row');
    if (headerRow) {
      headerRow.appendChild(editBtn);
    }
    
    box.querySelector('.shared-announcement-header-row').appendChild(editBtn);
    return box;
  }

  async function renderAnnouncementBox(forceEdit = false) {
    const announcement = await loadAnnouncement();
    
    // Remove existing box
    if (announcementBox) {
      announcementBox.remove();
      announcementBox = null;
    }

    // Show edit form if no announcement or if editing
    // Note: Check for announcement existence, not just text (empty text is valid)
    if (forceEdit || !announcement) {
      announcementBox = createEditForm(announcement);
    } else {
      announcementBox = createDisplayBox(announcement);
    }

    // Insert after header
    const header = document.querySelector('.shared-header');
    if (header) {
      header.insertAdjacentElement('afterend', announcementBox);
    } else {
      // Fallback: insert at beginning of body
      document.body.insertBefore(announcementBox, document.body.firstChild);
    }
  }

  async function init() {
    // Only show announcement box on main page
    const currentPath = window.location.pathname;
    const isMainPage = currentPath === '/' || 
                      currentPath === '/dashboard/' || 
                      currentPath === '/dashboard' ||
                      currentPath === '/dashboard/index.html' ||
                      currentPath.indexOf('/dashboard') === 0;
    
    if (!isMainPage) {
      return; // Don't render announcement box on other pages
    }

    // Initialize Supabase client
    initializeSupabaseClient();

    // Wait a bit for Supabase to initialize, then render
    setTimeout(async () => {
      await renderAnnouncementBox();

      // Set up realtime subscription if Supabase is available
      const client = initializeSupabaseClient();
      if (client) {
        try {
          realtimeSubscription = client
            .channel('announcements-changes')
            .on('postgres_changes', 
              { 
                event: '*', 
                schema: 'public', 
                table: 'announcements',
                filter: 'id=eq.main'
              }, 
              (payload) => {
                console.log('Announcement updated via realtime:', payload);
                renderAnnouncementBox();
              }
            )
            .subscribe();
        } catch (e) {
          console.error('Error setting up realtime subscription:', e);
        }
      }

      // Fallback: Poll for updates every 5 seconds
      setInterval(() => {
        renderAnnouncementBox();
      }, 5000);

      // Listen for localStorage updates (fallback)
      window.addEventListener('storage', (e) => {
        if (e.key === 'crystal_announcement') {
          renderAnnouncementBox();
        }
      });
    }, 200); // Small delay to ensure Supabase is loaded
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
