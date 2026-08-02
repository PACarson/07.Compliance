/**
 * 140_VerifiedIncome.js
 * Compliance OS — Verified Income：把 Reconciliation 的 Auto_Verified 结果
 * 变成 Verified_Income 记录 + 发布 INCOME_VERIFIED（对应治理文档 §5.3、§7）。
 *
 * publishComplianceEvent_() 是 UCR7 的 Adapter——目前还没确认 Personal AI
 * Core 的 EventBus 实际调用方式，所以只做记录，不猜签名硬调用（UCR7 明确
 * 说：依赖没确认就不要猜签名）。
 */

var VERIFIED_INCOME_COLUMNS = [
  'income_id', 'period', 'currency',
  'net_delivery_income', 'incentive', 'tip', 'other_payments',
  'total_deductions', 'net', 'amount',
  'source', 'origin_platform', 'status', 'verified_at'
];

/**
 * 把 GrabWeeklyParser（或未来其他 Parser）的输出 + Reconciliation 结果，
 * 组成 Verified_Income 的一行。net_delivery_income/incentive/tip/other_payments
 * 这些细项来自 parsedStatement，Reconciliation 只知道汇总，这里两边都要。
 * @param {string} week
 * @param {Object} parsedStatement GrabWeeklyParser 输出
 * @param {Object} reconciliationResult reconcileStatement_() 的回传
 * @param {Date} [now]
 * @return {Object}
 */
function buildVerifiedIncomeRecord_(week, parsedStatement, reconciliationResult, now) {
  const nowDate = now || new Date();
  if (!(nowDate instanceof Date) || isNaN(nowDate.getTime())) {
    throw new Error('buildVerifiedIncomeRecord_: now 必须是合法的 Date 对象'); // UCR4
  }
  if (!parsedStatement || !parsedStatement.income_breakdown) {
    throw new Error('buildVerifiedIncomeRecord_: parsedStatement.income_breakdown 缺失');
  }
  if (!reconciliationResult || reconciliationResult.status !== 'Auto_Verified') {
    throw new Error('buildVerifiedIncomeRecord_: 只能对 Auto_Verified 的对账结果建立 Verified Income（CMP-P1 Official Truth Principle——未通过对账的不能发布）');
  }

  const b = parsedStatement.income_breakdown;
  return {
    income_id: `CMP-INCOME-${week}`,
    period: week,
    currency: parsedStatement.document_meta.currency,
    net_delivery_income: b.net_delivery_income.amount,
    incentive: b.incentive.amount,
    tip: b.tip.amount,
    other_payments: b.other_payments.amount,
    total_deductions: parsedStatement.summary.total_deductions,
    net: reconciliationResult.statement_total,
    amount: reconciliationResult.statement_total,
    source: 'Compliance OS', // CMP-P2：固定这个，不是 origin_platform
    origin_platform: parsedStatement.document_meta.source,
    status: 'Verified',
    verified_at: nowDate.toISOString()
  };
}

/** @return {Object} 供 publishComplianceEvent_() 用的 INCOME_VERIFIED payload */
function buildIncomeVerifiedEvent_(verifiedIncomeRecord, eventId) {
  return {
    event_id: eventId,
    income_id: verifiedIncomeRecord.income_id,
    period: verifiedIncomeRecord.period,
    net_delivery_income: verifiedIncomeRecord.net_delivery_income,
    incentive: verifiedIncomeRecord.incentive,
    tip: verifiedIncomeRecord.tip,
    other_payments: verifiedIncomeRecord.other_payments,
    total_deductions: verifiedIncomeRecord.total_deductions,
    net: verifiedIncomeRecord.net,
    amount: verifiedIncomeRecord.amount,
    currency: verifiedIncomeRecord.currency,
    source: verifiedIncomeRecord.source,
    origin_platform: verifiedIncomeRecord.origin_platform,
    status: verifiedIncomeRecord.status,
    verified_at: verifiedIncomeRecord.verified_at
  };
}

/**
 * UCR7 Adapter——EventBus 发布的唯一出口。目前是纯占位：Personal AI Core
 * 的 EventBus 真实调用方式还没确认，不猜签名，只记录。等确认了，只改这个
 * 函数内部，调用方（这个文件、Reconciliation Engine）完全不用动。
 */
function publishComplianceEvent_(eventType, payload) {
  const msg = `[占位实现，等确认 Personal AI Core EventBus 的真实调用方式] event_type=${eventType}`;
  if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
    AlertService.log('INFO', 'ComplianceEventPublisher', 'publishComplianceEvent_', { eventType, payload }, msg);
  } else {
    console.log(`[publishComplianceEvent_] ${msg}`, JSON.stringify(payload));
  }
}

/**
 * 把 Verified_Income 一行写进 Sheet（透过 TruthWriter，UCR6）。
 * @param {Object} truthWriter 115_TruthWriter.js 的实例
 * @param {Object} record buildVerifiedIncomeRecord_() 的回传
 */
function writeVerifiedIncome_(truthWriter, record) {
  return truthWriter.appendValidatedRow('Verified_Income', record, VERIFIED_INCOME_COLUMNS);
}

/**
 * 编排：Auto_Verified 才会走到这里（呼叫方负责判断，这个函数本身也会再检查
 * 一次，双重保险——CMP-P1 太重要，不能只靠呼叫方守规矩）。
 * @param {string} week
 * @param {Object} parsedStatement
 * @param {Object} reconciliationResult
 * @param {Object} truthWriter
 * @param {string} eventId
 * @param {Date} [now]
 * @return {{record: Object, event: Object}}
 */
function verifyAndPublishIncome_(week, parsedStatement, reconciliationResult, truthWriter, eventId, now) {
  const record = buildVerifiedIncomeRecord_(week, parsedStatement, reconciliationResult, now);
  writeVerifiedIncome_(truthWriter, record);
  const event = buildIncomeVerifiedEvent_(record, eventId);
  publishComplianceEvent_('INCOME_VERIFIED', event);
  return { record, event };
}

if (typeof module !== 'undefined') {
  module.exports = {
    VERIFIED_INCOME_COLUMNS,
    buildVerifiedIncomeRecord_,
    buildIncomeVerifiedEvent_,
    publishComplianceEvent_,
    writeVerifiedIncome_,
    verifyAndPublishIncome_
  };
}
