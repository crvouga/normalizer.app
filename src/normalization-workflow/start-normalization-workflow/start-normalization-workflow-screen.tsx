import { FileInput } from "~/src/ui/file-input/file-input";
import { Button } from "~/src/ui/button";
import * as React from "react";

const MAX_FILES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const StartNormalizationWorkflowScreen = () => {
  const [prompt, setPrompt] = React.useState("");

  const handleInputFilesChange = (files: FileList | null) => {
    // Handle input files change
  };

  const handleTargetFilesChange = (files: FileList | null) => {
    // Handle target files change
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-2xl p-8">
        <h1 className="text-3xl font-bold mb-8">Normalization</h1>

        <form className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="input-files" className="font-medium">
              Input Files
            </label>
            <FileInput
              id="input-files"
              multiple
              maxFiles={MAX_FILES}
              maxSize={MAX_FILE_SIZE}
              onFilesChange={handleInputFilesChange}
              placeholder="Upload input files"
              accept=".txt,.csv,.xlsx,.json"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="target-files" className="font-medium">
              Target Files
            </label>
            <FileInput
              id="target-files"
              multiple
              maxFiles={MAX_FILES}
              maxSize={MAX_FILE_SIZE}
              onFilesChange={handleTargetFilesChange}
              placeholder="Upload target files"
              accept=".txt,.csv,.xlsx,.json"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="prompt" className="font-medium">
              Prompt
            </label>
            <textarea
              id="prompt"
              rows={4}
              className="border rounded p-2 resize-y"
              placeholder="Enter your prompt here..."
              value={prompt}
              onChange={handlePromptChange}
            />
          </div>

          <Button size="lg" type="submit">
            Start Normalization
          </Button>
        </form>
      </div>
    </div>
  );
};
