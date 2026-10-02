/** Validação e mascaramento de CPF/CNPJ (FR-CLI-001/012, Q-24: sempre mascarados). */

export function apenasDigitos(doc: string): string {
  return (doc ?? '').replace(/\D/g, '');
}

function digitoCpf(base: number[]): number {
  const soma = base.reduce((acc, n, i) => acc + n * (base.length + 1 - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function digitoCnpj(base: number[]): number {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.reduce((acc, n, i) => acc + n * pesos[i]!, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(doc: string): boolean {
  const d = apenasDigitos(doc);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = [...d].map(Number);
  return digitoCpf(n.slice(0, 9)) === n[9] && digitoCpf(n.slice(0, 10)) === n[10];
}

export function cnpjValido(doc: string): boolean {
  const d = apenasDigitos(doc);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = [...d].map(Number);
  return digitoCnpj(n.slice(0, 12)) === n[12] && digitoCnpj(n.slice(0, 13)) === n[13];
}

export function documentoValido(doc: string): boolean {
  const len = apenasDigitos(doc).length;
  return len === 11 ? cpfValido(doc) : len === 14 ? cnpjValido(doc) : false;
}

/** Gera CPF com dígitos verificadores válidos a partir de 9 dígitos-base. */
export function gerarCpf(base9: string): string {
  const n = [...base9].map(Number);
  const d1 = digitoCpf(n);
  const d2 = digitoCpf([...n, d1]);
  return `${base9}${d1}${d2}`;
}

/** Gera CNPJ com dígitos verificadores válidos a partir de 12 dígitos-base (8 raiz + 4 filial). */
export function gerarCnpj(base12: string): string {
  const n = [...base12].map(Number);
  const d1 = digitoCnpj(n);
  const d2 = digitoCnpj([...n, d1]);
  return `${base12}${d1}${d2}`;
}

/** Marcador de dado sintético: CPF iniciado por 999 e CNPJ cuja raiz inicia por 99999 (FR-DAD-009). */
export function ehDocumentoSintetico(doc: string): boolean {
  const d = apenasDigitos(doc);
  return (d.length === 11 && d.startsWith('999')) || (d.length === 14 && d.startsWith('99999'));
}

/** `***.456.789-**` / `**.***.678/0001-**`: nunca expõe o documento completo. */
export function mascararDocumento(doc: string): string {
  const d = apenasDigitos(doc);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.***.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return '***';
}
