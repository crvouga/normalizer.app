import type { AsyncComboboxOption } from '~/src/ui/combobox/async-combobox';
import { IconCheck } from '~/src/ui/icons';
import { Typography } from '~/src/ui/typography';
import { toI18nText } from '~/src/i18n/types';
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
        <Typography weight={selected ? 'semibold' : 'normal'} text={option.label} />
        {option.metadata?.type ? (
          <Typography variant="xs" color="muted" text={toI18nText(String(option.metadata.type))} />
        ) : null}
      </div>
      {selected && <IconCheck className="text-fuchsia-600" />}
    </div>
  );
}
