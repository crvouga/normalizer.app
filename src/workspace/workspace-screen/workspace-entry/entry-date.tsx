import { formatDate } from '~/src/lib/date/format-date';

export const EntryDate = (props: { date: Date }) => {
  return (
    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(props.date)}</div>
  );
};
