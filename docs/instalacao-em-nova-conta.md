# Instalação em outra conta Google (outro computador)

Cenário: você baixa o repositório do GitHub no outro computador, **cria à mão** uma planilha e um projeto do Apps Script na conta nova, e o **Claude Code popula a planilha e atualiza o Apps Script**.

Dois caminhos; use o **A** (recomendado) quando quiser que o Claude faça a carga de dados e a publicação, ou o **B** se não quiser mexer com Google Cloud.

---
## Caminho A — o Claude popula a planilha e publica o Apps Script (recomendado)

### O que VOCÊ faz à mão (uma vez, na conta nova)
1. **Baixar o repositório:** `git clone https://github.com/brunotrolo/GestaoCarteiraBancaria` e abrir a pasta no Claude Code. Instalar o Node 24+ e rodar `npm install`.
2. **Criar a planilha** no Google Drive (vazia, qualquer nome). Copie o **ID** da URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.
3. **Criar o projeto Apps Script** em script.google.com → *Novo projeto* (independente, não "vinculado" à planilha). Copie o **ID do script** da URL: `https://script.google.com/home/projects/<ID_DO_SCRIPT>/edit`.
4. **Ativar a Apps Script API** da conta: https://script.google.com/home/usersettings → ligar *API do Google Apps Script*.
5. **Entrar nas ferramentas** com a conta nova (cada comando abre o navegador):
   - `npx clasp login`
   - `gcloud auth login` (instale o Google Cloud CLI se não tiver)

### O que o CLAUDE faz (peça: "instale o projeto na minha nova conta" e informe os dois IDs)
1. `npm run setup:conta -- --planilha <ID_DA_PLANILHA> --script <ID_DO_SCRIPT> --gcp <id-de-projeto-novo>`
   - cria um projeto Google Cloud **sem billing** (o id precisa ser único, por exemplo `carteira-poc-<suas-iniciais>`), habilita as APIs, cria uma *service account* **sem chave** e permite que o seu usuário aja como ela;
   - grava `config/ambiente.json`, aponta `apps-script/.clasp.json` e `PLANILHA_PADRAO` (em `apps-script/Codigo.js`) para os seus IDs.
2. **Você compartilha a planilha como Editor** com a service account impressa no final do passo anterior (`carteira-pipeline@<projeto>.iam.gserviceaccount.com`).
3. `npm run setup:conta -- --verificar` → confere a impersonation e o acesso à planilha (aguarde ~1 min se o IAM ainda estiver propagando).
4. `npm run sheets:carga` → **popula as 14 abas** com os dados sintéticos (idempotente; relê e valida por hash).
5. `npm run gas:build && npm run apps-script:push` → gera e **atualiza o Apps Script** (23 arquivos: backend por domínio + um HTML por micro-frontend).
6. Dentro de `apps-script/`: `npx clasp deploy --description "POC"` → abra a URL `/exec` com a conta nova e autorize os escopos na primeira vez.
7. `npm run sheets:homologar` → confere a planilha com o código do Apps Script (52 verificações).

Se o Google Workspace da conta nova bloquear a criação de projetos (política da organização), use o Caminho B.

---
## Caminho B — sem Google Cloud (a planilha é populada pelo próprio Apps Script)
1. Faça os passos 1–5 acima, **exceto** `gcloud auth login`.
2. Configure só o script: edite `apps-script/.clasp.json` (campo `scriptId`) e rode `npm run gas:build && npm run apps-script:push`.
3. Implante o web app (`npx clasp deploy` dentro de `apps-script/`) e **abra a URL**: se o app não achar a planilha configurada, ele **cria uma nova planilha na conta e a popula sozinho** (primeira abertura: 30–60 s). Ou rode a função `instalar` no editor do Apps Script. Para usar a planilha que você criou à mão (vazia): rode `usarPlanilha('<ID>')` no editor e abra o app — na primeira chamada ele **popula as 14 abas sozinho** (ou edite `PLANILHA_PADRAO` em `Codigo.js` antes do `gas:build`).

---
## Conferências úteis
- `npm run gas:smoke` — o backend do Apps Script em sandbox sem Node/Intl/URL (sem tocar na planilha).
- `npm run sheets:smoke` — grava pelo adaptador, relê e restaura o cenário (usa a planilha configurada).
- Planilha em uso pelo app: função `urlDaPlanilha` no editor do Apps Script.
- O cache do app dura 15 min; após editar a planilha à mão, use **Recarregar da planilha** no topo do app.

## Segurança
- Nenhuma chave é criada ou salva: a service account é usada só por *impersonation* com o seu login do gcloud.
- Dados são **sintéticos**; CPF/CNPJ aparecem sempre mascarados. Não coloque dados reais sem autenticação real e revisão de privacidade.
- `config/ambiente.json` contém apenas IDs (não são segredos), mas depois do setup ele aponta para a conta nova: faça o commit só se quiser que o repositório passe a apontar para ela.
