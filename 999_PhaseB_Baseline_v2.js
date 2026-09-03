/**
 * Phase B — Zero-Change Baseline Test（v2：修正 GAS 总执行时间预算问题）
 *
 * 上一版把 Gate 1（原始诊断呼叫）跟 Gate 2（完整 fallback 编排）写在同一次执行里，
 * 结果 Gate 1 单次呼叫（305 秒）就把 GAS 消费帐号 ~360 秒的总执行时间硬上限吃掉大半，
 * Gate 2 完全没有剩余时间跑完自己的 Gemini API 呼叫，导致 "Exceeded maximum execution time"。
 *
 * 这是这份测试脚本本身的设计缺陷，不是 127/142 production code 的问题——
 * production 正常使用只会呼叫一次 runGeminiOrderExtractionWithFallback_()，
 * 不会像上一版这样先跑一次原始诊断、再跑一次完整编排，等于同一次执行里打了两次 Gemini。
 *
 * 这一版把两个 Gate 拆成两个独立函数，分开执行，各自拿到完整的 ~360 秒预算。
 * 112/125/127/142 production code 完全没有改动，改的只有这份测试脚本自己。
 *
 * 用法：
 * 1. Gate 1 已经在上一轮验证过 PASS（173 笔、finishReason=STOP、无 schema mismatch），
 *    不需要重跑，除非你想要多一次确认。
 * 2. 直接跑 runPhaseB_Gate2Only —— 这是这次真正需要的证据。
 */

const PHASE_B_W01_FILE_ID = "YOUR_W01_DRIVE_FILE_ID_HERE";

function runPhaseB_Gate1Only() {
  const docInfo = { fileId: PHASE_B_W01_FILE_ID, documentId: "CMP-DOC-PHASEB-W01", totalPages: 24 };
  const extractor = realLLMExtractor_();

  console.log("========== GATE 1: API / Schema Integration ==========");
  const g1Start = Date.now();
  try {
    const rawExtract = extractor.extractOrders(docInfo, null);
    const elapsed = (Date.now() - g1Start) / 1000;
    const days = rawExtract.candidate && rawExtract.candidate.days;
    const shapeOk = Array.isArray(days) && days.length > 0 &&
      days.every(d => Array.isArray(d.orders) && typeof d.printed_daily_subtotal !== 'undefined');
    const totalOrdersRaw = days ? days.reduce((s, d) => s + (d.orders ? d.orders.length : 0), 0) : 0;

    console.log(`[G1] API 呼叫成功，耗时 ${elapsed}s`);
    console.log(`[G1] finishReason: ${rawExtract.evidence.finishReason}`);
    console.log(`[G1] evidence 档案 ID: ${rawExtract.evidence.evidenceFileId}`);
    console.log(`[G1] extractorId: ${rawExtract.evidence.extractorId || '(未记录)'}`);
    console.log(`[G1] candidate.days 形状正确（无 schema mismatch）: ${shapeOk}`);
    console.log(`[G1] 回传天数: ${days ? days.length : 0}`);
    console.log(`[G1] 回传订单总笔数: ${totalOrdersRaw}`);
    console.log(`[G1] === GATE 1 判定: ${(rawExtract.evidence.finishReason === 'STOP' && shapeOk) ? 'PASS' : 'FAIL'} ===`);
  } catch (err) {
    console.error(`[G1] API 呼叫失败（耗时 ${(Date.now() - g1Start) / 1000}s）:`, err.message);
    console.log("[G1] === GATE 1 判定: FAIL ===");
  }
}

