'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface AppointmentCardProps {
  name: string;
  service: string;
  time: string;
  date?: string;
  onClick?: () => void;
  isSelected?: boolean;
  onCancel?: () => void;
  onReschedule?: () => void;
}

export default function AppointmentCard({ name, service, time, date, onClick, isSelected, onCancel, onReschedule }: AppointmentCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const handleMenuClick = (action: () => void) => {
    action();
    setShowMenu(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + window.scrollY + 4, // 4px margin top
        right: window.innerWidth - rect.right - window.scrollX
      });
    }
    setShowMenu(true);
  };

  // Close menu when clicking outside or scrolling
  useEffect(() => {
    if (!showMenu) return;
    
    const handleOutsideClick = () => setShowMenu(false);
    
    // Use capture phase for scroll to catch inner div scrolling
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('scroll', handleOutsideClick, true);
    window.addEventListener('resize', handleOutsideClick);
    
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleOutsideClick, true);
      window.removeEventListener('resize', handleOutsideClick);
    };
  }, [showMenu]);

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-card transition-colors cursor-pointer border ${
        isSelected 
          ? 'border-border-active bg-bg-surface' 
          : 'border-border-card bg-bg-surface hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      <div className="w-12 h-12 rounded-full bg-bg-avatar-initials text-text-on-avatar font-bold text-sm flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-base text-text-primary truncate">{name}</p>
        <p className="text-sm text-text-secondary truncate">{service}</p>
      </div>
      <div className="text-right">
        {date && <p className="text-xs font-medium text-text-secondary">{date}</p>}
        <p className="text-sm font-bold text-brand-danger">{time}</p>
      </div>
      {(onCancel || onReschedule) && (
        <div className="relative ml-2">
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleMenu}
            className={`p-1.5 rounded-lg transition-colors ${
              showMenu ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          
          {showMenu && typeof document !== 'undefined' && createPortal(
            <div 
              className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[140px] overflow-hidden"
              style={{
                top: `${menuCoords.top}px`,
                right: `${menuCoords.right}px`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {onReschedule && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuClick(onReschedule);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-gray-100"
                >
                  <span className="text-base">🔄</span> Reschedule
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuClick(onCancel);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-base">❌</span> Cancel
                </button>
              )}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
