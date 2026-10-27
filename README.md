# Fichas de RPG

Portal único para as fichas de Vampiro: A Máscara e Mutantes & Malfeitores.
O frontend usa React e Vite; a API usa Node.js, Express e PostgreSQL. Uma conta
Authentik pode criar várias fichas em cada sistema.

Repositório: [nilvanlopes/fichasrpg](https://github.com/nilvanlopes/fichasrpg).
O projeto foi renomeado de `fichaMutantes`, preservando seu histórico Git.
No repositório Docker, o submódulo fica em `fichasrpg/`.

## Organização

- `src/app/`: entrada da aplicação, rotas e estilos globais.
- `src/features/portal/`: lista de fichas, cadastro e apresentação dos sistemas.
- `src/features/sheets/`: abertura, persistência, importação e exportação de fichas.
- `src/systems/mutantes/` e `src/systems/vampiro/`: editor, componentes, dados,
  regras e estilos de cada sistema.
- `src/shared/ui/`: campos de formulário usados pelos dois sistemas.
- `src/shared/sheets/`: layout do editor, menu de ações e janela de anotações.
- `src/shared/api/`: cliente HTTP compartilhado.
- `public/assets/portal/` e `public/assets/systems/<sistema>/`: assets publicados.
- `docs/reference/`: imagens de referência e material visual da implementação antiga.
- `server/`: API, cadastro e esquema PostgreSQL compartilhados.
- `docker-compose.yml`: serviços web, API e banco.

O [guia de arquitetura](docs/architecture.md) explica os limites de cada pasta,
quais componentes são reutilizáveis e como adicionar um sistema.

Stack, banco, volume, rede e secret usam o nome `fichasrpg`.

O botão Sair usa `/api/logout`, que redireciona ao outpost da URL definida em
`AUTHENTIK_FICHASRPG_APP_URL`. O provedor Proxy do Fichas RPG usa
`fichasrpg-invalidation-flow`: primeiro o estágio User Logout encerra a sessão
do Authentik; depois um Redirect abre `/outpost.goauthentik.io/start` no domínio
do portal, iniciando um novo login na tela personalizada sem renderizar a home.
O parâmetro fixo `rd` guarda a home como destino após autenticar. A configuração
fica salva no banco do Authentik e pode ser ajustada pelo painel administrativo, nos fluxos
e no provedor `fichamutantes-forward-auth`.

## Desenvolvimento

O ambiente local usa Docker Swarm. Execute na pasta do projeto:

```bash
make dev
make dev-logs      # interface
make dev-api-logs  # API
make dev-stop
```

O ambiente precisa do `.env` (copie `.env.example`), das redes `traefik-local`
e `fichasrpg_database`, além do secret `fichasrpg_db_password`. O
serviço de API carrega desse arquivo as configurações de cadastro e OAuth; a
interface Vite encaminha `/api` para essa API. A URL local é
`http://fichasrpg.localnetwork`.

O campo “Desenho do personagem” usa o Floci em uma rede Swarm privada. Prepare
o bucket antes de publicar uma versão que inclua upload de desenhos:

```bash
make deploy-floci
make setup-floci-drawings
make deploy-fichasrpg
```

O bucket de desenhos não tem leitura pública. A API autentica cada leitura,
upload e remoção e verifica se a ficha pertence à conta da sessão.

## Cadastro e sessão

O cadastro aberto fica em `/cadastro`, também acessível pelo link Cadastre-se
na tela de login. O formulário usa o fluxo dedicado `fichasrpg-enrollment`,
que cria contas externas inativas, com caminho `users/fichasrpg` e somente o
grupo `fichasrpg-users`. O e-mail de confirmação ativa a conta. Convites antigos
que apontam para `/cadastro?itoken=...` abrem o mesmo cadastro público.

O login e os links de cadastro usam `login-fichasrpg.nilvanlopes.com`,
servido pelo Authentik existente com a brand Fichas RPG.
Continuar com Google usa o OAuth nativo do Authentik. Uma conta nova com e-mail
verificado ganha somente `fichasrpg-users`; uma conexão Google existente é
reutilizada e recebe acesso às fichas, preservando suas permissões anteriores.
O retorno é para o FichasRPG. Fora desse contexto, o Google continua sem cadastro
aberto e os logins existentes mantêm o retorno do Foundry. Se o e-mail verificado
pelo Google corresponder a uma única conta ativa, o Google é vinculado a ela,
preservando senha, UID, fichas e permissões anteriores. Contas inativas ou
endereços compartilhados por múltiplas contas são recusados.

Para provisionar os fluxos no Authentik local, execute na raiz do repositório
Docker `python3 authentik/fichasrpg-signup/configure.py --apply`. As regras e os
testes estão documentados em `authentik/fichasrpg-signup/README.md`.

O token para consultar duplicidades fica em `fichasrpg/.env`, ignorado pelo
Git e pelo build Docker. Copie `.env.example` para um novo ambiente. As
credenciais Google do cliente FichasRPG nesse arquivo são usadas somente pelo
provisionador da source `google-fichasrpg`, separada da source do Foundry.
Seu callback autorizado é
`https://login-fichasrpg.nilvanlopes.com/source/oauth/callback/google-fichasrpg/`.
O backend das fichas não recebe essas credenciais nem troca tokens OAuth. A sessão é confirmada pelo outpost
e a API usa o UID recebido dele como dono dos registros.

## Dados e migração

`server/schema.sql` cria o esquema atual com múltiplas fichas por conta,
identificadas por UUID e sistema. A conversão do banco antigo já foi aplicada;
o início da API preserva os registros existentes e cria tabelas ausentes.

A ficha de Vampiro usa componentes React e os mesmos campos controlados,
menu de ações e fluxo de persistência de Mutantes. Os painéis se reorganizam
em uma coluna no celular; as marcações e trilhas também funcionam pelo teclado.
O tema é salvo junto com os dados da ficha.
As trilhas de Vitalidade, Força de Vontade, Fome e Humanidade usam SVG inline
para desenhar os estados (vazio, traço, cruzado e preenchido), sem trocar imagens.
Os círculos de graduação são checkboxes independentes com preenchimento completo.

Cada bloco de Disciplinas agrupa o nome, os pontos e cinco linhas de poderes.
Clicar em qualquer parte de um bloco sem poderes abre a seleção de disciplinas,
mesmo quando o nome da disciplina já está preenchido;
escolher uma disciplina mostra seus poderes, organizados por nível. Clicar em
uma linha vazia permite adicionar um poder. Clicar em um poder preenchido abre
um card junto ao clique com descrição, custo, parada de dados, sistema, duração
e outras regras disponíveis na planilha. O card permite trocar ou remover o poder,
fecha com Escape ou clique fora e se ajusta às bordas da tela. O seletor impede
poderes repetidos no mesmo bloco e mantém os nomes já importados de fichas antigas.
Trocar a disciplina limpa os poderes e os pontos apenas daquele bloco.

Em Thin-Blood Alchemy, **Mimic Discipline** abre as disciplinas que podem ser
imitadas neste portal: poderes dos níveis 1 a 4, sem Blood Sorcery nem a própria
Alquimia. O nível da fórmula copiada é o nível do poder de origem mais um.
Cada fórmula, nativa ou imitada, exige escolher **Athanor Corporis**, **Fixatio**
ou **Calcinatio** antes de salvar. A mesma fórmula pode ser aprendida em métodos
diferentes; a combinação de poder, origem e método não se repete no mesmo bloco.
O card de uma cópia mostra a indicação **Copied via Thin-Blood Alchemy**, sua
origem, o nível da fórmula e o método aprendido. Fórmulas antigas sem método
continuam acessíveis e têm a ação **Definir método**; depois, **Alterar método**
permite ajustá-lo. Método e origem acompanham o salvamento e o JSON exportado,
nos campos `<poder>-distillation`, `<poder>-mimic-discipline` e
`<poder>-mimic-power`. Remover ou substituir um poder limpa os metadados anteriores.

O catálogo contém as 11 disciplinas e os 95 poderes da
[planilha de referência](https://docs.google.com/spreadsheets/d/1ln-mxkyH1L_ekIYoQHNW1LXe2N-K_l2ELBTTHL3Fh90/edit?gid=766982432),
com os nomes em inglês e os níveis informados na origem. O arquivo
`server/data/vampire-disciplines.json` é importado para as tabelas
`vampire_disciplines` e `vampire_discipline_powers` ao iniciar a API, na mesma
transação da inicialização. A importação pode ser repetida sem duplicar os registros.
O endpoint autenticado `GET /api/systems/vampiro/disciplines` entrega esse catálogo.
Para atualizar os dados, exporte a mesma aba como CSV e execute
`python3 server/import-vampire-catalog.py caminho/disciplinas.csv`; o script importa
nomes, níveis, descrição, regras e a referência de fonte.
Reinicie a API para aplicar o catálogo atualizado ao banco.

O visual de Vampiro segue a [ficha de referência](https://fichavampiro.netlify.app/):
moldura e logotipo, tipografia, três colunas e tabelas compactas. Em telas pequenas,
os grupos se reorganizam para leitura e preenchimento. A impressão usa uma página
A4 para os dados do personagem. O botão **Anotações**, no menu de ações, abre um
editor separado e mantém o salvamento no mesmo campo da ficha. As fontes ficam em
`public/assets/systems/vampiro/fonts/`, com suas licenças SIL Open Font License.

No menu de ações, **Importar** aceita o JSON atual e arquivos da ficha antiga.
**Nova ficha**, disponível nos dois sistemas, abre um rascunho vazio do sistema
atual. Havendo alterações ainda não salvas, pede confirmação antes de sair.
O novo registro é criado no banco somente ao clicar em **Salvar**.
Os botões **Desfazer** e **Refazer** ficam desabilitados quando não há uma ação
disponível. Os atalhos são **Ctrl+Z** e **Ctrl+Y** (também **Ctrl+Shift+Z** e os
equivalentes com Command no Mac). O histórico guarda até 100 ações nesta sessão,
agrupa a digitação contínua e as alterações de vários campos feitas em um clique,
e permanece disponível depois de salvar. Uma nova edição descarta a sequência de
refazer. Recarregar, abrir outra ficha, importar uma ficha independente ou mudar
de conta reinicia o histórico. As alterações desfeitas ou refeitas usam o mesmo
salvamento da ficha; os rascunhos só são gravados ao clicar em **Salvar**.
Na importação da v1, o histórico acumulado é consolidado pelo último valor de cada
campo, e os índices antigos de Fome e Humanidade são convertidos para as marcações
exibidas na ficha. A importação cria uma ficha independente na conta.
**Exportar** gera o formato compartilhado do portal, com versão, sistema, nome
e campos. Os identificadores existentes dos campos são preservados no banco.

`npm run test:unit` verifica os arquivos e o mapeamento dos campos de Vampiro.
`npm test` também executa a integração com PostgreSQL; configure as variáveis
de conexão para um banco dedicado chamado `fichasrpg_test` (os testes limpam
apenas esse banco).

## API

Configure `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD_FILE` ou `DB_PASSWORD`,
`PUBLIC_ORIGIN` e `AUTHENTIK_AUTH_URL`. Para o cadastro, também são necessárias
`AUTHENTIK_BASE_URL` e `AUTHENTIK_API_TOKEN`. O fluxo de cadastro é
`fichasrpg-enrollment` (`AUTHENTIK_FICHASRPG_ENROLLMENT_FLOW_SLUG`).
`AUTHENTIK_FICHASRPG_APP_URL` define a URL pública para o retorno do Google.

Para iniciar a API, use `npm start`. Para gerar a interface de produção, use
`npm run build`.

## Prévia dos links

O `index.html` inclui os metadados [Open Graph](https://ogp.me/) e Twitter Card
com título, descrição e imagem JPEG de 1200 × 630. A imagem publicada fica em
`public/assets/portal/social-preview-v2.jpg`; seu original editável está em
`docs/branding/social-preview.svg`. Ao trocar a imagem, use um novo nome e
atualize os metadados e a rota para evitar o cache dos arquivos estáticos.

A raiz `/` e `/index.html` mostram uma landing page pública, inclusive para
quem já está autenticado. Ela apresenta os sistemas e oferece **Entrar**, que
leva a `/fichas`, e **Criar conta**, que leva a `/cadastro`. Os metadados de
compartilhamento estão no HTML estático da landing, sem depender de JavaScript
ou do User-Agent do leitor do link.

A aplicação valida a sessão antes de entregar o portal em `/fichas` ou uma
ficha em `/sistemas/…`. Sem sessão, responde HTTP 302 para
`/outpost.goauthentik.io/start`, preservando o caminho e a consulta como destino
após o login. O cadastro em `/cadastro` e os arquivos de `/assets/` permanecem
públicos. O login Google do cadastro retorna ao portal em `/fichas`.

O Traefik mantém três rotas: portal, sessão e login. Ele apenas encaminha as
requisições, com CrowdSec. O Nginx encaminha as páginas e APIs ao backend.
O backend responde com `X-Accel-Redirect` para `/_landing.html` na entrada
pública e para `/_portal.html` depois de autorizar o portal ou uma ficha.
Esses caminhos internos entregam os HTMLs do Nginx e não aceitam acesso direto.
Não há cópia do frontend dentro da API.
O HTML usa `Cache-Control: no-store`, com variação por cookie; arquivos com
nome versionado continuam com cache público.

A mesma validação de sessão atende às páginas e às APIs: consulta o outpost,
confere `fichasrpg-users` e identifica a conta pelo UID. As APIs privadas
continuam respondendo HTTP 401 em JSON quando a sessão falta ou expira.
O frontend também trata esse caso durante o uso. Cabeçalhos de identidade
enviados pelo cliente não autenticam requisições.

As rotas ficam somente em `../traefik/infra/traefik/dynamic/fichasrpg.yml`.
Depois do deploy, valide sem cookies:

```bash
curl -I https://fichasrpg.nilvanlopes.com/
curl -I https://fichasrpg.nilvanlopes.com/fichas
curl -I https://fichasrpg.nilvanlopes.com/cadastro
curl -I https://fichasrpg.nilvanlopes.com/assets/portal/social-preview-v2.jpg
curl -i https://fichasrpg.nilvanlopes.com/api/session
```

Os resultados esperados são 200 para a landing, cadastro e imagem, 302 para
`/fichas` sem sessão e 401 em JSON para a API. Valide também login, acesso à
página original e logout. A recuperação de callback expirado no Traefik aponta
para `/fichas`, para iniciar uma autenticação nova em vez de abrir a landing.