function runPhaseB_Gate2Only() {
  const docInfo = { fileId: PHASE_B_W01_FILE_ID, documentId: "CMP-DOC-PHASEB-W01-G2", totalPages: 24 };
  const verifiedIncomeContext = {
    netDeliveryIncome: 1297.60,
    periodStartParts: { year: 2025, month: 12, day: 29 },
    periodEndParts: { year: 2026, month: 1, day: 4 },
    verifiedIncomeId: "CMP-INCOME-2026-W01-PHASEB-G2"
  };
  const extractor = realLLMExtractor_();

  console.log("========== GATE 2: Real Data Accuracy（独立执行，不先跑 Gate 1）==========");
  const g2Start = Date.now();
  const result = runGeminiOrderExtractionWithFallback_(docInfo, verifiedIncomeContext, {
    extractor: extractor,
    now: new Date()
  });
  console.log(`[G2] 编排完成，耗时 ${(Date.now() - g2Start) / 1000}s`);
  console.log(`[G2] 最终 allocationStatus: ${result.allocationStatus}`);
  console.log(`[G2] 尝试历程: ${JSON.stringify(result.attempts)}`);

  const allOrders = result.orderRows || [];
  console.log(`\n--- 订单总数检查 ---`);
  console.log(`[G2] 订单总笔数: ${allOrders.length} / 已知正确 173`);

  const lowConf = allOrders.filter(o => o.low_confidence);
  console.log(`[G2] low_confidence=true 笔数: ${lowConf.length}（已知正确 0）`);
  if (lowConf.length) console.log(JSON.stringify(lowConf, null, 2));

  const nullFields = allOrders.filter(o =>
    [o.base_income, o.other_income, o.income_adjustment, o.net_income].some(v => v === null || typeof v === 'undefined')
  );
  console.log(`[G2] 金额栏位有 null/undefined 的笔数: ${nullFields.length}（已知正确 0）`);
  if (nullFields.length) console.log(JSON.stringify(nullFields, null, 2));

  console.log(`\n--- 逐日 checksum ---`);
  let dailyMatchedCount = 0;
  (result.dailyAllocations || []).forEach(d => {
    if (d.checksum_status === 'Matched') dailyMatchedCount++;
    console.log(`  ${d.date}: ${d.order_row_count}笔 算得=${d.net_delivery_income} 印刷=${d.printed_daily_subtotal} 差=${d.checksum_difference} -> ${d.checksum_status}`);
  });
  console.log(`[G2] 7/7 daily checksum Matched: ${dailyMatchedCount}/7`);

  console.log(`\n--- 整周 statement checksum ---`);
  if (result.statementChecksum) {
    console.log(`[G2] 算得=${result.statementChecksum.calculatedTotal} vs 官方=${result.statementChecksum.statedTotal} -> ${result.statementChecksum.status}`);
    console.log(`（范围提醒：这里指订单净收入加总 vs net_delivery_income，不含 Tip/Insentif/asas 等——那些是 extract() 的范围）`);
  } else {
    console.log("[G2] !!! 没有 statementChecksum !!!");
  }

  console.log(`\n--- 8PRUR5AGXAQRAV 专项检查 ---`);
  const targetOrder = allOrders.find(o =>
    (o.order_ids_raw || o.order_ids || []).some(id => String(id).indexOf('8PRUR5AGXAQRAV') !== -1)
  );
  if (targetOrder) {
    console.log("[G2] 找到:", JSON.stringify(targetOrder, null, 2));
    console.log(`[G2] 判定: ${(targetOrder.net_income === 4.00 && !targetOrder.low_confidence) ? 'PASS' : 'FAIL，见上方内容'}`);
  } else {
    console.log("[G2] !!! FAIL：完全没找到这笔订单 !!!");
  }

  console.log(`\n--- Sekaligus / and N 分布 ---`);
  const sekaligus = allOrders.filter(o => o.order_row_type === 'Sekaligus');
  const singleId = sekaligus.filter(o => (o.order_ids_raw || []).length === 1 && !(o.and_more_count > 0));
  const withAndN = sekaligus.filter(o => o.and_more_count > 0);
  console.log(`[G2] Sekaligus 笔数: ${sekaligus.length}，单-ID 无 and N: ${singleId.length}，含 and N: ${withAndN.length}`);
  if (withAndN.length) console.log(JSON.stringify(withAndN.map(o => ({ ids: o.order_ids_raw, and_more: o.and_more_count }))));

  console.log(`\n--- 跨年份日期检查 ---`);
  const byYear = {};
  allOrders.forEach(o => {
    const y = (o.order_date || o.date || '').slice(0, 4);
    byYear[y] = (byYear[y] || 0) + 1;
  });
  console.log(`[G2] 按年份分布: ${JSON.stringify(byYear)}`);

  console.log(`\n--- 非重试错误 ---`);
  console.log(`[G2] nonRetryableErrors: ${JSON.stringify(result.nonRetryableErrors || [])}`);

  console.log("\n========== 请把这次完整 log 原样贴回来 ==========");
}
