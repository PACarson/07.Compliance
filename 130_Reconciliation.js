/**
 * 130_Reconciliation.js
 * Compliance OS — Reconciliation Engine（对应治理文档 §2.1、§4.2 ADR-001、CMP-P5/P7/P10）
 *
 * 三层：
 *  - reconcileStatement_()：纯逻辑，不碰 I/O，可以直接测。
 *  - recordReconciliationResult_()：把结果写进 Reconciliation_Log（透过
 *    115_TruthWriter.js，UCR6），Auto_Verified 时再呼叫 140_VerifiedIncome.js
 *    的 verifyAndPublishIncome_() 写 Verified_Income + 发布事件。
 *  - runReconciliationForWeek_()：编排层，透过 RiderOSAdapter 取数（UCR7），
 *    「两边到齐才跑」。
 *
 * 依赖（riderOSAdapter / truthWriter / now）一律用 deps 对象注入，不在函数
 * 内部直接 new Date() 或直接引用全局 RiderOSAdapter/TruthWriter——这样单元
 * 测试可以喂假的，GAS 环境下呼叫方传真的。
 */

if (typeof require === 'function') {
  var { verifyAndPublishIncome_ } = require('./140_VerifiedIncome.js');
}

function round2_(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
    status: withinTolerance ? 'Auto_Verified' : 'Needs_Review'
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
 * 编排层：「两边到齐才跑」。parsedStatement 目前用参数传入——Document Import
 * Engine + 读 Parsed_Statements 的机制还没写，等那部分建好，这里改成内部
 * 自己去读，函数签名不用变。
 * @param {string} week 例如 "2026-W30"
 * @param {Object} parsedStatement
 * @param {{riderOSAdapter: Object, truthWriter: Object, now: Date}} deps
 * @param {Object} [config]
 * @return {Object}
 */
function runReconciliationForWeek_(week, parsedStatement, deps, config) {
  const riderEstimate = deps.riderOSAdapter.getWeeklyEstimate(week);
  if (!riderEstimate) {
    // 两边没到齐——回传等待状态，不是当成 0 去算，也不是抛错
    return { week, status: 'Waiting_For_Rider_Estimate' };
  }

  const result = reconcileStatement_(parsedStatement, riderEstimate, config);
  const reconciliationId = recordReconciliationResult_(week, result, deps.truthWriter, deps.now);

  let verifiedIncome = null;
  if (result.status === 'Auto_Verified') {
    const eventId = `CMP-EVT-${week}-${deps.now.getTime()}`;
    verifiedIncome = verifyAndPublishIncome_(week, parsedStatement, result, deps.truthWriter, eventId, deps.now);
  }

  return Object.assign({ week, reconciliation_id: reconciliationId, verifiedIncome }, result);
}

if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULT_RECONCILIATION_CONFIG,
    RECONCILIATION_LOG_COLUMNS,
    reconcileStatement_,
    recordReconciliationResult_,
    runReconciliationForWeek_
  };
}
