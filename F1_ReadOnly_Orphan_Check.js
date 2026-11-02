/**
 * ════════════════════════════════════════════════════════════════════════
 *  F1_ReadOnly_Orphan_Check.js
 *  独立只读核查脚本（STANDALONE · READ-ONLY）—— 不是正式项目的一部分
 * ════════════════════════════════════════════════════════════════════════
 *  授权依据：Carson 2026-11-02「F1 UI 新建任务持久化情况只读核查」。
 *  目的：核查 Events 表里每一条 "TASK_CREATED"，在 Tasks / ActiveTasks /
 *        ArchiveTasks 三张表里是否有对应任务。只验证 F1 的实际风险，不做修复。
 *
 *  只读保证（代码层，可用文件末尾的检查方法复核）：
 *   - 全文只有一处接触 Spreadsheet：F1C_readSheet_()，只调用
 *     getSheetByName / getLastRow / getLastColumn / getRange().getValues()；
 *     另有 openById、getName、getId、getSheets 用于确认身份。
 *   - 不写任何单元格，不发布事件，不调用正式项目的任何函数，
 *     不创建 Trigger，不访问网络，不写 Script Properties。
 *   - 输出只走 Logger.log。
 *
 *  证据等级：只有在真实 Apps Script 运行时里成功读到真实 Spreadsheet，
 *  报告才会标 LIVE；否则标 NOT_LIVE。本脚本不产生也不接受模拟数据。
 *
 *  不要把本文件加入正式项目，不要部署，不要加 Trigger。
 *  运行步骤见文件末尾 RUNBOOK。
 */

// ───────────────────────── 配置（只需要改 SPREADSHEET_ID） ─────────────────────────
var F1C_CONFIG = {
  // 真实 Spreadsheet 的 ID（与正式项目 Script Properties 里的 SPREADSHEET_ID 同一个值）。
  // 在独立核查项目里必须填；留空时，只在正式项目环境里才会（只读）去 Script Properties 取。
  SPREADSHEET_ID: '',

  // 正式项目 scriptId 的首尾片段（来自 .clasp.json），只用于判断「当前是否在正式项目里运行」。
  FORMAL_SCRIPT_ID_PREFIX: '1oIcP-',
  FORMAL_SCRIPT_ID_SUFFIX: 'SDuYPl',

  SHEETS: { EVENTS: 'Events', TASKS: 'Tasks', ACTIVE: 'ActiveTasks', ARCHIVE: 'ArchiveTasks' },
  EVENT_TYPE: 'TASK_CREATED',

  // 终态：这些状态的任务不应出现在 ActiveTasks（见投影代码里对 ActiveTasks 的删除逻辑）。
  TERMINAL_STATUSES: ['DONE', 'CANCELLED', 'NOT_SELECTED', 'CONVERTED'],

  // 疑似测试数据的标题特征（仅作辅助标签，不改变四类判定）。
  TEST_TITLE_PATTERN: '验收测试|回归测试|canonicalization 回归',

  TITLE_MAX_CHARS: 24,    // 明细里标题最多显示多少字；0 = 不显示标题
  MAX_DETAIL_LINES: 300,  // 孤儿明细最多打印多少行
  MAX_LIST_IDS: 30        // 其他清单最多打印多少个 task_id
};

// ───────────────────────── 纯函数小工具（不接触任何 Google 服务） ─────────────────────────
function F1C_trim_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function F1C_mask_(s) {
  s = F1C_trim_(s);
  if (!s) return '(none)';
  if (s.length <= 12) return s.slice(0, 2) + '…(len ' + s.length + ')';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

function F1C_clip_(s, n) {
  s = F1C_trim_(s).replace(/[\r\n\t|]+/g, ' ');
  if (n <= 0) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function F1C_isTrue_(v) {
  return v === true || F1C_trim_(v).toLowerCase() === 'true';
}

function F1C_toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = F1C_trim_(v);
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function F1C_bump_(obj, key, by) {
  obj[key] = (obj[key] || 0) + (by === undefined ? 1 : by);
}

function F1C_sortedKeysByCount_(obj) {
  return Object.keys(obj).sort(function (a, b) {
    return obj[b] - obj[a] || (a < b ? -1 : a > b ? 1 : 0);
  });
}

/** 按表头名字定位列；重名视为歧义。headers 里的空表头忽略。 */
function F1C_resolveCols_(headers, names) {
  var counts = Object.create(null), first = Object.create(null);
  for (var i = 0; i < headers.length; i++) {
    var h = F1C_trim_(headers[i]);
    if (!h) continue;
    counts[h] = (counts[h] || 0) + 1;
    if (first[h] === undefined) first[h] = i;
  }
  var idx = {}, missing = [], ambiguous = [];
  names.forEach(function (n) {
    if (!counts[n]) { idx[n] = -1; missing.push(n); }
    else { idx[n] = first[n]; if (counts[n] > 1) ambiguous.push(n); }
  });
  return { idx: idx, missing: missing, ambiguous: ambiguous };
}

/** 解析 Events.payload 单元格（JSON 文本）。不信任内容，任何异常都返回 ok:false。 */
function F1C_parsePayload_(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: false, reason: 'EMPTY_PAYLOAD' };
  if (typeof raw !== 'string') return { ok: false, reason: 'PAYLOAD_NOT_TEXT' };
  var o;
  try { o = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'PAYLOAD_PARSE_ERROR' }; }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: 'PAYLOAD_NOT_OBJECT' };
  return { ok: true, obj: o };
}

