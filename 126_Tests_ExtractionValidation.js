/**
 * 126_Tests_ExtractionValidation.js
 * 纯逻辑，不碰任何 GAS 服务——125 本身就是刻意设计成完全不依赖 GAS，这里
 * 应该是几个新文件里覆盖率最高的一个。
 */

if (typeof require === 'function') {
  var {
    validateCandidateSchema_, validateCandidatePeriod_, validateCandidateArithmetic_,
    validateExtractionCandidate_, normalizeExtractionCandidate_, isoWeekFromParts_,
    validateOrderCandidateSchema_, validateOrderCandidateStructural_, validateOrderCandidateArithmetic_,
    validateOrderCandidateTraceability_, validateOrderExtractionCandidate_
  } = require('./125_ExtractionValidation.js');
  require('./106_Utils.js');
  var { assertEqual_ } = require('./105_TestUtils.js');
}

/** 一份四则运算完全站得住、期间合法的 candidate——每条测试从这份复制再改一个地方。 */
function validCandidate_() {
  return {
    document_meta: {
      source: 'Grab',
      document_type: 'Weekly Statement',
      currency: 'MYR',
      period_start_parts: { year: 2026, month: 7, day: 20 },
      period_end_parts: { year: 2026, month: 7, day: 26 }
    },
    summary: { total_income: 500, total_deductions: 50, weekly_net: 450 },
    income_breakdown: { net_delivery_income: 300, incentive: 100, tip: 80, other_payments: 20 },
    extraction_notes: ''
  };
}

