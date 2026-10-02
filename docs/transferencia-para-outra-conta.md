# Transferir o app para outra conta Google

O app roda **100% dentro do Google Apps Script**: front (`index.html`), backend (`backend.js`) e dados (uma planilha do Google). Não depende deste computador, do repositório, de Node, de projeto Google Cloud, de service account nem de nenhum serviço externo (as fontes e o CSS vão embutidos no HTML).

## O que o projeto tem dentro
| Arquivo no Apps Script | Função |
|---|---|
| `index.html` | front completo (React compilado, estilos e fontes embutidos) |
| `backend.js` | regras de negócio: posições, delegação, acesso, redistribuição, insights, dados de demonstração |
| `Codigo.js` | `doGet` (abre o app), `apiChamar` (liga front e backend), `planilhaId` / `instalar` (autoinstalação), homologação |
| `rules.js`, `schema.js` | regras e esquema usados na homologação da planilha |
| `appsscript.json` | configuração do web app e permissões |

## Passo a passo (conta de destino)
1. **Levar o projeto**, de um destes modos:
   - **Fazer uma cópia** (recomendado): abra o projeto → ⋮ ao lado do nome → *Fazer uma cópia*; depois compartilhe a cópia com a conta nova ou baixe/copie os arquivos para um projeto novo; **ou**
   - **Transferir a propriedade** do projeto no Google Drive (clique direito no arquivo do projeto → *Compartilhar* → tornar a conta nova **proprietária**).
2. Na conta nova, abra o projeto e rode **`instalar`** (▶ no editor, escolhendo a função `instalar`). Autorize quando o Google pedir. Isso **cria uma planilha nova** no Drive da conta nova, com as 15 abas e os dados sintéticos de demonstração, e registra o id nas propriedades do script. (Se você pular este passo, o app faz o mesmo sozinho na primeira abertura, e a primeira tela pode levar cerca de 30–60 segundos.)
3. **Implantar o web app**: *Implantar → Nova implantação → App da Web*; *Executar como*: **Eu**; *Quem tem acesso*: **Somente eu** (ou as pessoas que forem homologar). Abra a URL `/exec`.
4. Para ver os dados: rode `urlDaPlanilha` (o endereço aparece no log) ou abra a planilha pelo Drive. Para apontar o app para **outra planilha já existente** com as 15 abas: rode `usarPlanilha('ID_DA_PLANILHA')`.

## Pontos de atenção
- A planilha antiga (da conta de origem) **não é copiada**; o app da conta nova nasce com um cenário demo novo. Se quiser levar os dados, copie a planilha antiga (*Arquivo → Fazer uma cópia*) e use `usarPlanilha` com o id da cópia.
- O projeto tem um *fallback* para a planilha de homologação original; ele só é usado se a conta enxergar aquela planilha. Em qualquer outra conta, ela é ignorada e a autoinstalação cria uma nova.
- **Cache**: as leituras vêm de um cache de até 15 minutos. Se você editar as abas à mão, clique em **Recarregar da planilha** no topo do app.
- **Dados são sintéticos**; o papel e a data são simulados (não há login por usuário). Antes de usar dados reais, é preciso autenticação real e revisão de privacidade.
- O primeiro acesso de cada conta pede autorização dos escopos *Planilhas* e *e-mail*.

## Como regenerar os arquivos (quem mantém o código)
```bash
npm run gas:build          # gera backend.js e index.html
npm run apps-script:push   # envia para o Apps Script (clasp)
```
