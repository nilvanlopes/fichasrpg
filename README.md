# Fichas de RPG

Portal único para as fichas de Vampiro: A Máscara e Mutantes & Malfeitores.
O frontend usa React e Vite; a API usa Node.js, Express e PostgreSQL. Uma conta
Authentik pode criar várias fichas em cada sistema.

Repositório: [nilvanlopes/fichasrpg](https://github.com/nilvanlopes/fichasrpg).
O projeto foi renomeado de `fichaMutantes`, preservando seu histórico Git.
No repositório Docker, o submódulo fica em `fichasrpg/`.

## Organização

- `src/components/`: portal, cadastro e componentes de Mutantes & Malfeitores.
- `src/systems/vampiro/`: editor e estilos da ficha de Vampiro.
- `public/vampiro/`: imagens usadas pela ficha de Vampiro.
- `server/`: API, cadastro e migração PostgreSQL compartilhados.
- `docker-compose.yml`: serviços web, API e banco.

Stack, banco, volume, rede e secret usam o nome `fichasrpg`.

O botão Sair usa `/api/logout`, que redireciona ao outpost da URL definida em
`AUTHENTIK_FICHASRPG_APP_URL`. No provedor Proxy do Fichas RPG, selecione
`default-invalidation-flow` como fluxo de invalidação: esse fluxo deve conter
o estágio User Logout para encerrar também a sessão do Authentik.

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

## Cadastro e sessão

O cadastro por convite fica em `/cadastro?itoken=<convite>`. Os cadastros entram
no grupo `fichasrpg-users`; o grupo `foundry-users` continua separado. A sessão
é confirmada pelo outpost do Authentik e a API usa o UID recebido do outpost
como dono dos registros.

As credenciais de cadastro e Google ficam em `fichasrpg/.env`, ignorado pelo
Git e pelo build Docker. Para configurar um novo ambiente, copie `.env.example`
para `.env` e preencha o token do Authentik e, se necessário, as credenciais
Google. O comando `make deploy-fichasrpg`, na raiz do repositório Docker,
carrega esse arquivo. Use um cliente OAuth do tipo Aplicativo da Web e autorize
o URI `https://fichasrpg.nilvanlopes.com/api/oauth/google/callback` no Google.
O backend deriva esse callback da URL pública do portal, sem uma configuração
de redirecionamento separada.

## Dados e migração

`server/schema.sql` transforma o registro único antigo de Mutantes em uma ficha
identificada por UUID e `system = 'mutantes'`. Os dados e revisões existentes
são preservados no mesmo volume PostgreSQL. Novas fichas usam o mesmo formato
JSON, identificadas por `owner_uid`, sistema e ID próprio.

Vampiro mantém a estrutura visual da ficha anterior
([projeto original](https://github.com/nilvanlopes/fichaVampiro)). Na tela de edição, use
**Importar JSON antigo** e selecione o `ficha.json` exportado em
`fichavampiro.netlify.app`. A exportação continua no formato aceito pela ficha
antiga.

## API

Configure `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD_FILE` ou `DB_PASSWORD`,
`PUBLIC_ORIGIN` e `AUTHENTIK_AUTH_URL`. Para o cadastro, também são necessárias
`AUTHENTIK_BASE_URL`, `AUTHENTIK_API_TOKEN`, `AUTHENTIK_FICHASRPG_GROUP_NAME`,
`AUTHENTIK_FICHASRPG_USER_PATH` e, se habilitado, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`. `AUTHENTIK_FICHASRPG_APP_URL` define a URL pública
usada no cadastro e no callback do Google.

Para iniciar a API, use `npm start`. Para gerar a interface de produção, use
`npm run build`.
