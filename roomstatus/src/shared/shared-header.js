// Shared Header for static HTML pages (Purchase, Dashboard)

(function() {
  'use strict';

  function createHeader() {
    const currentPath = window.location.pathname;
    
    const header = document.createElement('header');
    header.className = 'shared-header';
    header.innerHTML = `
      <div class="shared-header-content">
        <div class="shared-header-left">
          <span class="shared-header-brand">Crystal Resort & Café — ระบบภายใน</span>
        </div>
        <div class="shared-header-center">
          <a href="/roomstatus/" class="shared-header-nav-btn ${currentPath.startsWith('/roomstatus') ? 'active' : ''}">
            🏨 สถานะห้องพัก
          </a>
          <a href="/purchase/" class="shared-header-nav-btn ${currentPath.startsWith('/purchase') ? 'active' : ''}">
            🛒 บอร์ดจัดซื้อ
          </a>
        </div>
        <div class="shared-header-right">
          <div class="shared-header-status online" id="connectionStatus">ออนไลน์</div>
          <div class="shared-header-time" id="currentTime"></div>
        </div>
      </div>
    `;

    // Update time every minute
    function updateTime() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      const timeEl = document.getElementById('currentTime');
      if (timeEl) {
        timeEl.textContent = timeStr;
      }
    }

    // Monitor online/offline status
    function updateConnectionStatus() {
      const statusEl = document.getElementById('connectionStatus');
      if (statusEl) {
        const isOnline = navigator.onLine;
        statusEl.textContent = isOnline ? 'ออนไลน์' : 'ออฟไลน์';
        statusEl.className = `shared-header-status ${isOnline ? 'online' : 'offline'}`;
      }
    }

    // Initial setup
    updateTime();
    updateConnectionStatus();
    setInterval(updateTime, 60000);

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    return header;
  }

  function createFooter() {
    const footer = document.createElement('footer');
    footer.className = 'shared-footer';
    footer.innerHTML = `
      <div class="shared-footer-content">
        <p class="shared-footer-text">Crystal Resort & Café — Internal System</p>
        <p class="shared-footer-subtext">สำหรับการใช้งานภายในเท่านั้น</p>
      </div>
    `;
    return footer;
  }

  // Insert header at the beginning of body
  function init() {
    const header = createHeader();
    const footer = createFooter();
    
    document.body.insertBefore(header, document.body.firstChild);
    document.body.appendChild(footer);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
