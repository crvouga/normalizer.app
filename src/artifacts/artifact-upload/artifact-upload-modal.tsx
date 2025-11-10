import { type FormEvent, useState } from 'react';
import { isOk, type Result } from '~/src/lib/result';
import { Modal } from '~/src/ui/modal';
import { ModalActions } from '~/src/ui/modal-actions';
import { TabularFileField } from '~/src/ui/tabular-file-input/tabular-file-field';
import { TextField } from '~/src/ui/text-field/text-field';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [artifactName, setArtifactName] = useState<string>('');

  const { uploadArtifact, isUploading } = useArtifactUpload({
    onUploadComplete: (result) => {
      onUploadComplete?.(result);
      if (isOk(result)) {
        setSelectedFile(null);
        setArtifactName('');
        onClose();
      }
    },
  });

  const handleFilesChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      // Pre-fill the artifact name with the filename
      setArtifactName(file.name);
    } else {
      setSelectedFile(null);
      setArtifactName('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      await uploadArtifact(selectedFile, artifactName || undefined);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('artifact.uploadDialogTitle')} size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TabularFileField
          label={t('artifact.fileLabel')}
          onFilesChange={handleFilesChange}
          accept="*/*"
          maxFiles={1}
          maxSize={100 * 1024 * 1024}
          placeholder={t('artifact.uploadPlaceholder')}
          showPreview={true}
          multiple={false}
        />
        <TextField
          id="artifact-name"
          type="text"
          label={t('artifact.nameLabel')}
          value={artifactName}
          onChange={(e) => setArtifactName(e.target.value)}
          placeholder={t('artifact.namePlaceholder')}
          disabled={isUploading}
        />
        <ModalActions
          cancelText={t('common.cancel')}
          onCancel={onClose}
          cancelDisabled={isUploading}
          submitText={isUploading ? t('artifact.uploading') : t('artifact.upload')}
          submitDisabled={!selectedFile || isUploading}
        />
      </form>
    </Modal>
  );
}
