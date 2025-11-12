import { type FormEvent, useEffect, useState } from 'react';
import { isOk, type Result } from '~/src/lib/result';
import { Modal } from '~/src/ui/modal';
import { ModalActions } from '~/src/ui/modal-actions';
import { TextField } from '~/src/ui/text-field/text-field';
import { TabularFileInputField } from '~/src/ui/tabular-file-input/tabular-file-input-field';
import type { TabularFile } from '~/src/ui/tabular-file-input/tabular-file';
import { useI18n } from '../../i18n/use-i18n';
import type { Artifact } from '../artifact';
import { useEditArtifact } from './use-edit-artifact';

export interface EditArtifactModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifact: Artifact | null;
  onEditComplete?: (artifact: Result<Artifact, Error>) => void;
}

export function EditArtifactModal({
  isOpen,
  onClose,
  artifact,
  onEditComplete,
}: EditArtifactModalProps) {
  const { t } = useI18n();
  const [artifactName, setArtifactName] = useState<string>('');

  // Initialize form with artifact data when modal opens
  useEffect(() => {
    if (artifact) {
      setArtifactName(artifact.name || artifact.filename || '');
    }
  }, [artifact]);

  // Convert artifact to TabularFile format
  const tabularFiles: TabularFile[] = artifact
    ? [
        {
          id: String(artifact.id),
          name: artifact.name || artifact.filename,
          downloadUrl: artifact.download_url || '',
          size: artifact.size,
          contentType: artifact.content_type,
        },
      ]
    : [];

  const { editArtifact, isEditing } = useEditArtifact({
    onEditComplete: (result) => {
      onEditComplete?.(result);
      if (isOk(result)) {
        onClose();
      }
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (artifact) {
      await editArtifact({
        artifactId: artifact.id,
        ...(artifactName ? { name: artifactName } : {}),
      });
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('artifact.editDialogTitle')}
      size="2xl"
      disabled={isEditing}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="artifact-name"
          type="text"
          label={t('artifact.nameLabel')}
          value={artifactName}
          onChange={(e) => setArtifactName(e.target.value)}
          placeholder={t('artifact.namePlaceholder')}
          disabled={isEditing}
        />

        <TabularFileInputField
          id="artifact-file"
          label={t('artifact.fileLabel') || 'File'}
          readOnly={true}
          files={tabularFiles}
        />

        <ModalActions
          cancelText={t('common.cancel')}
          onCancel={handleClose}
          cancelDisabled={isEditing}
          submitText={t('artifact.save')}
          submitLoading={isEditing}
        />
      </form>
    </Modal>
  );
}
