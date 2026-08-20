/**
 * 108_SheetSetup.js
 * Compliance OS — 一次把 Documents / Verified_Income / Reconciliation_Log /
 * Compliance_Calendar / Compliance_Completions 五张表的表头跟栏位格式建好。
 *
 * 回应 115_TruthWriter.js 原本留的那句话：「Sheet 建立本身不是这个文件的
 * 职责……建表/迁移是另一个还没写的关注点（ensureSheetSchema_ 风格）」——
 * 这个文件就是那个还没写的关注点。
 *
 * 栏位定义直接引用各自来源文件已经在用的 *_COLUMNS 常数（DOCUMENTS_COLUMNS/
 * VERIFIED_INCOME_COLUMNS/RECONCILIATION_LOG_COLUMNS/COMPLIANCE_CALENDAR_
 * COLUMNS/COMPLIANCE_COMPLETIONS_COLUMNS），不另外复制一份——单一事实来源：
 * 哪天那些常数加了新栏位，这里自动跟着变，不用两个地方一起改。
 *
 * textColumns：凡是 ID、hash、period/week 代码、ISO 时间戳字符串，一律强制
 * plain-text（'@'）格式，不给 Sheets 有机会自动转成日期序数值——118_Tests_
 * SheetReader.js 人工清单里那条「日期栏位被 Sheets 静默转成 Date 序列值」
 * 的教训，原本写的是「呼叫方要自己防御性转换」；这里从源头（栏位格式）解决，
 * 不用每个呼叫方各自记得转换。金额/整数栏位刻意不列入 textColumns，让
 * Sheets 当数字处理（SUM 等公式才有用）。
 *
 * 手动执行入口：setupComplianceOsSheets()（刻意不带下划线——这是要给人从
 * Apps Script 编辑器下拉菜单手动选来跑的一次性 setup，跟 runAllXTests()
 * 系列同一个惯例，不是要藏起来的内部函数）。
 */

if (typeof require === 'function') {
  var { DOCUMENTS_COLUMNS } = require('./110_DocumentImport.js');
  var { RECONCILIATION_LOG_COLUMNS } = require('./130_Reconciliation.js');
  var { VERIFIED_INCOME_COLUMNS } = require('./140_VerifiedIncome.js');
  var { COMPLIANCE_CALENDAR_COLUMNS, COMPLIANCE_COMPLETIONS_COLUMNS } = require('./150_ComplianceCalendar.js');
  var { getTargetSpreadsheet_ } = require('./115_TruthWriter.js');
}

/**
 * 五张表的 schema 定义，写成函数、惰性求值——不能写成 file 顶层的
 * `var SHEET_SCHEMAS_ = [...]`。GAS 把整个专案所有档案照文件名字母序
 * 塞进同一个 global scope 执行；108 排在 110/130/140/150 前面，如果
 * 在顶层就求值，这时候 DOCUMENTS_COLUMNS 等常数都还没被赋值
 * （`var` 声明会被提升，但赋值不会，读到的会是 undefined，不会抛错、
 * 是静默的错资料——已经用一次模拟真实载入顺序的检查实测出来过一次）。
 * 写成函数、只有真的被呼叫时才求值，这时候全专案早就载入完毕，就没有
 * 这个问题——这也是 buildConsoleDeps_() 之类的函数能够不管档案顺序都
 * 安全引用其他档案全局变量的同一个原因。
 * @return {Array<{name:string, columns:string[], textColumns:string[]}>}
 */
