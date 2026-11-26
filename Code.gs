/**
 * Minha Casa, Minha (Dí)vida — Google Sheets edition.
 * Deploy as a web app that executes as the owner. The private URL key is the
 * access control because this edition intentionally has no login screen.
 */
const APP_TITLE = 'Minha Casa, Minha (Dí)vida';
const PROP = PropertiesService.getScriptProperties();
const PROP_SHEET = 'FINANCE_SHEET_ID';
const PROP_RECEIPTS = 'FINANCE_RECEIPTS_FOLDER_ID';
const PROP_BACKUPS = 'FINANCE_BACKUPS_FOLDER_ID';
const PROP_KEY = 'FINANCE_APP_KEY';
const PROP_BACKUP_DAY = 'FINANCE_LAST_BACKUP_DAY';
const PROP_QUICK_FORM_ID = 'FINANCE_QUICK_FORM_ID';
const PROP_QUICK_FORM_URL = 'FINANCE_QUICK_FORM_URL';
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

/** Mapeia cada coleção do aplicativo para a aba e colunas correspondentes. */
const TABLES = [
  { key: 'entries', name: 'Lançamentos', headers: ['ID', 'Data', 'Tipo', 'Descrição', 'Categoria', 'Responsável', 'Registrado por', 'Conta / cartão', 'Valor (R$)', 'Comprovante', 'Observação', 'Dados completos'], columns: x => [x.id, x.date, x.type, x.description, x.category, x.owner, x.createdBy, x.account, x.amount, x.fileId, x.note, JSON.stringify(x)] },
  { key: 'bills', name: 'Contas', headers: ['ID', 'Conta', 'Vencimento', 'Data paga', 'Status', 'Valor original', 'Juros', 'Valor pago', 'Total', 'Categoria', 'Responsável', 'Registrado por', 'Conta usada', 'Comprovante', 'Observação', 'Renegociação', 'Dados completos'], columns: x => [x.id, x.name, x.due, x.paidDate, x.status, x.original, x.interest, x.paid, x.total, x.category, x.owner, x.createdBy, x.account, x.fileId, x.note, x.renegotiation, JSON.stringify(x)] },
  { key: 'cards', name: 'Cartão parcelado', headers: ['ID', 'Compra', 'Data', 'Valor total', 'Parcelas', 'Valor por parcela', 'Primeira parcela', 'Cartão', 'Categoria', 'Responsável', 'Registrado por', 'Dados completos'], columns: x => [x.id, x.description, x.date, x.amount, x.installments, Number(x.amount || 0) / Math.max(1, Number(x.installments || 1)), x.firstMonth, x.card, x.category, x.owner, x.createdBy, JSON.stringify(x)] },
  { key: 'pots', name: 'Reservas e cofrinhos', headers: ['ID', 'Nome', 'Saldo', 'Meta', 'Rendimento mensal (%)', 'Projeto vinculado', 'Dados completos'], columns: x => [x.id, x.name, x.balance, x.goal, x.monthlyRate, x.projectId, JSON.stringify(x)] },
  { key: 'projects', name: 'Projetos e obras', headers: ['ID', 'Projeto', 'Orçamento', 'Meta', 'Caixinha vinculada', 'Dados completos'], columns: x => [x.id, x.name, x.budget, x.target, x.potId, JSON.stringify(x)] },
  { key: 'members', name: 'Pessoas', headers: ['ID', 'Nome', 'Dados completos'], columns: (x, i) => [String(i + 1), typeof x === 'string' ? x : x.name, JSON.stringify(x)] },
  { key: 'accountTemplates', name: 'Contas recorrentes', headers: ['ID', 'Nome', 'Dia de vencimento', 'Dados completos'], columns: x => [x.id, x.name, x.dueDay, JSON.stringify(x)] },
  { key: 'accounts', name: 'Contas financeiras', headers: ['ID', 'Nome', 'Tipo', 'Responsável', 'Dados completos'], columns: x => [x.id, x.name, x.type, x.owner, JSON.stringify(x)] }
];

