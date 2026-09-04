/**
 * Phase B — Zero-Change Baseline Test（v4：修正 Gate 2 两个检查项自己的栏位名称
 * 错误——不是 127/142 的问题，是这份测试脚本的 bug）
 *
 * v3 结果：编排 179.6s 完成，attempts 只有一条 full_document/errorCount:0——证实
 * 前两次超时纯粹是单次呼叫的延迟波动，不是 fallback/validation 问题，这个结论
 * 不变，v3 的计时探针原封不动留著。但 v3 报的「8PRUR5AGXAQRAV FAIL：完全没找到
 * 这笔订单」和「Sekaligus 单-ID/and-N 都是 0」两项，经过对照 Steven 提供的
 * evidence JSON（raw_candidate）逐笔核对，证实是**测试脚本自己的栏位名称写错**，
 * 不是抽取或 142 的问题：
 *
 *   - 142_DailyOrderAllocation.js 的 candidateFromGeminiOrderRow_() 把 Gemini 原始的
 *     order_ids_raw（阵列）+ and_more_count 映射成 orderRows 里完全不同名字的栏位：
 *     order_id_primary（字串，=第一个 ID）、order_id_raw（字串，=用 / 接起来的完整
 *     文字）、bundled_order_count、order_identity_status——不是抽取或 142 搞错了
 *     这笔订单，是 v1/v2/v3 这份检查脚本从头就在找一个 orderRows 里根本不存在的
 *     栏位名字（order_ids_raw / order_ids / and_more_count），对 173 笔里的每一笔
 *     都会是同样的假阴性，不只是这一笔。
 *   - 直接核对 evidence JSON：8PRUR5AGXAQRAV 那笔在 raw_candidate 里就是
 *     {"order_ids_raw":["A-8PRUR5AGXAQRAV"],...,"net_income":4,"low_confidence":false}，
 *     金额、ID、日期全部正确；用 142 真正的映射规则重建 orderRows 之后，这笔会是
 *     {order_id_primary:"A-8PRUR5AGXAQRAV", order_id_raw:"A-8PRUR5AGXAQRAV", net_income:4}——
 *     从头到尾都在，checksum 对得上是因为它真的没错，不是巧合掩盖了问题。
 *   - Sekaligus 35 笔用正确栏位重算：单-ID 无 and N＝0、多-ID(2+) 无 and N＝29、
 *     含 and N＝6（v3 因为同一个栏位名称错误，两个桶都恒为 0，不是真的数据分布）。
 *
 * 只改了这两个检查项的栏位名称，判断逻辑（找不到＝FAIL、and N 分桶方式）不变；
 * Gate 1、计时探针、其余每一项检查（订单总数/low_confidence/null 栏位/checksum/
 * 跨年份分布）原样不动。112/125/127/142 仍然一行都没碰。
 *
 * ⚠️ v4 取代 v3：把 GAS 专案里的 999_PhaseB_Baseline_v3.js 整份删除再加入这份，
 * 原因跟 v2→v3 时一样（PHASE_B_W01_FILE_ID 重复宣告）。Gate 1 不需要重跑。
 *
 * 用法：
 * 1. 删除 999_PhaseB_Baseline_v3.js
 * 2. 加入这份 999_PhaseB_Baseline_v4.js，确认 PHASE_B_W01_FILE_ID 已经填真实 file ID
 * 3. 跑 runPhaseB_Gate2Only()——这次应该会看到 8PRUR5AGXAQRAV PASS
 * 4. 把完整 log 贴回来做最后确认
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

/**
 * 纯计时包装——不碰 142 的任何一行、不改 deps 的形状（142 只用得到 extractOrders
 * 这一个方法，签章和回传值原样透传）。每次 extractOrders 被呼叫，不管是
 * full_document 还是某个 chunk，都记录开始时间、结束（或例外）时间、耗时。
 * 就算这次又超时，最后一行 [G2-TIMING] 会告诉我们卡在哪一次呼叫上。
 */
