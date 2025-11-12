import { Spinner } from './spinner';

export function SpinnerBlock() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