/** Entrada do Web App: valida o link privado e entrega a página inicial. */
function doGet(e) {
  const key = PROP.getProperty(PROP_KEY);
  if (!key || !e || !e.parameter || e.parameter.k !== key) {
    return HtmlService.createHtmlOutput('<main style="font:16px system-ui;max-width:560px;margin:12vh auto;padding:24px"><h2>Link privado inválido</h2><p>Abra o endereço completo que foi compartilhado com você.</p></main>').setTitle(APP_TITLE);
  }
  const page = HtmlService.createTemplateFromFile('Index');
  page.APP_ACCESS_KEY = key;
  return page.evaluate().setTitle(APP_TITLE).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Run once from the Apps Script editor. Save the generated URL key. */
/** Instalação inicial. Cria planilha, abas, pastas e chave privada. */
function setupFinanceApp() {
  if (PROP.getProperty(PROP_SHEET)) throw new Error('A configuração já existe. Use showFinanceSetup() para ver os links.');
  const spreadsheet = SpreadsheetApp.create('Minha Casa, Minha Dívida — Dados');
  const first = spreadsheet.getSheets()[0];
  first.setName(TABLES[0].name);
  TABLES.forEach((table, index) => {
    const sheet = index === 0 ? first : spreadsheet.insertSheet(table.name);
    sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers]).setFontWeight('bold').setBackground('#e5f2eb');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, table.headers.length);
  });
  const config = spreadsheet.insertSheet('Configuração');
  config.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]).setFontWeight('bold').setBackground('#e5f2eb');
  config.setFrozenRows(1);
  config.getRange(2, 1, 2, 2).setValues([
    ['settings', JSON.stringify({ name: APP_TITLE, primary: '#183b34', secondary: '#1c725a', allocation: { casa: 50, reserva: 15, projetos: 10, individual: 10, familia: 15 }, simulatedIncome: null })],
    ['skippedRecurring', '[]']
  ]);
  spreadsheet.getSheetByName('Pessoas').getRange(2, 1, 2, 3).setValues([[1, 'Você', JSON.stringify('Você')], [2, 'Sua esposa', JSON.stringify('Sua esposa')]]);
  const receipts = DriveApp.createFolder('Minha Casa Minha Divida — Comprovantes');
  const backups = DriveApp.createFolder('Minha Casa Minha Divida — Backups');
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PROP.setProperties({ [PROP_SHEET]: spreadsheet.getId(), [PROP_RECEIPTS]: receipts.getId(), [PROP_BACKUPS]: backups.getId(), [PROP_KEY]: key }, false);
  Logger.log('Planilha: ' + spreadsheet.getUrl());
  Logger.log('Chave privada do link: ' + key);
  Logger.log('Depois de publicar o web app, acesse showFinanceSetup() para montar o link final.');
  return { spreadsheetUrl: spreadsheet.getUrl(), accessKey: key };
}

function showFinanceSetup() {
  const id = PROP.getProperty(PROP_SHEET);
  if (!id) throw new Error('Rode setupFinanceApp() primeiro.');
  const key = PROP.getProperty(PROP_KEY);
  const deploymentUrl = ScriptApp.getService().getUrl();
  const url = deploymentUrl ? deploymentUrl + '?k=' + encodeURIComponent(key) : 'Publique como app da web; depois execute showFinanceSetup() novamente.';
  Logger.log('Planilha (não precisa abrir para usar o aplicativo): ' + SpreadsheetApp.openById(id).getUrl());
  Logger.log('Link privado do aplicativo: ' + url);
  return { spreadsheetUrl: SpreadsheetApp.openById(id).getUrl(), appUrl: url };
}

