import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AnnouncementBox = () => {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Use refs to store intervals/subscriptions for cleanup
  const pollIntervalRef = useRef(null);
  const realtimeSubscriptionRef = useRef(null);
  const hasSubscribedRef = useRef(false);
  const closedCountRef = useRef(0);
  const announcementSubscribedRef = useRef(false); // Guard against double subscription
  const announcementErrorTimeRef = useRef(null); // Track when CHANNEL_ERROR first occurred
  const announcementStartTimeRef = useRef(null); // Track when subscription started

  // Only show announcement box on main page
  const currentPath = window.location.pathname;
  const isMainPage = currentPath === '/' || 
                    currentPath === '/dashboard/' || 
                    currentPath === '/dashboard' ||
                    currentPath === '/dashboard/index.html' ||
                    currentPath.indexOf('/dashboard') === 0;
  
  if (!isMainPage) {
    return null;
  }

  useEffect(() => {
    let realtimeSubscription = null;

    const loadAnnouncement = async () => {
      try {
        // Check if Supabase is configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
        const isSupabaseConfigured = supabaseUrl && supabaseKey && 
          supabaseUrl !== '' && supabaseKey !== '' &&
          !supabaseUrl.includes('placeholder') && !supabaseKey.includes('placeholder');

        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('id', 'main')
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error loading announcement from Supabase:', error);
            // Fall through to localStorage fallback
          } else if (data) {
            // Always set announcement, even if text is empty (to show edit form)
            setAnnouncement({
              text: data.text || '',
              updatedAt: data.updated_at
            });
            setEditText(data.text || '');
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error('Error loading announcement from Supabase:', e);
      }

      // Fallback to localStorage if Supabase fails or not configured
      try {
        const stored = localStorage.getItem('crystal_announcement');
        if (stored) {
          const data = JSON.parse(stored);
          setAnnouncement({
            text: data.text || '',
            updatedAt: data.updatedAt
          });
          setEditText(data.text || '');
        } else {
          setAnnouncement(null);
          setEditText('');
        }
      } catch (parseError) {
        console.error('Error parsing localStorage announcement:', parseError);
        setAnnouncement(null);
        setEditText('');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    loadAnnouncement();

    // Subscribe to realtime updates (only if Supabase is configured)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    const isSupabaseConfigured = supabaseUrl && supabaseKey && 
      supabaseUrl !== '' && supabaseKey !== '' &&
      !supabaseUrl.includes('placeholder') && !supabaseKey.includes('placeholder');

    let realtimeWorking = false;

    if (isSupabaseConfigured) {
      // Guard against double subscription
      if (announcementSubscribedRef.current) {
        console.log("ℹ️ Realtime subscription already active — skipping");
        return;
      }

      // Runtime check: Verify Supabase client is available
      if (!supabase) {
        if (import.meta.env.DEV) {
          console.warn("⚠️ Supabase client not available — skipping realtime subscription");
        }
        return;
      }

      // Track subscription start time
      announcementStartTimeRef.current = Date.now();
      announcementSubscribedRef.current = true;

      try {
        // Use unique channel name to avoid conflicts
        const channelName = `announcements-changes-${Date.now()}`;
        realtimeSubscriptionRef.current = supabase
          .channel(channelName, {
            config: {
              broadcast: { self: true }
            }
          })
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'announcements',
              filter: 'id=eq.main'
            }, 
            (payload) => {
              console.log('Announcement updated via realtime:', payload);
              realtimeWorking = true; // Mark realtime as working
              hasSubscribedRef.current = true; // We got data, so subscription is working
              closedCountRef.current = 0; // Reset closed count on successful update
              announcementErrorTimeRef.current = null; // Reset error tracking
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current); // Stop polling if realtime works
                pollIntervalRef.current = null;
              }
              if (payload.new) {
                setAnnouncement({
                  text: payload.new.text || '',
                  updatedAt: payload.new.updated_at
                });
                setEditText(payload.new.text || '');
              } else {
                setAnnouncement(null);
                setEditText('');
              }
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Announcement realtime subscribed');
              realtimeWorking = true;
              hasSubscribedRef.current = true;
              closedCountRef.current = 0; // Reset closed count on successful subscription
              announcementErrorTimeRef.current = null; // Reset error tracking
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            } else if (status === 'TIMED_OUT') {
              console.log('ℹ️ Supabase auto-reconnected — no action needed');
              // Don't start polling immediately - let Supabase reconnect
              realtimeWorking = false;
            } else if (status === 'CHANNEL_ERROR') {
              // Track when error first occurred
              if (!announcementErrorTimeRef.current) {
                announcementErrorTimeRef.current = Date.now();
              }
              
              const errorDuration = Date.now() - announcementErrorTimeRef.current;
              const totalDuration = Date.now() - announcementStartTimeRef.current;
              
              // Only log as error if it persists > 30 seconds OR never reached SUBSCRIBED after 60 seconds
              if (errorDuration > 30000 || (totalDuration > 60000 && !hasSubscribedRef.current)) {
                console.error('❌ Announcement realtime CHANNEL_ERROR (persistent):', err);
                realtimeWorking = false;
                // Only start polling if we've never successfully subscribed
                if (!hasSubscribedRef.current && !pollIntervalRef.current) {
                  console.warn('⚠️ Starting polling fallback due to persistent channel error');
                  pollIntervalRef.current = setInterval(() => {
                    loadAnnouncement();
                  }, 2000);
                }
              } else {
                // Downgrade to info for transient errors
                console.log('ℹ️ CHANNEL_ERROR — Supabase will auto-reconnect');
                realtimeWorking = false;
              }
            } else if (status === 'CLOSED') {
              // CLOSED is normal during reconnection - Supabase handles it automatically
              closedCountRef.current++;
              if (closedCountRef.current === 1 && hasSubscribedRef.current) {
                // First CLOSED after SUBSCRIBED - likely transient, Supabase will reconnect
                console.log('ℹ️ Supabase auto-reconnected — no action needed');
              } else if (closedCountRef.current > 3) {
                // Multiple CLOSED events - might be a persistent issue
                console.warn('⚠️ Announcement realtime CLOSED multiple times - starting polling fallback');
                realtimeWorking = false;
                if (!pollIntervalRef.current) {
                  pollIntervalRef.current = setInterval(() => {
                    loadAnnouncement();
                  }, 2000);
                }
              } else if (!hasSubscribedRef.current) {
                // CLOSED before ever subscribing - might be a real issue
                console.log('ℹ️ Supabase auto-reconnected — no action needed');
                realtimeWorking = false;
              }
            }
          });
      } catch (e) {
        console.error('Error setting up realtime subscription:', e);
        realtimeWorking = false;
        announcementSubscribedRef.current = false;
      }
    }

    // Fallback: Poll for updates every 2 seconds only if realtime never works
    // Give realtime a chance to connect first (wait 3 seconds)
    const fallbackTimeout = setTimeout(() => {
      if (!realtimeWorking && !pollIntervalRef.current && !hasSubscribedRef.current) {
        console.warn('⚠️ Realtime never connected - starting polling fallback');
        pollIntervalRef.current = setInterval(() => {
          loadAnnouncement();
        }, 2000);
      }
    }, 3000);

    return () => {
      // Guard against recursive cleanup
      if (!announcementSubscribedRef.current) {
        return;
      }
      
      announcementSubscribedRef.current = false;
      
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current.unsubscribe();
        realtimeSubscriptionRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
    };
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleSave = async () => {
    const text = editText.trim();
    
    try {
      if (text) {
        // Upsert announcement (insert or update)
        const { data, error } = await supabase
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

        setAnnouncement({
          text: data.text,
          updatedAt: data.updated_at
        });
        setIsEditing(false);

        // Also save to localStorage as fallback
        localStorage.setItem('crystal_announcement', JSON.stringify({
          text: data.text,
          updatedAt: data.updated_at
        }));
      } else {
        // If empty, clear the announcement
        const { error } = await supabase
          .from('announcements')
          .update({
            text: '',
            updated_at: new Date().toISOString()
          })
          .eq('id', 'main');

        if (error) throw error;

        setAnnouncement(null);
        setIsEditing(false);
        localStorage.removeItem('crystal_announcement');
      }
    } catch (e) {
      console.error('Error saving announcement:', e);
      // Fallback to localStorage
      const newAnnouncement = {
        text: text,
        updatedAt: new Date().toISOString()
      };
      if (text) {
        localStorage.setItem('crystal_announcement', JSON.stringify(newAnnouncement));
        setAnnouncement(newAnnouncement);
      } else {
        localStorage.removeItem('crystal_announcement');
        setAnnouncement(null);
      }
      setIsEditing(false);
      alert('เกิดข้อผิดพลาดในการบันทึก กรุณาลองอีกครั้ง');
    }
  };

  const handleCancel = () => {
    setEditText(announcement?.text || '');
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm('คุณต้องการลบประกาศนี้หรือไม่?')) {
      try {
        const { error } = await supabase
          .from('announcements')
          .update({
            text: '',
            updated_at: new Date().toISOString()
          })
          .eq('id', 'main');

        if (error) throw error;

        setAnnouncement(null);
        setEditText('');
        setIsEditing(false);
        localStorage.removeItem('crystal_announcement');
      } catch (e) {
        console.error('Error deleting announcement:', e);
        // Fallback to localStorage
        localStorage.removeItem('crystal_announcement');
        setAnnouncement(null);
        setEditText('');
        setIsEditing(false);
        alert('เกิดข้อผิดพลาดในการลบ กรุณาลองอีกครั้ง');
      }
    }
  };

  // Show edit form if no announcement exists or if editing
  if (isLoading) {
    return null; // Don't show anything while loading
  }

  // Note: Check for announcement existence, not text (empty text is valid)
  if (!announcement || isEditing) {
    return (
      <div className="shared-announcement-box shared-announcement-box-editing">
        <div className="shared-announcement-content">
          <div className="shared-announcement-header">
            📢 ประกาศสำคัญ
          </div>
          <textarea
            className="shared-announcement-edit-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="กรอกข้อความประกาศ..."
            rows={2}
            maxLength={200}
          />
          <div className="shared-announcement-actions">
            <button
              className="shared-announcement-btn shared-announcement-btn-save"
              onClick={handleSave}
            >
              บันทึก
            </button>
            {announcement && (
              <button
                className="shared-announcement-btn shared-announcement-btn-delete"
                onClick={handleDelete}
              >
                ลบ
              </button>
            )}
            <button
              className="shared-announcement-btn shared-announcement-btn-cancel"
              onClick={handleCancel}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Convert text to bullet points (split by newlines)
  const formatBulletPoints = (text) => {
    if (!text) return '';
    const lines = text.split('\n').filter(line => line.trim() !== '');
    return lines.map((line, index) => (
      <div key={index} className="shared-announcement-bullet-item">
        <span className="shared-announcement-bullet">•</span>
        <span className="shared-announcement-bullet-text">{line.trim()}</span>
      </div>
    ));
  };

  return (
    <div className="shared-announcement-box">
      <div className="shared-announcement-content">
        <div className="shared-announcement-header-row">
          <div className="shared-announcement-header">
            📢 ประกาศสำคัญ
          </div>
          <button
            className="shared-announcement-edit-btn"
            onClick={() => setIsEditing(true)}
            title="แก้ไขประกาศ"
          >
            ✏️
          </button>
        </div>
        <div className="shared-announcement-body">
          {formatBulletPoints(announcement.text)}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBox;
