/**
 * 115_TruthWriter.js
 * Compliance OS — TruthWriter：所有 Sheet 写入的唯一出口（UCR6：Sheet appends
 * 一律透过项目自己的 TruthEngine-等价物，不能有任何地方直接
 * sheet.appendRow()）。
 *
 * 跟 123_RiderOSAdapter.js 同一个套路：真正的 GAS 依赖（SpreadsheetApp /
 * LockService）用工厂函数注入，GAS 环境下自动接上真的，Node 测试环境用假的
 * accessor/lock，逻辑（栏位校验、栏位顺序、加锁）可以直接测。
 *
 * ⚠️ Sheet 建立本身（列要设成 plain-text '@' 格式，对应 UEF Failure Catalog
 * 里 Property OS 那条「日期字符串被 Sheets 静默转成日期序列值」的教训）不是
 * 这个文件的职责——这里假设 Sheet 已经存在、格式已经设好；建表/迁移是另一个
 * 还没写的关注点（ensureSheetSchema_ 风格，等 Document Import Engine 那边
 * 一起处理）。
 */

/**
 * @param {{appendRow: function(string, Array): void}} sheetAccessor
 * @param {{withLock: function(function(): any): any}} lockProvider
 */
function createTruthWriter_(sheetAccessor, lockProvider) {
  /**
   * 把 rowObject 按 columnOrder 校验、转成数组、加锁写入。
   * 缺任何一个栏位就抛错，不静默用 undefined/空字符串顶替——CMP-P10。
   * @param {string} sheetName
   * @param {Object} rowObject
   * @param {string[]} columnOrder
   * @return {Array} 实际写入的那一行（数组形式），方便测试/记录
   */
  function appendValidatedRow(sheetName, rowObject, columnOrder) {
    if (!rowObject) throw new Error(`appendValidatedRow: rowObject 是空的（sheet=${sheetName}）`);
    return lockProvider.withLock(function () {
      const row = columnOrder.map(function (col) {
        const value = rowObject[col];
        if (value === undefined) {
          throw new Error(`appendValidatedRow: 缺少栏位 "${col}"（sheet=${sheetName}）`);
        }
        // CMP-P6/EP4 的栏位（例如尚未发生的 completed_at）允许显式传 null，
        // 代表「还没有值」，不是漏填——只有 undefined 才算漏填。
        return value === null ? '' : value;
      });
      sheetAccessor.appendRow(sheetName, row);
      return row;
    });
  }

  return { appendValidatedRow };
}

/**
 * 找到 TruthWriter/SheetReader 要连的那份 Spreadsheet。
 *
 * 这个项目是 standalone script（.clasp.json 没有 parentId，没有绑定任何
 * Spreadsheet 容器）——SpreadsheetApp.getActive() 在这里不管什么情境都只会
 * 拿到 null："active" 指的是绑定脚本的 Sheet UI session，Web App 请求/
 * time-based trigger/API 执行都没有这个 session，不是偶发、是必然拿不到。
 *
 * 改用 openById + Script Property 存 ID，跟 170_OperatorConsole.js 的
 * CONSOLE_LAST_FOLDER_ID、123_RiderOSAdapter.js 的 PropertiesService 缓存
 * 同一个模式——要连哪份表明确指定，不猜"现在碰巧开着哪份"（CMP-P10）。
 *
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getTargetSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('getTargetSpreadsheet_: Script Properties 里没有设定 "SPREADSHEET_ID"——standalone script 没有 SpreadsheetApp.getActive() 可用，需要明确指定要连哪份表（Apps Script 编辑器 → Project Settings → Script Properties，加一笔 SPREADSHEET_ID = 该 Spreadsheet 网址 /d/ 后面那一串）');
  }
  return SpreadsheetApp.openById(id);
}

function gasSheetAccessor_() {
  return {
    appendRow(sheetName, rowArray) {
      const sheet = getTargetSpreadsheet_().getSheetByName(sheetName);
      if (!sheet) throw new Error(`找不到 Sheet："${sheetName}"——需要先建表（含 plain-text 格式设置）`);
      sheet.appendRow(rowArray);
    },
    getAllRows(sheetName) {
      const sheet = getTargetSpreadsheet_().getSheetByName(sheetName);
      if (!sheet) throw new Error(`找不到 Sheet："${sheetName}"——需要先建表`);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return []; // 只有表头或整张表是空的
      return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues(); // 跳过表头
    }
  };
}

function gasLockProvider_() {
  return {
    withLock(fn) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    }
  };
}

// GAS 环境才自动接上真的 SpreadsheetApp/LockService；Node 测试环境两者都不
// 存在，TruthWriter 就先不初始化，测试改用 createTruthWriter_ 自己注入假的。
var TruthWriter = (typeof SpreadsheetApp !== 'undefined' && typeof LockService !== 'undefined')
  ? createTruthWriter_(gasSheetAccessor_(), gasLockProvider_())
  : null;

if (typeof module !== 'undefined') {
  module.exports = { createTruthWriter_, gasSheetAccessor_, getTargetSpreadsheet_, TruthWriter };
}