/** Rotate the private-link key if the previous link was exposed. */
function rotateFinanceAppKey() {
  const id = requiredProp_(PROP_SHEET);
  const key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PROP.setProperty(PROP_KEY, key);
  const deploymentUrl = ScriptApp.getService().getUrl();
  const url = deploymentUrl ? deploymentUrl + '?k=' + encodeURIComponent(key) : 'Implante o app da web e execute novamente.';
  Logger.log('Novo link privado do aplicativo: ' + url);
  return { appUrl: url, spreadsheetUrl: SpreadsheetApp.openById(id).getUrl() };
}

/** Create a short Google Form for quick entries and connect it to this app. Run once. */
function setupQuickEntryForm() {
  const existingId = PROP.getProperty(PROP_QUICK_FORM_ID);
  if (existingId) {
    const existing = FormApp.openById(existingId);
    Logger.log('Formulário de lançamento rápido: ' + existing.getPublishedUrl());
    Logger.log('Editar formulário: ' + existing.getEditUrl());
    return { responderUrl: existing.getPublishedUrl(), editUrl: existing.getEditUrl() };
  }

  const spreadsheet = SpreadsheetApp.openById(requiredProp_(PROP_SHEET));
  const state = readStateFromSpreadsheet_(spreadsheet);
  const people = (state.members && state.members.length ? state.members : ['Você', 'Sua esposa']).map(String);
  const form = FormApp.create('Minha Casa, Minha (Dí)vida — Lançamento rápido');
  form.setDescription('Use este formulário para registrar rapidamente uma conta, despesa ou receita. As respostas entram no aplicativo financeiro do casal.');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage('Lançamento recebido. Ele será integrado ao aplicativo financeiro.');
  form.addMultipleChoiceItem().setTitle('O que deseja registrar?').setChoiceValues(['Conta da casa', 'Despesa do dia', 'Receita']).setRequired(true);
  form.addTextItem().setTitle('Nome ou descrição').setHelpText('Ex.: conta de luz, mercado, salário').setRequired(true);
  form.addTextItem().setTitle('Valor total (R$)').setHelpText('Informe apenas números e centavos, se houver.').setRequired(true);
  form.addDateItem().setTitle('Data do lançamento ou vencimento').setRequired(true);
  form.addListItem().setTitle('Categoria').setChoiceValues(['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Obras', 'Renda', 'Investimento', 'Outros']).setRequired(true);
  form.addListItem().setTitle('Responsável pelo gasto ou receita').setChoiceValues(['Casa compartilhada'].concat(people)).setRequired(true);
  form.addListItem().setTitle('Quem está cadastrando?').setChoiceValues(people).setRequired(true);
  form.addMultipleChoiceItem().setTitle('Status do pagamento (para contas da casa)').setChoiceValues(['Pendente', 'Completo', 'Parcial', 'Renegociado']).setRequired(true);
  form.addTextItem().setTitle('Valor já pago (R$)').setHelpText('Para pagamento parcial, informe quanto foi pago. Para os demais registros, pode deixar em branco.');
  form.addDateItem().setTitle('Data do pagamento').setRequired(false);
  form.addTextItem().setTitle('Conta ou cartão usado').setRequired(false);
  form.addParagraphTextItem().setTitle('Observação').setRequired(false);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());

  const trigger = ScriptApp.newTrigger('processQuickEntryForm').forForm(form).onFormSubmit().create();
  PROP.setProperties({ [PROP_QUICK_FORM_ID]: form.getId(), [PROP_QUICK_FORM_URL]: form.getPublishedUrl() }, false);
  Logger.log('Formulário de lançamento rápido: ' + form.getPublishedUrl());
  Logger.log('Editar formulário: ' + form.getEditUrl());
  Logger.log('Respostas serão vinculadas à planilha: ' + spreadsheet.getUrl());
  return { responderUrl: form.getPublishedUrl(), editUrl: form.getEditUrl(), triggerId: trigger.getUniqueId() };
}

function getQuickEntryFormUrl(accessKey) {
  assertKey_(accessKey);
  return PROP.getProperty(PROP_QUICK_FORM_URL) || '';
}

