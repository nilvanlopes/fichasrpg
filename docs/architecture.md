# Organização do frontend

O frontend se organiza por funcionalidade e sistema de RPG. As regras de Mutantes
ficam em `systems/mutantes`; as de Vampiro, em `systems/vampiro`. As pastas
compartilhadas contêm código que os dois editores conseguem usar sem conhecer as
regras de nenhum jogo.

```text
src/
├── main.jsx
├── app/
│   ├── App.jsx                   # Escolha entre portal, cadastro e ficha
│   └── global.css                # Reset, tokens padrão e elementos básicos
├── features/
│   ├── portal/                   # Dashboard, cadastro, logos e estilos do portal
│   └── sheets/
│       ├── SheetRoute.jsx        # Resolve o sistema e entrega a ficha ao editor
│       ├── useRpgSheet.js        # Sessão, salvamento, conflitos e ações da ficha
│       ├── sheetFiles.js         # Formato JSON e validação de arquivos
│       └── sheetFiles.test.js
├── shared/
│   ├── api/client.js
│   ├── ui/                       # Campos controlados e seus estilos básicos
│   └── sheets/                   # Layout, toolbar, anotações e estilos comuns
└── systems/
    ├── registry.js              # Catálogo de definições, sem React
    ├── mutantes/
    │   ├── definition.js         # Identidade, assets e recuperação de ficha antiga
    │   ├── MutantesEditor.jsx
    │   ├── components/           # Páginas, painéis e campos próprios de Mutantes
    │   ├── useCalculatedValues.js
    │   ├── data.js
    │   ├── featsCatalog.js
    │   ├── additionalFeats.js
    │   ├── knightForm.js
    │   └── mutantes.css
    └── vampiro/
        ├── definition.js         # Identidade, assets e adaptador de importação v1
        ├── VampireEditor.jsx
        ├── components/           # Identidade, atributos, disciplinas e trilhas
        ├── data.js
        ├── data.test.js
        ├── legacyImport.js
        └── vampire.css
```

## Dependências

`app` monta as funcionalidades de `features`. A funcionalidade de fichas escolhe
o editor, carrega os dados e passa o objeto `sheet` ao sistema. O editor monta seus
componentes e usa o layout compartilhado para as ações comuns.

- `shared` pode importar outros módulos de `shared`. Não importa `app`, `features`
  ou `systems`.
- Um sistema pode importar `shared` e seus próprios módulos. Não importa outro
  sistema, `app` ou `features`.
- `features` pode consumir o catálogo, os editores e os adaptadores de sistemas.
  O catálogo mantém definições simples, sem importar editores ou hooks React.
- Testes de um sistema podem testar sua integração com o formato comum de arquivos.

`test/architecture.test.js` verifica esses limites e a resolução dos imports.
O backend continua independente do código do navegador.

## Reutilização de componentes

| Componente | Local | Critério |
| --- | --- | --- |
| `LineField`, `TextField`, `CheckField` | `shared/ui` | Recebem valor e callback, sem conhecer o jogo |
| `SheetEditorLayout` | `shared/sheets` | Loading, erros, conflitos e bloqueio dos campos |
| `Toolbar` | `shared/sheets` | Ações comuns; aceita ações adicionais do editor |
| `SheetNotesDialog` | `shared/sheets` | Edição de anotações com tema por classe CSS |
| `SystemLogo` | `features/portal` | Apresentação dos sistemas no dashboard |
| `NumericFields`, `PageOnePanels`, `FeatsPanel` | `systems/mutantes/components` | Formato e apresentação da ficha de Mutantes |
| `DotRating`, `StateTrack`, `VampirePanel` | `systems/vampiro/components` | Marcações, ciclos e apresentação da ficha de Vampiro |

Um componente pode ser reutilizado dentro de seu sistema. Só vai para `shared`
quando tiver uso comum e uma interface que não dependa de regras ou apresentação
de um jogo. O fato de dois painéis terem um título não exige uma abstração comum.

## Estilos e assets

Os estilos ficam próximos de quem os usa: campos em `shared/ui/form-fields.css`,
ações e layout comum em `shared/sheets/sheets.css`, portal em `features/portal` e
fichas em seus sistemas. Os seletores de Mutantes ficam sob `.mutantes-root`;
Vampiro usa `.vampire-root` e `.vampire-notes-dialog`. As variáveis CSS permitem
que cada sistema defina papel, tinta e foco.

```text
public/assets/
├── portal/favicon.svg
└── systems/
    ├── mutantes/                 # Capa, logo e favicon
    └── vampiro/                  # Capa, favicon, images/ e fonts/ com licenças

docs/reference/
├── mutantes/                     # Duas páginas usadas como referência visual
└── vampiro/                      # Imagens da implementação antiga sem uso na UI
```

Assets publicados usam URLs a partir de `/assets/`. As definições dos sistemas
declaram as capas e logos usados pelo portal. Fontes e molduras usadas pelo CSS
ficam no diretório do respectivo sistema. Material de referência fica fora de
`public`, pois não precisa acompanhar a aplicação publicada.

## Adicionar um sistema

1. Criar `systems/<id>/` com `definition.js`, editor, componentes, dados e CSS.
   Manter os identificadores dos campos estáveis, pois são persistidos em JSON.
2. Definir `id`, `label`, `shortLabel`, `nameField`, `cover` e `logo`. Se necessário,
   fornecer `importLegacyForm` para arquivos antigos e `readLegacyForm` para
   recuperação local. Registrar a definição em `systems/registry.js`.
3. Registrar o editor em `features/sheets/SheetRoute.jsx`. Ele recebe `sheet` e usa
   `SheetEditorLayout`; não implementa outro fluxo de sessão ou salvamento.
4. Colocar os assets em `public/assets/systems/<id>/` e delimitar o CSS do sistema.
   O dashboard usa o catálogo para apresentar o novo sistema.
5. Adicionar o ID à validação de `server/app.js` e migrar a restrição
   `sheets_system_check` de PostgreSQL em `server/schema.sql`.
6. Verificar importação e exportação, regras próprias, visual em celular e impressão.

`npm run test:unit` verifica os limites de imports, o formato de arquivos e os
campos de Vampiro. `npm run build` valida a montagem do frontend. `npm test` inclui
a integração da API e exige o banco dedicado `fichasrpg_test`, conforme o README.
