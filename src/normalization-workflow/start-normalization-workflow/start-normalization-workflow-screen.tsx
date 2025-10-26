import { FileInput } from "~/src/ui/file-input/file-input";
import { Button } from "~/src/ui/button";
import { useCurrentScreen } from "~/src/screen/use-current-screen";
import * as React from "react";
import { useFileUpload } from "~/src/file-upload/use-file-upload";

const MAX_FILES = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const StartNormalizationWorkflowScreen = () => {
  const [prompt, setPrompt] = React.useState("");
  const [inputFile, setInputFile] = React.useState<File | null>(null);
  const [targetFile, setTargetFile] = React.useState<File | null>(null);

  const { uploadFile, isUploading } = useFileUpload({
    onUploadComplete: (file) => {
      console.log("File uploaded:", file);
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
    },
  });

  const handleInputFilesChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setInputFile(files[0]);
    }
  };

  const handleTargetFilesChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setTargetFile(files[0]);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputFile || !targetFile) {
      console.error("Please select both input and target files");
      return;
    }

    try {
      // Upload both files
      await uploadFile(inputFile);
      await uploadFile(targetFile);

      // TODO: Handle successful upload - perhaps navigate to next screen
      console.log("Files uploaded successfully");
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-2xl p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Normalizer</h1>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
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

          <Button size="lg" type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Start Normalization"}
          </Button>
        </form>
      </div>
    </div>
  );
};
