import * as React from 'react';
import { isOk, type Result } from '~/src/lib/result';
import { Button } from '~/src/ui/button';
import { Modal } from '~/src/ui/modal';
import { TabularFileInput } from '~/src/ui/tabular-file-input/tabular-file-input';
import { useI18n } from '../../i18n/use-i18n';
import type { Artifact } from '../artifact';
import { useArtifactUpload } from './use-artifact-upload';

export interface ArtifactUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (artifact: Result<Artifact, Error>) => void;
}

export function ArtifactUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: ArtifactUploadModalProps) {
  const { t } = useI18n();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  const { uploadArtifact, isUploading, state } = useArtifactUpload({
    onUploadComplete: (result) => {
      onUploadComplete?.(result);
      setSelectedFile(null);
      if (isOk(result)) {
        onClose();
      }
    },
  });

  const handleFilesChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      await uploadArtifact(selectedFile);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('artifact.uploadDialogTitle')} size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TabularFileInput
          onFilesChange={handleFilesChange}
          accept="*/*"
          maxFiles={1}
          maxSize={100 * 1024 * 1024}
          placeholder={t('artifact.uploadPlaceholder')}
          showPreview={true}
          multiple={false}
        />
        {state.tag === 'err' && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {state.error?.message || t('artifact.uploadError')}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            text={t('common.cancel')}
            onClick={onClose}
            disabled={isUploading}
          />
          <Button
            type="submit"
            variant="default"
            text={isUploading ? t('artifact.uploading') : t('artifact.upload')}
            disabled={!selectedFile || isUploading}
          />
        </div>
      </form>
    </Modal>
  );
}