// ───────────────────────── 读取（全文唯一接触 Spreadsheet 数据的地方） ─────────────────────────
/** 只读一张表：getSheetByName / getLastRow / getLastColumn / getRange().getValues()。 */
function F1C_readSheet_(ss, name) {
  var out = { name: name, exists: false, readError: '', lastRow: 0, lastCol: 0, headers: [], rows: [] };
  try {
    var sh = ss.getSheetByName(name);
    if (!sh) return out;
    out.exists = true;
    out.lastRow = sh.getLastRow();
    out.lastCol = sh.getLastColumn();
    if (out.lastRow < 1 || out.lastCol < 1) return out;
    var values = sh.getRange(1, 1, out.lastRow, out.lastCol).getValues();
    out.headers = values[0].map(function (h) { return F1C_trim_(h); });
    out.rows = values.slice(1);
  } catch (e) {
    out.readError = String(e && e.message ? e.message : e);
  }
  return out;
}

/** 只取 Sheet 名字列表（不读内容），用于确认 Spreadsheet 身份。 */
function F1C_listSheetNames_(ss) {
  try { return ss.getSheets().map(function (s) { return s.getName(); }); }
  catch (e) { return null; }
}

// ───────────────────────── 运行环境（真实 Apps Script 运行时） ─────────────────────────
function F1C_buildEnv_() {
  var tz = 'UTC';
  try { tz = Session.getScriptTimeZone() || 'UTC'; } catch (e) {}
  return {
    runtime: 'apps-script',
    tz: tz,
    now: function () { return new Date(); },
    fmt: function (d, pattern) { return Utilities.formatDate(d, tz, pattern); },
    scriptId: function () { try { return ScriptApp.getScriptId(); } catch (e) { return ''; } },
    // 只读取 SPREADSHEET_ID 这一个键，不枚举 Script Properties。
    scriptProp: function (name) {
      try { return PropertiesService.getScriptProperties().getProperty(name); } catch (e) { return null; }
    },
    openById: function (id) { return SpreadsheetApp.openById(id); }
  };
}

function F1C_collectContext_(cfg, env) {
  var now = env.now();
  var sid = F1C_trim_(env.scriptId());
  var formal = !!sid &&
    sid.indexOf(cfg.FORMAL_SCRIPT_ID_PREFIX) === 0 &&
    sid.slice(-cfg.FORMAL_SCRIPT_ID_SUFFIX.length) === cfg.FORMAL_SCRIPT_ID_SUFFIX;
  return {
    runtime: env.runtime,
    runAtUtc: now.toISOString(),
    runAtLocal: env.fmt(now, 'yyyy-MM-dd HH:mm:ss'),
    tz: env.tz,
    scriptIdMasked: F1C_mask_(sid),
    formalScriptIdMatch: formal,
    context: formal
      ? 'FORMAL_PROJECT（scriptId 首尾片段与 .clasp.json 一致）'
      : 'STANDALONE_SCRATCH（scriptId 与正式项目不同或读不到；正式项目身份需手动对照）',
    idSource: ''
  };
}

function F1C_resolveSpreadsheetId_(cfg, env) {
  var id = F1C_trim_(cfg.SPREADSHEET_ID);
  if (id) return { id: id, source: 'F1C_CONFIG.SPREADSHEET_ID' };
  var p = F1C_trim_(env.scriptProp('SPREADSHEET_ID'));
  if (p) return { id: p, source: 'Script Properties[SPREADSHEET_ID]（只读这一个键）' };
  return { id: '', source: '' };
}

// ───────────────────────── 分析（纯函数：只处理内存里的数组） ─────────────────────────
function F1C_indexSheet_(sheet, c) {
  var byId = Object.create(null), blank = 0, idRows = 0;
  for (var i = 0; i < sheet.rows.length; i++) {
    var r = sheet.rows[i];
    var id = F1C_trim_(r[c.task_id]);
    if (!id) { blank++; continue; }
    idRows++;
    var rec = {
      row: i + 2,
      status: c.status >= 0 ? F1C_trim_(r[c.status]).toUpperCase() : '',
      archived: c.archived >= 0 ? F1C_isTrue_(r[c.archived]) : false,
      identity: c.identity >= 0 ? F1C_trim_(r[c.identity]) : ''
    };
    (byId[id] || (byId[id] = [])).push(rec);
  }
  return {
    byId: byId, blankRows: blank, idRows: idRows, distinctIds: Object.keys(byId).length,
    hasStatus: c.status >= 0, hasArchived: c.archived >= 0
  };
}

/**
 * 判定规则（口径）
 *  - 关联键：Events.payload.task_id ↔ 各表 task_id 列（精确匹配，trim 后）。绝不按标题匹配。
 *  - FOUND            ：Tasks / ActiveTasks / ArchiveTasks 至少一张表有该 task_id。
 *  - DUPLICATE        ：FOUND 的子集——同一张表里同一 task_id 出现 ≥2 行。
 *  - CONFIRMED_ORPHAN ：三张表都可读、都没有该 task_id，且 task_id 来自可解析的 payload。
 *  - UNKNOWN          ：payload 不可解析 / 没有 task_id / 有目标表读不了而无法确认「没有」。
 *  四类互斥地覆盖全部 TASK_CREATED 事件：FOUND + CONFIRMED_ORPHAN + UNKNOWN = 事件总数。
 */
