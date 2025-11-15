import { type FormEvent, useEffect, useRef, useState } from 'react';
import { isOk, type Result } from '~/src/lib/result';
import { Form } from '~/src/ui/form';
import { Modal } from '~/src/ui/modal';
import { ModalActions } from '~/src/ui/modal-actions';
import type { TabularFile } from '~/src/ui/tabular-file-input/tabular-file';
import { TabularFileInputField } from '~/src/ui/tabular-file-input/tabular-file-input-field';
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
  const [artifactState, setArtifactState] = useState<Artifact | null>(null);
  const [artifactName, setArtifactName] = useState<string>('');
  const [artifactFilename, setArtifactFilename] = useState<string>('');
  const prevArtifactRef = useRef<Artifact | null>(null);

  useEffect(() => {
    if (isOpen && artifact) {
      setArtifactState(artifact);
      prevArtifactRef.current = artifact;
    } else if (isOpen && !artifact && prevArtifactRef.current) {
      setArtifactState(prevArtifactRef.current);
    } else if (!isOpen) {
      prevArtifactRef.current = artifactState || artifact || null;
    }
  }, [isOpen, artifact, artifactState]);

  useEffect(() => {
    if (artifactState) {
      setArtifactName(artifactState.name || '');
      setArtifactFilename(artifactState.filename || '');
    }
  }, [artifactState?.id]);

  const tabularFiles: TabularFile[] = artifactState
    ? [
        {
          id: String(artifactState.id),
          name: artifactState.filename || artifactState.name || '',
          downloadUrl: artifactState.download_url || '',
          size: artifactState.size,
          contentType: artifactState.content_type,
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
    if (artifactState) {
      await editArtifact({
        artifactId: artifactState.id,
        ...(artifactName ? { name: artifactName } : {}),
        filename: artifactFilename,
      });
    }
  };

  const handleClose = () => {
    if (!isEditing) {
      onClose();
      setTimeout(() => setArtifactState(null), 250);
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
      {artifactState && (
        <Form onSubmit={handleSubmit} contentClassName="space-y-4">
          <TextField
            id="artifact-name"
            type="text"
            label={t('artifact.nameLabel')}
            value={artifactName}
            onChange={(e) => setArtifactName(e.target.value)}
            placeholder={t('artifact.namePlaceholder')}
            disabled={isEditing}
          />

          <TextField
            id="artifact-filename"
            type="text"
            label={t('artifact.filenameLabel')}
            value={artifactFilename}
            onChange={(e) => setArtifactFilename(e.target.value)}
            placeholder={t('artifact.filenamePlaceholder')}
            disabled={isEditing}
          />

          <TabularFileInputField
            id="artifact-file"
            label={t('artifact.fileLabel')}
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
        </Form>
      )}
    </Modal>
  );
}