function wrapExtractorWithTiming_(rawExtractor) {
  return {
    extractOrders(document, pageRange) {
      const label = pageRange ? `chunk_${pageRange.firstPage}-${pageRange.lastPage}` : 'full_document';
      const t0 = Date.now();
      console.log(`[G2-TIMING] >>> extractOrders(${label}) 开始，此刻 ${new Date(t0).toISOString()}`);
      try {
        const result = rawExtractor.extractOrders(document, pageRange);
        console.log(`[G2-TIMING] <<< extractOrders(${label}) 完成，耗时 ${(Date.now() - t0) / 1000}s，finishReason=${result.evidence.finishReason}`);
        return result;
      } catch (err) {
        console.log(`[G2-TIMING] <<< extractOrders(${label}) 抛出例外，耗时 ${(Date.now() - t0) / 1000}s：${err.message}`);
        throw err;
      }
    }
  };
}

function runPhaseB_Gate2Only() {
  const docInfo = { fileId: PHASE_B_W01_FILE_ID, documentId: "CMP-DOC-PHASEB-W01-G2", totalPages: 24 };
  const verifiedIncomeContext = {
    netDeliveryIncome: 1297.60,
    periodStartParts: { year: 2025, month: 12, day: 29 },
    periodEndParts: { year: 2026, month: 1, day: 4 },
    verifiedIncomeId: "CMP-INCOME-2026-W01-PHASEB-G2"
  };
  const extractor = wrapExtractorWithTiming_(realLLMExtractor_());

  console.log("========== GATE 2: Real Data Accuracy（独立执行，不先跑 Gate 1，含计时探针）==========");
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
    (o.order_id_primary && o.order_id_primary.indexOf('8PRUR5AGXAQRAV') !== -1) ||
    (o.order_id_raw && o.order_id_raw.indexOf('8PRUR5AGXAQRAV') !== -1)
  );
  if (targetOrder) {
    console.log("[G2] 找到:", JSON.stringify(targetOrder, null, 2));
    console.log(`[G2] 判定: ${(targetOrder.net_income === 4.00 && !targetOrder.low_confidence) ? 'PASS' : 'FAIL，见上方内容'}`);
  } else {
    console.log("[G2] !!! FAIL：完全没找到这笔订单 !!!");
  }

  console.log(`\n--- Sekaligus / and N 分布 ---`);
  const sekaligus = allOrders.filter(o => o.order_row_type === 'Sekaligus');
  const singleId = sekaligus.filter(o => o.bundled_order_count === 1);
  const multiIdNoAndN = sekaligus.filter(o => o.bundled_order_count >= 2 && o.order_identity_status === 'Fully_Known');
  const withAndN = sekaligus.filter(o => o.order_identity_status === 'Partially_Known');
  console.log(`[G2] Sekaligus 笔数: ${sekaligus.length}，单-ID 无 and N: ${singleId.length}，多-ID(2+) 无 and N: ${multiIdNoAndN.length}，含 and N: ${withAndN.length}`);
  if (withAndN.length) console.log(JSON.stringify(withAndN.map(o => ({ id_raw: o.order_id_raw, bundled_order_count: o.bundled_order_count }))));

  console.log(`\n--- 跨年份日期检查 ---`);
  const byYear = {};
  allOrders.forEach(o => {
    const y = (o.order_date || o.date || '').slice(0, 4);
    byYear[y] = (byYear[y] || 0) + 1;
  });
  console.log(`[G2] 按年份分布: ${JSON.stringify(byYear)}`);

  console.log(`\n--- 非重试错误 ---`);
  console.log(`[G2] nonRetryableErrors: ${JSON.stringify(result.nonRetryableErrors || [])}`);

  console.log("\n========== 请把这次完整 log 原样贴回来（特别是 [G2-TIMING] 那几行）==========");
}
