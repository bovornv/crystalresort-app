// Shared Announcement Box for static HTML pages (Purchase, Dashboard)

(function() {
  'use strict';

  let announcementBox = null;
  let isEditing = false;

  // Load announcement from localStorage
  function loadAnnouncement() {
    try {
      const stored = localStorage.getItem('crystal_announcement');
      if (stored) {
        const data = JSON.parse(stored);
        return data;
      }
    } catch (e) {
      console.error('Error loading announcement:', e);
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
    });
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
    saveBtn.onclick = () => {
      const text = textarea.value.trim();
      if (text) {
        const newAnnouncement = {
          text: text,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('crystal_announcement', JSON.stringify(newAnnouncement));
        window.dispatchEvent(new Event('storage'));
        renderAnnouncementBox();
      } else {
        localStorage.removeItem('crystal_announcement');
        window.dispatchEvent(new Event('storage'));
        renderAnnouncementBox();
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shared-announcement-btn shared-announcement-btn-delete';
    deleteBtn.textContent = 'ลบ';
    deleteBtn.onclick = () => {
      if (window.confirm('คุณต้องการลบประกาศนี้หรือไม่?')) {
        localStorage.removeItem('crystal_announcement');
        window.dispatchEvent(new Event('storage'));
        renderAnnouncementBox();
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
        ${announcement.updatedAt ? `
          <div class="shared-announcement-time">
            อัปเดต: ${formatTime(announcement.updatedAt)}
          </div>
        ` : ''}
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

  function renderAnnouncementBox(forceEdit = false) {
    const announcement = loadAnnouncement();
    
    // Remove existing box
    if (announcementBox) {
      announcementBox.remove();
      announcementBox = null;
    }

    // Show edit form if no announcement or if editing
    if (forceEdit || !announcement || !announcement.text) {
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

  function init() {
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

    renderAnnouncementBox();

    // Listen for updates
    window.addEventListener('storage', (e) => {
      if (e.key === 'crystal_announcement') {
        renderAnnouncementBox();
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
