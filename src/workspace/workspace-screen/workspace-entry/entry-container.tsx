export const EntryContainer = (props: {
  variant: 'default' | 'success' | 'error';
  children: React.ReactNode;
}) => {
  const variantClasses = {
    default: 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
    success: 'border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    error: 'border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
  };

  return <div className={`rounded-lg p-6 ${variantClasses[props.variant]}`}>{props.children}</div>;
};