function buildSheetSchemas_() {
  return [
    {
      name: 'Documents',
      columns: DOCUMENTS_COLUMNS,
      textColumns: DOCUMENTS_COLUMNS // 全部都是文字/ID 栏位，没有数字
    },
    {
      name: 'Verified_Income',
      columns: VERIFIED_INCOME_COLUMNS,
      textColumns: ['income_id', 'period', 'currency', 'source', 'origin_platform', 'status', 'verified_at']
      // net_delivery_income/incentive/tip/other_payments/total_deductions/net/amount
      // 刻意不列——留给 Sheets 当数字
    },
    {
      name: 'Reconciliation_Log',
      columns: RECONCILIATION_LOG_COLUMNS,
      textColumns: ['reconciliation_id', 'week', 'reason', 'status']
      // statement_total/rider_os_estimate/reward_sheet_total/rider_total/
      // difference/difference_pct 刻意不列——留给 Sheets 当数字；
      // within_tolerance 是 boolean，也不列
    },
    {
      name: 'Compliance_Calendar',
      columns: COMPLIANCE_CALENDAR_COLUMNS,
      textColumns: ['obligation_id', 'category', 'title', 'due_date', 'recurrence', 'linked_document_id']
      // reminder_lead_days 是整数天数，刻意不列
    },
    {
      name: 'Compliance_Completions',
      columns: COMPLIANCE_COMPLETIONS_COLUMNS,
      textColumns: COMPLIANCE_COMPLETIONS_COLUMNS // 全部都是文字/ID 栏位
    }
  ];
}

/**
 * 确保单一 Sheet 存在、表头正确、指定栏位是 plain-text 格式。
 * 已经有表头就检查是否跟预期一致；不一致就抛错，不静默覆盖——现有表头
 * 不一致，代表可能已经有真实资料对着旧栏位顺序，贸然改表头会让既有资料
 * 全部错位（CMP-P10：明确失败，不猜）。
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet
 * @param {{name:string, columns:string[], textColumns:string[]}} schema
 * @return {{name:string, action:string}}
 */
function ensureSheetSchema_(spreadsheet, schema) {
  let sheet = spreadsheet.getSheetByName(schema.name);
  let action;

  if (!sheet) {
    sheet = spreadsheet.insertSheet(schema.name);
    action = 'created';
  } else {
    action = 'existing';
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const hasContent = lastRow >= 1 && lastCol >= 1;
  const currentHeader = hasContent
    ? sheet.getRange(1, 1, 1, Math.max(lastCol, schema.columns.length)).getValues()[0]
    : [];
  const headerIsBlank = !hasContent || currentHeader.every((v) => v === '');

  if (headerIsBlank) {
    sheet.getRange(1, 1, 1, schema.columns.length).setValues([schema.columns]);
    sheet.setFrozenRows(1);
    action += action === 'created' ? '+header' : '（补上 header）';
  } else {
    const matches = schema.columns.every((col, i) => currentHeader[i] === col);
    if (!matches) {
      throw new Error(
        `ensureSheetSchema_: Sheet "${schema.name}" 现有表头跟预期不一致——` +
        `现有=[${currentHeader.slice(0, schema.columns.length).join(', ')}]，` +
        `预期=[${schema.columns.join(', ')}]。可能已经有真实资料，不自动覆盖，` +
        `需要你确认后手动处理。`
      );
    }
    action += '（header 已一致）';
  }

  // 整栏套用 plain-text 格式——不只表头那一行，未来 appendRow 进来的资料列
  // 也吃得到，不用每次写入前另外设一次格式。
  schema.textColumns.forEach((colName) => {
    const colIndex = schema.columns.indexOf(colName) + 1;
    if (colIndex < 1) {
      throw new Error(`ensureSheetSchema_: textColumns 里的 "${colName}" 不在 "${schema.name}" 的 columns 定义里——设定本身有误`);
    }
    sheet.getRange(1, colIndex, sheet.getMaxRows(), 1).setNumberFormat('@');
  });

  return { name: schema.name, action };
}

/**
 * 手动从 Apps Script 编辑器执行的入口：一次把五张表全部建好/补齐。
 * 前提：Script Properties 已经设定 SPREADSHEET_ID（跟 getTargetSpreadsheet_
 * 同一个前提，见 115_TruthWriter.js）。
 * @return {Array<{name:string, action:string}>}
 */
function setupComplianceOsSheets() {
  const spreadsheet = getTargetSpreadsheet_();
  const results = buildSheetSchemas_().map((schema) => ensureSheetSchema_(spreadsheet, schema));
  results.forEach((r) => console.log(`${r.name}: ${r.action}`));
  return results;
}

if (typeof module !== 'undefined') {
  module.exports = { buildSheetSchemas_, ensureSheetSchema_, setupComplianceOsSheets };
}
