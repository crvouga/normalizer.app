import { type FormEvent, useEffect, useState } from 'react';
import { isOk, type Result } from '~/src/lib/result';
import { Modal } from '~/src/ui/modal';
import { ModalActions } from '~/src/ui/modal-actions';
import { TextField } from '~/src/ui/text-field/text-field';
import { TabularFileList } from '~/src/ui/tabular-file-input/tabular-file-list';
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
  const [showPreview, setShowPreview] = useState<Record<number, boolean>>({
    0: true,
  });

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

        {/* Read-only file display */}
        {tabularFiles.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('artifact.fileLabel') || 'File'}
            </div>
            <div className="[&_.flex.items-center.justify-end]:hidden [&_button:has(svg)]:hidden">
              <TabularFileList
                files={tabularFiles}
                showPreview={true}
                showPreviews={showPreview}
                onTogglePreview={(index) => {
                  setShowPreview((prev) => ({
                    ...prev,
                    [index]: !prev[index],
                  }));
                }}
                onRemoveFile={() => {}}
                onClearAll={() => {}}
              />
            </div>
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
