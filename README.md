# Ficha Mutantes & Malfeitores

Aplicação web para preencher, imprimir e salvar fichas de Mutantes & Malfeitores. A interface usa React e Vite; a API usa Node.js, Express e PostgreSQL. Cada conta autenticada acessa sua própria ficha.

## Desenvolvimento

O ambiente local usa Docker Swarm. Execute na pasta do projeto:

```bash
make dev
make dev-logs      # interface
make dev-api-logs  # API
make dev-stop
```

O ambiente precisa das redes Docker `traefik-local` e `fichamutantes_database`, além do secret `fichamutantes_db_password`. A URL local depende da configuração do proxy.

## API

Configure `DB_HOST`, `DB_NAME`, `DB_USER` e uma das opções `DB_PASSWORD_FILE` ou `DB_PASSWORD`. A API também usa `PUBLIC_ORIGIN` e `AUTHENTIK_AUTH_URL` para validar a origem das requisições e a sessão do usuário.

Para iniciar a API, use `npm start`. Para gerar a interface de produção, use `npm run build`.

## Testes

```bash
npm test
```

Os testes de integração precisam de um PostgreSQL dedicado. Defina `DB_NAME=fichamutantes_test`; a suíte recusa outros nomes de banco.
