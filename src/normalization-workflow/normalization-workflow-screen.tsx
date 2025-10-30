import { Button } from '~/src/ui/button';
import { FileInputField } from '~/src/ui/file-input/file-input-field';
import { PromptInputField } from '~/src/ui/prompt/prompt-field';
import { useNormalizationForm } from './use-normalization-form';

const MAX_FILES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const NormalizationWorkflowScreen = () => {
  const {
    prompt,
    isUploading,
    handleInputFilesChange,
    handleTargetFilesChange,
    handlePromptChange,
    handleSubmit,
  } = useNormalizationForm();

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl p-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">normalizer.app</h1>
        </div>

        <div className="flex flex-col gap-6">
          <FileInputField
            id="target-files"
            label="Target Files"
            multiple
            maxFiles={MAX_FILES}
            maxSize={MAX_FILE_SIZE}
            onFilesChange={handleTargetFilesChange}
            placeholder="Upload target files"
            accept=".txt,.csv,.xlsx,.json"
          />
          <div className="flex justify-end">
            <Button
              size="lg"
              type="submit"
              disabled={isUploading}
              text="Start Normalization Workflow"
            />
          </div>
        </div>

        <div className="my-8 h-px bg-gray-700" />

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
      </div>
    </div>
  );
};
