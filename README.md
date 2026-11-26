# Minha Casa, Minha (Dí)vida — versão Google Sheets

Aplicativo web de finanças domésticas para duas ou mais pessoas. A interface roda como Web App do Google Apps Script; os dados ficam na planilha privada do Google Drive, e os comprovantes e cópias ficam em pastas privadas do Drive.

## Arquivos deste projeto

- `Index.html`: telas, estilos, gráficos, formulários e interações do navegador.
- `Code.gs`: comunicação com Sheets e Drive, validação dos dados, formulário rápido e cópias de segurança.
- `appsscript.json`: configurações e permissões que o Apps Script solicita.
- `LEIA-ME.txt`: instruções de instalação e atualização.
- `GUIA_DO_CODIGO.md`: mapa comentado da estrutura e dos principais fluxos.

## Incluir no GitHub

Crie um repositório privado e envie somente os cinco arquivos acima. Não envie dados reais, planilhas exportadas, comprovantes, URLs privadas do aplicativo, identificadores de planilhas/pastas, nem chaves ou senhas. O Apps Script guarda os identificadores e a chave privada nas propriedades do projeto; não copie esses valores para o repositório.

Para atualizar uma instalação existente, copie `Code.gs`, `Index.html` e `appsscript.json` para o projeto Apps Script atual e publique uma nova versão da implantação. Não execute `setupFinanceApp()` novamente numa instalação existente: essa função cria uma planilha e pastas novas.

## Resumo de recursos

Registra receitas, despesas, contas da casa, pagamentos parciais e renegociados, cartão parcelado, reservas, projetos e obras. Inclui identificação de quem cadastrou, filtro por intervalo de meses, relatórios históricos, gráficos, alertas configuráveis, edição/exclusão de lançamentos, importação CSV, backup e formulário Google opcional. Em Ajustes há um botão de reinício protegido por confirmação digitada e cópia prévia no Drive.

## Privacidade

O link do Web App contém uma chave de acesso. Trate o link como senha e mantenha o repositório privado. Os dados e os comprovantes permanecem no Drive da conta que instalou o aplicativo; o GitHub recebe apenas o código-fonte genérico.

## Uso de Inteligência Artificial

Este projeto contou com o apoio de ferramentas de Inteligência Artificial (IA) durante seu desenvolvimento. A IA foi utilizada como assistente para auxiliar em tarefas como geração de código, revisão, depuração, documentação, sugestões de interface, organização de funcionalidades e melhoria da experiência do usuário.

Todo o código, arquitetura, regras de negócio, validações e decisões finais foram revisados, adaptados e validados pelo desenvolvedor responsável pelo projeto.

O uso de IA teve caráter colaborativo, atuando como ferramenta de apoio à produtividade e à qualidade do desenvolvimento, sem substituir a análise, os testes e a validação humana.
