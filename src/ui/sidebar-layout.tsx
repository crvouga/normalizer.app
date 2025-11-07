import React, { useState } from 'react';
import { useKeyDown } from '../lib/use-key-down';
import { IconBars2 } from './icons';

// Collapsible sidebar wrapper with row layout for desktop, column for mobile
export const SidebarLayout: React.FC<{ sidebar: React.ReactNode; main: React.ReactNode }> = ({
  sidebar,
  main,
}) => {
  const [state, setState] = useState<'open' | 'closed'>('closed');
  useKeyDown('Escape', () => setState('closed'));
  return (
    <div className="flex h-full w-full flex-col lg:flex-row">
      {/* Mobile sidebar open button */}
      <div className="flex w-full items-center justify-start p-4 px-8 lg:hidden">
        <button
          onClick={() => setState('open')}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded bg-gray-800 p-2 text-white lg:hidden"
          aria-label="Open sidebar"
        >
          <IconBars2 className="size-6" />
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {state === 'open' && (
        <div
          className="fixed inset-0 z-30 bg-black/80 lg:hidden"
          onClick={() => setState('closed')}
        />
      )}

      {/* Sidebar: collapsible on mobile, visible on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:static lg:translate-x-0 ${
          state === 'open' ? 'translate-x-0' : '-translate-x-full'
        } lg:flex lg:translate-x-0`}
        style={{ minWidth: 0 }} // fixes overflow scroll issues on flex row
      >
        {sidebar}
      </div>

      {/* Main content area */}
      <div className="flex-1 shrink-0">{main}</div>
    </div>
  );
};
