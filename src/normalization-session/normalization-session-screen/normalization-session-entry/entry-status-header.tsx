import { useI18n } from '~/src/i18n/use-i18n';
import { Typography } from '~/src/ui/typography';

export const EntryStatusHeader = (props: { icon: React.ReactNode; textKey: string }) => {
  const { t } = useI18n();

  return (
    <div className="mb-4 flex items-center gap-3">
      {props.icon}
      <Typography
        variant="sm"
        color="primary"
        weight="medium"
        as="p"
        text={t(props.textKey as any)}
      />
    </div>
  );
};
