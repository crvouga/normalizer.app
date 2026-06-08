import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import { cn } from '~/src/lib/cn';
import { useTheme } from '~/src/ui/theme/use-theme';

SyntaxHighlighter.registerLanguage('sql', sql);

export const SqlCodeBlock = (props: { sql: string; compact?: boolean; dense?: boolean }) => {
  const { effectiveTheme } = useTheme();
  const dense = props.dense ?? false;

  return (
    <div
      className={cn(
        'overflow-hidden rounded border border-slate-200 dark:border-slate-700',
        props.compact && 'max-h-12',
      )}
    >
      <SyntaxHighlighter
        language="sql"
        style={effectiveTheme === 'dark' ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: dense ? '0.25rem 0.5rem' : '0.625rem 0.75rem',
          background: 'transparent',
          fontSize: dense ? '0.625rem' : '0.75rem',
          lineHeight: dense ? '0.875rem' : '1.25rem',
        }}
        codeTagProps={{
          className: 'font-mono',
        }}
        wrapLongLines={!props.compact}
      >
        {props.sql}
      </SyntaxHighlighter>
    </div>
  );
};
