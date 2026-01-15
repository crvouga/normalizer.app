import type { ReactNode } from 'react';

export const OutputArea = (props: { children: ReactNode }) => {
  return <div className="flex w-full">{props.children}</div>;
};
