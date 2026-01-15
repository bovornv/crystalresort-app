import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Only show header on main page
  const currentPath = window.location.pathname;
  const isMainPage = currentPath === '/' || 
                    currentPath === '/dashboard/' || 
                    currentPath === '/dashboard' ||
                    currentPath === '/dashboard/index.html';
  
  if (!isMainPage) {
    return null;
  }

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatTime = (date) => {
    const timeStr = date.toLocaleTimeString('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    return `${timeStr} น.`;
  };

  return (
    <header className="shared-header">
      <div className="shared-header-content">
        {/* Brand - centered */}
        <div className="shared-header-left">
          <span className="shared-header-brand">ระบบภายใน Crystal Resort & Café</span>
        </div>

        {/* Right: Status & Time */}
        <div className="shared-header-right">
          <div className={`shared-header-status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'ออนไลน์' : 'ออฟไลน์'}
          </div>
          <div className="shared-header-time">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
