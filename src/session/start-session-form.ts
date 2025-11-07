import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useArtifactUploadForm } from '~/src/artifacts/artifact-upload-form';

export const useStartSessionForm = () => {
  const [prompt, setPrompt] = useState('');
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [targetFile, setTargetFile] = useState<File | null>(null);

  const { uploadFile, isUploading } = useArtifactUploadForm({
    onUploadComplete: (file) => {
      console.log('File uploaded:', file);
    },
    onUploadError: (error) => {
      console.error('Upload error:', error);
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

  const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!inputFile || !targetFile) {
      console.error('Please select both input and target files');
      return;
    }

    try {
      // Upload both files
      await uploadFile(inputFile);
      await uploadFile(targetFile);

      // TODO: Handle successful upload - perhaps navigate to next screen
      console.log('Files uploaded successfully');
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  return {
    prompt,
    inputFile,
    targetFile,
    isUploading,
    handleInputFilesChange,
    handleTargetFilesChange,
    handlePromptChange,
    handleSubmit,
  };
};
