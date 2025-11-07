import React, { useState } from 'react';
import { IconBars2 } from './icons';

// Generic reusable sidebar components

export const SidebarRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <aside className="flex h-full w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-900 text-white select-none">
    {children}
  </aside>
);

// Collapsible sidebar wrapper for mobile responsiveness
export const CollapsibleSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger menu button - only visible on mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 flex-col items-center justify-center gap-1 rounded bg-gray-800 p-2 text-white lg:hidden"
        aria-label="Toggle sidebar"
      >
        <IconBars2 className="size-6" />
      </button>

      {/* Overlay backdrop - only visible on mobile when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/80 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile by default, overlay when open */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {children}
      </div>
    </>
  );
};

export const SidebarHeader: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
}> = ({ icon, title }) => (
  <div className="flex items-center gap-2 px-6 py-6">
    {icon}
    <span className="text-lg font-bold tracking-wide">{title}</span>
  </div>
);

export const SidebarAction: React.FC<{
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}> = ({ icon, label, onClick, className = '' }) => (
  <div className="p-4">
    <button
      className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-gray-800 px-4 py-2 font-medium text-gray-100 transition-colors hover:bg-gray-700 active:opacity-80 ${className}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  </div>
);

export const SidebarNav: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <nav className="flex-1 overflow-y-auto px-2">
    <ul className="space-y-1">{items}</ul>
  </nav>
);

export const SidebarNavItem: React.FC<{
  content: React.ReactNode;
  active?: boolean;
  onClick?: React.MouseEventHandler<HTMLLIElement>;
}> = ({ content, active = false, onClick }) => (
  <li
    className={`flex cursor-pointer items-center rounded px-3 py-2 transition-colors hover:bg-gray-800 ${
      active ? 'bg-gray-800' : ''
    }`}
    onClick={onClick}
  >
    <span className="truncate">{content}</span>
  </li>
);

export const SidebarFooter: React.FC<{
  content: React.ReactNode;
}> = ({ content }) => (
  <div className="flex items-center gap-3 border-t border-gray-800 p-4">{content}</div>
);

export const SidebarAvatar: React.FC<{
  name: React.ReactNode;
  avatarContent?: React.ReactNode;
}> = ({ name, avatarContent }) => (
  <div className="flex items-center gap-2 overflow-hidden">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 font-semibold text-gray-300">
      {avatarContent}
    </div>
    <span className="truncate text-sm text-gray-200">{name}</span>
  </div>
);

export const SidebarFooterButton: React.FC<{
  content: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}> = ({ content, onClick, className = '' }) => (
  <button
    className={`ml-auto rounded px-2 py-1 text-gray-400 transition-colors hover:bg-gray-800 ${className}`}
    onClick={onClick}
  >
    {content}
  </button>
);
