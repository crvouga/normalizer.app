import * as React from 'react';
import { ComboboxActionButton } from '~/src/ui/combobox/combobox-action-button';
import { UploadIcon } from '~/src/ui/icons';
import { useI18n } from '../../i18n/use-i18n';
import type { Artifact } from '../artifact';
import { useArtifactUpload } from '../artifact-upload/use-artifact-upload';

export interface ArtifactUploadButtonProps {
  onUploadComplete?: (artifact: Artifact) => void;
  onUploadError?: (error: Error) => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'contained';
}

/**
 * Button component that triggers a file upload dialog.
 * Shows loading state during upload and calls lifecycle callbacks.
 */
export function ArtifactUploadButton({
  onUploadComplete,
  onUploadError,
  variant = 'outline',
}: ArtifactUploadButtonProps) {
  const { t } = useI18n();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useArtifactUpload({
    onUploadComplete,
    onUploadError,
  });

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Start the upload
    await uploadFile(file);

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      <ComboboxActionButton
        onClick={handleButtonClick}
        disabled={isUploading}
        variant={variant}
        startIcon={<UploadIcon className="size-6" />}
        text={isUploading ? t('artifact.uploading') : t('artifact.uploadButton')}
      />
    </>
  );
}