function F1C_analyze_(data, cfg, env) {
  var A = {
    stop: null, gaps: [], cols: {}, sheetStats: {},
    eventRows: 0, eventTypeCounts: Object.create(null), typeVariantRows: 0,
    counts: null, reliability: null,
    unknownReasons: Object.create(null), foundCombos: Object.create(null),
    dupList: [], dupEventTaskIds: [],
    orphans: [], orphanSubtypes: Object.create(null),
    bySource: Object.create(null), byChat: Object.create(null),
    orphanByDate: Object.create(null), createdByDate: Object.create(null),
    supp: { ACTIVE_MISSING_NONTERMINAL: [], ACTIVE_HAS_TERMINAL: [], ARCHIVED_FLAG_NO_ARCHIVE_ROW: [], ONLY_IN_ACTIVE: [], ONLY_IN_ARCHIVE: [] },
    createdRange: { first: '', last: '' }
  };

  // ── Events 结构 ──
  var ev = data.events;
  if (!ev.exists || ev.readError || ev.headers.length === 0) {
    A.stop = {
      code: 'EVENTS_UNREADABLE',
      detail: !ev.exists ? 'Events 表不存在' : (ev.readError ? '读取失败：' + ev.readError : 'Events 表为空')
    };
    return A;
  }
  var evc = F1C_resolveCols_(ev.headers, ['event_id', 'timestamp', 'type', 'chat_id', 'payload', 'source']);
  A.cols.events = evc;
  var hardMissing = ['type', 'payload'].filter(function (n) {
    return evc.idx[n] < 0 || evc.ambiguous.indexOf(n) >= 0;
  });
  if (hardMissing.length) {
    A.stop = { code: 'EVENTS_STRUCTURE_MISMATCH', detail: '必需列缺失或重名：' + hardMissing.join(',') + '（实际表头见 STRUCTURE 段）' };
    return A;
  }
  A.eventRows = ev.rows.length;

  // ── 三张任务表：定位 task_id 列并建索引 ──
  var defs = [['T', 'tasks', cfg.SHEETS.TASKS], ['A', 'active', cfg.SHEETS.ACTIVE], ['R', 'archive', cfg.SHEETS.ARCHIVE]];
  var idx = { T: null, A: null, R: null };
  defs.forEach(function (d) {
    var sh = data[d[1]], nm = d[2];
    if (!sh.exists) { A.gaps.push(nm + ':ABSENT'); return; }
    if (sh.readError) { A.gaps.push(nm + ':READ_ERROR'); return; }
    var c = F1C_resolveCols_(sh.headers, ['task_id', 'status', 'identity', 'title', 'archived', 'archived_at', 'chat_id']);
    A.cols[d[1]] = c;
    if (c.idx.task_id < 0 || c.ambiguous.indexOf('task_id') >= 0) { A.gaps.push(nm + ':NO_UNIQUE_task_id_COLUMN'); return; }
    idx[d[0]] = F1C_indexSheet_(sh, c.idx);
    A.sheetStats[d[0]] = { idRows: idx[d[0]].idRows, blankIdRows: idx[d[0]].blankRows, distinctIds: idx[d[0]].distinctIds };
  });
  if (!idx.T) {
    A.stop = { code: 'TASKS_UNREADABLE', detail: 'Tasks 表无法作为主投影读取（' + A.gaps.join('; ') + '），无法判定 FOUND / 孤儿' };
    return A;
  }

  // identity → 拥有它的 task_id 集合（仅用于给孤儿加「有同 identity 的另一条任务」标签，不参与判定）
  var identityOwners = Object.create(null);
  ['T', 'A', 'R'].forEach(function (k) {
    if (!idx[k]) return;
    Object.keys(idx[k].byId).forEach(function (id) {
      idx[k].byId[id].forEach(function (rec) {
        if (!rec.identity) return;
        (identityOwners[rec.identity] || (identityOwners[rec.identity] = Object.create(null)))[id] = true;
      });
    });
  });

  // ── 扫描 Events ──
  var typeIdx = evc.idx.type, payloadIdx = evc.idx.payload, tsIdx = evc.idx.timestamp,
      chatIdx = evc.idx.chat_id, srcIdx = evc.idx.source, idIdx = evc.idx.event_id;
  var TYPE = cfg.EVENT_TYPE;
  var created = [];
  var laterByTask = Object.create(null);         // task_id → 其他类型事件 [{row,type}]
  var createdCountByTask = Object.create(null);  // task_id → TASK_CREATED 事件条数
  for (var i = 0; i < ev.rows.length; i++) {
    var r = ev.rows[i];
    var type = F1C_trim_(r[typeIdx]);
    if (!type) continue;
    F1C_bump_(A.eventTypeCounts, type);
    var row = i + 2;
    if (type === TYPE) {
      var rec = {
        row: row,
        eventId: idIdx >= 0 ? F1C_trim_(r[idIdx]) : '',
        ts: tsIdx >= 0 ? F1C_toDate_(r[tsIdx]) : null,
        chat: chatIdx >= 0 ? F1C_trim_(r[chatIdx]) : '',
        taskId: '', title: '', srcModule: '', method: '', identity: '',
        verdict: '', reason: '', parsed: false
      };
      var p = F1C_parsePayload_(r[payloadIdx]);
      if (!p.ok) {
        rec.verdict = 'UNKNOWN'; rec.reason = p.reason;
      } else {
        rec.parsed = true;
        var o = p.obj;
        rec.taskId = F1C_trim_(o.task_id);
        rec.title = F1C_trim_(o.title);
        rec.srcModule = F1C_trim_(o.source_module);
        rec.method = F1C_trim_(o.created_method);
        rec.identity = F1C_trim_(o.identity);
        if (!rec.chat) rec.chat = F1C_trim_(o.chat_id);
        if (!rec.taskId) { rec.verdict = 'UNKNOWN'; rec.reason = 'NO_TASK_ID'; }
        else F1C_bump_(createdCountByTask, rec.taskId);
      }
      created.push(rec);
    } else {
      if (type.toUpperCase() === TYPE.toUpperCase()) A.typeVariantRows++;
      var raw = r[payloadIdx];
      if (typeof raw === 'string' && raw.indexOf('"task_id"') !== -1) {
        var q = F1C_parsePayload_(raw);
        if (q.ok) {
          var tid = F1C_trim_(q.obj.task_id);
          if (tid) (laterByTask[tid] || (laterByTask[tid] = [])).push({ row: row, type: type });
        }
      }
    }
  }

  // ── 判定 ──
  var terminal = Object.create(null);
  cfg.TERMINAL_STATUSES.forEach(function (s) { terminal[s] = true; });
  var testRx = null;
  try { testRx = new RegExp(cfg.TEST_TITLE_PATTERN, 'i'); } catch (e) { testRx = null; }
  var counts = {
    createdEvents: created.length,
    distinctTaskIds: Object.keys(createdCountByTask).length,
    FOUND: 0, CONFIRMED_ORPHAN: 0, UNKNOWN: 0, DUPLICATE: 0
  };
  var dupSeen = Object.create(null), suppSeen = Object.create(null);
  function addSupp(kind, id) { A.supp[kind].push(id); }

  created.forEach(function (e) {
    if (!e.verdict) {
      var inT = idx.T.byId[e.taskId] || null;
      var inA = idx.A ? (idx.A.byId[e.taskId] || null) : null;
      var inR = idx.R ? (idx.R.byId[e.taskId] || null) : null;
      if (inT || inA || inR) {
        e.verdict = 'FOUND';
        var where = [];
        if (inT) where.push('T');
        if (inA) where.push('A');
        if (inR) where.push('R');
        F1C_bump_(A.foundCombos, where.join('+'));
        var dups = [];
        if (inT && inT.length > 1) dups.push('Tasks×' + inT.length);
        if (inA && inA.length > 1) dups.push('ActiveTasks×' + inA.length);
        if (inR && inR.length > 1) dups.push('ArchiveTasks×' + inR.length);
        if (dups.length) {
          counts.DUPLICATE++;
          if (!dupSeen[e.taskId]) { dupSeen[e.taskId] = true; A.dupList.push({ taskId: e.taskId, sheets: dups.join(',') }); }
        }
        // 补充：投影落点是否完整（不改变四类计数）
        if (!suppSeen[e.taskId]) {
          suppSeen[e.taskId] = true;
          var st = inT ? inT[0].status : '';
          if (inT && idx.A && idx.T.hasStatus && !inA && !terminal[st]) addSupp('ACTIVE_MISSING_NONTERMINAL', e.taskId);
          if (inT && inA && idx.T.hasStatus && terminal[st]) addSupp('ACTIVE_HAS_TERMINAL', e.taskId);
          if (inT && idx.R && idx.T.hasArchived && inT[0].archived === true && !inR) addSupp('ARCHIVED_FLAG_NO_ARCHIVE_ROW', e.taskId);
          if (!inT && inA) addSupp('ONLY_IN_ACTIVE', e.taskId);
          if (!inT && !inA && inR) addSupp('ONLY_IN_ARCHIVE', e.taskId);
        }
      } else if (A.gaps.length) {
        e.verdict = 'UNKNOWN';
        e.reason = 'SHEET_UNREADABLE:' + A.gaps.join('+');
      } else {
        e.verdict = 'CONFIRMED_ORPHAN';
      }
    }
    counts[e.verdict]++;
    if (e.verdict === 'UNKNOWN') F1C_bump_(A.unknownReasons, e.reason);
  });
  A.counts = counts;
  A.reliability = {
    createdEvents: created.length,
    payloadParsed: created.filter(function (e) { return e.parsed; }).length,
    withTaskId: created.filter(function (e) { return !!e.taskId; }).length,
    matchedByTaskId: counts.FOUND
  };
  Object.keys(createdCountByTask).forEach(function (id) {
    if (createdCountByTask[id] > 1) A.dupEventTaskIds.push({ taskId: id, events: createdCountByTask[id] });
  });

  // ── 分组统计：聊天分组（不输出原始 chat_id）、来源模块、日期 ──
  var chatCounts = Object.create(null);
  created.forEach(function (e) { F1C_bump_(chatCounts, e.chat || '(empty)'); });
  var groupOf = Object.create(null);
  F1C_sortedKeysByCount_(chatCounts).forEach(function (c, n) { groupOf[c] = 'G' + (n + 1); });
  var firstTs = null, lastTs = null;
  created.forEach(function (e) {
    e.group = groupOf[e.chat || '(empty)'];
    var g = A.byChat[e.group] || (A.byChat[e.group] = { created: 0, FOUND: 0, CONFIRMED_ORPHAN: 0, UNKNOWN: 0 });
    g.created++; g[e.verdict]++;
    var sk = e.srcModule || '(none)';
    var s = A.bySource[sk] || (A.bySource[sk] = { created: 0, FOUND: 0, CONFIRMED_ORPHAN: 0, UNKNOWN: 0 });
    s.created++; s[e.verdict]++;
    e.dkey = e.ts ? env.fmt(e.ts, 'yyyy-MM-dd') : 'n/a';
    F1C_bump_(A.createdByDate, e.dkey);
    if (e.ts) {
      if (!firstTs || e.ts < firstTs) firstTs = e.ts;
      if (!lastTs || e.ts > lastTs) lastTs = e.ts;
    }
  });
  A.createdRange.first = firstTs ? env.fmt(firstTs, 'yyyy-MM-dd HH:mm') : 'n/a';
  A.createdRange.last = lastTs ? env.fmt(lastTs, 'yyyy-MM-dd HH:mm') : 'n/a';

  // ── 孤儿明细 + 辅助标签（仅辅助人工判断，不改变判定） ──
  created.forEach(function (e) {
    if (e.verdict !== 'CONFIRMED_ORPHAN') return;
    var later = (laterByTask[e.taskId] || []).filter(function (x) { return x.row > e.row; });
    var laterTypes = Object.create(null);
    later.forEach(function (x) { F1C_bump_(laterTypes, x.type); });
    var owners = e.identity ? identityOwners[e.identity] : null;
    var twin = owners ? Object.keys(owners).filter(function (id) { return id !== e.taskId; }).length : 0;
    var testLike = !!(testRx && testRx.test(e.title));
    var subtype = later.length > 0 ? 'WITH_LATER_EVENTS' : (testLike ? 'SUSPECT_TEST' : 'NO_SIGNAL');
    F1C_bump_(A.orphanSubtypes, subtype);
    F1C_bump_(A.orphanByDate, e.dkey);
    A.orphans.push({
      row: e.row,
      taskId: e.taskId,
      ts: e.ts ? env.fmt(e.ts, 'yyyy-MM-dd HH:mm') : 'n/a',
      group: e.group,
      src: e.srcModule || '(none)',
      method: e.method || '(none)',
      title: F1C_clip_(e.title, cfg.TITLE_MAX_CHARS),
      later: Object.keys(laterTypes).sort().map(function (k) { return k + '×' + laterTypes[k]; }).join(',') || '-',
      twin: twin,
      subtype: subtype
    });
  });
  return A;
}

