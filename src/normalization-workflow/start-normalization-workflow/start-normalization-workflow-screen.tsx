import { FileInput } from "~/src/components/ui/file-input";
import { Button } from "~/src/components/ui/button";
import * as React from "react";

const MAX_FILES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const StartNormalizationWorkflowScreen = () => {
  const [prompt, setPrompt] = React.useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("normalization-prompt") || "";
    }
    return "";
  });

  const handleInputFilesChange = (files: FileList | null) => {
    // Handle input files change
    // Note: Files cannot be stored in localStorage directly
    // Only storing file metadata if needed
    if (files) {
      const fileNames = Array.from(files).map((f) => f.name);
      localStorage.setItem(
        "normalization-input-files",
        JSON.stringify(fileNames)
      );
    } else {
      localStorage.removeItem("normalization-input-files");
    }
  };

  const handleTargetFilesChange = (files: FileList | null) => {
    // Handle target files change
    if (files) {
      const fileNames = Array.from(files).map((f) => f.name);
      localStorage.setItem(
        "normalization-target-files",
        JSON.stringify(fileNames)
      );
    } else {
      localStorage.removeItem("normalization-target-files");
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    localStorage.setItem("normalization-prompt", newPrompt);
  };

  // Clear form data on unmount
  React.useEffect(() => {
    return () => {
      localStorage.removeItem("normalization-prompt");
      localStorage.removeItem("normalization-input-files");
      localStorage.removeItem("normalization-target-files");
    };
  }, []);

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
