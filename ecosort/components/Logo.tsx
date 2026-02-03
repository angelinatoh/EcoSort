
import React from 'react';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const dims = size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-12 h-12' : 'w-24 h-24';
  const id = React.useId().replace(/:/g, "");

  return (
    <div className={`relative ${dims} flex items-center justify-center transform hover:scale-110 transition-transform duration-500 ease-out cursor-pointer`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`gradMain-${id}`} x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>
          <linearGradient id={`gradGlass-${id}`} x1="50" y1="0" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id={`blur-${id}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>
        <circle cx="50" cy="50" r="45" fill={`url(#gradMain-${id})`} />
        <ellipse cx="50" cy="30" rx="28" ry="18" fill={`url(#gradGlass-${id})`} />
        <path d="M35 70 Q50 40 70 30" stroke="white" strokeWidth="8" strokeLinecap="round" opacity="0.3" filter={`url(#blur-${id})`} />
        <path d="M40 75 C40 75 35 50 50 35 C65 20 85 25 80 45 C75 65 50 75 40 75Z" fill="white" fillOpacity="0.2" />
      </svg>
    </div>
  );
};
