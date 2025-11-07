import { Button } from '~/src/ui/button';
import { FileInputField } from '~/src/ui/file-input/file-input-field';
import { PromptInputField } from '~/src/ui/prompt/prompt-field';
import { useStartSessionForm } from './start-session-form';
import { ArtifactInput } from '../artifacts/artifact-input';
import { useI18n } from '../i18n/use-i18n';

const MAX_FILES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const NormalizationSessionScreen = (props: { normalizationSessionId: string | null }) => {
  const { t } = useI18n();
  const {
    prompt,
    isUploading,
    handleInputFilesChange,
    handleTargetFilesChange,
    handlePromptChange,
    handleSubmit,
  } = useStartSessionForm();

  return (
    <div className="flex h-full w-full items-start justify-center bg-white p-8 dark:bg-gray-900">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <ArtifactInput value={[]} onChange={() => {}} />

        {false && (
          <FileInputField
            id="target-files"
            label={t('session.targetFiles')}
            multiple
            maxFiles={MAX_FILES}
            maxSize={MAX_FILE_SIZE}
            onFilesChange={handleTargetFilesChange}
            placeholder={t('session.uploadPlaceholder')}
            accept=".txt,.csv,.xlsx,.json"
          />
        )}
        <div className="flex justify-end">
          <Button
            size="lg"
            type="submit"
            disabled={isUploading}
            text={t('session.startButton')}
          />
        </div>
      </div>

      {false && (
        <>
          <div className="my-8 h-px bg-gray-300 dark:bg-gray-700" />
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <FileInputField
              id="input-files"
              label="Input Files"
              maxFiles={MAX_FILES}
              maxSize={MAX_FILE_SIZE}
              onFilesChange={handleInputFilesChange}
              placeholder="Upload input files"
              accept=".txt,.csv,.xlsx,.json"
            />

            <PromptInputField
              id="prompt"
              label="Prompt"
              value={prompt}
              onChange={handlePromptChange}
              placeholder="Enter your prompt here..."
              rows={4}
            />

            <div className="flex justify-end">
              <Button size="lg" type="submit" disabled={isUploading} text="Normalize" />
            </div>
          </form>
        </>
      )}
    </div>
  );
};
