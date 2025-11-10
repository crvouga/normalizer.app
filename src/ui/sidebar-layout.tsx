import React, { useState } from 'react';
import { Transition } from '@headlessui/react';
import { useKeyDown } from '../lib/use-key-down';
import { IconBars2 } from './icons';
import { ButtonBase } from './button-base';

// Collapsible sidebar wrapper with row layout for desktop, column for mobile
export const SidebarLayout: React.FC<{ sidebar: React.ReactNode; main: React.ReactNode }> = ({
  sidebar,
  main,
}) => {
  const [state, setState] = useState<'open' | 'closed'>('closed');
  useKeyDown('Escape', () => setState('closed'));

  return (
    <div className="flex h-full w-full flex-col lg:flex-row">
      <SidebarOpenButton onOpen={() => setState('open')} />

      <SidebarOverlay show={state === 'open'} onClose={() => setState('closed')} />

      <SidebarContainer open={state === 'open'}>{sidebar}</SidebarContainer>

      <MainContent>{main}</MainContent>
    </div>
  );
};

// Sidebar open button (mobile only)
const SidebarOpenButton: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <div className="flex w-full items-center justify-start p-4 px-8 lg:hidden">
    <ButtonBase
      onClick={onOpen}
      className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded bg-slate-100 p-2 text-slate-900 lg:hidden dark:bg-slate-800 dark:text-white"
      aria-label="Open sidebar"
    >
      <IconBars2 className="size-6" />
    </ButtonBase>
  </div>
);

// Sidebar overlay (mobile only, fade in/out when show changes)
const SidebarOverlay: React.FC<{ show: boolean; onClose: () => void }> = ({ show, onClose }) => {
  return (
    <Transition
      show={show}
      enter="transition-opacity duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="transition-opacity duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div
        className="pointer-events-auto fixed inset-0 z-30 bg-black/80 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
    </Transition>
  );
};

// Collapsible sidebar container (styles for mobile/desktop)
const SidebarContainer: React.FC<{
  open: boolean;
  children: React.ReactNode;
}> = ({ open, children }) => (
  <div
    className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:static lg:translate-x-0 ${
      open ? 'translate-x-0' : '-translate-x-full'
    } lg:flex lg:translate-x-0`}
    style={{ minWidth: 0 }} // fixes overflow scroll issues on flex row
  >
    {children}
  </div>
);

// Main content area (flex child)
const MainContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 shrink-0">{children}</div>
);
