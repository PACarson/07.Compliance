/**
 * 150_ComplianceCalendar.js
 * Compliance OS — Compliance Calendar（对应治理文档 §7、CMP-P6/EP4）
 *
 * 核心设计决定（延续 v0.5 的 EP4 重新设计，这里落成代码）：
 *  - Upcoming/Due_Soon/Overdue 永远查询时即时算，不存欄位。
 *  - "完成"不是拿 UPDATE 改一行既有记录的 completed_at——TruthWriter 现在
 *    只支援 append（UCR6，对应生态整体的 event-sourcing 风格：Rider OS 的
 *    TruthEngine、Personal AI Core 的 EventBus 都是只加不改）。改成
 *    Compliance_Completions 是独立的、append-only 的完成记录表；一个
 *    obligation_id 只要出现过一笔完成记录，就代表这个（这一次）义务完成了。
 *  - 因此周期性义务（recurrence != None）不是同一个 obligation_id 重复使用
 *    ——每个周期算一个新的 obligation_id（例如 CMP-CAL-ROADTAX-2026 完成后，
 *    下一次到期是 CMP-CAL-ROADTAX-2027，不是同一笔记录被改状态），这样
 *    「这个义务完成了没」永远只是「这个 obligation_id 有没有出现在
 *    Compliance_Completions 里」，不需要处理"这个完成记录属于哪个周期"
 *    这种更复杂的对应关系。
 *
 * 还没解决、故意留着不猜的问题：同一个 obligation 连续好几天都是 Due_Soon，
 * 每次扫描是不是都要发一次 COMPLIANCE_DUE_SOON？这样会不会太吵？——这个
 * 留给人工验证清单，不在这版猜一个"避免重复通知"的机制（EP3：没有实际
 * 使用证据前，不知道多久提醒一次才合理）。
 */

var COMPLIANCE_CALENDAR_COLUMNS = [
  'obligation_id', 'category', 'title', 'due_date', 'recurrence', 'reminder_lead_days', 'linked_document_id'
];

var COMPLIANCE_COMPLETIONS_COLUMNS = ['obligation_id', 'completed_at', 'linked_document_id', 'note'];

/** CMP-CAL-{OBLIGATION_CODE}-{YEAR}。obligationCode 由呼叫方明确指定
 *（例如 "ROADTAX"、"PASSPORT"），不自动从 title/category 猜——同一个
 * category（例如 Vehicle）底下可能同时有路税跟保险两种不同义务，用
 * category 当 ID 会撞名，CMP-P10。 */
function computeObligationId_(obligationCode, year) {
  return `CMP-CAL-${String(obligationCode).toUpperCase()}-${year}`;
}

function parseIsoDateParts_(isoDateStr) {
  const m = String(isoDateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`不是合法的 ISO 日期格式（YYYY-MM-DD）：${isoDateStr}`);
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
}

function isoDateFromParts_(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/** to - from，单位天。UCR4：全程用拆解好的整数透过 Date.UTC 组装，不把
 *  日期字符串直接交给 Date 构造函数解析。 */
function daysBetween_(fromParts, toParts) {
  const fromMs = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toMs = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.round((toMs - fromMs) / (24 * 3600 * 1000));
}

/**
 * 核心：可推导的状态查询时即时算，不存欄位（EP4）。
 * @param {{due_date: string, reminder_lead_days: number}} obligation
 * @param {boolean} hasCompletion 这个 obligation_id 是否已经有完成记录——
 *   由呼叫方去查 Compliance_Completions 决定，这个函数本身不碰 I/O
 * @param {Date} now
 * @return {{status: string, days_remaining: number}}
 */
function computeObligationStatus_(obligation, hasCompletion, now) {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    throw new Error('computeObligationStatus_: now 必须是合法的 Date 对象'); // UCR4
  }
  if (hasCompletion) {
    return { status: 'Completed', days_remaining: null };
  }
  const nowParts = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  const dueParts = parseIsoDateParts_(obligation.due_date);
  const daysRemaining = daysBetween_(nowParts, dueParts);

  if (daysRemaining < 0) {
    return { status: 'Overdue', days_remaining: daysRemaining };
  }
  if (daysRemaining <= obligation.reminder_lead_days) {
    return { status: 'Due_Soon', days_remaining: daysRemaining };
  }
  return { status: 'Upcoming', days_remaining: daysRemaining };
}

/**
 * 周期性义务下一次到期日（只算日期，不建新记录——建新记录是呼叫方的事，
 * 通常在这一期被标记完成、或临近到期时才做，不是这个函数自动做的）。
 * @param {string} dueDate 这一期的到期日
 * @param {string} recurrence "Annual" | "Monthly" | "None"
 * @return {string|null} None 回 null
 */
