/**
 * 140_VerifiedIncome.js
 * Compliance OS — Verified Income：把成功解析的官方文件变成 Verified_Income
 * 记录 + 发布 INCOME_VERIFIED（对应治理文档 §5.3、§7）。
 *
 * ADR-003（v0.7，Steven 已签字）：发布只取决于 Statement 解析成功，不再等
 * Reconciliation。Rider OS 对账现在是独立、可选、非阻断的次要验证——「当前
 * 对账状态」不存在这个模块的记录上（TruthWriter/UCR6 只支援 append，没有
 * 原地更新；跟 Compliance_Calendar 的 Completed 判定同一个模式：真相是
 * Reconciliation_Log，查询时算，不在这里多存一个会过期的欄位），要看某一周
 * 现在的对账状态，呼叫 130_Reconciliation.js 的 getCurrentReconciliationStatus_()。
 *
 * publishComplianceEvent_() 是 UCR7 的 Adapter——目前还没确认 Personal AI
 * Core 的 EventBus 实际调用方式，所以只做记录，不猜签名硬调用（UCR7 明确
 * 说：依赖没确认就不要猜签名）。
 */

var VERIFIED_INCOME_COLUMNS = [
  'income_id', 'period', 'currency',
  'net_delivery_income', 'incentive', 'tip', 'other_payments',
  'total_deductions', 'net', 'amount',
  'source', 'origin_platform', 'status', 'verified_at',
  'source_document_id', 'extractor_id'
];

/**
 * 把 GrabWeeklyParser（或 LLMExtractor，经 125_ExtractionValidation.js 验证
 * 通过后 normalize 出来的同一个形状）的输出组成 Verified_Income 的一行。
 * ADR-003：只要求解析成功（parsedStatement.income_breakdown 存在）——net/amount
 * 直接来自 parsedStatement.summary.weekly_net（陈述值本身，CMP-P5），不再经过
 * Reconciliation。Rider OS 对账完全不参与这个函数。
 *
 * source_document_id/extractor_id（2026-08-21 新增，追溯用）：extractor_id
 * 直接读 parsedStatement._parser_id——不管这份 parsedStatement 是
 * GrabWeeklyParser 正则解析出来的还是 LLMExtractor 经验证/normalize 出来的，
 * 两条路径都会在 _parser_id 上留下自己的身份，这里不用另外判断走的是哪条
 * 路径。sourceDocumentId 是呼叫方（runImportPipeline_）传进来的，因为
 * 「这笔 Verified Income 对应哪一笔 Documents 记录」是编排层的事实，不是
 * parsedStatement 自己知道的东西。
 * @param {string} week
 * @param {Object} parsedStatement GrabWeeklyParser 或 LLMExtractor 输出
 * @param {Date} [now]
 * @param {string} [sourceDocumentId]
 * @return {Object}
 */
function buildVerifiedIncomeRecord_(week, parsedStatement, now, sourceDocumentId) {
  const nowDate = now || new Date();
  if (!(nowDate instanceof Date) || isNaN(nowDate.getTime())) {
    throw new Error('buildVerifiedIncomeRecord_: now 必须是合法的 Date 对象'); // UCR4
  }
  if (!parsedStatement || !parsedStatement.income_breakdown) {
    throw new Error('buildVerifiedIncomeRecord_: parsedStatement.income_breakdown 缺失');
  }
  if (!parsedStatement.summary || typeof parsedStatement.summary.weekly_net !== 'number') {
    throw new Error('buildVerifiedIncomeRecord_: parsedStatement.summary.weekly_net 缺失或不是数字');
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
    net: parsedStatement.summary.weekly_net,
    amount: parsedStatement.summary.weekly_net,
    source: 'Compliance OS', // CMP-P2：固定这个，不是 origin_platform
    origin_platform: parsedStatement.document_meta.source,
    status: 'Verified',
    verified_at: nowDate.toISOString(),
    source_document_id: sourceDocumentId || null,
    extractor_id: parsedStatement._parser_id || null
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
    verified_at: verifiedIncomeRecord.verified_at,
    source_document_id: verifiedIncomeRecord.source_document_id,
    extractor_id: verifiedIncomeRecord.extractor_id
  };
}

