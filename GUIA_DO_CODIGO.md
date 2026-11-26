# Guia do código

Este guia explica como as partes do aplicativo se conectam e onde procurar cada comportamento. Os nomes exibidos na interface estão em português; funções e objetos internos usam nomes curtos e consistentes para reduzir repetição.

## 1. Visão geral

O aplicativo tem dois lados:

1. **Navegador (`Index.html`)**: monta a interface, valida entradas simples, calcula indicadores e gráficos, e envia solicitações ao Apps Script.
2. **Apps Script (`Code.gs`)**: verifica a chave privada, lê ou grava dados nas abas da planilha, salva comprovantes no Drive e cria cópias de segurança.

O navegador não acessa a planilha diretamente. A comunicação usa `google.script.run`, encapsulada no cliente por `gasCall()`. Assim, as permissões de planilha e Drive pertencem à conta que publicou o aplicativo.

## 2. Arquivos

### `Index.html`

É a página inteira do Web App. O Apps Script precisa que o arquivo se chame `Index` no editor e que a página seja entregue como modelo HTML, pois `Code.gs` injeta `APP_ACCESS_KEY` antes de renderizar.

- `<head>`: idioma, escala para celular, cor do navegador e estilos.
- `<body>`: cabeçalho, seletor de pessoa, filtros, abas, áreas de conteúdo e janelas de edição.
- bloco JavaScript: estado local da tela, renderização, cálculos, formulários, gráficos, importação/exportação e chamadas ao servidor.
- `render()`: atualiza as áreas da página a partir do estado atual.
- `pageSet()`: troca a aba ativa e redesenha o conteúdo.
- `setPeriod()`: valida e grava o intervalo de meses escolhido.
- `gasCall()`: envolve a ponte assíncrona `google.script.run` em uma Promise.
- `getFinanceState` / `saveFinanceState` (chamadas ao servidor): carregam e persistem o estado completo.

O JavaScript do navegador está junto ao HTML para que o template do Apps Script possa inserir a chave de acesso com segurança e manter a instalação simples. CSS e JavaScript inline também evitam dependências de arquivos adicionais no editor Apps Script.

### `Code.gs`

É o lado servidor. As primeiras constantes configuram nomes das abas, propriedades privadas e limite de comprovante. `TABLES` define, num único lugar, como cada coleção da aplicação vira linhas e cabeçalhos na planilha.

- `doGet(e)`: confere a chave da URL e entrega `Index.html`.
- `setupFinanceApp()`: instalação inicial; cria planilha, abas, pastas e chave privada.
- `showFinanceSetup()`: mostra o endereço da planilha e monta o link do Web App.
- `rotateFinanceAppKey()`: invalida o link anterior e gera outro.
- `getFinanceState()` / `saveFinanceState()`: carregam e gravam dados, com validação e trava para evitar gravações simultâneas conflitantes.
- `uploadReceipt()` / `getReceipt()`: enviam e recuperam comprovantes.
- `setupQuickEntryForm()` / `processQuickEntryForm()`: criam e processam o formulário opcional.
- `createManualBackup()` / `restoreLatestBackup()`: cuidam das cópias manuais.\n- `clearFinanceData()`: exige a chave do app e a frase `DILUVIO`, salva uma cópia da planilha e só então limpa as abas e restaura preferências iniciais.
- `readStateFromSpreadsheet_()` / `writeStateToSpreadsheet_()`: convertem entre o formato da aplicação e as abas da planilha.
- `backupDailyIfNeeded_()` / `pruneBackups_()`: criam cópia diária e limitam a pasta às 30 mais recentes.
- `assertKey_()` / `requiredProp_()` / `validateState_()`: verificações compartilhadas antes de operações sensíveis.

O sufixo `_` marca funções auxiliares internas do Apps Script. `PROP` guarda acesso às propriedades do projeto; elas não ficam dentro do repositório.

### `appsscript.json`

Define fuso horário, runtime V8, forma de execução e permissões solicitadas. O Web App executa com a conta implantadora para poder gravar na planilha e nas pastas dessa conta.

## 3. Modelo de dados

O estado do aplicativo é um objeto com coleções, por exemplo `entries`, `bills`, `cards`, `pots`, `projects`, `members`, `accountTemplates` e `accounts`, além de `settings`.

Cada coleção é armazenada numa aba própria. As colunas visíveis ajudam a consultar dados; a coluna `Dados completos` mantém o objeto original em JSON para preservar campos novos sem exigir uma coluna para cada detalhe. As preferências gerais e contas recorrentes ignoradas ficam na aba `Configuração`.

Comprovantes são arquivos do Drive. O registro guarda seu identificador, e o conteúdo do arquivo não é colocado na planilha nem no GitHub.

## 4. Caminho de um lançamento

1. A pessoa preenche o formulário no navegador.
2. O cliente atualiza o estado e redesenha a tela.
3. A gravação agenda a chamada para `saveFinanceState`.
4. O Apps Script verifica a chave e a estrutura dos dados.
5. Uma trava protege a gravação; o estado é escrito nas abas e, se necessário, uma cópia diária é criada.
6. A interface mostra o resultado da gravação.

O botão **Atualizar** chama novamente `getFinanceState` e redesenha os resumos e gráficos com os dados atuais da planilha.

## 5. Como alterar com segurança

- Para acrescentar uma coleção persistente, atualize o estado inicial no cliente, `TABLES` em `Code.gs` e a leitura/gravação correspondente.
- Para acrescentar um campo a uma coleção existente, primeiro atualize o formulário e os cálculos. O JSON em `Dados completos` preserva o campo; acrescente uma coluna somente se ela precisar ficar visível na planilha.
- Para alterar permissões, ajuste `appsscript.json` e autorize novamente no Apps Script.
- Para alterar a interface, mantenha os IDs usados pelos ouvintes de eventos. O HTML de cada tela é reconstruído por `render()`, então eventos de elementos recriados precisam ser delegados ao documento ou associados após a renderização.
- Preserve `<?= APP_ACCESS_KEY ?>` e os nomes `Index` e `doGet`; são a ligação entre o template e o Web App.
- Faça uma cópia do projeto Apps Script antes de alterações estruturais e teste com uma planilha de teste. Nunca use `setupFinanceApp()` para atualizar dados existentes.

## 6. Otimizações e limites atuais

A gravação envia o estado inteiro em vez de uma única linha por alteração. Isso deixa o modelo simples para uso doméstico e evita divergência entre recursos que se relacionam, mas aumenta o volume de cada gravação conforme o histórico cresce. Se o uso ficar grande, a próxima otimização estrutural é persistir somente os registros alterados, preservando uma rotina de migração e backup.

Os gráficos são calculados no navegador a partir dos dados carregados. Para volumes domésticos, isso evita consultas complexas; históricos muito extensos podem tornar a renderização mais lenta. Dependências opcionais carregadas por CDN, como o leitor OCR, exigem internet.

As cópias de segurança reduzem o risco de perda acidental, mas não substituem uma exportação periódica mantida em local seguro. O link privado concede acesso a quem o possui; use `rotateFinanceAppKey()` se ele for compartilhado por engano.

