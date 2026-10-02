// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Aviso, Botao, EstadoErro, EstadoVazio, Kpi, Selo, TabelaDados, dataBR, dataHoraBR, inteiro, moeda, moedaCompacta, percentual, SemPermissao } from '../src';

afterEach(cleanup);

describe('formatação pt-BR', () => {
  it('moeda, compacta, inteiro, percentual e datas', () => {
    expect(moeda(1234567.89).replace(/ /g, ' ')).toBe('R$ 1.234.567,89');
    expect(moedaCompacta(2130701600.98).replace(/ /g, ' ')).toMatch(/^R\$ 2,13 bi/);
    expect(inteiro(1234567)).toBe('1.234.567');
    expect(percentual(0.9375)).toBe('93,8%');
    expect(percentual(1.2, 0)).toBe('120%');
    expect(dataBR('2026-11-05')).toBe('05/11/2026');
    expect(dataBR(null)).toBe('—');
    expect(dataHoraBR('2026-11-05T15:30:00.000Z')).toMatch(/05\/11\/2026,? 12:30/);
    expect(dataHoraBR(undefined)).toBe('—');
  });
});

describe('componentes do design system', () => {
  it('Botão: pill, padding 8px 16px, alvo ≥ 40px e variantes do DESIGN', () => {
    render(<><Botao>Primário</Botao><Botao variante="secundario">Secundário</Botao><Botao variante="escuro">Escuro</Botao></>);
    const p = screen.getByRole('button', { name: 'Primário' });
    expect(p.className).toMatch(/rounded-pill/);
    expect(p.className).toMatch(/px-4/);
    expect(p.className).toMatch(/py-2/);
    expect(p.className).toMatch(/min-h-10/);
    expect(p.className).toMatch(/bg-primary/);
    expect(screen.getByRole('button', { name: 'Secundário' }).className).toMatch(/border-primary/);
    expect(screen.getByRole('button', { name: 'Escuro' }).className).toMatch(/bg-brand-dark-900/);
  });

  it('Botão asChild mantém a aparência em links e respeita disabled', () => {
    const aoClicar = vi.fn();
    render(<><Botao asChild><a href="#/x">Ir</a></Botao><Botao disabled onClick={aoClicar}>Bloqueado</Botao></>);
    expect(screen.getByRole('link', { name: 'Ir' }).className).toMatch(/rounded-pill/);
    fireEvent.click(screen.getByRole('button', { name: 'Bloqueado' }));
    expect(aoClicar).not.toHaveBeenCalled();
  });

  it('Selo semântico nunca depende só da cor: crítico/atenção/informativo trazem ícone e texto', () => {
    const { container } = render(<><Selo variante="critico">Acima do limite</Selo><Selo variante="atencao">Vaga</Selo><Selo variante="informativo">Agendada</Selo><Selo variante="tag">Cobertura temporária</Selo></>);
    expect(container.querySelectorAll('svg')).toHaveLength(3); // a tag não tem ícone; os três semânticos têm
    expect(screen.getByText('Acima do limite')).toBeTruthy();
    expect(screen.getByText('Cobertura temporária').className).toMatch(/text-primary-press/); // correção de contraste NC-DS-6
    expect(screen.getByText('Cobertura temporária').className).toMatch(/rounded-pill/);
  });

  it('Aviso usa role=alert só quando crítico e rótulo textual', () => {
    render(<><Aviso variante="critico" titulo="Falhou">Erro</Aviso><Aviso titulo="Info">ok</Aviso></>);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('Kpi mostra valor com tnum e variante em destaque', () => {
    render(<Kpi rotulo="Clientes ativos" valor="348" dica="AUM médio" />);
    const cartao = screen.getByLabelText('Clientes ativos');
    expect(within(cartao).getByText('348').className).toMatch(/tnum/);
    render(<Kpi destaque rotulo="AUM total" valor="R$ 2 bi" />);
    expect(screen.getByLabelText('AUM total').className).toMatch(/bg-brand-dark-900/);
  });

  it('Estados: vazio, erro com retentativa e sem permissão', () => {
    const tentar = vi.fn();
    render(<><EstadoVazio titulo="Nada aqui">Ajuste os filtros</EstadoVazio><EstadoErro mensagem="falhou" aoTentar={tentar} /><SemPermissao /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(tentar).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert').textContent).toContain('falhou');
    expect(screen.getByText('Sem permissão para esta visão')).toBeTruthy();
  });
});

describe('TabelaDados (TanStack Table v8)', () => {
  interface Linha { nome: string; aum: number }
  const dados: Linha[] = [{ nome: 'Beta', aum: 200 }, { nome: 'Alfa', aum: 100 }, { nome: 'Gama', aum: 300 }];
  const colunas = [
    { accessorKey: 'nome', header: 'Nome', meta: { rotulo: 'Nome' } },
    { accessorKey: 'aum', header: 'AUM', cell: ({ getValue }: { getValue: () => number }) => moeda(getValue()), meta: { numerica: true, rotulo: 'AUM' } },
  ];

  it('ordena, filtra, alterna colunas e usa tnum nas células numéricas', () => {
    render(<TabelaDados colunas={colunas} dados={dados} rotulo="Teste" tamanhoPagina={2} />);
    const tabela = screen.getByRole('table', { name: 'Teste' });
    const nomes = (): string[] => within(tabela).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]!.textContent ?? '');
    expect(nomes()).toEqual(['Beta', 'Alfa']); // paginação de 2
    fireEvent.click(screen.getByRole('button', { name: /Nome/ }));
    expect(nomes()).toEqual(['Alfa', 'Beta']); // ordenado asc
    expect(within(tabela).getAllByRole('cell')[1]!.className).toMatch(/tnum/);
    fireEvent.change(screen.getByLabelText('Buscar em Teste'), { target: { value: 'gam' } });
    expect(nomes()).toEqual(['Gama']);
    fireEvent.change(screen.getByLabelText('Buscar em Teste'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhum registro encontrado')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar em Teste'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Colunas' }));
    fireEvent.click(screen.getByLabelText('AUM'));
    expect(within(screen.getByRole('table', { name: 'Teste' })).queryByText('AUM')).toBeNull();
  });

  it('paginação e clique/teclado na linha', () => {
    const aoClicar = vi.fn();
    render(<TabelaDados colunas={colunas} dados={dados} rotulo="Pag" tamanhoPagina={2} aoClicarLinha={aoClicar} />);
    expect(screen.getByText(/1–2 de 3/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(screen.getByText(/3–3 de 3/)).toBeTruthy();
    const linha = screen.getAllByRole('row')[1]!;
    fireEvent.keyDown(linha, { key: 'Enter' });
    expect(aoClicar).toHaveBeenCalledWith(dados[2]);
  });
});