/** Import a submitted Google Form response into the app's structured tabs. */
function processQuickEntryForm(event) {
  if (!event || !event.response) throw new Error('Este processamento deve ser iniciado pelo envio do formulário.');
  const response = event.response;
  const responseId = response.getId();
  const answers = {};
  response.getItemResponses().forEach(itemResponse => { answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse(); });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = SpreadsheetApp.openById(requiredProp_(PROP_SHEET));
    const state = readStateFromSpreadsheet_(spreadsheet);
    const allRows = [...(state.entries || []), ...(state.bills || [])];
    if (allRows.some(row => row.formResponseId === responseId)) return;

    const type = String(answers['O que deseja registrar?'] || '');
    const description = String(answers['Nome ou descrição'] || '').trim();
    const amount = parseFormMoney_(answers['Valor total (R$)']);
    const paidInput = parseFormMoney_(answers['Valor já pago (R$)']);
    const category = String(answers['Categoria'] || 'Outros');
    const enteredBy = String(answers['Quem está cadastrando?'] || 'Não informado');
    const person = String(answers['Responsável pelo gasto ou receita'] || 'Casa compartilhada');
    const owner = person === 'Casa compartilhada' ? '__shared__' : person;
    const date = formDateKey_(answers['Data do lançamento ou vencimento']);
    const paidDate = formDateKey_(answers['Data do pagamento']);
    const account = String(answers['Conta ou cartão usado'] || '').trim();
    const note = String(answers['Observação'] || '').trim();
    if (!description || !Number.isFinite(amount) || amount <= 0 || !date) throw new Error('A resposta do formulário tem descrição, valor ou data inválidos.');

    const id = Utilities.getUuid();
    if (type === 'Conta da casa') {
      const status = String(answers['Status do pagamento (para contas da casa)'] || 'Pendente');
      const paid = Number.isFinite(paidInput) && paidInput > 0 ? paidInput : status === 'Completo' ? amount : 0;
      state.bills.push({ id, name: description, original: amount, interest: 0, total: amount, paid, due: date, paidDate: paidDate || (status === 'Completo' ? date : ''), status, category, owner, account, note, renegotiation: status === 'Renegociado' ? note : '', createdBy: enteredBy, formResponseId: responseId });
      if (paid > 0) state.entries.push({ id: Utilities.getUuid(), type: 'expense', amount: paid, description, category, date: paidDate || date, account, owner, note: 'Pagamento lançado pelo formulário de contas' + (note ? ': ' + note : ''), createdBy: enteredBy, formResponseId: responseId });
    } else {
      const entryType = type === 'Receita' ? 'income' : 'expense';
      state.entries.push({ id, type: entryType, amount, description, category, date, account, owner, note, createdBy: enteredBy, formResponseId: responseId });
    }
    backupDailyIfNeeded_(spreadsheet);
    writeStateToSpreadsheet_(spreadsheet, state);
  } finally {
    lock.releaseLock();
  }
}

function parseFormMoney_(value) {
  const text = String(value == null ? '' : value).trim().replace(/[R$\s]/g, '');
  if (!text) return NaN;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function formDateKey_(value) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, 'America/Sao_Paulo', 'yyyy-MM-dd');
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

/** API usada pelo navegador para ler e gravar o estado financeiro completo. */
function getFinanceState(accessKey) {
  assertKey_(accessKey);
  return readStateFromSpreadsheet_(SpreadsheetApp.openById(requiredProp_(PROP_SHEET)));
}