// ───────────────────────── 执行（读 → 分析），不输出 ─────────────────────────
function F1C_execute_(cfg, env) {
  var res = {
    stop: null, ctx: F1C_collectContext_(cfg, env), spreadsheet: null,
    sheetNames: null, reads: {}, analysis: null, liveRead: false
  };
  var idInfo = F1C_resolveSpreadsheetId_(cfg, env);
  res.ctx.idSource = idInfo.source || '(none)';
  if (!idInfo.id) {
    res.stop = { code: 'SPREADSHEET_IDENTITY_UNCONFIRMED', detail: 'SPREADSHEET_ID 为空，且当前环境读不到 Script Properties 里的 SPREADSHEET_ID' };
    return res;
  }
  var ss = null;
  try { ss = env.openById(idInfo.id); }
  catch (e) {
    res.stop = { code: 'SPREADSHEET_IDENTITY_UNCONFIRMED', detail: 'openById 失败：' + String(e && e.message ? e.message : e) };
    return res;
  }
  var ssName = '', ssId = '', ssTz = '';
  try { ssName = ss.getName(); } catch (e1) {}
  try { ssId = ss.getId(); } catch (e2) {}
  try { ssTz = ss.getSpreadsheetTimeZone(); } catch (e3) {}
  res.spreadsheet = {
    name: ssName, idMasked: F1C_mask_(ssId || idInfo.id),
    idEqualsInput: !!ssId && ssId === idInfo.id, timeZone: ssTz
  };
  res.sheetNames = F1C_listSheetNames_(ss);

  var data = {
    events: F1C_readSheet_(ss, cfg.SHEETS.EVENTS),
    tasks: F1C_readSheet_(ss, cfg.SHEETS.TASKS),
    active: F1C_readSheet_(ss, cfg.SHEETS.ACTIVE),
    archive: F1C_readSheet_(ss, cfg.SHEETS.ARCHIVE)
  };
  Object.keys(data).forEach(function (k) {
    var d = data[k];
    res.reads[k] = { name: d.name, exists: d.exists, readError: d.readError, lastRow: d.lastRow, lastCol: d.lastCol, headers: d.headers, rowsRead: d.rows.length };
  });
  res.liveRead = data.events.exists && !data.events.readError;
  res.analysis = F1C_analyze_(data, cfg, env);
  if (res.analysis.stop) res.stop = res.analysis.stop;
  return res;
}

