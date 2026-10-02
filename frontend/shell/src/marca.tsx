import { cn } from '@carteira/ui';

/**
 * Marca Porto Bank (POC): wordmark em texto com as cores dos tokens do DESIGN — nenhum hex literal
 * (o teste `design.test.ts` proíbe cor fora dos tokens) e nenhum ativo externo (o Apps Script recebe
 * tudo embutido). Quando o banco enviar o SVG oficial, basta trocar o conteúdo deste componente.
 */
export function MarcaPortoBank({ sobre = 'sidebar', className }: { sobre?: 'sidebar' | 'claro'; className?: string }) {
  const escuro = sobre === 'sidebar';
  return (
    <span className={cn('flex items-center gap-2', className)} role="img" aria-label="Porto Bank">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary text-heading-sm font-bold"
      >
        P
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn('truncate text-heading-sm font-bold tracking-tight', escuro ? 'text-sidebar-foreground' : 'text-foreground')}>
          Porto Bank
        </span>
        <span className={cn('truncate text-caption', escuro ? 'text-sidebar-muted' : 'text-muted-foreground')}>
          Gestão de Carteira
        </span>
      </span>
    </span>
  );
}