function saveFinanceState(accessKey, incoming) {
  assertKey_(accessKey);
  validateState_(incoming);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = SpreadsheetApp.openById(requiredProp_(PROP_SHEET));
    backupDailyIfNeeded_(spreadsheet);
    writeStateToSpreadsheet_(spreadsheet, incoming);
    return { saved: true, savedAt: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

/** Salva um comprovante no Drive privado e retorna os dados do arquivo. */
function uploadReceipt(accessKey, fileName, mimeType, base64) {
  assertKey_(accessKey);
  const encoded = String(base64 || '');
  if (encoded.length > Math.ceil(MAX_RECEIPT_BYTES * 4 / 3) + 8) throw new Error('O comprovante precisa ter até 8 MB.');
  const bytes = Utilities.base64Decode(encoded);
  if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES) throw new Error('O comprovante precisa ter até 8 MB.');
  const safe = String(fileName || 'comprovante').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 140);
  const blob = Utilities.newBlob(bytes, String(mimeType || 'application/octet-stream'), safe);
  const file = DriveApp.getFolderById(requiredProp_(PROP_RECEIPTS)).createFile(blob);
  return { id: file.getId(), name: file.getName(), type: file.getMimeType(), url: file.getUrl() };
}

function getReceipt(accessKey, fileId) {
  assertKey_(accessKey);
  const file = DriveApp.getFileById(String(fileId));
  const blob = file.getBlob();
  return { id: file.getId(), name: file.getName(), type: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

function createManualBackup(accessKey) {
  assertKey_(accessKey);
  const source = DriveApp.getFileById(requiredProp_(PROP_SHEET));
  const name = 'Minha Casa Minha Divida — Cópia manual — ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  const copy = source.makeCopy(name, DriveApp.getFolderById(requiredProp_(PROP_BACKUPS)));
  pruneBackups_();
  return { name: copy.getName(), url: copy.getUrl() };
}

function restoreLatestBackup(accessKey) {
  assertKey_(accessKey);
  const files = backupFiles_();
  if (!files.length) throw new Error('Ainda não existe uma cópia de segurança no Drive.');
  const restored = readStateFromSpreadsheet_(SpreadsheetApp.openById(files[0].getId()));
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    writeStateToSpreadsheet_(SpreadsheetApp.openById(requiredProp_(PROP_SHEET)), restored);
  } finally {
    lock.releaseLock();
  }
  return restored;
}

/** Converte as abas da planilha no objeto de estado usado pelo aplicativo. */
/**
 * Limpa todas as coleções financeiras após a confirmação digitada no cliente.
 * Antes de apagar, guarda uma cópia completa da planilha na pasta de backups.
 * A chave e a frase são conferidas novamente no servidor.
 */
function clearFinanceData(accessKey, confirmationPhrase) {
  assertKey_(accessKey);
  if (String(confirmationPhrase || '') !== 'DILUVIO') {
    throw new Error('Confirmação inválida. Digite DILUVIO para autorizar a limpeza.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheetId = requiredProp_(PROP_SHEET);
    const backupFolder = DriveApp.getFolderById(requiredProp_(PROP_BACKUPS));
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmmss');
    const backup = DriveApp.getFileById(spreadsheetId).makeCopy(
      'Minha Casa Minha Divida — Antes do dilúvio — ' + timestamp,
      backupFolder
    );

    const cleanState = {
      entries: [],
      bills: [],
      cards: [],
      pots: [],
      projects: [],
      members: ['Você', 'Sua esposa'],
      accountTemplates: [],
      accounts: [],
      settings: {
        name: APP_TITLE,
        primary: '#183b34',
        secondary: '#1c725a',
        allocation: { casa: 50, reserva: 15, projetos: 10, individual: 10, familia: 15 },
        simulatedIncome: null
      },
      skippedRecurring: []
    };

    writeStateToSpreadsheet_(SpreadsheetApp.openById(spreadsheetId), cleanState);
    pruneBackups_();
    return { cleared: true, backupName: backup.getName(), state: cleanState };
  } finally {
    lock.releaseLock();
  }
}
function readStateFromSpreadsheet_(spreadsheet) {
  const result = { entries: [], bills: [], cards: [], pots: [], projects: [], members: ['Você', 'Sua esposa'], accountTemplates: [], accounts: [], settings: {}, skippedRecurring: [] };
  TABLES.forEach(table => {
    const sheet = spreadsheet.getSheetByName(table.name);
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    result[table.key] = values.map(row => {
      const raw = row[row.length - 1];
      try { return JSON.parse(String(raw || 'null')); } catch (_) { return null; }
    }).filter(value => value !== null);
  });
  const config = spreadsheet.getSheetByName('Configuração');
  if (config && config.getLastRow() >= 2) {
    config.getRange(2, 1, config.getLastRow() - 1, 2).getValues().forEach(row => {
      if (row[0] === 'settings') { try { result.settings = JSON.parse(row[1] || '{}'); } catch (_) {} }
      if (row[0] === 'skippedRecurring') { try { result.skippedRecurring = JSON.parse(row[1] || '[]'); } catch (_) {} }
    });
  }
  return result;
}

/** Grava cada coleção na aba definida em TABLES e atualiza configurações. */
function writeStateToSpreadsheet_(spreadsheet, state) {
  TABLES.forEach(table => {
    const sheet = spreadsheet.getSheetByName(table.name) || spreadsheet.insertSheet(table.name);
    sheet.clearContents();
    sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers]).setFontWeight('bold').setBackground('#e5f2eb');
    sheet.setFrozenRows(1);
    const list = Array.isArray(state[table.key]) ? state[table.key] : [];
    if (list.length) sheet.getRange(2, 1, list.length, table.headers.length).setValues(list.map((row, index) => table.columns(row || {}, index).map(sheetSafeCell_)));
  });
  let config = spreadsheet.getSheetByName('Configuração');
  if (!config) config = spreadsheet.insertSheet('Configuração');
  config.clearContents();
  config.getRange(1, 1, 1, 2).setValues([['Chave', 'Valor']]).setFontWeight('bold').setBackground('#e5f2eb');
  config.getRange(2, 1, 2, 2).setValues([['settings', JSON.stringify(state.settings || {})], ['skippedRecurring', JSON.stringify(state.skippedRecurring || [])]]);
  SpreadsheetApp.flush();
}

