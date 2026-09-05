/**
 * 142_DailyOrderAllocation.js
 * Compliance OS — Daily Order-Level Allocation Engine。
 *
 * 对应已批准的 Phase 2 design（compliance-os-daily-allocation-phase2-design.md）
 * 和 Steven 2026-08-24 的 Phase 3 implementation directive。这一版只做
 * "先写 pure functions + tests"（原始 handoff 文件的 PHASE 3）——不接
 * 108_SheetSetup.js、不接 110_DocumentImport.js、不写真的 Sheet，那些是
 * PHASE 4 的范围。
 *
 * 职责边界：把一份 Verified Weekly Income 底下的 Butiran Tempahan（逐笔
 * 订单）跟三个非订单台账（Tip / Insentif / Bayaran lain-lain）解析成
 * 「有证据支撑的每日/每笔分配」，并且每一步都用 PDF 自己印出来的数字做
 * 独立校验——不产生 EPF/SOCSO/Tax，不改 Verified_Income 本身一个字。
 *
 * CMP-P14（LLM 不是 Truth Engine）在这里的落地：这个文件完全不碰 LLM，
 * 全部是确定性文字解析 + 算术校验（Steven 2026-08-24 明确决定）。但
 * "确定性" 不等于 "不用验证"——125_ExtractionValidation.js 的三层验证
 * 精神（schema/period/arithmetic 分开检查、全部错误一次报完、不因为一层
 * 过了就假设下一层也过）在这里同样适用，只是验证对象从 LLM candidate
 * 换成文字解析出来的 row candidate。
 *
 * 已知、经 Phase 1 两份真实 PDF（2026-W01 跨月、2026-W33 单月）验证过的
 * 前提，写代码前务必读一次 Phase 2 design 文件里的 §3/§5：
 *   - 每个日期分组结尾都有 Grab 自己印出来的 "RM x,xxx.xx" 小计，逐日
 *     加总后精确等于 Verified_Income 的 net_delivery_income，两份真实
 *     样本都是分毫不差——这是整个 checksum 机制成立的前提，不是假设。
 *   - Pendapatan lain 栏经常整栏空白（不是 "0.00"），当 0 处理；命中 4 个
 *     金额时才认 lain 非零。
 *   - Sekaligus（合并订单）一行可能捆多个订单号，只有一组金额，较大批次
 *     用 "and N" 省略掉一部分订单号——分配单位是"印出来的这一行"，不是
 *     假设拆出来的单笔 booking。
 *   - 日期分组标题（例如 "Ahad, 4 Januari"）不带年份，年份必须从
 *     verified_income 的 period_start_parts/period_end_parts 反推。
 *   - Insentif/Bayaran lain-lain 有没有日期证据因周而异，不能假设固定
 *     sub-type 清单，只能逐行找证据。
 *
 * 跟真实文字抽取的已知落差（写在这里，不要假装不存在——CMP-P10）：
 * 目前这份文件预期收到的输入是「Butiran Tempahan 区段的抽取文字」，
 * 格式上比对 Phase 1 用 pdftotext -layout 得到的真实样本——这份文字在
 * 同一个视觉列（例如訂單 ID 的 "A-" 前缀跟后面的字母数字）偶尔会因为
 * PDF 内部换行渲染的关系被拆到不相邻的位置。这份 parser 刻意不依赖
 * "同一行 / 相邻" 这种脆弱假设：先用 "Pesanan" 关键字把整个日期区块切成
 * 一个个 row-block（这个关键字在两份真实样本里从未出现在其他地方，
 * 切分本身很稳定），再对每个 row-block 做 token 级搜寻，不要求 token
 * 之间的相对顺序完全符合视觉阅读顺序。这个设计已经在 Phase 3 交付前用
 * 两份真实 PDF 全量跑过一次，详细结果见交付时的报告——但 GAS 端真正的
 * PDF 转文字方式（Drive OCR 目前还是占位、LLM 路径目前只做 statement
 * 层级摘要）还没有定案，这份 parser 的输入契约是"假设有一份还算过得去
 * 的抽取文字"，PHASE 4 真正接上真实抽取器时，仍然需要用同一组真实
 * PDF 重新验证一次这个假设站不站得住。
 */

if (typeof require === 'function') {
  var { round2_, normalizeIsoDateString_ } = require('./106_Utils.js');
  var { yearMonthFromIsoDate_ } = require('./160_MonthlyProjection.js');
  var { validateOrderExtractionCandidate_ } = require('./125_ExtractionValidation.js');
}

var CHECKSUM_TOLERANCE_ = 0.01; // 跟 125_ExtractionValidation.js 的 EXTRACTION_TOLERANCE_ 同一个精度基准

var WEEKDAY_NAMES_ = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

/** Bonus Harian 这一行，Grab 实际印的是英文星期几（"Bonus Harian Monday"），
 * 跟日期分组标题用马来文星期几（"Ahad, 4 Januari"）不是同一套——这是
 * Phase 3 用真实 W33 PDF 测试时才发现的真实落差，不是假设：同一份文件
 * 里，日期分组标题跟这个特定的 incentif 行类型，用了两种不同语言的
 * 星期几名称。两边都要认，映射到同一个 0=Sunday...6=Saturday 编号。 */
var ENGLISH_WEEKDAY_NAMES_ = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekdayNumberFromAnyName_(name) {
  const malayIdx = WEEKDAY_NAMES_.findIndex((w) => w.toLowerCase() === name.toLowerCase());
  if (malayIdx !== -1) return malayIdx;
  const englishIdx = ENGLISH_WEEKDAY_NAMES_.findIndex((w) => w.toLowerCase() === name.toLowerCase());
  return englishIdx; // -1 if neither matches
}

var MONTH_NAME_TO_NUMBER_ = {
  Januari: 1, Februari: 2, Mac: 3, April: 4, Mei: 5, Jun: 6,
  Julai: 7, Ogos: 8, September: 9, Oktober: 10, November: 11, Disember: 12
};

var PLATFORM_NAMES_ = ['GrabExpress', 'GrabFood', 'GrabMart'];

// Butiran/Jenis Tempahan 栏位常见的非订单号关键字——从 flatten 过的
// row-block 文字里剔除这些之后，剩下形状像订单号的 token 才当作真的
// 订单号。刻意用「排除已知关键字」而不是「只认已知前缀」，因为前缀
// 常常因为换行被拆到跟号码本体不相邻的位置（Phase 1 实测过）。
var ORDER_ROW_STOPWORDS_ = new Set([
  'Pesanan', 'Tunggal', 'Sekaligus', 'Tanpa', 'tunai', 'Tunai',
  'Instant', 'Bike', 'and', 'PLAN', 'GrabExpress', 'GrabFood', 'GrabMart'
]);

/**
 * "YYYY-MM-DD" 字符串构造——完全用整数拼字符串，不喂进 Date 构造函数
 * 解析任何字符串（Steven 2026-08-24 §十一明确要求，UEF Failure Catalog
 * 里已经修过的坑：new Date("1 January") 这类 runtime string parsing 在
 * 不同环境下行为不保证一致）。跟 125_ExtractionValidation.js 的
 * isoDateStringFromParts_ 同一个算法，这里重复一份小函数是因为两个文件
 * 目前没有共同的"parts 工具"依赖点——如果之后有第三个文件也需要同样
 * 逻辑，应该抽到 106_Utils.js，不要再复制第三份。
 * @param {number} year @param {number} month 1-12 @param {number} day
 * @return {string}
 */
