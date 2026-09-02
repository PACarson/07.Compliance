/**
 * Phase B — Zero-Change Baseline Test
 * 完全使用 production 代码里现有、未修改的 112/125/127/142。
 * 不加 order_id_primary / order_identity_status / Gemini 自算年份 / Bayaran Balik Promo 新规则 /
 * Drive OCR rescue / 新 deterministic rescue parser / Tip-Insentif 逐笔日期 allocation。
 *
 * 用法：把这个档案加进你的 GAS 专案（例如另存一个 999_PhaseB_Baseline.js），
 * 填好下面的 W01_FILE_ID，GAS 编辑器下拉选 runPhaseB_ZeroChangeBaseline 执行。
 */
function runPhaseB_ZeroChangeBaseline() {
  const W01_FILE_ID = "YOUR_W01_DRIVE_FILE_ID_HERE";

  const docInfo = { fileId: W01_FILE_ID, documentId: "CMP-DOC-PHASEB-W01", totalPages: 24 };
  const verifiedIncomeContext = {
    netDeliveryIncome: 1297.60,
    periodStartParts: { year: 2025, month: 12, day: 29 },
    periodEndParts: { year: 2026, month: 1, day: 4 },
    verifiedIncomeId: "CMP-INCOME-2026-W01-PHASEB"
  };

  const extractor = realLLMExtractor_();

  // ========================================================================
  // GATE 1 — API / Schema Integration（原始单次呼叫，不经过 fallback 编排）
  // ========================================================================
  console.log("========== GATE 1: API / Schema Integration ==========");
  let gate1Pass = false;
  let rawCandidate = null;
  const g1Start = Date.now();
  try {
    const rawExtract = extractor.extractOrders(docInfo, null);
    const elapsed = (Date.now() - g1Start) / 1000;
    rawCandidate = rawExtract.candidate;

    console.log(`[G1] API 呼叫成功，耗时 ${elapsed}s`);
    console.log(`[G1] finishReason: ${rawExtract.evidence.finishReason}`);
    console.log(`[G1] evidence 档案 ID: ${rawExtract.evidence.evidenceFileId}`);
    console.log(`[G1] extractorId: ${rawExtract.evidence.extractorId || '(未记录)'}`);

    // schema mismatch / malformed 检查：candidate.days 必须存在且是阵列，每个 day 要有 orders 阵列
    const days = rawCandidate && rawCandidate.days;
    const shapeOk = Array.isArray(days) && days.length > 0 &&
      days.every(d => Array.isArray(d.orders) && typeof d.printed_daily_subtotal !== 'undefined');
    console.log(`[G1] candidate.days 存在且形状正确（无 schema mismatch）: ${shapeOk}`);
    console.log(`[G1] 回传天数: ${days ? days.length : 0}`);
    const totalOrdersRaw = days ? days.reduce((s, d) => s + (d.orders ? d.orders.length : 0), 0) : 0;
    console.log(`[G1] 回传订单总笔数: ${totalOrdersRaw}`);

    gate1Pass = rawExtract.evidence.finishReason === 'STOP' && shapeOk;
    console.log(`[G1] === GATE 1 判定: ${gate1Pass ? 'PASS' : 'FAIL'} ===`);
  } catch (err) {
    const elapsed = (Date.now() - g1Start) / 1000;
    console.error(`[G1] API 呼叫失败（耗时 ${elapsed}s），原样记录错误，不猜测原因:`);
    console.error(err.message);
    console.log("[G1] === GATE 1 判定: FAIL（见上方原始错误） ===");
  }

  if (!gate1Pass) {
    console.log("\nGate 1 未通过，Gate 2 不会执行（照 Steven 的规则：先分析 discrepancy，不要跳过 Gate 1 直接看 Gate 2）。");
    return;
  }

  // ========================================================================
  // GATE 2 — Real Data Accuracy（呼叫既有、未修改的 fallback 编排，内部会自动跑 125 验证 + 142 建构 + checksum）
  // ========================================================================
  console.log("\n========== GATE 2: Real Data Accuracy ==========");
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
  console.log(`[G2] low_confidence=true 笔数: ${lowConf.length}（已知正确 0，如果 >0 请列出是哪几笔）`);
  if (lowConf.length) console.log(JSON.stringify(lowConf, null, 2));

  const nullFields = allOrders.filter(o =>
    [o.base_income, o.other_income, o.income_adjustment, o.net_income].some(v => v === null || typeof v === 'undefined')
  );
  console.log(`[G2] 金额栏位有 null/undefined 的笔数: ${nullFields.length}（已知正确 0）`);
  if (nullFields.length) console.log(JSON.stringify(nullFields, null, 2));

  console.log(`\n--- 逐日 checksum ---`);
  const knownSubtotals = {
    "4 Januari": 205.50, "3 Januari": 213.50, "2 Januari": 162.40,
    "1 Januari": 187.60, "31 Disember": 174.70, "30 Disember": 196.00, "29 Disember": 157.90
  };
  let dailyMatchedCount = 0;
  (result.dailyAllocations || []).forEach(d => {
    const isMatched = d.checksum_status === 'Matched';
    if (isMatched) dailyMatchedCount++;
    console.log(`  ${d.date}: ${d.order_row_count}笔 算得=${d.net_delivery_income} 印刷=${d.printed_daily_subtotal} 差=${d.checksum_difference} -> ${d.checksum_status}`);
  });
  console.log(`[G2] 7/7 daily checksum Matched: ${dailyMatchedCount}/7`);

  console.log(`\n--- 整周 statement checksum ---`);
  if (result.statementChecksum) {
    console.log(`[G2] 算得=${result.statementChecksum.calculatedTotal} vs 官方=${result.statementChecksum.statedTotal} -> ${result.statementChecksum.status}`);
    console.log(`（注：这里的 "statement checksum" 指订单净收入加总 vs net_delivery_income，不含 Tip/Insentif/asas 等其他 Ringkasan 栏位——那些是 extract() 的范围，不是这次测的 extractOrders() 链路）`);
  } else {
    console.log("[G2] !!! 没有 statementChecksum，请检查 result 物件 !!!");
  }

  console.log(`\n--- 8PRUR5AGXAQRAV 专项检查（本轮最重要的 regression case）---`);
  const targetOrder = allOrders.find(o =>
    (o.order_ids_raw || o.order_ids || []).some(id => String(id).indexOf('8PRUR5AGXAQRAV') !== -1)
  );
  if (targetOrder) {
    console.log("[G2] 找到，完整内容:", JSON.stringify(targetOrder, null, 2));
    const ok = targetOrder.net_income === 4.00 && !targetOrder.low_confidence;
    console.log(`[G2] 8PRUR5AGXAQRAV 判定: ${ok ? 'PASS（金额正确、非 low_confidence）' : 'FAIL，见上方内容'}`);
  } else {
    console.log("[G2] !!! FAIL：完全没找到这笔订单，请检查 Isnin 29 Disember 那天的原始资料 !!!");
  }

  console.log(`\n--- Sekaligus / and N 分布 ---`);
  const sekaligus = allOrders.filter(o => o.order_row_type === 'Sekaligus');
  console.log(`[G2] Sekaligus 笔数: ${sekaligus.length}`);
  const singleId = sekaligus.filter(o => (o.order_ids_raw || []).length === 1 && !(o.and_more_count > 0));
  const withAndN = sekaligus.filter(o => o.and_more_count > 0);
  console.log(`[G2] 单-ID Sekaligus（无 and N）: ${singleId.length} 笔`);
  console.log(`[G2] 含 and N 的 Sekaligus: ${withAndN.length} 笔 — ${JSON.stringify(withAndN.map(o => ({ ids: o.order_ids_raw, and_more: o.and_more_count })))}`);

  console.log(`\n--- 跨年份日期检查 ---`);
  const byYear = {};
  allOrders.forEach(o => {
    const y = (o.order_date || o.date || '').slice(0, 4);
    byYear[y] = (byYear[y] || 0) + 1;
  });
  console.log(`[G2] 按年份分布: ${JSON.stringify(byYear)}（已知正确：2025 年 ~101 笔 [29/30/31 Dis], 2026 年 ~101 笔 [1/2/3/4 Jan] —— 实际数字以本次逐日笔数为准）`);

  console.log(`\n--- 非重试错误 ---`);
  console.log(`[G2] nonRetryableErrors: ${JSON.stringify(result.nonRetryableErrors || [])}`);

  console.log("\n========== 请把从 GATE 1 到这里的完整 log 原样贴回来 ==========");
}
