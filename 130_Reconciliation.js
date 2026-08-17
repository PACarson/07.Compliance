/**
 * 130_Reconciliation.js
 * Compliance OS — Reconciliation Engine（对应治理文档 §2.1、§2.5 ADR-003、
 * §4.2 ADR-001、CMP-P5/P7/P10/P12）
 *
 * ADR-003（v0.7，Steven 已签字）：Reconciliation 是独立、可选、非阻断的次要
 * 验证——完全不碰 Verified_Income（不写、不查、不 import 140_VerifiedIncome.js，
 * 这个文件现在对 140 零依赖）。Verified Income 的发布在 110_DocumentImport.js
 * 里解析成功当下就完成，不等这个模块。
 *
 * 三层：
 *  - reconcileStatement_()：纯逻辑，不碰 I/O，可以直接测。
 *  - recordReconciliationResult_()：把结果写进 Reconciliation_Log（透过
 *    115_TruthWriter.js，UCR6）——不管有没有 Rider OS 数据都会写一行，「尝试
 *    过」本身要留痕，不是没数据就整个跳过不留任何记录。
 *  - runReconciliationForWeek_()：编排层，透过 RiderOSAdapter 取数（UCR7）。
 *  - getCurrentReconciliationStatus_()：查询时用——某一周「现在」的对账状态
 *    从 Reconciliation_Log 取最新一笔算，不是存在别的地方等着被回头更新
 *    （TruthWriter/UCR6 只支援 append，没有原地更新的方法；这里跟
 *    150_ComplianceCalendar.js 的 Completed 判定同一个模式，EP4）。
 *
 * 依赖（riderOSAdapter / truthWriter / now）一律用 deps 对象注入，不在函数
 * 内部直接 new Date() 或直接引用全局 RiderOSAdapter/TruthWriter——这样单元
 * 测试可以喂假的，GAS 环境下呼叫方传真的。
 */

if (typeof require === 'function') {
  var { round2_ } = require('./106_Utils.js');
}

/** 预设容差：RM5 或总额的 0.5%，取较大者。还没被真实数据验证过，是合理猜测。 */
var DEFAULT_RECONCILIATION_CONFIG = {
  toleranceAbsolute: 5,
  tolerancePct: 0.005
};

var RECONCILIATION_LOG_COLUMNS = [
  'reconciliation_id', 'week',
  'statement_total', 'rider_os_estimate', 'reward_sheet_total', 'rider_total',
  'difference', 'difference_pct', 'reason', 'within_tolerance', 'status'
];

/**
 * 纯对账逻辑，不碰 I/O。
 * @param {{summary: {weekly_net: number}}} parsedStatement
 * @param {{daily_estimate_total: number, reward_estimate_total: number}} riderEstimate
 * @param {{toleranceAbsolute: number, tolerancePct: number}} [config]
 * @return {Object}
 */
function reconcileStatement_(parsedStatement, riderEstimate, config) {
  const cfg = config || DEFAULT_RECONCILIATION_CONFIG;

  if (!parsedStatement || !parsedStatement.summary || typeof parsedStatement.summary.weekly_net !== 'number') {
    throw new Error('parsedStatement.summary.weekly_net 缺失或不是数字');
  }
  if (!riderEstimate || typeof riderEstimate.daily_estimate_total !== 'number' || typeof riderEstimate.reward_estimate_total !== 'number') {
    throw new Error('riderEstimate 缺少 daily_estimate_total / reward_estimate_total');
  }

  const statementTotal = parsedStatement.summary.weekly_net;
  const riderTotal = round2_(riderEstimate.daily_estimate_total + riderEstimate.reward_estimate_total);
  const difference = round2_(statementTotal - riderTotal);
  const differencePct = riderTotal !== 0 ? round2_((Math.abs(difference) / Math.abs(riderTotal)) * 100) : (difference === 0 ? 0 : 100);

  const tolerance = Math.max(cfg.toleranceAbsolute, Math.abs(statementTotal) * cfg.tolerancePct);
  const withinTolerance = Math.abs(difference) <= tolerance;

  let reason;
  if (difference === 0) {
    reason = 'Exact_Match';
  } else if (withinTolerance) {
    reason = 'Within_Tolerance';
  } else {
    reason = 'Unclassified'; // CMP-P10：超出容差不猜原因，等人工判断，不提前设计分类规则（EP3）
  }

  return {
    statement_total: statementTotal,
    rider_os_estimate: riderEstimate.daily_estimate_total,
    reward_sheet_total: riderEstimate.reward_estimate_total,
    rider_total: riderTotal,
    difference,
    difference_pct: differencePct,
    within_tolerance: withinTolerance,
    reason,
    // ADR-003/CMP-P12：这个 status 现在纯粹是「对账本身的比对结果」，跟
    // Verified Income 发不发布无关（那件事在解析成功当下已经完成了）。
    // Discrepancy_Flagged 只是显性标注，不撤销、不阻断已经 Verified 的记录。
    status: withinTolerance ? 'Matched' : 'Discrepancy_Flagged'
  };
}