function isoDateFromYmd_(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Date.UTC 组出来的日期是否真的等于原始 year/month/day——防越界值被
 * Date.UTC 自动进位吸收掉（例如 day=32 会悄悄变成下个月 1 号）。跟
 * 125_ExtractionValidation.js 的 startRoundTrips 检查同一个原则。
 */
function isValidYmd_(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * 一份 Weekly Statement 的 period_start_parts/period_end_parts 之间，
 * 实际横跨了哪些 (year, month) 组合——用来给不带年份的日期分组标题
 * （"Ahad, 4 Januari"）反推年份。Weekly statement 最多横跨 10 天
 * （125_ExtractionValidation.js 的 spanDays 校验也是这个假设），所以
 * 这里最多也只会得到 2 组 (year, month)，不需要处理更复杂的情况。
 * @param {{year:number,month:number,day:number}} startParts
 * @param {{year:number,month:number,day:number}} endParts
 * @return {Array<{year:number, month:number}>}
 */
function enumerateYearMonthsInPeriod_(startParts, endParts) {
  const start = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));
  const seen = [];
  const seenKeys = new Set();
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 3600 * 1000) {
    const d = new Date(t);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      seen.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }
  }
  return seen;
}

/**
 * 把一个不带年份的日期分组标题（星期几 + 日 + 月份名）解析成确切的
 * ISO 日期——年份从 statement 的 period_start_parts/period_end_parts
 * 反推，不猜。这是 §十一（跨年日期推导）唯一的权威实现，不能用
 * `new Date(monthName + " " + day)` 这种依赖 runtime 字符串解析的写法。
 * @param {string} weekdayName 例如 "Ahad"（目前只用来做合理性检查，
 *   不是年份判定的依据——weekday 本身不携带年份信息）
 * @param {number} day 1-31
 * @param {string} monthName 例如 "Januari"
 * @param {{year:number,month:number,day:number}} periodStartParts
 * @param {{year:number,month:number,day:number}} periodEndParts
 * @return {{ok: true, isoDate: string}|{ok: false, reason: string}}
 */
/**
 * "day + monthName + period" → ISO 日期，不要求星期几——这是
 * resolveOrderDate_ 的核心逻辑抽出来的共用版本，因为 Tip/Insentif 的
 * 日期证据不一定带星期几（Tip 台账只有"4 Januari"，没有"Ahad"）。
 * @param {number} day
 * @param {string} monthName 马来文月份名
 * @param {{year:number,month:number,day:number}} periodStartParts
 * @param {{year:number,month:number,day:number}} periodEndParts
 * @return {{ok:true,isoDate:string}|{ok:false,reason:string}}
 */
function resolveDateFromDayMonth_(day, monthName, periodStartParts, periodEndParts) {
  const monthNumber = MONTH_NAME_TO_NUMBER_[monthName];
  if (!monthNumber) return { ok: false, reason: `未知月份名称：${monthName}` };
  const candidates = enumerateYearMonthsInPeriod_(periodStartParts, periodEndParts).filter((ym) => ym.month === monthNumber);
  if (candidates.length === 0) return { ok: false, reason: `月份 ${monthName} 不在 statement 期间范围内` };
  if (candidates.length > 1) return { ok: false, reason: `月份 ${monthName} 对应多个年份，无法唯一判定` };
  const year = candidates[0].year;
  if (!isValidYmd_(year, monthNumber, day)) return { ok: false, reason: `${year}-${monthName}-${day} 不是合法日期` };
  return { ok: true, isoDate: isoDateFromYmd_(year, monthNumber, day) };
}

function resolveOrderDate_(weekdayName, day, monthName, periodStartParts, periodEndParts) {
  if (WEEKDAY_NAMES_.indexOf(weekdayName) === -1) {
    return { ok: false, reason: `未知星期几名称：${weekdayName}` };
  }
  return resolveDateFromDayMonth_(day, monthName, periodStartParts, periodEndParts);
}

/**
 * 把「Butiran Tempahan - Penghantaran」区段的原始抽取文字切成一个个
 * 日期分组——对应 CMP-P8（多页官方文件的字段搜索要限定范围）：呼叫方
 * 必须先把输入截到这个区段本身（从 "Butiran Tempahan - Penghantaran"
 * 到下一个已知区段/词汇表为止），这个函数不做区段定界，只做区段内部的
 * 日期分组切分——两个职责分开，方便各自测试。
 * @param {string} sectionText 已经定界过的区段文字
 * @return {Array<{weekdayName:string, day:number, monthName:string, blockText:string}>}
 */
function splitIntoDayBlocks_(sectionText) {
  const dayHeaderRe = /(Ahad|Isnin|Selasa|Rabu|Khamis|Jumaat|Sabtu),\s*(\d{1,2})\s+([A-Za-z]+)\s*\n/g;
  const matches = [];
  let m;
  while ((m = dayHeaderRe.exec(sectionText)) !== null) {
    matches.push({ weekdayName: m[1], day: parseInt(m[2], 10), monthName: m[3], start: m.index, contentStart: dayHeaderRe.lastIndex });
  }
  return matches.map((entry, i) => ({
    weekdayName: entry.weekdayName,
    day: entry.day,
    monthName: entry.monthName,
    blockText: sectionText.slice(entry.contentStart, i + 1 < matches.length ? matches[i + 1].start : sectionText.length)
  }));
}

/**
 * 从一个已经 flatten（空白正规化）过的 row-block 文字里，挑出形状像
 * 订单号本体的 token——刻意不要求跟 "A-"/"PLAN-1-" 前缀相邻（Phase 1
 * 实测：换行会把前缀跟号码本体拆到不相邻的位置），改成排除法：已知
 * 关键字、纯数字、金额格式都不算，剩下形状是「大写字母/数字混合、
 * 长度 >= 6」的 token 才算。前缀依 platform 补回去（GrabExpress 一律
 * PLAN-1-，其他一律 A-——两份真实样本目前只见过这两种前缀）。
 * 有极少数情况（Phase 1 实测约 1.5% 的行）订单号会因为原始文字缺一个
 * 空白，直接跟下一个字词黏在一起（例如 "8QH7KHSWWCOWAVtunai"）——这里
 * 用「取开头连续大写字母/数字的部分」处理这种情况，而不是要求整个
 * token 都符合订单号形状。
 * @param {string} flatBlock
 * @param {string} platform
 * @return {string[]}
 */
function extractOrderIds_(flatBlock, platform) {
  const prefix = platform === 'GrabExpress' ? 'PLAN-1-' : 'A-';
  const tokens = flatBlock.replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const ids = [];
  tokens.forEach((t) => {
    if (ORDER_ROW_STOPWORDS_.has(t)) return;
    if (/^-?\d[\d,]*\.\d{2}$/.test(t)) return; // 金额
    if (/^\d+$/.test(t)) return; // 纯数字（例如 "and 2" 的 2）
    const idMatch = t.match(/^[A-Z0-9]{6,}/);
    if (idMatch) ids.push(idMatch[0]);
  });
  return ids.map((x) => prefix + x);
}

/**
 * 解析单一 Butiran Tempahan row-block——外部唯一入口，schema 层验证
 * （必要字段在不在、金额是不是数字、算术站不站得住）全部在这里做完，
 * 呼叫方拿到的 candidate 只有 valid=true 才能变成正式 Order_Allocation
 * 记录（CMP-P10：不合法的候选要显式落 errors，不能静默丢掉或囫囵接受）。
 * @param {string} rowBlockRaw "Pesanan" 之后、下一个 "Pesanan" 或该日
 *   印出来的 RM 小计之前的原始文字
 * @return {{valid:boolean, errors:string[], candidate:(Object|null)}}
 */
