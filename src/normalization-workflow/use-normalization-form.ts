import * as React from 'react';
import { useFileUpload } from '~/src/file-upload/use-file-upload';

export const useNormalizationForm = () => {
  const [prompt, setPrompt] = React.useState('');
  const [inputFile, setInputFile] = React.useState<File | null>(null);
  const [targetFile, setTargetFile] = React.useState<File | null>(null);

  const { uploadFile, isUploading } = useFileUpload({
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

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