/**
 * 把对账结果写进 Reconciliation_Log（透过 TruthWriter，UCR6——不直接
 * sheet.appendRow()）。
 * @param {string} week
 * @param {Object} result reconcileStatement_() 的回传
 * @param {Object} truthWriter 115_TruthWriter.js 的实例
 * @param {Date} now
 * @return {string} 这次写入用的 reconciliation_id
 */
function recordReconciliationResult_(week, result, truthWriter, now) {
  const reconciliationId = `CMP-REC-${week}-${now.getTime()}`;
  const record = Object.assign({ reconciliation_id: reconciliationId, week }, result);
  truthWriter.appendValidatedRow('Reconciliation_Log', record, RECONCILIATION_LOG_COLUMNS);
  return reconciliationId;
}

/**
 * 编排层。ADR-003：Rider OS 没资料不再是「等待、不留痕」，而是照样写一笔
 * Not_Performed 的 Reconciliation_Log（尝试过这件事本身要看得见，CMP-P10），
 * 且完全不影响 Verified Income——那份记录在这个函数被呼叫之前就已经发布了。
 * @param {string} week 例如 "2026-W30"
 * @param {Object} parsedStatement
 * @param {{riderOSAdapter: Object, truthWriter: Object, now: Date}} deps
 * @param {Object} [config]
 * @return {Object}
 */
function runReconciliationForWeek_(week, parsedStatement, deps, config) {
  const riderEstimate = deps.riderOSAdapter.getWeeklyEstimate(week);

  if (!riderEstimate) {
    const notPerformed = {
      statement_total: parsedStatement && parsedStatement.summary ? parsedStatement.summary.weekly_net : null,
      rider_os_estimate: null,
      reward_sheet_total: null,
      rider_total: null,
      difference: null,
      difference_pct: null,
      within_tolerance: null,
      reason: 'No_Rider_Estimate',
      status: 'Not_Performed'
    };
    const reconciliationId = recordReconciliationResult_(week, notPerformed, deps.truthWriter, deps.now);
    return Object.assign({ week, reconciliation_id: reconciliationId }, notPerformed);
  }

  const result = reconcileStatement_(parsedStatement, riderEstimate, config);
  const reconciliationId = recordReconciliationResult_(week, result, deps.truthWriter, deps.now);
  return Object.assign({ week, reconciliation_id: reconciliationId }, result);
}

/**
 * 查询时用——某一周「现在」的对账状态，从 Reconciliation_Log 全部记录里取
 * 最新一笔算出来，不是一个被回头改写的欄位（UCR6：TruthWriter 只支援
 * append）。reconciliation_id 带 now.getTime()，字串排序即时间排序。
 * @param {string} week
 * @param {Array<{week: string, reconciliation_id: string, status: string}>} reconciliationLogRecords
 * @return {string} 'Not_Performed' | 'Matched' | 'Discrepancy_Flagged'
 */
function getCurrentReconciliationStatus_(week, reconciliationLogRecords) {
  const forWeek = (reconciliationLogRecords || []).filter((r) => r.week === week);
  if (forWeek.length === 0) return 'Not_Performed';
  const latest = forWeek.reduce((a, b) => (a.reconciliation_id > b.reconciliation_id ? a : b));
  return latest.status;
}

if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULT_RECONCILIATION_CONFIG,
    RECONCILIATION_LOG_COLUMNS,
    reconcileStatement_,
    recordReconciliationResult_,
    runReconciliationForWeek_,
    getCurrentReconciliationStatus_
  };
}
