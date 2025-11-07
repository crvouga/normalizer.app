import * as React from 'react';

export type TopBarProps = {
  leftContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
};

export const TopBar: React.FC<TopBarProps> = ({
  leftContent,
  centerContent,
  rightContent,
  className = '',
}) => (
  <nav className={`flex h-14 items-center border-b bg-white px-4 shadow-sm ${className}`}>
    <div className="flex flex-1 items-center">{leftContent}</div>
    <div className="flex flex-1 items-center justify-center">{centerContent}</div>
    <div className="flex flex-1 items-center justify-end">{rightContent}</div>
  </nav>
);
