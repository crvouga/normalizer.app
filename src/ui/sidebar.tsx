import React from 'react';
import { Typography } from './typography';
import { ButtonBase } from './button-base';
import { toI18nText } from '../i18n/types';

export const SidebarRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <aside className="flex h-full w-sm shrink-0 flex-col border-r border-slate-200 bg-slate-100 text-slate-900 select-none dark:border-slate-800 dark:bg-slate-800 dark:text-white">
    {children}
  </aside>
);

export const SidebarHeader: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
}> = ({ icon, title }) => (
  <div className="flex items-center gap-2 px-6 py-6">
    {icon}
    {typeof title === 'string' ? (
      <Typography
        as="span"
        variant="lg"
        weight="bold"
        color="primary"
        className="tracking-wide"
        text={toI18nText(title)}
      />
    ) : (
      <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
        {title}
      </span>
    )}
  </div>
);

export const SidebarAction: React.FC<{
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}> = ({ icon, label, onClick, className = '' }) => (
  <div className="p-4">
    <ButtonBase
      className={`flex w-full items-center justify-center gap-2 rounded bg-slate-100 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${className}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </ButtonBase>
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
    className={`flex cursor-pointer items-center rounded px-3 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
      active ? 'bg-slate-100 dark:bg-slate-800' : ''
    }`}
    onClick={onClick}
  >
    <span className="truncate">{content}</span>
  </li>
);

export const SidebarFooter: React.FC<{
  content: React.ReactNode;
}> = ({ content }) => (
  <div className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
    {content}
  </div>
);

export const SidebarAvatar: React.FC<{
  name: React.ReactNode;
  avatarContent?: React.ReactNode;
}> = ({ name, avatarContent }) => (
  <div className="flex items-center gap-2 overflow-hidden">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
      {avatarContent}
    </div>
    {typeof name === 'string' ? (
      <Typography
        as="span"
        variant="sm"
        color="secondary"
        className="truncate"
        text={toI18nText(name)}
      />
    ) : (
      <span className="truncate text-sm text-slate-700 dark:text-slate-200">{name}</span>
    )}
  </div>
);

export const SidebarFooterButton: React.FC<{
  content: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
}> = ({ content, onClick, className = '' }) => (
  <ButtonBase
    className={`ml-auto rounded px-2 py-1 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${className}`}
    onClick={onClick}
  >
    {content}
  </ButtonBase>
);
