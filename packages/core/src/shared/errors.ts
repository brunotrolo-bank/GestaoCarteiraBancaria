export type CodigoErro =
  | 'OCUPACAO_SOBREPOSTA' | 'INTERVALO_INVALIDO' | 'POSICAO_COM_CARTEIRA' | 'GERENTE_INDISPONIVEL'
  | 'GERENTE_JA_ALOCADO' | 'POSICAO_INEXISTENTE' | 'POSICAO_EXTINTA' | 'GERENTE_INEXISTENTE' | 'PERFIL_INVALIDO'
  | 'TRANSICAO_INVALIDA' | 'EMAIL_DUPLICADO' | 'MOTIVO_OBRIGATORIO' | 'NAO_AUTORIZADO' | 'DADOS_INVALIDOS'
  | 'DATAS_INVALIDAS' | 'AUTO_DELEGACAO' | 'DELEGACAO_SOBREPOSTA' | 'DELEGACAO_TRANSITIVA' | 'DELEGACAO_INEXISTENTE'
  | 'ESTADO_INVALIDO' | 'DOCUMENTO_INVALIDO' | 'DOCUMENTO_DUPLICADO' | 'CLIENTE_INEXISTENTE' | 'CLIENTE_INATIVO'
  | 'POSICAO_DESTINO_INDISPONIVEL' | 'LOTE_VAZIO' | 'JUSTIFICATIVA_OBRIGATORIA' | 'LOTE_INEXISTENTE'
  | 'LOTE_JA_DESFEITO' | 'LOTE_NAO_DESFAZIVEL' | 'ACESSO_NEGADO' | 'ATOR_DESCONHECIDO';

/** Erro de regra de negócio com código estável (vira `codigo_dominio` na API — FR-API-003). */
export class DomainError extends Error {
  constructor(
    public readonly codigo: CodigoErro,
    mensagem: string,
    public readonly detalhe?: Record<string, unknown>,
  ) {
    super(mensagem);
    this.name = 'DomainError';
  }
}

export function exigir(condicao: unknown, codigo: CodigoErro, mensagem: string, detalhe?: Record<string, unknown>): asserts condicao {
  if (!condicao) throw new DomainError(codigo, mensagem, detalhe);
}
