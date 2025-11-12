import type { AsyncComboboxOption } from '~/src/ui/combobox/async-combobox';
import { IconCheck } from '~/src/ui/icons';
import { Typography } from '~/src/ui/typography';
import type { ArtifactId } from '../artifact-id';

export interface ArtifactOptionItemProps {
  option: AsyncComboboxOption<ArtifactId>;
  selected: boolean;
}

/**
 * Renders an individual artifact option in the combobox dropdown.
 * Displays the artifact name, type, and a checkmark if selected.
 */
export function ArtifactOptionItem({ option, selected }: ArtifactOptionItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <Typography weight={selected ? 'semibold' : 'normal'}>{option.label}</Typography>
        {option.metadata?.type ? (
          <Typography variant="xs" color="muted">
            {String(option.metadata.type)}
          </Typography>
        ) : null}
      </div>
      {selected && <IconCheck className="text-fuchsia-600" />}
    </div>
  );
}
