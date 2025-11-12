import { Label } from '~/src/ui/label';
import { ArtifactsInput, type ArtifactsInputProps } from './artifacts-input';

export type ArtifactsFieldProps = ArtifactsInputProps & {
  label: string;
};

/**
 * A field component that wraps ArtifactsInput with a label.
 * Supports read-only mode by passing the readOnly prop to ArtifactsInput.
 */
export function ArtifactsField({ label, ...artifactsInputProps }: ArtifactsFieldProps) {
  return (
    <div className="flex flex-col gap-4">
      <Label>{label}</Label>
      <ArtifactsInput {...artifactsInputProps} />
    </div>
  );
}
