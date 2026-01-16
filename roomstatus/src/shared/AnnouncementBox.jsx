import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

const AnnouncementBox = () => {
  const location = useLocation();
  const [announcement, setAnnouncement] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('id', 'main')
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading announcement:', error);
          return;
        }

        if (data && data.text) {
          setAnnouncement({
            text: data.text,
            updatedAt: data.updated_at
          });
          setEditText(data.text);
        } else {
          setAnnouncement(null);
          setEditText('');
        }
      } catch (e) {
        console.error('Error loading announcement:', e);
        // Fallback to localStorage if Supabase fails
        const stored = localStorage.getItem('crystal_announcement');
        if (stored) {
          try {
            const data = JSON.parse(stored);
            setAnnouncement(data);
            setEditText(data.text || '');
          } catch (parseError) {
            console.error('Error parsing localStorage announcement:', parseError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    loadAnnouncement();

    // Subscribe to realtime updates
    try {
      realtimeSubscription = supabase
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
            if (payload.new && payload.new.text) {
              setAnnouncement({
                text: payload.new.text,
                updatedAt: payload.new.updated_at
              });
              setEditText(payload.new.text);
            } else {
              setAnnouncement(null);
              setEditText('');
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.error('Error setting up realtime subscription:', e);
    }

    return () => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
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
        {announcement.updatedAt && (
          <div className="shared-announcement-time">
            อัปเดต: {formatTime(announcement.updatedAt)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementBox;
