import React, { useState, useEffect, useCallback } from 'react';
import { Stamp, PencilLine, AlertTriangle, ChevronRight, Loader2, Trash2, FileText, Circle, Bell } from 'lucide-react';

/* ============================================================
   PORTED LOGIC — mirrors 121_GrabWeeklyParser.js / 130_Reconciliation.js
   (v2) / 160_MonthlyProjection.js / 150_ComplianceCalendar.js.

   v2 change: Rider OS is an OPTIONAL cross-check, not a gate.
   CMP-P1 (Official Truth Principle) says the Grab Statement itself
   is the authoritative source — Reconciliation only annotates a
   Verified Income record (Not_Performed / Matched / Discrepancy_Flagged),
   it never blocks publishing it.
   ============================================================ */

const MALAY_MONTHS = {
  januari: 1, februari: 2, mac: 3, april: 4, mei: 5, jun: 6,
  julai: 7, ogos: 8, september: 9, oktober: 10, november: 11, disember: 12
};

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function parseMalayDateParts(text) {
  const m = text.trim().match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
  if (!m) throw new Error(`日期格式无法识别："${text}"`);
  const day = parseInt(m[1], 10);
  const month = MALAY_MONTHS[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (!month) throw new Error(`无法识别的马来文月份："${m[2]}"`);
  return { year, month, day };
}

function isoDateString(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function isoWeekFromParts(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const target = new Date(date.getTime());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function findAmountAfterLabel(text, label, searchWindow = 160) {
  const idx = text.indexOf(label);
  if (idx === -1) throw new Error(`找不到字段："${label}"`);
  const windowText = text.slice(idx + label.length, idx + label.length + searchWindow);
  const m = windowText.match(/-?[\d,]+\.\d{2}/);
  if (!m) throw new Error(`找到字段 "${label}" 但附近没有金额`);
  return parseFloat(m[0].replace(/,/g, ''));
}

function parseGrabWeeklyStatement(rawText) {
  const periodMatch = rawText.match(/(\d{1,2}\s+[A-Za-z]+,?\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]+,?\s+\d{4})/);
  if (!periodMatch) throw new Error('找不到统计期间（例如 "20 Julai, 2026 - 26 Julai, 2026"）');
  const periodStartParts = parseMalayDateParts(periodMatch[1]);
  const periodEndParts = parseMalayDateParts(periodMatch[2]);

  const ringkasanIdx = rawText.indexOf('Ringkasan');
  const butiranIdx = rawText.indexOf('Butiran pendapatan');
  if (ringkasanIdx === -1 || butiranIdx === -1 || butiranIdx <= ringkasanIdx) {
    throw new Error('找不到 "Ringkasan" 或 "Butiran pendapatan" 区块，无法界定汇总范围');
  }
  const summarySection = rawText.slice(ringkasanIdx, butiranIdx);
  const summary = {
    total_income: findAmountAfterLabel(summarySection, 'Jumlah Pendapatan'),
    total_deductions: findAmountAfterLabel(summarySection, 'Jumlah Penolakan'),
    weekly_net: findAmountAfterLabel(summarySection, 'Jumlah Mingguan')
  };

  const breakdownSection = rawText.slice(butiranIdx, butiranIdx + 1200);
  const components = {
    base_food_income: { amount: findAmountAfterLabel(breakdownSection, 'Pendapatan asas makanan') },
    base_express_income: { amount: findAmountAfterLabel(breakdownSection, 'Pendapatan asas Express') },
    express_addon_bonus: { amount: findAmountAfterLabel(breakdownSection, 'Bonus add-on express') },
    income_adjustment: { amount: findAmountAfterLabel(breakdownSection, 'Pelarasan Pendapatan') },
    commission: { amount: findAmountAfterLabel(breakdownSection, 'Komisen') }
  };
  const netDeliveryStated = findAmountAfterLabel(breakdownSection, 'Pendapatan bersih penghantaran');
  const netDeliveryComputed = round2(
    components.base_food_income.amount + components.base_express_income.amount +
    components.express_addon_bonus.amount + components.income_adjustment.amount - components.commission.amount
  );

  const incomeBreakdown = {
    net_delivery_income: { amount: netDeliveryStated, components },
    incentive: { amount: findAmountAfterLabel(breakdownSection, 'Insentif') },
    tip: { amount: findAmountAfterLabel(breakdownSection, 'Tip') },
    other_payments: { amount: findAmountAfterLabel(breakdownSection, 'Bayaran lain-lain') }
  };
  const recomputedTotal = round2(netDeliveryStated + incomeBreakdown.incentive.amount + incomeBreakdown.tip.amount + incomeBreakdown.other_payments.amount);

  return {
    document_meta: {
      source: 'Grab', document_type: 'Weekly Statement',
      period_start: isoDateString(periodStartParts), period_end: isoDateString(periodEndParts),
      week: isoWeekFromParts(periodStartParts), currency: 'MYR'
    },
    summary, income_breakdown: incomeBreakdown,
    _consistency_check: {
      net_delivery_stated_vs_computed_diff: round2(netDeliveryStated - netDeliveryComputed),
      total_income_stated_vs_recomputed_diff: round2(summary.total_income - recomputedTotal)
    }
  };
}

const DEFAULT_TOLERANCE = { toleranceAbsolute: 5, tolerancePct: 0.005 };

/** v2: riderEstimate can be null — that's a normal case (Not_Performed), never an error. */
function reconcileStatement(parsedStatement, riderEstimate, config = DEFAULT_TOLERANCE) {
  const statementTotal = parsedStatement.summary.weekly_net;
  if (!riderEstimate) {
    return { statement_total: statementTotal, rider_total: null, difference: null, difference_pct: null, reconciliation_status: 'Not_Performed' };
  }
  const riderTotal = round2(riderEstimate.daily_estimate_total + riderEstimate.reward_estimate_total);
  const difference = round2(statementTotal - riderTotal);
  const differencePct = riderTotal !== 0 ? round2((Math.abs(difference) / Math.abs(riderTotal)) * 100) : (difference === 0 ? 0 : 100);
  const tolerance = Math.max(config.toleranceAbsolute, Math.abs(statementTotal) * config.tolerancePct);
  const withinTolerance = Math.abs(difference) <= tolerance;
  return {
    statement_total: statementTotal, rider_total: riderTotal, difference, difference_pct: differencePct,
    reconciliation_status: withinTolerance ? 'Matched' : 'Discrepancy_Flagged'
  };
}

function isoWeekToYearMonth(isoWeekStr) {
  const m = String(isoWeekStr).match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error(`不是合法的 ISO 周格式：${isoWeekStr}`);
  const year = parseInt(m[1], 10), week = parseInt(m[2], 10);
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Date = new Date(jan4);
  const jan4IsoWeekday = (jan4Date.getUTCDay() + 6) % 7;
  const week1MondayMs = jan4 - jan4IsoWeekday * 24 * 3600 * 1000;
  const targetThursdayMs = week1MondayMs + ((week - 1) * 7 + 3) * 24 * 3600 * 1000;
  const targetThursday = new Date(targetThursdayMs);
  return `${targetThursday.getUTCFullYear()}-${String(targetThursday.getUTCMonth() + 1).padStart(2, '0')}`;
}

function computeMonthlySummaries(verifiedRecords) {
  const byMonth = {};
  verifiedRecords.forEach((r) => {
    const ym = isoWeekToYearMonth(r.period);
    if (!byMonth[ym]) byMonth[ym] = { year_month: ym, week_count: 0, net_delivery_income: 0, incentive: 0, tip: 0, other_payments: 0, net: 0 };
    const b = byMonth[ym];
    b.week_count += 1;
    b.net_delivery_income = round2(b.net_delivery_income + r.net_delivery_income);
    b.incentive = round2(b.incentive + r.incentive);
    b.tip = round2(b.tip + r.tip);
    b.other_payments = round2(b.other_payments + r.other_payments);
    b.net = round2(b.net + r.net);
  });
  return Object.values(byMonth).sort((a, b) => (a.year_month < b.year_month ? 1 : -1));
}

/** Compliance Calendar-style status, computed on demand — mirrors 150_ComplianceCalendar.js's
    computeObligationStatus_(): Upcoming/Due_Soon/Overdue from due_date + reminder_lead_days + now. */
function computeNextMonthlyDueDate(dueDay, now) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  let candidate = new Date(Date.UTC(y, m, dueDay));
  if (candidate.getTime() < Date.UTC(y, m, now.getUTCDate())) {
    candidate = new Date(Date.UTC(y, m + 1, dueDay));
  }
  return candidate;
}

function computeSocsoStatus(dueDay, reminderLeadDays, now) {
  const due = computeNextMonthlyDueDate(dueDay, now);
  const daysRemaining = Math.round((due.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / (24 * 3600 * 1000));
  const dueStr = `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, '0')}-${String(due.getUTCDate()).padStart(2, '0')}`;
  let status = 'Upcoming';
  if (daysRemaining < 0) status = 'Overdue';
  else if (daysRemaining <= reminderLeadDays) status = 'Due_Soon';
  return { due_date: dueStr, days_remaining: daysRemaining, status };
}

/* ============================================================
   STORAGE
   ============================================================ */
const LEDGER_KEY = 'compliance_os_verified_income_ledger';
const STATUTORY_KEY = 'compliance_os_statutory_payments';
const SETTINGS_KEY = 'compliance_os_settings';

/* ============================================================
   UI PRIMITIVES — Verified = stamp, Projection = dashed pencil,
   Discrepancy = amber flag (informational, never blocking).
   ============================================================ */
function VerifiedStamp() {
  return (
    <span className="inline-flex items-center gap-1 -rotate-2 border-2 border-[#0F6B5C] text-[#0F6B5C] px-2 py-0.5 text-[11px] font-bold tracking-widest uppercase font-mono rounded-sm">
      <Stamp size={12} strokeWidth={2.5} /> Verified
    </span>
  );
}
function ProjectionBadge({ children = 'Projection' }) {
  return (
    <span className="inline-flex items-center gap-1 border border-dashed border-[#8A6D1F] text-[#8A6D1F] px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase font-mono rounded-sm">
      <PencilLine size={12} strokeWidth={2} /> {children}
    </span>
  );
}
function ReconBadge({ status }) {
  if (status === 'Matched') return <span className="inline-flex items-center gap-1 text-[#0F6B5C] text-[11px] font-mono"><Circle size={8} fill="currentColor" /> Matched</span>;
  if (status === 'Discrepancy_Flagged') return <span className="inline-flex items-center gap-1 text-[#A3372B] text-[11px] font-mono font-semibold"><AlertTriangle size={11} /> Discrepancy Flagged</span>;
  return <span className="inline-flex items-center gap-1 text-[#8A8570] text-[11px] font-mono"><Circle size={8} /> Not Reconciled</span>;
}
const MYR = (n) => n === null || n === undefined ? '—' : `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ============================================================
   MAIN CONSOLE
   ============================================================ */
export default function ComplianceOsConsole() {
  const [statementText, setStatementText] = useState('');
  const [dailyEstimate, setDailyEstimate] = useState('');
  const [rewardEstimate, setRewardEstimate] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [reconResult, setReconResult] = useState(null);
  const [processError, setProcessError] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [statutory, setStatutory] = useState([]);
  const [settings, setSettings] = useState({ socsoDueDay: 15, socsoReminderLeadDays: 5 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [socsoAmount, setSocsoAmount] = useState('49.40');
  const [socsoMonth, setSocsoMonth] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { const l = await window.storage.get(LEDGER_KEY); setLedger(l ? JSON.parse(l.value) : []); } catch (e) { setLedger([]); }
    try { const s = await window.storage.get(STATUTORY_KEY); setStatutory(s ? JSON.parse(s.value) : []); } catch (e) { setStatutory([]); }
    try { const g = await window.storage.get(SETTINGS_KEY); if (g) setSettings(JSON.parse(g.value)); } catch (e) { /* use defaults */ }
    setLoading(false);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  async function saveLedger(next) {
    setLedger(next);
    try { await window.storage.set(LEDGER_KEY, JSON.stringify(next)); }
    catch (e) { setProcessError('保存失败，请重试一次：' + e.message); }
  }
  async function saveStatutory(next) {
    setStatutory(next);
    try { await window.storage.set(STATUTORY_KEY, JSON.stringify(next)); }
    catch (e) { setProcessError('保存失败，请重试一次：' + e.message); }
  }
  async function saveSettings(next) {
    setSettings(next);
    try { await window.storage.set(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { /* best effort */ }
  }

  function handleProcess() {
    setProcessError(null); setParseResult(null); setReconResult(null);
    if (!statementText.trim()) { setProcessError('先贴上 Grab Weekly Statement 的文字。'); return; }
    try {
      const parsed = parseGrabWeeklyStatement(statementText);
      setParseResult(parsed);
      const already = ledger.find((r) => r.period === parsed.document_meta.week);
      if (already) { setProcessError(`${parsed.document_meta.week} 已经有一笔记录了（${already.income_id}）——没有重复导入。`); return; }
      // v2：Rider 数据是可选的——两个都没填就是 null，直接跳过对账，不拦截
      const hasRiderData = dailyEstimate !== '' && rewardEstimate !== '';
      const recon = reconcileStatement(parsed, hasRiderData ? { daily_estimate_total: parseFloat(dailyEstimate), reward_estimate_total: parseFloat(rewardEstimate) } : null);
      setReconResult(recon);
    } catch (e) { setProcessError(e.message); }
  }

  async function handleSaveVerified() {
    if (!parseResult || !reconResult) return; // v2：不再要求 reconResult.status === Auto_Verified，任何 reconciliation_status 都能存
    setSaving(true);
    const b = parseResult.income_breakdown;
    const record = {
      income_id: `CMP-INCOME-${parseResult.document_meta.week}`,
      period: parseResult.document_meta.week,
      currency: parseResult.document_meta.currency,
      net_delivery_income: b.net_delivery_income.amount,
      incentive: b.incentive.amount, tip: b.tip.amount, other_payments: b.other_payments.amount,
      total_deductions: parseResult.summary.total_deductions,
      net: reconResult.statement_total,
      source: 'Compliance OS', origin_platform: parseResult.document_meta.source,
      status: 'Verified', reconciliation_status: reconResult.reconciliation_status,
      verified_at: new Date().toISOString()
    };
    const next = [...ledger, record].sort((a, b2) => (a.period < b2.period ? 1 : -1));
    await saveLedger(next);
    setStatementText(''); setDailyEstimate(''); setRewardEstimate('');
    setParseResult(null); setReconResult(null);
    setSaving(false);
  }

  async function handleDeleteLedgerRow(incomeId) { await saveLedger(ledger.filter((r) => r.income_id !== incomeId)); }

  async function handleLogStatutory() {
    if (!socsoAmount || !socsoMonth) { setProcessError('SOCSO 金额跟月份都要填。'); return; }
    const record = { type: 'SOCSO', plan: 'Plan 4', amount: parseFloat(socsoAmount), month: socsoMonth, logged_at: new Date().toISOString() };
    const next = [...statutory.filter((s) => !(s.type === 'SOCSO' && s.month === socsoMonth)), record].sort((a, b) => (a.month < b.month ? 1 : -1));
    await saveStatutory(next);
    setSocsoMonth('');
  }

  const monthlySummaries = computeMonthlySummaries(ledger.filter((r) => r.status === 'Verified'));
  const ytdNet = round2(ledger.filter((r) => r.status === 'Verified').reduce((s, r) => s + r.net, 0));
  const flaggedCount = ledger.filter((r) => r.reconciliation_status === 'Discrepancy_Flagged').length;
  const socsoStatus = computeSocsoStatus(settings.socsoDueDay, settings.socsoReminderLeadDays, new Date());
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const socsoPaidThisMonth = statutory.some((s) => s.type === 'SOCSO' && s.month === thisMonthKey);

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#1A1D23]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header className="border-b-2 border-[#1A1D23] bg-[#F5F4F0] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#6B6858]">Compliance OS</div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Operator Console</h1>
          </div>
          <div className="flex items-center gap-4">
            {flaggedCount > 0 && (
              <div className="flex items-center gap-1 text-[#A3372B] text-xs font-mono font-semibold"><AlertTriangle size={13} /> {flaggedCount} flagged</div>
            )}
            {!socsoPaidThisMonth && socsoStatus.status !== 'Upcoming' && (
              <div className={`flex items-center gap-1 text-xs font-mono font-semibold ${socsoStatus.status === 'Overdue' ? 'text-[#A3372B]' : 'text-[#8A6D1F]'}`}>
                <Bell size={13} /> SOCSO {socsoStatus.status === 'Overdue' ? '已逾期' : `${socsoStatus.days_remaining}天后到期`}
              </div>
            )}
            <div className="text-right font-mono">
              <div className="text-[11px] uppercase tracking-wider text-[#6B6858]">YTD · Verified</div>
              <div className="text-xl font-bold text-[#0F6B5C]">{MYR(ytdNet)}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-10">
        <section>
          <div className="flex items-center gap-2 mb-3"><FileText size={16} /><h2 className="text-sm font-bold uppercase tracking-wider">导入 Grab Weekly Statement</h2></div>
          <div className="border border-[#D8D4C8] bg-white rounded-md p-4 space-y-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wide text-[#6B6858] block mb-1">Statement 文字（贴上 Ringkasan 到 Butiran pendapatan 那段）</label>
              <textarea value={statementText} onChange={(e) => setStatementText(e.target.value)} rows={8}
                placeholder="Penyata Pemandu&#10;20 Julai, 2026 - 26 Julai, 2026&#10;&#10;Ringkasan&#10;Jumlah Pendapatan&#10;1,734.10&#10;..."
                className="w-full border border-[#D8D4C8] rounded p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C] focus:border-[#0F6B5C]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wide text-[#6B6858] block mb-1">Rider OS · Daily Estimate（选填）</label>
                <input type="number" step="0.01" value={dailyEstimate} onChange={(e) => setDailyEstimate(e.target.value)} placeholder="留空 = 不做交叉验证"
                  className="w-full border border-[#D8D4C8] rounded p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C] focus:border-[#0F6B5C]" />
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-wide text-[#6B6858] block mb-1">Rider OS · Reward Estimate（选填）</label>
                <input type="number" step="0.01" value={rewardEstimate} onChange={(e) => setRewardEstimate(e.target.value)} placeholder="留空 = 不做交叉验证"
                  className="w-full border border-[#D8D4C8] rounded p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C] focus:border-[#0F6B5C]" />
              </div>
            </div>
            <p className="text-xs text-[#6B6858] leading-relaxed">v2：Grab Statement 本身就足以发布 Verified Income（CMP-P1，官方文件是权威）——Rider OS 数字现在是可选的交叉验证，不填也能导入，填了只是多一层参考。</p>
            <button onClick={handleProcess} className="inline-flex items-center gap-2 bg-[#1A1D23] text-white px-4 py-2 rounded text-sm font-semibold hover:bg-[#33363D] transition-colors">
              Import → Parse{dailyEstimate || rewardEstimate ? ' → Reconciliation' : ''} <ChevronRight size={16} />
            </button>
            {processError && <div className="border-l-4 border-[#A3372B] bg-[#A3372B]/5 text-[#A3372B] text-sm px-3 py-2 rounded">{processError}</div>}
          </div>
        </section>

        {parseResult && reconResult && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">这次的结果 · {parseResult.document_meta.week}</h2>
            <div className="border border-[#D8D4C8] bg-white rounded-md p-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <VerifiedStamp />
                <ReconBadge status={reconResult.reconciliation_status} />
                {reconResult.reconciliation_status !== 'Not_Performed' && (
                  <span className="font-mono text-sm text-[#6B6858]">差异 {MYR(reconResult.difference)}（{reconResult.difference_pct}%）</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-sm">
                <Stat label="Net Delivery" value={MYR(parseResult.income_breakdown.net_delivery_income.amount)} />
                <Stat label="Incentive" value={MYR(parseResult.income_breakdown.incentive.amount)} />
                <Stat label="Tip" value={MYR(parseResult.income_breakdown.tip.amount)} />
                <Stat label="Other" value={MYR(parseResult.income_breakdown.other_payments.amount)} />
              </div>
              <div className="font-mono text-sm border-t border-[#D8D4C8] pt-3">
                <span className="text-[#6B6858]">Statement Total </span><span className="font-bold">{MYR(reconResult.statement_total)}</span>
                {reconResult.rider_total !== null && (<><span className="text-[#6B6858]"> vs Rider Total </span><span className="font-bold">{MYR(reconResult.rider_total)}</span></>)}
              </div>
              {(parseResult._consistency_check.net_delivery_stated_vs_computed_diff !== 0 || parseResult._consistency_check.total_income_stated_vs_recomputed_diff !== 0) && (
                <div className="border-l-4 border-[#8A6D1F] bg-[#8A6D1F]/5 text-[#8A6D1F] text-xs px-3 py-2 rounded">一致性检查有非 0 差异——Statement 的层级结构可能跟假设的不一样了，导入前建议先人工核对。</div>
              )}
              {reconResult.reconciliation_status === 'Discrepancy_Flagged' && (
                <div className="border-l-4 border-[#A3372B] bg-[#A3372B]/5 text-[#A3372B] text-xs px-3 py-2 rounded">Rider OS 估算对不上，但不影响这笔存进台账——Grab Statement 本身就是权威。存进去之后记得找时间看一下这笔差在哪。</div>
              )}
              <button onClick={handleSaveVerified} disabled={saving}
                className="inline-flex items-center gap-2 bg-[#0F6B5C] text-white px-4 py-2 rounded text-sm font-semibold hover:bg-[#0C5548] transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Stamp size={16} />} 存进 Verified Income 台账
              </button>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3">Verified Income 台账</h2>
          {loading ? (
            <div className="text-sm text-[#6B6858] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> 载入中…</div>
          ) : ledger.length === 0 ? (
            <div className="border border-dashed border-[#D8D4C8] rounded-md p-6 text-center text-sm text-[#6B6858]">还没有任何记录——导入第一份 Statement 就会出现在这里。</div>
          ) : (
            <div className="border border-[#D8D4C8] bg-white rounded-md overflow-hidden">
              <table className="w-full text-sm font-mono">
                <thead className="bg-[#F0EEE6] text-left text-[11px] uppercase tracking-wide text-[#6B6858]">
                  <tr><th className="px-3 py-2">Week</th><th className="px-3 py-2 text-right">Net</th><th className="px-3 py-2">Reconciliation</th><th className="px-3 py-2"></th></tr>
                </thead>
                <tbody>
                  {ledger.map((r) => (
                    <tr key={r.income_id} className="border-t border-[#EDEBE3]">
                      <td className="px-3 py-2">{r.period}</td>
                      <td className="px-3 py-2 text-right font-semibold">{MYR(r.net)}</td>
                      <td className="px-3 py-2"><ReconBadge status={r.reconciliation_status} /></td>
                      <td className="px-3 py-2 text-right"><button onClick={() => handleDeleteLedgerRow(r.income_id)} className="text-[#A3372B] hover:opacity-70" title="删除这笔"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {monthlySummaries.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-bold uppercase tracking-wider">月度汇总</h2><ProjectionBadge /></div>
            <p className="text-xs text-[#6B6858] mb-3">聚合出来的视图，不是新的 Verified 记录——查询时即时算，不额外存一份。</p>
            <div className="border border-[#D8D4C8] border-dashed bg-white rounded-md overflow-hidden">
              <table className="w-full text-sm font-mono">
                <thead className="bg-[#F0EEE6] text-left text-[11px] uppercase tracking-wide text-[#6B6858]"><tr><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Weeks</th><th className="px-3 py-2 text-right">Net</th></tr></thead>
                <tbody>
                  {monthlySummaries.map((m) => (
                    <tr key={m.year_month} className="border-t border-[#EDEBE3]"><td className="px-3 py-2">{m.year_month}</td><td className="px-3 py-2 text-right">{m.week_count}</td><td className="px-3 py-2 text-right font-semibold">{MYR(m.net)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3">法定缴费 · Compliance Calendar</h2>
          <div className="border border-[#D8D4C8] bg-white rounded-md p-4 space-y-4">
            <div className={`flex items-center justify-between rounded p-3 ${socsoStatus.status === 'Overdue' ? 'bg-[#A3372B]/5' : socsoStatus.status === 'Due_Soon' ? 'bg-[#8A6D1F]/5' : 'bg-[#F0EEE6]'}`}>
              <div>
                <div className="text-sm font-semibold">SOCSO · Self-Employment (SKSPS) Plan 4</div>
                <div className="text-xs text-[#6B6858] font-mono">下次到期 {socsoStatus.due_date} · RM49.40</div>
              </div>
              <span className={`text-xs font-mono font-bold uppercase ${socsoStatus.status === 'Overdue' ? 'text-[#A3372B]' : socsoStatus.status === 'Due_Soon' ? 'text-[#8A6D1F]' : 'text-[#6B6858]'}`}>
                {socsoStatus.status === 'Overdue' ? '已逾期' : socsoStatus.status === 'Due_Soon' ? `${socsoStatus.days_remaining} 天后到期` : 'Upcoming'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-mono uppercase tracking-wide text-[#6B6858] block mb-1">每月几号到期</label>
                <input type="number" min="1" max="28" value={settings.socsoDueDay}
                  onChange={(e) => saveSettings({ ...settings, socsoDueDay: parseInt(e.target.value, 10) || 15 })}
                  className="w-full border border-[#D8D4C8] rounded p-2 font-mono text-sm" />
              </div>
              <div>
                <label className="font-mono uppercase tracking-wide text-[#6B6858] block mb-1">提前几天提醒</label>
                <input type="number" min="0" max="30" value={settings.socsoReminderLeadDays}
                  onChange={(e) => saveSettings({ ...settings, socsoReminderLeadDays: parseInt(e.target.value, 10) || 5 })}
                  className="w-full border border-[#D8D4C8] rounded p-2 font-mono text-sm" />
              </div>
            </div>
            <p className="text-[11px] text-[#8A8570]">到期日是按「每月几号」算的猜测，不是从 PERKESO 官网直接读的——如果实际到期日不是固定某一天，或跟这里显示的对不上，改上面这个数字就好。</p>

            <div className="border-t border-[#D8D4C8] pt-3">
              <p className="text-xs text-[#6B6858] leading-relaxed mb-2">SOCSO Plan 4 是固定月费，不是从收入算出来的估算——记下实际缴了多少，比造一个公式更准确。</p>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-xs font-mono uppercase tracking-wide text-[#6B6858] block mb-1">月份</label>
                  <input type="month" value={socsoMonth} onChange={(e) => setSocsoMonth(e.target.value)} className="w-full border border-[#D8D4C8] rounded p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase tracking-wide text-[#6B6858] block mb-1">SOCSO Plan 4 金额</label>
                  <input type="number" step="0.01" value={socsoAmount} onChange={(e) => setSocsoAmount(e.target.value)} className="w-full border border-[#D8D4C8] rounded p-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]" />
                </div>
                <button onClick={handleLogStatutory} className="bg-[#1A1D23] text-white px-4 py-2 rounded text-sm font-semibold hover:bg-[#33363D] transition-colors h-[38px]">记一笔</button>
              </div>
              {statutory.length > 0 && (
                <div className="pt-2 space-y-1">
                  {statutory.map((s) => (
                    <div key={s.month + s.type} className="flex items-center justify-between text-sm font-mono border-t border-[#EDEBE3] pt-1.5"><span>{s.month} · {s.type} {s.plan}</span><span className="font-semibold">{MYR(s.amount)}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (<div className="border border-[#EDEBE3] rounded p-2"><div className="text-[10px] uppercase tracking-wide text-[#6B6858]">{label}</div><div className="font-semibold">{value}</div></div>);
}
