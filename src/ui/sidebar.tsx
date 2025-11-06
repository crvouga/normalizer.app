import React from 'react';

// Generic reusable sidebar components

export const SidebarRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <aside className="flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-900 text-white select-none">
    {children}
  </aside>
);

export const SidebarHeader: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
}> = ({ icon, title }) => (
  <div className="flex items-center gap-2 border-b border-gray-800 px-6 py-6">
    {icon}
    <span className="text-lg font-bold tracking-wide">{title}</span>
  </div>
);

export const SidebarAction: React.FC<{
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}> = ({ children, onClick, className = '' }) => (
  <div className="p-4">
    <button
      className={`flex w-full items-center justify-center gap-2 rounded bg-gray-800 px-4 py-2 font-medium text-gray-100 transition-colors hover:bg-gray-700 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  </div>
);

export const SidebarNav: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <nav className="flex-1 overflow-y-auto px-2">
    <ul className="space-y-1">{children}</ul>
  </nav>
);

export const SidebarNavItem: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  onClick?: React.MouseEventHandler<HTMLLIElement>;
}> = ({ children, active = false, onClick }) => (
  <li
    className={`flex cursor-pointer items-center rounded px-3 py-2 transition-colors hover:bg-gray-800 ${
      active ? 'bg-gray-800' : ''
    }`}
    onClick={onClick}
  >
    <span className="truncate">{children}</span>
  </li>
);

export const SidebarFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3 border-t border-gray-800 p-4">{children}</div>
);

export const SidebarAvatar: React.FC<{
  name: React.ReactNode;
  children?: React.ReactNode;
}> = ({ name, children }) => (
  <div className="flex items-center gap-2 overflow-hidden">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 font-semibold text-gray-300">
      {children}
    </div>
    <span className="truncate text-sm text-gray-200">{name}</span>
  </div>
);

export const SidebarFooterButton: React.FC<{
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}> = ({ children, onClick, className = '' }) => (
  <button
    className={`ml-auto rounded px-2 py-1 text-gray-400 transition-colors hover:bg-gray-800 ${className}`}
    onClick={onClick}
  >
    {children}
  </button>
);
