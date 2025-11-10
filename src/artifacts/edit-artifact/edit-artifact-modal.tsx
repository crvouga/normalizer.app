import { type FormEvent, useEffect, useState } from 'react';
import { isOk, type Result } from '~/src/lib/result';
import { Modal } from '~/src/ui/modal';
import { ModalActions } from '~/src/ui/modal-actions';
import { TextField } from '~/src/ui/text-field/text-field';
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

  const { editArtifact, isEditing, state } = useEditArtifact({
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
        name: artifactName || undefined,
      });
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('artifact.editDialogTitle')} size="2xl">
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
        {state.tag === 'err' && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {state.error?.message || t('artifact.editError')}
          </div>
        )}
        <ModalActions
          cancelText={t('common.cancel')}
          onCancel={handleClose}
          cancelDisabled={isEditing}
          submitText={isEditing ? t('artifact.saving') : t('artifact.save')}
          submitDisabled={isEditing}
        />
      </form>
    </Modal>
  );
}