// ───────────────────────── 输出（只走 Logger.log） ─────────────────────────
function F1C_formatReport_(res, cfg) {
  var L = [], c = res.ctx, A = res.analysis;
  var inScript = c.runtime === 'apps-script';
  var evidence = inScript
    ? (res.liveRead ? 'LIVE' : 'NOT_LIVE（没有读到真实 Events 数据）')
    : 'SIMULATED（非 Apps Script 运行时）';

  L.push('==================== F1 READ-ONLY CHECK ====================');
  L.push('EVIDENCE_LEVEL  : ' + evidence);
  L.push('RUN_AT_UTC      : ' + c.runAtUtc);
  L.push('RUN_AT_LOCAL    : ' + c.runAtLocal + '   tz=' + c.tz);
  L.push('RUNTIME         : ' + c.runtime);
  L.push('RUN_CONTEXT     : ' + c.context);
  L.push('SCRIPT_ID(mask) : ' + c.scriptIdMasked);
  L.push('ID_SOURCE       : ' + c.idSource);

  L.push('');
  L.push('[IDENTITY]');
  if (res.spreadsheet) {
    var byConstruction = c.formalScriptIdMatch && /^Script Properties/.test(c.idSource);
    L.push('Spreadsheet name : ' + res.spreadsheet.name);
    L.push('Spreadsheet id   : ' + res.spreadsheet.idMasked + '   (openById 返回的 id 与输入一致: ' + res.spreadsheet.idEqualsInput + ')');
    L.push('Spreadsheet tz   : ' + (res.spreadsheet.timeZone || 'n/a'));
    L.push('Sheets in file   : ' + (res.sheetNames ? res.sheetNames.join(', ') : '(读取失败)'));
    L.push('GAS 项目身份     : ' + (c.formalScriptIdMatch
      ? 'CONFIRMED（scriptId 首尾片段与 .clasp.json 一致）'
      : 'NOT CONFIRMED BY SCRIPT（独立项目；需手动核对正式项目的 Script ID）'));
    L.push('Spreadsheet 身份 : ' + (byConstruction
      ? 'CONFIRMED BY CONSTRUCTION（ID 取自正式项目自己的 Script Properties）'
      : 'PENDING MANUAL CHECK（把上面的掩码 id 与正式项目 Script Properties 的 SPREADSHEET_ID 对照）'));
  } else {
    L.push('Spreadsheet      : 未能打开');
  }

  var readKeys = Object.keys(res.reads);
  if (readKeys.length) {
    L.push('');
    L.push('[STRUCTURE]  先看实际表头，再确定关联字段');
    ['events', 'tasks', 'active', 'archive'].forEach(function (k) {
      var r = res.reads[k];
      if (!r) return;
      L.push('- ' + r.name + ': exists=' + r.exists + (r.readError ? ' READ_ERROR=' + r.readError : '') +
        ' lastRow=' + r.lastRow + ' lastCol=' + r.lastCol + ' dataRowsRead=' + r.rowsRead);
      L.push('  headers(' + r.headers.length + '): ' + r.headers.join(','));
    });
    if (A && A.cols) {
      L.push('列定位结果（缺失/重名；archived 只应出现在 Tasks、archived_at 只应出现在 ArchiveTasks，其余缺失才需关注）:');
      Object.keys(A.cols).forEach(function (k) {
        L.push('  ' + k + ': missing=' + (A.cols[k].missing.join(',') || '-') + '  ambiguous=' + (A.cols[k].ambiguous.join(',') || '-'));
      });
    }
  }

  if (res.stop) {
    L.push('');
    L.push('!!!!! STOP: ' + res.stop.code + ' — ' + res.stop.detail);
    L.push('未执行 FOUND / 孤儿判定。这不是核查结论，请把本输出回传。');
    L.push('WRITES_PERFORMED : none（本脚本不含任何写入调用）');
    return L;
  }

  var k = A.counts, rel = A.reliability;
  L.push('');
  L.push('[COUNTS]  口径：Events 表里 type == "' + cfg.EVENT_TYPE + '" 的每一行算 1 个事件；关联键 = payload.task_id');
  L.push('Events 数据行数           : ' + A.eventRows);
  L.push('Events 类型分布(前12)     : ' + F1C_sortedKeysByCount_(A.eventTypeCounts).slice(0, 12).map(function (t) { return t + '=' + A.eventTypeCounts[t]; }).join(', '));
  L.push('大小写变体(未计入)        : ' + A.typeVariantRows);
  L.push('表评估缺口                : ' + (A.gaps.join('; ') || 'none'));
  ['T', 'A', 'R'].forEach(function (s) {
    if (A.sheetStats[s]) L.push('  ' + { T: 'Tasks', A: 'ActiveTasks', R: 'ArchiveTasks' }[s] + ': 有 task_id 的行=' + A.sheetStats[s].idRows + ' 空 task_id 行=' + A.sheetStats[s].blankIdRows + ' 不同 task_id=' + A.sheetStats[s].distinctIds);
  });
  L.push('TASK_CREATED 总数         : ' + k.createdEvents + '   (不同 task_id: ' + k.distinctTaskIds + ')');
  L.push('TASK_CREATED 时间范围     : ' + A.createdRange.first + ' → ' + A.createdRange.last + '  (' + c.tz + ')');
  L.push('FOUND                     : ' + k.FOUND);
  L.push('CONFIRMED_ORPHAN          : ' + k.CONFIRMED_ORPHAN);
  L.push('UNKNOWN                   : ' + k.UNKNOWN);
  L.push('DUPLICATE (⊂ FOUND)       : ' + k.DUPLICATE);
  L.push('自检 FOUND+ORPHAN+UNKNOWN  : ' + (k.FOUND + k.CONFIRMED_ORPHAN + k.UNKNOWN) + '  (应等于 TASK_CREATED 总数)');

  L.push('');
  L.push('[FOUND 落点]  T=Tasks A=ActiveTasks R=ArchiveTasks');
  L.push(F1C_sortedKeysByCount_(A.foundCombos).map(function (x) { return x + '=' + A.foundCombos[x]; }).join(', ') || '(none)');
  L.push('[UNKNOWN 原因]');
  L.push(F1C_sortedKeysByCount_(A.unknownReasons).map(function (x) { return x + '=' + A.unknownReasons[x]; }).join(', ') || '(none)');
  L.push('[DUPLICATE 明细]（同一张表里同一 task_id ≥2 行）');
  if (A.dupList.length) {
    A.dupList.slice(0, cfg.MAX_LIST_IDS).forEach(function (d) { L.push('  ' + d.taskId + '  ' + d.sheets); });
    if (A.dupList.length > cfg.MAX_LIST_IDS) L.push('  …其余 ' + (A.dupList.length - cfg.MAX_LIST_IDS) + ' 个未列出');
  } else L.push('  (none)');
  L.push('[重复 TASK_CREATED 事件]（同一 task_id 出现在多条 TASK_CREATED 事件里）: ' +
    (A.dupEventTaskIds.length ? A.dupEventTaskIds.slice(0, cfg.MAX_LIST_IDS).map(function (d) { return d.taskId + '×' + d.events; }).join(', ') : '(none)'));

  L.push('');
  L.push('[RELIABILITY]');
  L.push('payload 可解析 ' + rel.payloadParsed + '/' + rel.createdEvents + '；含 task_id ' + rel.withTaskId + '/' + rel.createdEvents + '；按 task_id 精确命中 ' + rel.matchedByTaskId + '/' + rel.createdEvents);
  L.push('关联规则：payload.task_id ↔ 各表 task_id 列（trim 后精确匹配）；不使用标题匹配；identity 只作孤儿的辅助标签。');

  L.push('');
  L.push('[ORPHAN SUBTYPES]  辅助标签，不改变 CONFIRMED_ORPHAN 的判定');
  L.push('WITH_LATER_EVENTS = ' + (A.orphanSubtypes.WITH_LATER_EVENTS || 0) + '  (此事件之后 Events 里还有同 task_id 的其他事件 → 推断该行曾存在过)');
  L.push('SUSPECT_TEST      = ' + (A.orphanSubtypes.SUSPECT_TEST || 0) + '  (无后续事件，标题匹配测试特征)');
  L.push('NO_SIGNAL         = ' + (A.orphanSubtypes.NO_SIGNAL || 0) + '  (无后续事件、非测试特征；形态最接近 F1，但在授权的四张表内无法与「人工删除」区分)');

  L.push('');
  L.push('[BY CHAT GROUP]  G1 = TASK_CREATED 最多的聊天；不输出原始 chat_id');
  F1C_sortedKeysByCount_(Object.keys(A.byChat).reduce(function (o, g) { o[g] = A.byChat[g].created; return o; }, Object.create(null))).forEach(function (g) {
    var x = A.byChat[g];
    L.push('  ' + g + ': created=' + x.created + ' FOUND=' + x.FOUND + ' ORPHAN=' + x.CONFIRMED_ORPHAN + ' UNKNOWN=' + x.UNKNOWN);
  });
  L.push('[BY source_module]');
  F1C_sortedKeysByCount_(Object.keys(A.bySource).reduce(function (o, s) { o[s] = A.bySource[s].created; return o; }, Object.create(null))).forEach(function (s) {
    var x = A.bySource[s];
    L.push('  ' + s + ': created=' + x.created + ' FOUND=' + x.FOUND + ' ORPHAN=' + x.CONFIRMED_ORPHAN + ' UNKNOWN=' + x.UNKNOWN);
  });
  L.push('[ORPHANS BY DATE]  孤儿数 / 当天 TASK_CREATED 总数 (' + c.tz + ')');
  var dates = Object.keys(A.orphanByDate).sort();
  L.push(dates.length ? dates.map(function (d) { return d + ': ' + A.orphanByDate[d] + '/' + A.createdByDate[d]; }).join(' | ') : '(none)');

  L.push('');
  L.push('[ORPHAN DETAIL]  共 ' + A.orphans.length + ' 条（按 Events 行号升序）');
  A.orphans.slice(0, cfg.MAX_DETAIL_LINES).forEach(function (o) {
    L.push('row=' + o.row + ' | ' + o.taskId + ' | ' + o.ts + ' | ' + o.group + ' | src=' + o.src + ' | method=' + o.method +
      (cfg.TITLE_MAX_CHARS > 0 ? ' | title="' + o.title + '"' : '') + ' | later=' + o.later + ' | twin=' + o.twin + ' | ' + o.subtype);
  });
  if (A.orphans.length > cfg.MAX_DETAIL_LINES) L.push('…其余 ' + (A.orphans.length - cfg.MAX_DETAIL_LINES) + ' 条未列出（统计已包含在上面）');

  L.push('');
  L.push('[SUPPLEMENTARY 落点完整性]  仅针对 FOUND 的任务；不改变四类计数');
  var suppDesc = {
    ACTIVE_MISSING_NONTERMINAL: '非终态任务在 Tasks 有行、ActiveTasks 无行',
    ACTIVE_HAS_TERMINAL: '终态任务仍留在 ActiveTasks',
    ARCHIVED_FLAG_NO_ARCHIVE_ROW: 'Tasks.archived=true 但 ArchiveTasks 无对应行',
    ONLY_IN_ACTIVE: '只在 ActiveTasks 有行（Tasks 无）',
    ONLY_IN_ARCHIVE: '只在 ArchiveTasks 有行（Tasks / ActiveTasks 无）'
  };
  Object.keys(A.supp).forEach(function (kind) {
    var ids = A.supp[kind];
    L.push(kind + ' = ' + ids.length + '  — ' + suppDesc[kind] + (ids.length ? '  ' + ids.slice(0, cfg.MAX_LIST_IDS).join(', ') + (ids.length > cfg.MAX_LIST_IDS ? ' …' : '') : ''));
  });

  L.push('');
  L.push('[REPORT SKELETON — 12 项]');
  L.push('1. 是否进入真实 GAS 环境 : ' + (inScript && res.liveRead ? 'YES（Apps Script 运行时，成功读取真实 Spreadsheet）' : 'NO') + '；' + c.context);
  L.push('2. Spreadsheet 身份确认  : name=' + res.spreadsheet.name + '；id=' + res.spreadsheet.idMasked + '；ID 来源=' + c.idSource + '；人工对照=PENDING');
  L.push('3. TASK_CREATED 总数     : ' + k.createdEvents);
  L.push('4. FOUND                 : ' + k.FOUND);
  L.push('5. CONFIRMED_ORPHAN      : ' + k.CONFIRMED_ORPHAN);
  L.push('6. UNKNOWN               : ' + k.UNKNOWN);
  L.push('7. DUPLICATE (⊂ FOUND)   : ' + k.DUPLICATE);
  L.push('8. 孤儿明细             : 见 [ORPHAN DETAIL]（' + A.orphans.length + ' 条）');
  L.push('9. 关联规则与可靠性     : 见 [RELIABILITY]');
  L.push('10. 与 F1 静态发现的对应 : PENDING（拿到本输出后由助手对照 F1 的静态代码结论填写）');
  L.push('11. 是否发生写入        : 脚本内无写入调用；只用只读 API（清单见文件头）');
  L.push('12. 是否建议启动 Verified Create : PENDING（看完结果后决定；脚本不下结论）');
  L.push('F1C_SUMMARY_JSON=' + JSON.stringify({
    evidence: evidence, runAtUtc: c.runAtUtc, tz: c.tz,
    created: k.createdEvents, distinct: k.distinctTaskIds,
    FOUND: k.FOUND, CONFIRMED_ORPHAN: k.CONFIRMED_ORPHAN, UNKNOWN: k.UNKNOWN, DUPLICATE: k.DUPLICATE,
    orphanSubtypes: A.orphanSubtypes, gaps: A.gaps
  }));
  return L;
}

