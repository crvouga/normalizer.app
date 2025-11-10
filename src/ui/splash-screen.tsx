import { IconSparkles } from './icons';

export function SplashScreen() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-gray-900">
      <div className="animate-pulse">
        <IconSparkles className="size-24 text-purple-600 dark:text-purple-400" />
      </div>
    </div>
  );
}