function runAllExtractionValidationTests() {
  const results = [];

  // ============ Schema ============
  assertEqual_('合法 candidate：schema 没有错误', validateCandidateSchema_(validCandidate_()), [], results);

  const missingDocMeta = validCandidate_();
  delete missingDocMeta.document_meta;
  assertEqual_('缺 document_meta：schema 报错', validateCandidateSchema_(missingDocMeta).length > 0, true, results);

  const wrongType = validCandidate_();
  wrongType.summary.total_income = '500'; // 字符串，不是 number
  assertEqual_('total_income 是字符串：schema 报错', validateCandidateSchema_(wrongType).length > 0, true, results);

  const missingPeriodPart = validCandidate_();
  delete missingPeriodPart.document_meta.period_start_parts.day;
  assertEqual_('period_start_parts 缺 day：schema 报错', validateCandidateSchema_(missingPeriodPart).length > 0, true, results);

  // ============ Period ============
  const validPeriod = validateCandidatePeriod_(validCandidate_());
  assertEqual_('合法 candidate：period 没有错误', validPeriod.errors, [], results);
  assertEqual_('合法 candidate：week 算出 2026-W30', validPeriod.week, '2026-W30', results);
  assertEqual_('合法 candidate：periodStartIso 是 2026-07-20', validPeriod.periodStartIso, '2026-07-20', results);

  const invalidMonth = validCandidate_();
  invalidMonth.document_meta.period_start_parts.month = 13; // 越界——Date.UTC 会自动进位到隔年 1 月
  const invalidMonthResult = validateCandidatePeriod_(invalidMonth);
  assertEqual_('month=13：period 报错（round-trip 检查挡下进位）', invalidMonthResult.errors.length > 0, true, results);

  const tooWideSpan = validCandidate_();
  tooWideSpan.document_meta.period_end_parts = { year: 2026, month: 8, day: 20 }; // 跟 start 差 31 天
  assertEqual_('period 相差 31 天：报错（不像 weekly statement）', validateCandidatePeriod_(tooWideSpan).errors.length > 0, true, results);

  // week 固定用 isoWeekFromParts_ 重新算，candidate 就算自己夹带 week 字段也不会被读到
  // （125 的 validateCandidatePeriod_/normalizeExtractionCandidate_ 从头到尾没有读过
  // candidate.document_meta.week 这个路径——这里用一个已知日期反向确认算法本身是对的）
  assertEqual_('isoWeekFromParts_ 已知日期算出已知 week（2026-01-01 是 2026-W01）', isoWeekFromParts_({ year: 2026, month: 1, day: 1 }), '2026-W01', results);

  // ============ Arithmetic：hallucination 的负向测试 ============
  assertEqual_('合法 candidate：arithmetic 没有错误', validateCandidateArithmetic_(validCandidate_()), [], results);

  const badTotalIncome = validCandidate_();
  badTotalIncome.summary.total_income = 999; // 跟 300+100+80+20=500 对不上——故意让数字看起来合理但兜不起来
  const badTotalIncomeErrors = validateCandidateArithmetic_(badTotalIncome);
  assertEqual_('total_income 被改成兜不起来的数字：arithmetic 报错', badTotalIncomeErrors.length > 0, true, results);

  const badWeeklyNet = validCandidate_();
  badWeeklyNet.summary.weekly_net = 1000; // 跟 500-50=450 对不上
  const badWeeklyNetErrors = validateCandidateArithmetic_(badWeeklyNet);
  assertEqual_('weekly_net 被改成兜不起来的数字：arithmetic 报错', badWeeklyNetErrors.length > 0, true, results);

  const withinTolerance = validCandidate_();
  withinTolerance.summary.total_income = 500.005; // 跟 round2_ 的容差内——不该被拒
  assertEqual_('容差内的浮点误差：arithmetic 不报错', validateCandidateArithmetic_(withinTolerance), [], results);

  // ============ validateExtractionCandidate_：三层组起来的行为 ============
  const validOverall = validateExtractionCandidate_(validCandidate_());
  assertEqual_('合法 candidate：整体 valid=true', validOverall.valid, true, results);
  assertEqual_('合法 candidate：stage 是 null', validOverall.stage, null, results);

  const schemaFailOverall = validateExtractionCandidate_(missingDocMeta);
  assertEqual_('schema 没过：stage 是 Extraction_Failed（不是 Needs_Review——形状都不对没什么好 review）', schemaFailOverall.stage, 'Extraction_Failed', results);

  const hallucinationOverall = validateExtractionCandidate_(badTotalIncome);
  assertEqual_('hallucination（数字兜不起来）：stage 是 Needs_Review，不是静默接受也不是直接丢弃', hallucinationOverall.stage, 'Needs_Review', results);
  assertEqual_('hallucination：valid 是 false（不能变成 Verified）', hallucinationOverall.valid, false, results);
  assertEqual_('hallucination：errors 里有内容，不是吞掉不说', hallucinationOverall.errors.length > 0, true, results);

  // 同时踩到 period 跟 arithmetic 两种问题：两类错误都要出现，不能因为 period
  // 先失败就不检查 arithmetic 了
  const bothBad = validCandidate_();
  bothBad.document_meta.period_start_parts.month = 13;
  bothBad.summary.total_income = 999;
  const bothBadResult = validateExtractionCandidate_(bothBad);
  assertEqual_('period 跟 arithmetic 都有问题：errors 至少有 2 条', bothBadResult.errors.length >= 2, true, results);

  // ============ normalizeExtractionCandidate_ ============
  const normalized = normalizeExtractionCandidate_(validCandidate_(), validOverall, 'LLMExtractor:gemini-3.7-flash', '2026-08-21T10:00:00.000Z');
  assertEqual_('normalize 后 document_meta.week 是 2026-W30', normalized.document_meta.week, '2026-W30', results);
  assertEqual_('normalize 后 income_breakdown.tip.amount 是 80', normalized.income_breakdown.tip.amount, 80, results);
  assertEqual_('normalize 后 _parser_id 记录 extractor 来源', normalized._parser_id, 'LLMExtractor:gemini-3.7-flash', results);

  let normalizeThrew = false;
  try {
    normalizeExtractionCandidate_(badTotalIncome, hallucinationOverall, 'x', 'y');
  } catch (err) {
    normalizeThrew = true;
  }
  assertEqual_('normalize 不能对没通过验证的 candidate 呼叫——会抛错，不会静默产出东西', normalizeThrew, true, results);

  // ============ Order-level (Butiran Tempahan) candidate — Phase 4，2026-08-25 ============
  function validOrderCandidate_() {
    return {
      extraction_scope: { first_page_seen: 7, last_page_seen: 9 },
      days: [{
        weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: true, printed_daily_subtotal: 9.40,
        orders: [
          { order_row_type: 'Tunggal', platform_raw: 'GrabFood', order_ids_raw: ['A-8QLIOUFWWKVDAV'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 4.10, other_income: 1.40, income_adjustment: 0, net_income: 5.50, source_page: 7, low_confidence: false },
          { order_row_type: 'Sekaligus', platform_raw: 'GrabFood', order_ids_raw: ['A-8QL4CN9WWW57AV'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 3.90, other_income: 0, income_adjustment: 0, net_income: 3.90, source_page: 8, low_confidence: false }
        ]
      }],
      notes: ''
    };
  }

  assertEqual_('合法 order candidate：schema 没有错误', validateOrderCandidateSchema_(validOrderCandidate_()), [], results);
  assertEqual_('合法 order candidate：structural 没有错误', validateOrderCandidateStructural_(validOrderCandidate_()), [], results);
  assertEqual_('合法 order candidate：arithmetic 没有错误', validateOrderCandidateArithmetic_(validOrderCandidate_()), [], results);
  assertEqual_('合法 order candidate：traceability 没有错误', validateOrderCandidateTraceability_(validOrderCandidate_()), [], results);
  assertEqual_('合法 order candidate：整体 valid=true', validateOrderExtractionCandidate_(validOrderCandidate_()).valid, true, results);

  const badRowType = validOrderCandidate_();
  badRowType.days[0].orders[0].order_row_type = 'Sesuatu';
  assertEqual_('未知 row type：schema 报错', validateOrderCandidateSchema_(badRowType).length > 0, true, results);

  const sekaligusZeroIds = validOrderCandidate_();
  sekaligusZeroIds.days[0].orders[1].order_ids_raw = [];
  sekaligusZeroIds.days[0].orders[1].and_more_count = 0;
  assertEqual_('Sekaligus 0 个订单号且 and_more_count=0：structural 报错（今天确认的规则：>=1 个即合法，0 个不合法）', validateOrderCandidateStructural_(sekaligusZeroIds).length > 0, true, results);

  const sekaligusOneId = validOrderCandidate_(); // 已经是 1 个 id 的 Sekaligus，代表今天的规则变更
  assertEqual_('Sekaligus 只有 1 个订单号、没有 and N：structural 不报错（W33 page 14 已经肉眼核实过的真实规则）', validateOrderCandidateStructural_(sekaligusOneId).length, 0, results);

  const tunggalTwoIds = validOrderCandidate_();
  tunggalTwoIds.days[0].orders[0].order_ids_raw = ['A-1', 'A-2'];
  assertEqual_('Tunggal 却有 2 个订单号：structural 报错', validateOrderCandidateStructural_(tunggalTwoIds).length > 0, true, results);

  const badIdFormat = validOrderCandidate_();
  badIdFormat.days[0].orders[0].order_ids_raw = ['XYZ-not-a-real-format'];
  assertEqual_('订单号格式不符合已知 Grab pattern：structural 报错', validateOrderCandidateStructural_(badIdFormat).length > 0, true, results);

  const badPayment = validOrderCandidate_();
  badPayment.days[0].orders[0].payment_method_raw = 'Bitcoin';
  assertEqual_('未知付款方式：structural 报错', validateOrderCandidateStructural_(badPayment).length > 0, true, results);

  const badArithmetic = validOrderCandidate_();
  badArithmetic.days[0].orders[0].net_income = 999;
  assertEqual_('asas+lain+pelarasan 跟 net_income 对不上：arithmetic 报错', validateOrderCandidateArithmetic_(badArithmetic).length > 0, true, results);

  const dupIds = validOrderCandidate_();
  dupIds.days[0].orders[1].order_ids_raw = ['A-8QL4CN9WWW57AV', 'A-8QL4CN9WWW57AV'];
  assertEqual_('同一行内部重复订单号：traceability 报错（可能是读取重复，不是真实重复）', validateOrderCandidateTraceability_(dupIds).length > 0, true, results);

  const orderMissingArithmeticAndStructural = validOrderCandidate_();
  orderMissingArithmeticAndStructural.days[0].orders[0].payment_method_raw = 'Bitcoin';
  orderMissingArithmeticAndStructural.days[0].orders[0].net_income = 999;
  const combinedValidation = validateOrderExtractionCandidate_(orderMissingArithmeticAndStructural);
  assertEqual_('同时有 structural 跟 arithmetic 问题：一次全部列出，不是抓到第一个就停', combinedValidation.errors.length >= 2, true, results);
  assertEqual_('schema 过但其他层没过：stage 是 Needs_Review 不是 Extraction_Failed', combinedValidation.stage, 'Needs_Review', results);

  const brokenSchema = { days: 'not-an-array' };
  assertEqual_('schema 本身就坏掉：stage 是 Extraction_Failed', validateOrderExtractionCandidate_(brokenSchema).stage, 'Extraction_Failed', results);

  const allPass = results.every((r) => r.pass);

  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllExtractionValidationTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllExtractionValidationTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllExtractionValidationTests };
}