function F1C_emit_(lines) {
  for (var i = 0; i < lines.length; i += 40) Logger.log(lines.slice(i, i + 40).join('\n'));
}

// ───────────────────────── 入口：在函数下拉里选这个并运行 ─────────────────────────
function F1C_runReadOnlyCheck() {
  var cfg = F1C_CONFIG;
  var env = F1C_buildEnv_();
  var res;
  try {
    res = F1C_execute_(cfg, env);
  } catch (e) {
    F1C_emit_(['F1 READ-ONLY CHECK 异常中止：' + String(e && e.message ? e.message : e),
      '未产生任何结论；本脚本没有写入调用。请把这行回传。']);
    return;
  }
  F1C_emit_(F1C_formatReport_(res, cfg));
}

/**
 * ════════════════════════ RUNBOOK ════════════════════════
 *  1. script.google.com → 新建项目（独立项目，不要用正式项目）。
 *  2. 项目设置 → 时区设为 Asia/Singapore（与正式项目 appsscript.json 一致）。
 *  3. 把本文件全部内容粘贴进新项目的代码文件。
 *  4. 在 F1C_CONFIG.SPREADSHEET_ID 填入 Spreadsheet ID
 *     （正式项目 Script Properties 里的 SPREADSHEET_ID，手动抄，别贴到聊天里）。
 *  5. 函数下拉选 F1C_runReadOnlyCheck → 运行 → 首次授权（Spreadsheet 访问）。
 *  6. 打开「执行日志」，复制全部输出回传。输出只含掩码 ID，不含凭证。
 *  7. 身份确认（手动）：在正式项目的「项目设置」里核对 Script ID 首尾、
 *     SPREADSHEET_ID 首尾，对照输出里的掩码值。
 *  8. 核查结束后可直接删除该独立项目。不要加 Trigger，不要部署，
 *     不要把本文件放进正式项目。
 *
 *  本脚本里出现的全部 Google 服务调用（用于复核只读性）：
 *    SpreadsheetApp.openById
 *    Spreadsheet : getName / getId / getSpreadsheetTimeZone / getSheets / getSheetByName
 *    Sheet       : getName / getLastRow / getLastColumn / getRange
 *    Range       : getValues
 *    Session.getScriptTimeZone · Utilities.formatDate · ScriptApp.getScriptId
 *    PropertiesService.getScriptProperties().getProperty（只在 SPREADSHEET_ID 留空时读这一个键）
 *    Logger.log
 */
