# Cópia da planilha (dados sintéticos)

`gestao-carteira-bancaria-dados-sinteticos.xlsx` é uma exportação da planilha usada na homologação: 15 abas (370 clientes, 5 posições, delegações, metas, auditoria). Todos os dados são fictícios.

**Importar no Google Sheets do computador corporativo:** Drive → Novo → Upload de arquivo → abra o `.xlsx` → *Arquivo → Salvar como planilha do Google*. Copie o ID da URL.

**Apontar o Apps Script para ela:** no editor do Apps Script rode `usarPlanilha('<ID>')` e abra o app. As colunas de texto (datas, CPF/CNPJ) já vêm como texto; não reformate.

Alternativa sem o arquivo: `npm run sheets:carga` repopula qualquer planilha vazia, ou o próprio app a popula na primeira abertura.
