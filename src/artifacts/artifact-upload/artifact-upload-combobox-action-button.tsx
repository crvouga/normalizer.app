import * as React from 'react';
import type { Result } from '~/src/lib/result';
import { ComboboxActionButton } from '~/src/ui/combobox/combobox-action-button';
import { UploadIcon } from '~/src/ui/icons';
import { useI18n } from '../../i18n/use-i18n';
import type { Artifact } from '../artifact';
import { ArtifactUploadModal } from './artifact-upload-modal';

export interface ArtifactUploadComboboxActionButtonProps {
  onUploadComplete?: (artifact: Result<Artifact, Error>) => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'contained';
}

/**
 * Button component that opens the ArtifactUploadModal for file uploads.
 */
export function ArtifactUploadComboboxActionButton({
  onUploadComplete,
  variant = 'outline',
}: ArtifactUploadComboboxActionButtonProps) {
  const { t } = useI18n();
  const [isModalOpen, setModalOpen] = React.useState(false);

  const handleButtonClick = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);

  return (
    <>
      <ComboboxActionButton
        onClick={handleButtonClick}
        disabled={isModalOpen}
        variant={variant}
        startIcon={<UploadIcon className="size-6 shrink-0" />}
        text={t('artifact.uploadButton')}
      />
      <ArtifactUploadModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        {...(onUploadComplete !== undefined ? { onUploadComplete } : {})}
      />
    </>
  );
}
