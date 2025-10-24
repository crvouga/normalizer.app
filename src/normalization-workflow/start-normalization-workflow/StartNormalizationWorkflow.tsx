import { FileInput } from "~/src/components/ui/FileInput";
import { Button } from "~/src/components/ui/button";

export const StartNormalizationWorkflowScreen = () => {
  const handleInputFilesChange = (files: FileList | null) => {
    // Handle input files change
  };

  const handleTargetFilesChange = (files: FileList | null) => {
    // Handle target files change
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
              maxFiles={5}
              maxSize={50 * 1024 * 1024} // 50MB
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
              maxFiles={5}
              maxSize={50 * 1024 * 1024} // 50MB
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
