import { cn } from '@carteira/ui';
import logoPortoBank from './ativos/PortoBank_logo.png';

/**
 * Marca Porto Bank (POC): logo oficial embutido como data URI no build (o Apps Script recebe tudo
 * embutido, sem URL externa). `sobre` ajusta o texto ao fundo (sidebar escura ou cartão claro).
 */
export function MarcaPortoBank({ sobre = 'sidebar', className }: { sobre?: 'sidebar' | 'claro'; className?: string }) {
  const escuro = sobre === 'sidebar';
  return (
    <span className={cn('flex items-center gap-2', className)} role="img" aria-label="Porto Bank">
      <img src={logoPortoBank} alt="" aria-hidden className="size-8 shrink-0 rounded-md" />
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