function parseOrderRowCandidate_(rowBlockRaw) {
  const errors = [];
  const flat = rowBlockRaw.replace(/\s+/g, ' ').trim();

  const rowType = /\bSekaligus\b/.test(flat) ? 'Sekaligus' : (/\bTunggal\b/.test(flat) ? 'Tunggal' : null);
  if (!rowType) errors.push(`无法判定 Jenis Tempahan（Tunggal/Sekaligus）：${flat.slice(0, 80)}`);

  const platform = PLATFORM_NAMES_.find((p) => flat.indexOf(p) !== -1) || null;
  if (!platform) errors.push(`无法判定 platform：${flat.slice(0, 80)}`);

  const ids = platform ? extractOrderIds_(flat, platform) : [];
  if (ids.length === 0) errors.push(`没有解析出任何订单号：${flat.slice(0, 80)}`);

  const andMoreMatch = flat.match(/\band\s+(\d+)\b/);
  const andMoreCount = andMoreMatch ? parseInt(andMoreMatch[1], 10) : 0;
  // 2026-08-25 修正：原本要求 Sekaligus 至少 2 个订单号，但用真实 W33 PDF
  // 第 14 页肉眼核对过（Steven 对照官方 PDF 原件确认）：Grab 自己的模板
  // 确实会印出「Sekaligus + 只有 1 个订单号 + 没有 and N」这种行（同一页
  // 上下文还同时有 2-ID 跟 "and N" 两种变体作对照），金额也跟当日 subtotal
  // 对得上——这是真实业务规则，不是解析缺陷。改成只要求「至少 1 个可
  // 识别订单号」；真正一个订单号都抓不到的情况，交给下面的
  // `ids.length === 0` 检查落 Needs_Review，不是靠这里的数量门槛。
  if (rowType === 'Sekaligus' && ids.length === 0 && andMoreCount === 0) {
    errors.push(`Sekaligus 行一个订单号都没解析出来：${flat.slice(0, 80)}`);
  }

  // "Tanpa" 跟 "tunai"（小写，"Tanpa tunai" = 无现金/cashless 的第二个字）
  // 常常因为同一个 row-block 内部换行顺序被打散而不相邻（Phase 3 实测：
  // 用相邻性判断会让绝大多数行被误判成"无法判定付款方式"）——改成各自
  // 独立找是否存在，不要求相邻，跟 extractOrderIds_ 已经踩过、修过的
  // 同一类问题。独立出现的大写 "Tunai"（不是 "Tanpa tunai" 的一部分）
  // 代表现金支付；Sekaligus 常见的组合支付（两个都出现）判为 Mixed。
  // "tunai" 前面不要求 \b：极少数情况（Phase 3 用真实 W01/W33 PDF 测试时
  // 实测到）它会直接黏在订单号字母尾巴后面、中间没有空白（例如
  // "...COWAVtunai"），\b 在两个 \w 字符之间不会成立，会导致这极少数行
  // 被误判成「无法判定付款方式」。这里只保留结尾 \b（避免匹配到更长的
  // 词），前面用大小写字母边界弱化掉。
  // 跟上面 "tunai" 同一个理由："Tanpa" 偶尔也会黏在前一个订单号字母
  // 尾巴后面（例如 "...PSTAVTanpa"），前导 \b 一样会失效，一并放宽。
  const hasTanpaWord = /Tanpa\b/.test(flat);
  const hasLowercaseTunai = /tunai\b/.test(flat);
  const hasCapitalTunai = /\bTunai\b/.test(flat);
  let paymentMethod = null;
  if (hasTanpaWord && hasLowercaseTunai && hasCapitalTunai) paymentMethod = 'Mixed';
  else if (hasTanpaWord && hasLowercaseTunai) paymentMethod = 'Tanpa_Tunai';
  else if (hasCapitalTunai) paymentMethod = 'Tunai';
  if (!paymentMethod) errors.push(`无法判定付款方式：${flat.slice(0, 80)}`);

  const amounts = (flat.match(/-?\d[\d,]*\.\d{2}/g) || []).map((x) => parseFloat(x.replace(/,/g, '')));
  let baseIncome = null, otherIncome = null, adjustment = null, netIncome = null;
  if (amounts.length === 3) {
    [baseIncome, adjustment, netIncome] = amounts;
    otherIncome = 0;
  } else if (amounts.length === 4) {
    [baseIncome, otherIncome, adjustment, netIncome] = amounts;
  } else {
    errors.push(`金额栏数量异常（预期 3 或 4 个，实际 ${amounts.length} 个）：${JSON.stringify(amounts)} :: ${flat.slice(0, 80)}`);
  }
  if (baseIncome !== null) {
    const recomputed = round2_(baseIncome + otherIncome + adjustment);
    const diff = round2_(netIncome - recomputed);
    if (Math.abs(diff) > CHECKSUM_TOLERANCE_) {
      errors.push(`asas+lain+pelarasan (${recomputed}) 跟 bersih (${netIncome}) 对不上，差 ${diff}：${flat.slice(0, 80)}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, candidate: null };
  }
  return {
    valid: true,
    errors: [],
    candidate: {
      order_row_type: rowType,
      platform,
      order_id_primary: ids[0],
      order_id_raw: ids.join(' / ') + (andMoreCount > 0 ? ` and ${andMoreCount}` : ''),
      bundled_order_count: rowType === 'Tunggal' ? 1 : (ids.length + andMoreCount),
      order_identity_status: andMoreCount > 0 ? 'Partially_Known' : 'Fully_Known',
      payment_method: paymentMethod,
      base_income: round2_(baseIncome),
      other_income: round2_(otherIncome),
      income_adjustment: round2_(adjustment),
      net_income: round2_(netIncome)
    }
  };
}

/**
 * 一个日期分组区块（splitIntoDayBlocks_ 的输出之一）解析成：该日所有
 * 有效 order row candidate + Grab 自己印出来的当日小计。当日小计的
 * 抓取方式：区块内最后一个独立出现的 "RM x,xxx.xx"——这是该日结尾的
 * 汇总行，不是某一笔订单金额的一部分（订单金额从来不带 "RM" 前缀）。
 * @param {Object} dayBlock splitIntoDayBlocks_ 的单一元素
 * @return {{rows: Array, invalidRows: Array, printedSubtotal: (number|null)}}
 */
function parseDayBlock_(dayBlock) {
  const rmMatches = [...dayBlock.blockText.matchAll(/RM([\d,]+\.\d{2})/g)];
  const printedSubtotal = rmMatches.length > 0
    ? parseFloat(rmMatches[rmMatches.length - 1][1].replace(/,/g, ''))
    : null;
  const bodyText = rmMatches.length > 0
    ? dayBlock.blockText.slice(0, rmMatches[rmMatches.length - 1].index)
    : dayBlock.blockText;

  const rowChunks = bodyText.split('Pesanan').slice(1);
  const rows = [];
  const invalidRows = [];
  rowChunks.forEach((chunk) => {
    const result = parseOrderRowCandidate_(chunk);
    if (result.valid) rows.push(result.candidate);
    else invalidRows.push({ errors: result.errors, raw: chunk.slice(0, 120) });
  });
  return { rows, invalidRows, printedSubtotal };
}

/**
 * Level 1 checksum——某一天的订单行 net_income 加总 vs 该日 Grab 印出来
 * 的小计。容差刻意是 0（经过 round2_ 之后），不是 Reconciliation 那种
 * RM5/0.5% 业务容差——两边数字同源于同一份 PDF，理论上该完全相等，
 * 业务容差在这里只会掩盖真正的解析错误。status 沿用
 * 130_Reconciliation.js 的 Matched/Discrepancy_Flagged 词汇（Steven
 * 2026-08-24 批准），不是另外发明 Checksum_Passed/Failed。
 * @param {Array<{net_income:number}>} orderRows
 * @param {number|null} printedSubtotal
 * @return {{calculatedTotal:number, printedSubtotal:(number|null), difference:(number|null), status:string}}
 */
function computeDailyChecksum_(orderRows, printedSubtotal) {
  const calculatedTotal = round2_(orderRows.reduce((sum, r) => sum + r.net_income, 0));
  if (printedSubtotal === null) {
    return { calculatedTotal, printedSubtotal: null, difference: null, status: 'Discrepancy_Flagged' };
  }
  const difference = round2_(calculatedTotal - printedSubtotal);
  const status = Math.abs(difference) <= CHECKSUM_TOLERANCE_ ? 'Matched' : 'Discrepancy_Flagged';
  return { calculatedTotal, printedSubtotal, difference, status };
}

/**
 * Level 2 checksum——整份 Statement：Daily_Allocation 逐日 net_income
 * 加总 vs Verified_Income 自己的 net_delivery_income 陈述值（CMP-P5：
 * 后者是权威，前者只是拿来核对，核对不过不能反过来改 Verified_Income）。
 * @param {Array<{net_delivery_income:number}>} dailyAllocations
 * @param {number} verifiedNetDeliveryIncome
 * @return {{calculatedTotal:number, statedTotal:number, difference:number, status:string}}
 */
function computeStatementChecksum_(dailyAllocations, verifiedNetDeliveryIncome) {
  const calculatedTotal = round2_(dailyAllocations.reduce((sum, d) => sum + d.net_delivery_income, 0));
  const difference = round2_(calculatedTotal - verifiedNetDeliveryIncome);
  const status = Math.abs(difference) <= CHECKSUM_TOLERANCE_ ? 'Matched' : 'Discrepancy_Flagged';
  return { calculatedTotal, statedTotal: verifiedNetDeliveryIncome, difference, status };
}

// ---------------------------------------------------------------------
// Non-Order Income（Tip / Insentif / Bayaran lain-lain）
// ---------------------------------------------------------------------

/** Grab 官方措辞里两种已知、经两份真实样本证实的「明确属于别的 period」文案。 */
var LONG_WAIT_COMPENSATION_RE_ = /Weekly compensation for long wait time\s*\(\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*\)/i;
var MONTH_REIMBURSEMENT_RE_ = /Reimbursement\s+([A-Za-z]+)\s+(\d{4})/i;
var ENGLISH_MONTH_TO_NUMBER_ = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12
};

/**
 * Insentif 逐行找日期证据——只认「Bonus Harian <星期几>」这个已知格式
 * （Phase 1 在 2026-W33 真实证实存在，2026-W01 则完全没有这种格式，
 * 两份样本本身就是"不能假设固定 sub-type 清单"的证据）。星期几本身要
 * 配合 statement 的 period 才能反推成确切日期，用同一个
 * enumerateYearMonthsInPeriod_ + weekday 比对的逻辑（这里简化成：在
 * period_start~period_end 的每一天里找 weekday 名称相符的那一天——
 * 一个 statement 最多 10 天，同一个 weekday 名称在这个范围内不会出现
 * 两次，不会有歧义）。
 * @param {string} descriptionRaw
 * @param {{year:number,month:number,day:number}} periodStartParts
 * @param {{year:number,month:number,day:number}} periodEndParts
 * @return {{dateSource:string, allocatedDate:(string|null), referencedSourcePeriod:(string|null)}}
 */
function matchInsentifLineDate_(descriptionRaw, periodStartParts, periodEndParts) {
  const weekdayMatch = descriptionRaw.match(/Bonus Harian ([A-Za-z]+)/i);
  if (weekdayMatch) {
    const targetWeekday = weekdayNumberFromAnyName_(weekdayMatch[1]);
    if (targetWeekday !== -1) {
      const start = new Date(Date.UTC(periodStartParts.year, periodStartParts.month - 1, periodStartParts.day));
      const end = new Date(Date.UTC(periodEndParts.year, periodEndParts.month - 1, periodEndParts.day));
      for (let t = start.getTime(); t <= end.getTime(); t += 24 * 3600 * 1000) {
        const d = new Date(t);
        if (d.getUTCDay() === targetWeekday) {
          return { dateSource: 'Weekday_Label_Match', allocatedDate: isoDateFromYmd_(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), referencedSourcePeriod: null };
        }
      }
    }
  }
  return matchExplicitPeriodReference_(descriptionRaw);
}

/**
 * Tip 台账逐笔解析——格式跟 Butiran Tempahan 订单行完全不同，是自己
 * 独立的一张表：「day 月份名,」+ 订单号 + 现金/信用/小计三个金额（信用
 * 栏永远印成 "-"，不是数字）。同样不假设相邻顺序（Phase 3 实测：
 * Tip 区块里日期行、订单号+金额行、时间行三者的物理换行顺序也不固定），
 * 用「day+monthName」「订单号」「三个金额」三种 token 各自独立搜寻，
 * 按照它们在整个 Tip 区块文字里出现的顺序配对——这个顺序在两份真实
 * 样本里都保持一致（同一笔交易的三种证据虽然行内顺序会变，但跨笔之间
 * 的先后顺序没有被打乱）。
 * @param {string} tipSectionText 已经定界到 Tip 表格本身的文字（含表头
 *   到该表格自己的 "RM" 总计之前）
 * @param {{year:number,month:number,day:number}} periodStartParts
 * @param {{year:number,month:number,day:number}} periodEndParts
 * @return {{lines: Array, invalid: Array}}
 */
function parseTipSection_(tipSectionText, periodStartParts, periodEndParts) {
  const dateTokens = [...tipSectionText.matchAll(/(\d{1,2})\s+([A-Za-z]+),/g)];
  const orderAmountTokens = [...tipSectionText.matchAll(/((?:A-|PLAN-\d+-)[A-Z0-9]+)\s+(-?\d[\d,]*\.\d{2})\s+-\s+(-?\d[\d,]*\.\d{2})/g)];
  const lines = [];
  const invalid = [];
  const n = Math.min(dateTokens.length, orderAmountTokens.length);
  if (dateTokens.length !== orderAmountTokens.length) {
    invalid.push({ reason: `日期 token 数量 (${dateTokens.length}) 跟 订单/金额 token 数量 (${orderAmountTokens.length}) 不一致，两者按顺序配对可能有误`, dateTokenCount: dateTokens.length, orderAmountTokenCount: orderAmountTokens.length });
  }
  for (let i = 0; i < n; i++) {
    const day = parseInt(dateTokens[i][1], 10);
    const monthName = dateTokens[i][2];
    const dateResult = resolveDateFromDayMonth_(day, monthName, periodStartParts, periodEndParts);
    if (!dateResult.ok) {
      invalid.push({ reason: dateResult.reason, raw: dateTokens[i][0] });
      continue;
    }
    lines.push({
      order_id: orderAmountTokens[i][1],
      amount: round2_(parseFloat(orderAmountTokens[i][3].replace(/,/g, ''))),
      allocated_date: dateResult.isoDate,
      date_source: 'Tip_Ledger_Direct'
    });
  }
  return { lines, invalid };
}

/**
 * Bayaran lain-lain（以及找不到星期几标签的 Insentif 行）逐行找「明确
 * 属于别的 period」的证据——只认两个已知、在两份真实样本里都出现过的
 * 固定文案，不做自由文字日期解析（CMP-P10：找不到已知格式就是
 * Not_Determinable，不要为了"看起来更完整"去猜一个通用日期抽取器）。
 * @param {string} descriptionRaw
 * @return {{dateSource:string, allocatedDate:null, referencedSourcePeriod:(string|null)}}
 */
function matchExplicitPeriodReference_(descriptionRaw) {
  const waitMatch = descriptionRaw.match(LONG_WAIT_COMPENSATION_RE_);
  if (waitMatch) {
    // 取区间「结束日」所在的月份当作 source period——补偿通常在
    // 该周结束后的下一份 statement 才付款，结束日比开始日更能代表
    // "这笔钱对应的是哪个月的工作"，但两者若跨月，仍然只能给出一个
    // 单一月份标签；这里保留 raw 文字供人工核对，不假装能精确到日。
    const endMonthNum = MONTH_NAME_TO_NUMBER_[waitMatch[5]] || ENGLISH_MONTH_TO_NUMBER_[waitMatch[5]];
    if (endMonthNum) {
      return { dateSource: 'Explicit_Period_Reference', allocatedDate: null, referencedSourcePeriod: `${waitMatch[6]}-${String(endMonthNum).padStart(2, '0')}` };
    }
  }
  const reimbMatch = descriptionRaw.match(MONTH_REIMBURSEMENT_RE_);
  if (reimbMatch) {
    const monthNum = ENGLISH_MONTH_TO_NUMBER_[reimbMatch[1]] || MONTH_NAME_TO_NUMBER_[reimbMatch[1]];
    if (monthNum) {
      return { dateSource: 'Explicit_Period_Reference', allocatedDate: null, referencedSourcePeriod: `${reimbMatch[2]}-${String(monthNum).padStart(2, '0')}` };
    }
  }
  return { dateSource: 'Not_Determinable', allocatedDate: null, referencedSourcePeriod: null };
}

/**
 * Bayaran lain-lain 专用：文字里如果含一个订单号，且该订单号确实出现在
 * 这份 Statement 已经解析好的 Order_Allocation 里，就用该订单的日期
 * （date_source='Order_ID_Matched'——沿用 Steven 2026-08-24 §八 A 的
 * 命名）。找不到就退回 matchExplicitPeriodReference_。
 * @param {string} descriptionRaw
 * @param {Array<{order_id_primary:string, order_date:string}>} knownOrderRows 同一份 Statement 已经解析好的订单
 * @return {{dateSource:string, allocatedDate:(string|null), referencedSourcePeriod:(string|null), linkedOrderId:(string|null)}}
 */
function matchBayaranLainLainDate_(descriptionRaw, knownOrderRows) {
  const idMatch = descriptionRaw.match(/(?:A-|PLAN-\d+-)[A-Z0-9]{6,}/);
  if (idMatch) {
    const found = knownOrderRows.find((r) => r.order_id_primary === idMatch[0] || (r.order_id_raw && r.order_id_raw.indexOf(idMatch[0]) !== -1));
    if (found) {
      return { dateSource: 'Order_ID_Matched', allocatedDate: found.order_date, referencedSourcePeriod: null, linkedOrderId: found.order_id_primary };
    }
  }
  const fallback = matchExplicitPeriodReference_(descriptionRaw);
  return Object.assign({ linkedOrderId: null }, fallback);
}

/**
 * date → "YYYY-MM"，纯粹转呼叫 160_MonthlyProjection.js 既有的
 * yearMonthFromIsoDate_，不重新实现（Steven §十 明确要求这是查询方法，
 * 不是新存储字段；重用既有函数则是「不要重新发明」的直接体现）。
 * @param {string} isoDate
 * @return {string}
 */
function orderDateToYearMonth_(isoDate) {
  return yearMonthFromIsoDate_(isoDate);
}

// =======================================================================
// Gemini extraction 对接 —— Phase 4，2026-08-25。127_LLMExtractor.js 的
// extractOrders() 产出、125_ExtractionValidation.js 的
// validateOrderExtractionCandidate_() 验证过的 candidate，在这里映射成
// 跟上面文字解析路径完全一样的 candidate 形状——computeDailyChecksum_ /
// computeStatementChecksum_ / matchInsentifLineDate_ 等等因此完全不用
// 因为换了资料来源而改一行。
// =======================================================================

/**
 * 一个 Gemini 回报的 order 物件（已经过 125 的四层验证）→ 跟
 * parseOrderRowCandidate_ 完全一样形状的 candidate，外加 source_page
 * （文字解析路径没有页码资讯，这个栏位是新增的，选填，不影响既有消费者）。
 * 日期用既有、Phase 3 已测过的 resolveOrderDate_——125 刻意不检查这一步
 * （见 125_ExtractionValidation.js 顶端的边界说明），这里才是真正拿这份
 * Statement 的 period 去比对的地方。
 * @param {Object} geminiDay candidate.days[i]（已通过 125 验证）
 * @param {Object} geminiOrder geminiDay.orders[j]
 * @param {{year:number,month:number,day:number}} periodStartParts
 * @param {{year:number,month:number,day:number}} periodEndParts
 * @return {{valid:boolean, errors:string[], candidate:(Object|null)}}
 */
function candidateFromGeminiOrderRow_(geminiDay, geminiOrder, periodStartParts, periodEndParts) {
  const dateResult = resolveDateFromDayMonth_(geminiDay.day, geminiDay.month_name, periodStartParts, periodEndParts);
  if (!dateResult.ok) {
    return { valid: false, errors: [`日期无法在 statement period 内解析：${dateResult.reason}`], candidate: null };
  }
  if (KNOWN_WEEKDAY_MISMATCH_CHECK_(geminiDay.weekday_name, dateResult.isoDate)) {
    return { valid: false, errors: [`weekday_name (${geminiDay.weekday_name}) 跟解析出来的日期 ${dateResult.isoDate} 实际的星期几对不上`], candidate: null };
  }
  const platform = PLATFORM_NAMES_.find((p) => geminiOrder.platform_raw.indexOf(p) !== -1) || null;
  if (!platform) {
    return { valid: false, errors: [`platform_raw 无法归类到已知 platform：${geminiOrder.platform_raw}`], candidate: null };
  }
  const idPrefix = platform === 'GrabExpress' ? 'PLAN-1-' : 'A-';
  const idsText = geminiOrder.order_ids_raw.join(' / ') + (geminiOrder.and_more_count > 0 ? ` and ${geminiOrder.and_more_count}` : '');
  const hasTanpa = /Tanpa\s*tunai/i.test(geminiOrder.payment_method_raw);
  const hasTunai = /(?:^|\/)\s*Tunai\s*(?:$|\/)/i.test(geminiOrder.payment_method_raw) || /^Tunai$/i.test(geminiOrder.payment_method_raw.trim());
  const paymentMethod = (hasTanpa && hasTunai) ? 'Mixed' : (hasTanpa ? 'Tanpa_Tunai' : (hasTunai ? 'Tunai' : null));

  return {
    valid: true,
    errors: [],
    candidate: {
      order_date: dateResult.isoDate,
      order_row_type: geminiOrder.order_row_type,
      platform,
      order_id_primary: geminiOrder.order_ids_raw[0] || null,
      order_id_raw: idsText,
      bundled_order_count: geminiOrder.order_row_type === 'Tunggal' ? 1 : (geminiOrder.order_ids_raw.length + geminiOrder.and_more_count),
      order_identity_status: geminiOrder.and_more_count > 0 ? 'Partially_Known' : 'Fully_Known',
      payment_method: paymentMethod,
      base_income: round2_(geminiOrder.base_income),
      other_income: round2_(geminiOrder.other_income),
      income_adjustment: round2_(geminiOrder.income_adjustment),
      net_income: round2_(geminiOrder.net_income),
      source_page: geminiOrder.source_page,
      extraction_method: 'Gemini_Structured_v1',
      low_confidence: !!geminiOrder.low_confidence
    }
  };
}

/** weekday_name 跟实际算出来的日期是否吻合——防呆用（125 只查 weekday_name
 * 是不是已知枚举，没有拿它去跟 day/month_name 交叉核对，这里补上）。 */
function KNOWN_WEEKDAY_MISMATCH_CHECK_(weekdayName, isoDate) {
  const idx = WEEKDAY_NAMES_.indexOf(weekdayName);
  if (idx === -1) return true; // 未知名称，交给上面统一报错
  const d = new Date(isoDate + 'T00:00:00Z');
  return d.getUTCDay() !== idx;
}

/**
 * 合并多个 page-range chunk 的 Gemini candidate（fallback 用）——按
 * (weekday_name, day, month_name) 当 day-key。同一个 day-key 只在一个
 * chunk 出现、且该 chunk 自报 day_block_complete=true → 直接采用。
 * 出现在多个 chunk（跨块边界的日期分组）→ 合并 orders 并对同一个
 * order（用 order_ids_raw 的 JSON 序列化 + source_page 当 identity）
 * 去重；如果两个 chunk 对同一个 printed_daily_subtotal 报的数字不一样，
 * 或者合并后仍然没有任何一个 chunk 报出这一天的 printed_daily_subtotal，
 * 都不要猜——整份合并结果标记为需要人工看，而不是挑一个数字硬用。
 * @param {Array<{candidate: Object, pageRange: {firstPage:number,lastPage:number}}>} chunkResults
 * @return {{merged: (Object|null), errors: string[]}}
 */
function mergeChunkedExtractionResults_(chunkResults) {
  const errors = [];
  const byKey = new Map();
  chunkResults.forEach(({ candidate }) => {
    candidate.days.forEach((day) => {
      const key = `${day.weekday_name}|${day.day}|${day.month_name}`;
      if (!byKey.has(key)) {
        byKey.set(key, { weekday_name: day.weekday_name, day: day.day, month_name: day.month_name, subtotals: [], orders: [], anyComplete: false });
      }
      const entry = byKey.get(key);
      if (day.printed_daily_subtotal !== null) entry.subtotals.push(day.printed_daily_subtotal);
      if (day.day_block_complete) entry.anyComplete = true;
      entry.orders.push(...day.orders);
    });
  });

  const mergedDays = [];
  byKey.forEach((entry, key) => {
    const uniqueSubtotals = [...new Set(entry.subtotals.map((s) => round2_(s)))];
    if (uniqueSubtotals.length > 1) {
      errors.push(`日期分组 ${key} 在不同 chunk 里报出不一致的 printed_daily_subtotal：${JSON.stringify(uniqueSubtotals)}`);
    }
    // 同一笔订单可能因为 chunk 重叠范围被两个 chunk 都看到并各自报一次——
    // 用「order_ids_raw + source_page」当 identity 去重，不是信任 chunk
    // 自己讲的 day_block_complete 就假设没有重叠。
    const seen = new Set();
    const dedupedOrders = [];
    entry.orders.forEach((o) => {
      const identity = JSON.stringify(o.order_ids_raw) + '@' + o.source_page;
      if (seen.has(identity)) return;
      seen.add(identity);
      dedupedOrders.push(o);
    });
    mergedDays.push({
      weekday_name: entry.weekday_name, day: entry.day, month_name: entry.month_name,
      day_block_complete: entry.anyComplete,
      printed_daily_subtotal: uniqueSubtotals.length === 1 ? uniqueSubtotals[0] : null,
      orders: dedupedOrders
    });
    if (uniqueSubtotals.length === 0) {
      errors.push(`日期分组 ${key} 合并后没有任何 chunk 报出 printed_daily_subtotal，无法做 daily checksum`);
    }
  });

  return { merged: { extraction_scope: { first_page_seen: Math.min(...chunkResults.map((c) => c.pageRange.firstPage)), last_page_seen: Math.max(...chunkResults.map((c) => c.pageRange.lastPage)) }, days: mergedDays, notes: '' }, errors };
}

/**
 * Phase 4 顶层协调——「整份 PDF 一次呼叫」是首选，失败/验证不过才 fallback
 * 到分块（Steven 2026-08-25 §1）。CMP-P13 精神：呼叫方不需要知道内部
 * 到底试了几次、走了哪条路，只关心最后拿到的是一个 Fully_Allocated /
 * Partially_Allocated / Needs_Review 的结果，不会是例外中断整个 Statement。
 *
 * 重要老实话（写在这里，不要假装没有）：这个函数的 fallback 分支——
 * 真的把 PDF 切成 page range 分别丢给 Gemini、再合并——目前只用合成的
 * fake extractor 测过合并逻辑本身对不对，没有、也没办法在这个环境里对
 * 真的 Gemini API 验证过"分段之后 Gemini 实际会不会给出可以合并的结果"。
 * Phase 4 report 里会明确列出来，这不是隐藏的限制。
 *
 * @param {{fileId:string, mimeType:string, documentId:string, totalPages:number}} document
 * @param {{netDeliveryIncome:number, periodStartParts:Object, periodEndParts:Object, verifiedIncomeId:string}} verifiedIncomeContext
 * @param {{extractor: Object, now: (Date|undefined)}} deps extractor 必须有 extractOrders(document, pageRangeOrNull)
 * @return {Object} { batchId, allocationStatus, dailyAllocations, orderRows, nonRetryableErrors, attempts }
 */
function runGeminiOrderExtractionWithFallback_(document, verifiedIncomeContext, deps) {
  const now = deps.now instanceof Date ? deps.now : new Date();
  const batchId = `CMP-OALB-${verifiedIncomeContext.verifiedIncomeId}-${now.getTime()}`;
  const attempts = [];

  function tryValidate(candidate, label) {
    const validation = validateOrderExtractionCandidate_(candidate);
    attempts.push({ label, stage: validation.stage, errorCount: validation.errors.length });
    return validation;
  }

  // 第一次尝试：整份文件一次呼叫（首选路径）
  let fullCandidate = null;
  let fullValidation = null;
  try {
    fullCandidate = deps.extractor.extractOrders(document, null).candidate;
    fullValidation = tryValidate(fullCandidate, 'full_document');
  } catch (err) {
    attempts.push({ label: 'full_document', stage: 'Extraction_Failed', errorCount: 1, exception: String(err && err.message || err) });
  }

  let finalCandidate = null;
  if (fullValidation && fullValidation.valid) {
    finalCandidate = fullCandidate;
  } else {
    // Fallback：切成两个有 1 页重叠的 page range 各打一次。用这么简单的
    // 二分而不是更细的分块，是因为目前完全没有真实证据支持「细到几页
    // 一块比较可靠」这个假设——细节交给 Phase 5 真的对真实 Gemini 测试
    // 之后再调，这里先给一个能动、逻辑上站得住的版本。
    const totalPages = document.totalPages;
    const midpoint = Math.ceil(totalPages / 2);
    const ranges = [
      { firstPage: 1, lastPage: Math.min(midpoint + 1, totalPages) },
      { firstPage: Math.max(midpoint, 1), lastPage: totalPages }
    ];
    const chunkResults = [];
    let anyChunkException = false;
    ranges.forEach((range) => {
      try {
        const candidate = deps.extractor.extractOrders(document, range).candidate;
        const validation = tryValidate(candidate, `chunk_${range.firstPage}-${range.lastPage}`);
        if (validation.valid) {
          chunkResults.push({ candidate, pageRange: range });
        }
      } catch (err) {
        anyChunkException = true;
        attempts.push({ label: `chunk_${range.firstPage}-${range.lastPage}`, stage: 'Extraction_Failed', errorCount: 1, exception: String(err && err.message || err) });
      }
    });

    if (chunkResults.length > 0) {
      const { merged, errors: mergeErrors } = mergeChunkedExtractionResults_(chunkResults);
      const mergedValidation = tryValidate(merged, 'merged_chunks');
      if (mergedValidation.valid && mergeErrors.length === 0) {
        finalCandidate = merged;
      } else {
        attempts.push({ label: 'merged_chunks_rejected', stage: 'Needs_Review', errorCount: mergeErrors.length + mergedValidation.errors.length, mergeErrors, validationErrors: mergedValidation.errors });
      }
    } else if (anyChunkException) {
      attempts.push({ label: 'all_chunks_failed', stage: 'Extraction_Failed', errorCount: 1 });
    }
  }

  if (!finalCandidate) {
    // 全部路径都没能产生一个通过验证的 candidate——Steven 明确要求：
    // 不能让整个 Statement 因此失败/中断，回一个明确的 Needs_Review 结果，
    // 不抛例外、不中断呼叫方的流程（例如批次汇入其他 Statement）。
    return { batchId, allocationStatus: 'Needs_Review', dailyAllocations: [], orderRows: [], nonRetryableErrors: attempts, attempts };
  }

  // finalCandidate 已经通过 125 的四层验证，逐笔映射成既有 candidate 形状，
  // 复用 Phase 3 完全没变过的 checksum/allocation 逻辑。
  const orderRows = [];
  const mappingErrors = [];
  finalCandidate.days.forEach((day) => {
    day.orders.forEach((order) => {
      const mapped = candidateFromGeminiOrderRow_(day, order, verifiedIncomeContext.periodStartParts, verifiedIncomeContext.periodEndParts);
      if (mapped.valid) orderRows.push(mapped.candidate);
      else mappingErrors.push({ day: `${day.weekday_name} ${day.day} ${day.month_name}`, errors: mapped.errors });
    });
  });

  const dailyAllocations = finalCandidate.days.map((day) => {
    const rowsForDay = orderRows.filter((r) => {
      const d = new Date(r.order_date + 'T00:00:00Z');
      return WEEKDAY_NAMES_[d.getUTCDay()] === day.weekday_name && d.getUTCDate() === day.day;
    });
    const checksum = computeDailyChecksum_(rowsForDay, day.printed_daily_subtotal);
    return {
      date: rowsForDay.length > 0 ? rowsForDay[0].order_date : null,
      order_row_count: rowsForDay.length,
      net_delivery_income: checksum.calculatedTotal,
      printed_daily_subtotal: checksum.printedSubtotal,
      checksum_difference: checksum.difference,
      checksum_status: checksum.status
    };
  });

  const allDaysMatched = dailyAllocations.length > 0 && dailyAllocations.every((d) => d.checksum_status === 'Matched') && mappingErrors.length === 0;
  const statementChecksum = computeStatementChecksum_(dailyAllocations, verifiedIncomeContext.netDeliveryIncome);
  const allocationStatus = (allDaysMatched && statementChecksum.status === 'Matched') ? 'Fully_Allocated' : 'Needs_Review';

  return { batchId, allocationStatus, dailyAllocations, orderRows, nonRetryableErrors: mappingErrors, attempts, statementChecksum };
}

// =======================================================================
// Persistence —— ADR-004 四层模型的 Daily_Allocation / Non_Order_Income_
// Allocation 两张表，第一次接上真的 Sheet（透过 115_TruthWriter.js，UCR6：
// 不直接 sheet.appendRow()）。Order_Allocation / Monthly_Allocation 不在这
// 次范围内（Steven 明确只列了这两张）。
//
// 这一段只新增，不改上面任何一行——runGeminiOrderExtractionWithFallback_
// 等既有函式回传的 in-memory 形状完全不变，这里只是多一层「把回传结果写
// 进 Sheet」的薄封装，跟 140_VerifiedIncome.js 的 writeVerifiedIncome_ /
// verifyAndPublishIncome_ 同一个套路：*_COLUMNS 常数 + build*Row(s)_ 纯函式
// + write*_ 呼叫 truthWriter.appendValidatedRow + 查询用的 getLatest*_。
//
// 栏位顺序规则（140_VerifiedIncome.js 顶端 2026-08-22 教训、UCR6 的直接
// 延伸）：这两张都是全新表，还没有任何真实资料，下面这个顺序是初版；
// 之后如果要加新栏位，一律加在整个陣列最后面，不要插在中间——不然等表里
// 已经有真实资料之后，旧资料会因为栏位错位被读成别的意思。
// =======================================================================

/**
 * Daily_Allocation：一笔 = 一个 batch 里的一天。batch_id 直接沿用
 * runGeminiOrderExtractionWithFallback_ 已经在算的 CMP-OALB-{verifiedIncomeId}-
 * {timestamp}（Steven 明确要求不要另外发明第二套 batch identity），
 * allocation_status 是整个 batch 的结果（Fully_Allocated/Needs_Review），
 * 重复记在每一天的行上，查询时不用回头 join 一张不存在的 batch 表。
 */
var DAILY_ALLOCATION_COLUMNS = [
  'daily_allocation_id', 'batch_id', 'verified_income_id',
  'date', 'order_row_count', 'net_delivery_income', 'printed_daily_subtotal',
  'checksum_difference', 'checksum_status', 'allocation_status', 'written_at'
];

/**
 * Non_Order_Income_Allocation：一笔 = 一条非订单收入台账记录（Tip /
 * Insentif / Bayaran_Lain_Lain 三选一，category 自己标）。
 *
 * ⚠️ 范围说明（不是这次新增的缺口，是既有、记录在案的缺口——见
 * 901_System_Architecture.js）：matchInsentifLineDate_ / matchBayaranLainLainDate_
 * 只做「日期判定」，不产生完整一行（Insentif/Bayaran-lain-lain 目前没有
 * 类似 parseTipSection_ 那种"逐行解析出 description+amount"的完整实作，
 * Gemini 这边 extract() 目前也只回报统计总额，不是逐行文字）。这里的
 * buildNonOrderIncomeAllocationRow_ 因此不自己去解析原始文字，而是要求
 * 呼叫方已经把 category/description_raw/amount 跟这三个判定函式其中一个
 * 的回传值（dateSource/allocatedDate/referencedSourcePeriod/linkedOrderId）
 * 组成同一个 candidate 物件——持久化层只负责「这个统一形状能不能正确、
 * 完整地写进 Sheet（包括 allocated_date 允许 null）」，不负责组出这个
 * 形状本身。真正逐行组出这个 candidate 的呼叫方，等 Gemini 或其他方式
 * 真的产出非订单收入的逐行资料时才会存在——这不是这次 Persistence 任务
 * 的范围（会碰到 extraction contract，按规则 1 应该 STOP，不是我自己
 * 顺手做掉）。
 *
 * @typedef {{category:string, descriptionRaw:(string|null), amount:number,
 *   dateSource:string, allocatedDate:(string|null),
 *   referencedSourcePeriod:(string|null), linkedOrderId:(string|null)}}
 *   NonOrderIncomeCandidate
 */
var NON_ORDER_INCOME_ALLOCATION_COLUMNS = [
  'non_order_income_id', 'batch_id', 'verified_income_id', 'category',
  'description_raw', 'amount', 'allocated_date', 'date_source',
  'referenced_source_period', 'linked_order_id', 'written_at'
];

/**
 * @param {Object} batchResult runGeminiOrderExtractionWithFallback_() 的回传
 *   （batchId/allocationStatus/dailyAllocations 三个字段会被用到，其余忽略）
 * @param {string} verifiedIncomeId 例如 "CMP-INCOME-2026-W01"
 * @param {Date} [now]
 * @return {Array<Object>} 已经是 DAILY_ALLOCATION_COLUMNS 形状的 row 物件陣列
 */
function buildDailyAllocationRows_(batchResult, verifiedIncomeId, now) {
  if (!batchResult || !Array.isArray(batchResult.dailyAllocations)) {
    throw new Error('buildDailyAllocationRows_: batchResult.dailyAllocations 缺失或不是阵列');
  }
  if (!verifiedIncomeId) {
    throw new Error('buildDailyAllocationRows_: verifiedIncomeId 缺失——Daily_Allocation 必须能追溯回它所属的 Verified_Income');
  }
  const writtenAt = (now instanceof Date ? now : new Date()).toISOString();
  return batchResult.dailyAllocations.map((day) => ({
    daily_allocation_id: `${batchResult.batchId}-${day.date || 'UNDATED'}`,
    batch_id: batchResult.batchId,
    verified_income_id: verifiedIncomeId,
    date: day.date,
    order_row_count: day.order_row_count,
    net_delivery_income: day.net_delivery_income,
    printed_daily_subtotal: day.printed_daily_subtotal,
    checksum_difference: day.checksum_difference,
    checksum_status: day.checksum_status,
    allocation_status: batchResult.allocationStatus,
    written_at: writtenAt
  }));
}

/**
 * 查询用——某个 verified_income_id 目前最新的 batch_id 是哪个，从全部既有
 * 记录里用 batch_id 字串排序（batch_id 带 timestamp，同 130_Reconciliation.js
 * 的 getCurrentReconciliationStatus_ 同一个原理）算出来，不是存在别处等着
 * 被回头更新的欄位（UCR6：TruthWriter 只支援 append）。
 * @param {string} verifiedIncomeId
 * @param {Array<{verified_income_id:string, batch_id:string}>} dailyAllocationRecords 从 Sheet 读回来的既有全部记录
 * @return {string|null}
 */
function getLatestDailyAllocationBatchId_(verifiedIncomeId, dailyAllocationRecords) {
  const forIncome = (dailyAllocationRecords || []).filter((r) => r.verified_income_id === verifiedIncomeId);
  if (forIncome.length === 0) return null;
  return forIncome.reduce((a, b) => (a.batch_id > b.batch_id ? a : b)).batch_id;
}

/** 同上，但直接回传最新那个 batch 的全部行（例如给 Monthly Projection 之类的消费者用）。 */
function getLatestDailyAllocationRows_(verifiedIncomeId, dailyAllocationRecords) {
  const latestBatchId = getLatestDailyAllocationBatchId_(verifiedIncomeId, dailyAllocationRecords);
  if (!latestBatchId) return [];
  return (dailyAllocationRecords || []).filter((r) => r.batch_id === latestBatchId);
}

/**
 * 把一个 batch 的 Daily_Allocation 写进 Sheet（透过 TruthWriter，UCR6）。
 *
 * existingRows 是可选的（不给就是原本的行为：一律写入，旧 batch 天然因为
 * batch_id 不同而不会被覆写——这是 143 Test 28 已经确认过的 idempotency
 * 定义本身）。如果给了 existingRows，会多一层「这个 verified_income_id
 * 现有最新的 batch 是不是已经 Fully_Allocated」的保护：已经是的话就跳过、
 * 不再多写一个 batch，除非 force=true——这一层是这次新加、比既有定义更
 * 严格的一个选择性策略，不是本来就决定好的行为，标在这里方便 Steven
 * 之后决定要不要保留。
 * @param {Object} truthWriter 115_TruthWriter.js 的实例
 * @param {Object} batchResult runGeminiOrderExtractionWithFallback_() 的回传
 * @param {string} verifiedIncomeId
 * @param {Date} [now]
 * @param {Array<Object>} [existingRows] 已存在的 Daily_Allocation 全部记录（选填）
 * @param {boolean} [force] 即使既有最新 batch 已经 Fully_Allocated，仍强制再写一个新 batch
 * @return {{written:Array<Object>, skipped:boolean, reason:(string|undefined), existingBatchId:(string|undefined)}}
 */
function writeDailyAllocationBatch_(truthWriter, batchResult, verifiedIncomeId, now, existingRows, force) {
  if (existingRows && !force) {
    const latestBatchId = getLatestDailyAllocationBatchId_(verifiedIncomeId, existingRows);
    if (latestBatchId) {
      const latestRows = existingRows.filter((r) => r.batch_id === latestBatchId);
      const latestStatus = latestRows.length > 0 ? latestRows[0].allocation_status : null;
      if (latestStatus === 'Fully_Allocated') {
        return { written: [], skipped: true, reason: 'Already_Fully_Allocated', existingBatchId: latestBatchId };
      }
    }
  }
  const rows = buildDailyAllocationRows_(batchResult, verifiedIncomeId, now);
  rows.forEach((row) => truthWriter.appendValidatedRow('Daily_Allocation', row, DAILY_ALLOCATION_COLUMNS));
  return { written: rows, skipped: false };
}

/**
 * @param {NonOrderIncomeCandidate} candidate
 * @param {string} batchId
 * @param {string} verifiedIncomeId
 * @param {Date} now
 * @param {number} sequenceIndex 同一个 batch 里的第几笔非订单收入（0 起算），
 *   用来组出稳定、不重复的 non_order_income_id——这类记录没有像订单号那种
 *   天然唯一的业务 ID 可以借用。
 * @return {Object} NON_ORDER_INCOME_ALLOCATION_COLUMNS 形状的 row 物件
 */
function buildNonOrderIncomeAllocationRow_(candidate, batchId, verifiedIncomeId, now, sequenceIndex) {
  if (!candidate || !candidate.category) {
    throw new Error('buildNonOrderIncomeAllocationRow_: candidate.category 缺失（必须是 Tip/Insentif/Bayaran_Lain_Lain 之一）');
  }
  if (typeof candidate.amount !== 'number' || isNaN(candidate.amount)) {
    throw new Error(`buildNonOrderIncomeAllocationRow_: candidate.amount 缺失或不是数字（category=${candidate.category}）`);
  }
  if (!candidate.dateSource) {
    throw new Error(`buildNonOrderIncomeAllocationRow_: candidate.dateSource 缺失——就算判定不出日期也要显式给 'Not_Determinable'，不能整个欄位不见（CMP-P10）`);
  }
  const writtenAt = (now instanceof Date ? now : new Date()).toISOString();
  return {
    non_order_income_id: `${batchId}-NOI-${sequenceIndex}`,
    batch_id: batchId,
    verified_income_id: verifiedIncomeId,
    category: candidate.category,
    description_raw: candidate.descriptionRaw === undefined ? null : candidate.descriptionRaw,
    amount: round2_(candidate.amount),
    // CMP-P10 + Steven 明确要求：allocated_date 允许 null（日期判定不出来
    // 是真实、要保留的状态，不能因为要写进 Sheet 就编一个日期）——
    // TruthWriter.appendValidatedRow 本来就把显式 null 转成空字符串写入，
    // 只有 undefined 才会被当成漏填而抛错，这里确保永远传 null 不传 undefined。
    allocated_date: candidate.allocatedDate === undefined ? null : candidate.allocatedDate,
    date_source: candidate.dateSource,
    referenced_source_period: candidate.referencedSourcePeriod === undefined ? null : candidate.referencedSourcePeriod,
    linked_order_id: candidate.linkedOrderId === undefined ? null : candidate.linkedOrderId,
    written_at: writtenAt
  };
}

/**
 * 把同一个 batch 的一批非订单收入候选写进 Sheet（透过 TruthWriter，UCR6）。
 * @param {Object} truthWriter
 * @param {Array<NonOrderIncomeCandidate>} candidates
 * @param {string} batchId 建议跟同一次处理的 Daily_Allocation batch 用同一个
 *   batch_id（呼叫方决定，这里不強制、不自己生成第二套）
 * @param {string} verifiedIncomeId
 * @param {Date} [now]
 * @return {Array<Object>} 实际写入的 row 物件陣列
 */
function writeNonOrderIncomeAllocationBatch_(truthWriter, candidates, batchId, verifiedIncomeId, now) {
  const rows = (candidates || []).map((c, i) => buildNonOrderIncomeAllocationRow_(c, batchId, verifiedIncomeId, now, i));
  rows.forEach((row) => truthWriter.appendValidatedRow('Non_Order_Income_Allocation', row, NON_ORDER_INCOME_ALLOCATION_COLUMNS));
  return rows;
}

if (typeof module !== 'undefined') {
  module.exports = {
    CHECKSUM_TOLERANCE_,
    WEEKDAY_NAMES_,
    ENGLISH_WEEKDAY_NAMES_,
    MONTH_NAME_TO_NUMBER_,
    isoDateFromYmd_,
    isValidYmd_,
    enumerateYearMonthsInPeriod_,
    weekdayNumberFromAnyName_,
    resolveDateFromDayMonth_,
    resolveOrderDate_,
    splitIntoDayBlocks_,
    extractOrderIds_,
    parseOrderRowCandidate_,
    parseDayBlock_,
    computeDailyChecksum_,
    computeStatementChecksum_,
    parseTipSection_,
    matchInsentifLineDate_,
    matchExplicitPeriodReference_,
    matchBayaranLainLainDate_,
    orderDateToYearMonth_,
    candidateFromGeminiOrderRow_,
    mergeChunkedExtractionResults_,
    runGeminiOrderExtractionWithFallback_,
    DAILY_ALLOCATION_COLUMNS,
    NON_ORDER_INCOME_ALLOCATION_COLUMNS,
    buildDailyAllocationRows_,
    getLatestDailyAllocationBatchId_,
    getLatestDailyAllocationRows_,
    writeDailyAllocationBatch_,
    buildNonOrderIncomeAllocationRow_,
    writeNonOrderIncomeAllocationBatch_
  };
}