/**
 * UCR7 Adapter——EventBus 发布的唯一出口，跟 RiderOSAdapter/TruthWriter 同一个
 * 套路：工厂函数 + 注入，方便测试；GAS 环境下用真正的实现，Personal AI Core
 * 的 EventBus 真实调用方式确认前，先用占位实现（记录、不猜签名硬调用）。
 */
function createEventPublisher_(publisher) {
  return {
    publish(eventType, payload) {
      return publisher.publish(eventType, payload);
    }
  };
}

function placeholderEventPublisher_() {
  return {
    publish(eventType, payload) {
      const msg = `[占位实现，等确认 Personal AI Core EventBus 的真实调用方式] event_type=${eventType}`;
      if (typeof AlertService !== 'undefined' && typeof AlertService.log === 'function') {
        AlertService.log('INFO', 'ComplianceEventPublisher', 'publish', { eventType, payload }, msg);
      } else {
        console.log(`[EventPublisher.publish] ${msg}`, JSON.stringify(payload));
      }
    }
  };
}

var EventPublisher = createEventPublisher_(placeholderEventPublisher_());

/**
 * 把 Verified_Income 一行写进 Sheet（透过 TruthWriter，UCR6）。
 * @param {Object} truthWriter 115_TruthWriter.js 的实例
 * @param {Object} record buildVerifiedIncomeRecord_() 的回传
 */
function writeVerifiedIncome_(truthWriter, record) {
  return truthWriter.appendValidatedRow('Verified_Income', record, VERIFIED_INCOME_COLUMNS);
}

/**
 * 编排：解析成功就发布（ADR-003）——不等、也不需要 Reconciliation 结果。
 *
 * existingIncomeIds 是可选的（不给就是原本的行为，既有呼叫方/测试不用改）：
 * Operator Console 的批次汇入 / 重试会传这个，避免同一个 income_id 被写进
 * Verified_Income 两次——「已导入文件不能因为重复点击而重复产生 Verified
 * Income」这个要求，最自然的位置就是发布本身检查一次，不是靠上层每个
 * 呼叫方各自小心。已经存在就跳过，不当错误处理（这是预期会发生的正常
 * 情况，尤其是 Retry 场景）。
 * @param {string} week
 * @param {Object} parsedStatement
 * @param {Object} truthWriter
 * @param {string} eventId
 * @param {Date} [now]
 * @param {string[]} [existingIncomeIds]
 * @param {string} [sourceDocumentId] 对应的 Documents.document_id，追溯用（2026-08-21 新增）
 * @return {{record: Object, event: (Object|null), skipped: boolean}}
 */
function verifyAndPublishIncome_(week, parsedStatement, truthWriter, eventId, now, existingIncomeIds, sourceDocumentId) {
  const record = buildVerifiedIncomeRecord_(week, parsedStatement, now, sourceDocumentId);
  if (existingIncomeIds && existingIncomeIds.indexOf(record.income_id) !== -1) {
    return { record, event: null, skipped: true };
  }
  writeVerifiedIncome_(truthWriter, record);
  const event = buildIncomeVerifiedEvent_(record, eventId);
  EventPublisher.publish('INCOME_VERIFIED', event);
  return { record, event, skipped: false };
}

if (typeof module !== 'undefined') {
  module.exports = {
    VERIFIED_INCOME_COLUMNS,
    buildVerifiedIncomeRecord_,
    buildIncomeVerifiedEvent_,
    createEventPublisher_,
    EventPublisher,
    writeVerifiedIncome_,
    verifyAndPublishIncome_
  };
}
