import { IconSparkles } from './icons';

export function SplashScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-gray-900">
      <div className="animate-pulse">
        <IconSparkles className="size-24 animate-pulse text-black dark:text-white" />
      </div>
    </div>
  );
}
