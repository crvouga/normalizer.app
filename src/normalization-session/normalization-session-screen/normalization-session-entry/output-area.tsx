import type { ReactNode } from 'react';

export const OutputArea = (props: { children: ReactNode }) => {
  return <div className="animate-slide-in-left flex w-full">{props.children}</div>;
};