/** Garante uma cópia diária antes de substituir os dados da planilha. */
function backupDailyIfNeeded_(spreadsheet) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (PROP.getProperty(PROP_BACKUP_DAY) === today) return;
  const name = 'Minha Casa Minha Divida — Cópia automática — ' + today;
  DriveApp.getFileById(spreadsheet.getId()).makeCopy(name, DriveApp.getFolderById(requiredProp_(PROP_BACKUPS)));
  PROP.setProperty(PROP_BACKUP_DAY, today);
  pruneBackups_();
}

function backupFiles_() {
  const folder = DriveApp.getFolderById(requiredProp_(PROP_BACKUPS));
  const iterator = folder.getFiles();
  const files = [];
  while (iterator.hasNext()) files.push(iterator.next());
  return files.filter(file => file.getMimeType() === MimeType.GOOGLE_SHEETS).sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
}

function pruneBackups_() {
  const files = backupFiles_();
  files.slice(30).forEach(file => file.setTrashed(true));
}

function validateState_(state) {
  if (!state || !Array.isArray(state.entries) || !Array.isArray(state.bills)) throw new Error('Os dados recebidos estão incompletos.');
  if (JSON.stringify(state).length > 8 * 1024 * 1024) throw new Error('O conjunto de dados excede o limite desta versão.');
}

function sheetSafeCell_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^[=+@]/.test(value)) return "'" + value;
  return value;
}

function assertKey_(candidate) {
  const saved = PROP.getProperty(PROP_KEY);
  if (!saved || String(candidate || '') !== saved) throw new Error('Link privado inválido. Reabra pelo endereço compartilhado.');
}

function requiredProp_(name) {
  const value = PROP.getProperty(name);
  if (!value) throw new Error('Configuração ausente. Execute setupFinanceApp() no Apps Script.');
  return value;
}



