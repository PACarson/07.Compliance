/**
 * 151_Tests_ComplianceCalendar.js
 */
if (typeof require === 'function') {
  var {
    computeObligationId_, computeObligationStatus_, computeNextOccurrenceDate_,
    buildObligationRecord_, buildCompletionRecord_, buildComplianceCalendarEvent_,
    writeObligation_, recordCompletion_, evaluateObligation_,
    COMPLIANCE_CALENDAR_COLUMNS, COMPLIANCE_COMPLETIONS_COLUMNS
  } = require('./150_ComplianceCalendar.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
  var { assertEqual_, fakeSheetAccessor_, fakeLockProvider_ } = require('./105_TestUtils.js');
}

function fakeEventPublisher_() {
  const published = [];
  return { publish(eventType, payload) { published.push({ eventType, payload }); }, getPublished() { return published; } };
}

function runAllComplianceCalendarTests() {
  const results = [];
  const now = new Date('2026-09-01T00:00:00Z');

  // ---- obligation_id 格式 ----
  assertEqual_('obligation_id 格式', computeObligationId_('roadtax', 2026), 'CMP-CAL-ROADTAX-2026', results);

  // ---- 状态计算：Upcoming/Due_Soon/Overdue/Completed，全部即时算，不靠存储 ----
  const farObligation = { due_date: '2026-12-31', reminder_lead_days: 14 };
  assertEqual_('远期义务·status', computeObligationStatus_(farObligation, false, now).status, 'Upcoming', results);

  const soonObligation = { due_date: '2026-09-10', reminder_lead_days: 14 };
  const soonResult = computeObligationStatus_(soonObligation, false, now);
  assertEqual_('临近义务·status', soonResult.status, 'Due_Soon', results);
  assertEqual_('临近义务·days_remaining', soonResult.days_remaining, 9, results);

  // 边界：剩余天数正好等于 reminder_lead_days，应该算 Due_Soon（<=），不是 Upcoming
  const boundaryObligation = { due_date: '2026-09-15', reminder_lead_days: 14 };
  assertEqual_('边界值（剩 14 天，门槛 14 天）·status', computeObligationStatus_(boundaryObligation, false, now).status, 'Due_Soon', results);

  const overdueObligation = { due_date: '2026-08-01', reminder_lead_days: 14 };
  const overdueResult = computeObligationStatus_(overdueObligation, false, now);
  assertEqual_('逾期义务·status', overdueResult.status, 'Overdue', results);
  assertEqual_('逾期义务·days_remaining 是负数', overdueResult.days_remaining < 0, true, results);

  // 已完成——不管到期日是什么，hasCompletion=true 就是 Completed（这是唯一真正存储的事实）
  assertEqual_('已完成义务·status（即使还没到期）', computeObligationStatus_(farObligation, true, now).status, 'Completed', results);

  let threwBadNow = false;
  try { computeObligationStatus_(farObligation, false, new Date('not-a-date')); } catch (e) { threwBadNow = true; }
  results.push({ name: 'now 不合法时抛错', pass: threwBadNow });

  // ---- 周期性义务的下一次到期日 ----
  assertEqual_('Annual 下一次到期', computeNextOccurrenceDate_('2026-09-15', 'Annual'), '2027-09-15', results);
  assertEqual_('Monthly 下一次到期（跨年）', computeNextOccurrenceDate_('2026-12-15', 'Monthly'), '2027-01-15', results);
  assertEqual_('Monthly 下一次到期（不跨年）', computeNextOccurrenceDate_('2026-03-15', 'Monthly'), '2026-04-15', results);
  assertEqual_('None 没有下一次', computeNextOccurrenceDate_('2026-09-15', 'None'), null, results);
  let threwUnknownRecurrence = false;
  try { computeNextOccurrenceDate_('2026-09-15', 'Weekly'); } catch (e) { threwUnknownRecurrence = true; }
  results.push({ name: '未知 recurrence 类型时抛错，不猜', pass: threwUnknownRecurrence });

  // ---- 事件建构：Upcoming 不该建事件 ----
  let threwOnUpcomingEvent = false;
  try { buildComplianceCalendarEvent_(farObligation, { status: 'Upcoming', days_remaining: 100 }, 'x'); } catch (e) { threwOnUpcomingEvent = true; }
  results.push({ name: 'Upcoming 状态建事件时抛错', pass: threwOnUpcomingEvent });

  const dueSoonEvent = buildComplianceCalendarEvent_(
    { obligation_id: 'CMP-CAL-ROADTAX-2026', category: 'Vehicle', title: '路税续保', due_date: '2026-09-10' },
    soonResult, 'CMP-EVT-x-1'
  );
  assertEqual_('Due_Soon 事件·类型', dueSoonEvent._event_type, 'COMPLIANCE_DUE_SOON', results);
  assertEqual_('Due_Soon 事件·priority', dueSoonEvent.priority, 'normal', results);

  const overdueEvent = buildComplianceCalendarEvent_(
    { obligation_id: 'CMP-CAL-ROADTAX-2026', category: 'Vehicle', title: '路税续保', due_date: '2026-08-01' },
    overdueResult, 'CMP-EVT-x-2'
  );
  assertEqual_('Overdue 事件·类型', overdueEvent._event_type, 'COMPLIANCE_OVERDUE', results);
  assertEqual_('Overdue 事件·priority 是 high', overdueEvent.priority, 'high', results);

  // ---- 写入：Compliance_Calendar / Compliance_Completions 都是 append-only ----
  const accessor = fakeSheetAccessor_();
  const truthWriter = createTruthWriter_(accessor, fakeLockProvider_());
  const obligationRecord = buildObligationRecord_('CMP-CAL-ROADTAX-2026', {
    category: 'Vehicle', title: '路税续保', dueDate: '2026-09-15', recurrence: 'Annual', reminderLeadDays: 14
  });
  writeObligation_(truthWriter, obligationRecord);
  assertEqual_('Compliance_Calendar 写入栏位数', accessor.getWritten('Compliance_Calendar')[0].length, COMPLIANCE_CALENDAR_COLUMNS.length, results);

  const completionRecord = buildCompletionRecord_('CMP-CAL-ROADTAX-2026', now, 'CMP-DOC-x', '已续保');
  recordCompletion_(truthWriter, completionRecord);
  assertEqual_('Compliance_Completions 写入栏位数', accessor.getWritten('Compliance_Completions')[0].length, COMPLIANCE_COMPLETIONS_COLUMNS.length, results);

  // ---- 编排：Upcoming 不发事件；Due_Soon/Overdue/Completed 都会发 ----
  const publisher1 = fakeEventPublisher_();
  const upcomingEval = evaluateObligation_(farObligation, false, { eventPublisher: publisher1, now });
  assertEqual_('Upcoming·不发事件', publisher1.getPublished().length, 0, results);
  assertEqual_('Upcoming·event 是 null', upcomingEval.event, null, results);

  const publisher2 = fakeEventPublisher_();
  const dueSoonEval = evaluateObligation_(soonObligation, false, { eventPublisher: publisher2, now });
  assertEqual_('Due_Soon·发了一个事件', publisher2.getPublished().length, 1, results);
  assertEqual_('Due_Soon·事件类型正确', publisher2.getPublished()[0].eventType, 'COMPLIANCE_DUE_SOON', results);

  const publisher3 = fakeEventPublisher_();
  const completedEval = evaluateObligation_(farObligation, true, { eventPublisher: publisher3, now });
  assertEqual_('Completed·发了一个事件', publisher3.getPublished().length, 1, results);
  assertEqual_('Completed·事件类型正确', publisher3.getPublished()[0].eventType, 'COMPLIANCE_COMPLETED', results);

  const allPass = results.every((r) => r.pass);
  results.forEach((r) => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}` + (r.pass ? '' : ` (got ${JSON.stringify(r.actual)}, expected ${JSON.stringify(r.expected)})`));
  });
  console.log(allPass ? '\n=== runAllComplianceCalendarTests: 全部通过 ===' : '\n=== 有失败项 ===');
  return allPass;
}

if (typeof require === 'function' && require.main === module) {
  const ok = runAllComplianceCalendarTests();
  process.exit(ok ? 0 : 1);
}
if (typeof module !== 'undefined') {
  module.exports = { runAllComplianceCalendarTests };
}

/**
 * ============ 人工验证清单 ============
 * [ ] 没解决、故意留着的问题：同一个 obligation 连续几天都是 Due_Soon，
 *     每次排程扫描是不是都会重复发送 COMPLIANCE_DUE_SOON？要不要加一个
 *     「上次通知时间」之类的字段避免吵——这是真实事实（一个动作发生的
 *     时间），不违反 EP4，但目前没有实际使用证据支撑该怎么设计，先不猜
 * [ ] 真实 GAS 环境下确认 Compliance_Calendar 和 Compliance_Completions
 *     两张表都已经建好，栏位对得上
 * [ ] 周期性义务完成后，谁负责用 computeNextOccurrenceDate_() 建下一期的
 *     新 obligation（新的 obligation_id）？这个编排还没写，目前只有算
 *     下一次日期的纯函数
 */
