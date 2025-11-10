import type { NormalizationSessionId } from '../normalization-session-id';

export const NormalizationSessionStartedScreen = (props: {
  normalizationSessionId: NormalizationSessionId;
}) => {
  return (
    <div className="flex h-full w-full items-start justify-center p-8">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-bold">Normalization Session Started</h1>
      </div>
    </div>
  );
};
