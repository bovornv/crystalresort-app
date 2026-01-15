import React, { useState, useEffect } from 'react';

const AnnouncementBox = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    // Load announcement from localStorage or API
    // For now, using localStorage as simple storage
    const loadAnnouncement = () => {
      const stored = localStorage.getItem('crystal_announcement');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setAnnouncement(data);
          setEditText(data.text || '');
        } catch (e) {
          console.error('Error parsing announcement:', e);
        }
      } else {
        setEditText('');
      }
    };

    loadAnnouncement();
    
    // Listen for announcement updates
    const handleStorageChange = (e) => {
      if (e.key === 'crystal_announcement') {
        loadAnnouncement();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for updates
    const interval = setInterval(loadAnnouncement, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Don't show announcement box on main page
  const currentPath = window.location.pathname;
  if (currentPath === '/' || currentPath === '/dashboard/' || currentPath === '/dashboard') {
    return null;
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleSave = () => {
    const newAnnouncement = {
      text: editText.trim(),
      updatedAt: new Date().toISOString()
    };
    
    if (newAnnouncement.text) {
      localStorage.setItem('crystal_announcement', JSON.stringify(newAnnouncement));
      setAnnouncement(newAnnouncement);
      setIsEditing(false);
      
      // Trigger storage event for other tabs/windows
      window.dispatchEvent(new Event('storage'));
    } else {
      // If empty, remove announcement
      localStorage.removeItem('crystal_announcement');
      setAnnouncement(null);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(announcement?.text || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('คุณต้องการลบประกาศนี้หรือไม่?')) {
      localStorage.removeItem('crystal_announcement');
      setAnnouncement(null);
      setEditText('');
      setIsEditing(false);
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Show edit form if no announcement exists or if editing
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
          {announcement.text}
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