function computeNextOccurrenceDate_(dueDate, recurrence) {
  const parts = parseIsoDateParts_(dueDate);
  if (recurrence === 'Annual') {
    return isoDateFromParts_({ year: parts.year + 1, month: parts.month, day: parts.day });
  }
  if (recurrence === 'Monthly') {
    const totalMonths = parts.month - 1 + 1;
    return isoDateFromParts_({ year: parts.year + Math.floor(totalMonths / 12), month: (totalMonths % 12) + 1, day: parts.day });
  }
  if (recurrence === 'None') {
    return null;
  }
  throw new Error(`未知的 recurrence 类型："${recurrence}"（只接受 Annual/Monthly/None，CMP-P10 不猜）`);
}

function buildObligationRecord_(obligationId, meta) {
  return {
    obligation_id: obligationId,
    category: meta.category,
    title: meta.title,
    due_date: meta.dueDate,
    recurrence: meta.recurrence || 'None',
    reminder_lead_days: meta.reminderLeadDays,
    linked_document_id: meta.linkedDocumentId || ''
  };
}

function buildCompletionRecord_(obligationId, now, linkedDocumentId, note) {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    throw new Error('buildCompletionRecord_: now 必须是合法的 Date 对象');
  }
  return {
    obligation_id: obligationId,
    completed_at: now.toISOString(),
    linked_document_id: linkedDocumentId || '',
    note: note || ''
  };
}

/** COMPLIANCE_DUE_SOON / COMPLIANCE_OVERDUE / COMPLIANCE_COMPLETED——通用
 *  schema，不分具名事件（§5.2 已确认不采纳具名事件的方向，这里延续）。 */
function buildComplianceCalendarEvent_(obligation, statusResult, eventId) {
  const eventTypeMap = { Due_Soon: 'COMPLIANCE_DUE_SOON', Overdue: 'COMPLIANCE_OVERDUE', Completed: 'COMPLIANCE_COMPLETED' };
  const eventType = eventTypeMap[statusResult.status];
  if (!eventType) {
    throw new Error(`buildComplianceCalendarEvent_: "Upcoming" 状态不发事件，呼叫前应该先过滤掉`);
  }
  return {
    event_id: eventId,
    obligation_id: obligation.obligation_id,
    category: obligation.category,
    title: obligation.title,
    due_date: obligation.due_date,
    days_remaining: statusResult.days_remaining,
    message: `${obligation.title}${statusResult.status === 'Overdue' ? '已逾期' : statusResult.status === 'Completed' ? '已完成' : `将在 ${statusResult.days_remaining} 天后到期`}`,
    priority: statusResult.status === 'Overdue' ? 'high' : 'normal',
    _event_type: eventType
  };
}

function writeObligation_(truthWriter, record) {
  return truthWriter.appendValidatedRow('Compliance_Calendar', record, COMPLIANCE_CALENDAR_COLUMNS);
}

function recordCompletion_(truthWriter, record) {
  return truthWriter.appendValidatedRow('Compliance_Completions', record, COMPLIANCE_COMPLETIONS_COLUMNS);
}

/**
 * 编排：算状态 → Upcoming 不发事件、其他状态发事件（透过 EventPublisher）。
 * @param {Object} obligation
 * @param {boolean} hasCompletion
 * @param {{eventPublisher: Object, now: Date}} deps
 * @return {{status: string, days_remaining: (number|null), event: (Object|null)}}
 */
function evaluateObligation_(obligation, hasCompletion, deps) {
  const statusResult = computeObligationStatus_(obligation, hasCompletion, deps.now);
  if (statusResult.status === 'Upcoming') {
    return Object.assign({ event: null }, statusResult);
  }
  const eventId = `CMP-EVT-${obligation.obligation_id}-${deps.now.getTime()}`;
  const event = buildComplianceCalendarEvent_(obligation, statusResult, eventId);
  deps.eventPublisher.publish(event._event_type, event);
  return Object.assign({ event }, statusResult);
}

if (typeof module !== 'undefined') {
  module.exports = {
    COMPLIANCE_CALENDAR_COLUMNS,
    COMPLIANCE_COMPLETIONS_COLUMNS,
    computeObligationId_,
    computeObligationStatus_,
    computeNextOccurrenceDate_,
    buildObligationRecord_,
    buildCompletionRecord_,
    buildComplianceCalendarEvent_,
    writeObligation_,
    recordCompletion_,
    evaluateObligation_
  };
}
