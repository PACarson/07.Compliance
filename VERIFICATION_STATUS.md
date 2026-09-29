# Compliance OS — Verification Status

**核心原则**：`Node PASS` 不等于 `Real GAS PASS`；`Real GAS function PASS` 不等于 `Production workflow PASS`。下表逐项标注实际达到的最高层级，不外推。

## 验证层级定义

1. **Static inspection** — 读代码、逻辑审查，没有实际执行
2. **Node tests** — Node.js 模拟环境跑测试（PropertiesService/SpreadsheetApp 等 GAS 全域用假实作模拟）
3. **Mock tests** — 用假的外部依赖（假 extractor、假 Sheet accessor）测编排逻辑本身
4. **Real GAS execution** — 在真实 Google Apps Script 项目里实际执行过
5. **Real Google Sheets persistence** — 真实写入/读回真实 Google Sheet 确认过
6. **Real Gemini API execution** — 真实呼叫过 Gemini API（不是假的 extractor）
7. **Independent source verification** — 对照原始文件本身（不是对照系统自己的输出）独立核对
8. **Production integration verification** — 完整端到端流程在真实环境跑过，不是分段验证

---

## Document Import（110/112/117/120/121/125/140）

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Node tests | 111/113/118/122/126/141 全套 | 持续 | PASS | — |
| Real GAS execution | Steven 真实执行 `consoleBatchImport` | 2026-08-21 | PASS（跑到抽取边界） | 未覆盖后续所有分支组合 |
| Real Gemini API execution | Steven 真实环境确认 LLM 抽取+人工输入均正确 | 2026-08-21 | PASS | 仅 statement 层级 `extract()`，非订单层级 |

## Gemini Order-Level Extraction（127 extractOrders / 142，ADR-005）

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Real Gemini API execution（same-file repeatability）| 10 次独立真实呼叫，锁定同一 `drive_file_id` | 2026-09-10 | PASS | 仅限该锁定 fixture |
| Independent source verification | 对照原始 `2026-W01.pdf`（非 Gemini 输出）| 2026-09-14 | PASS | 仅限该 fixture 的 period/checksum/8PRUR5AGXAQRAV/2 笔分歧 ID；未覆盖 Insentif/Tip/Bayaran lain-lain |
| Production integration verification | Steven 真实执行 `consoleRunDailyAllocation_`，真实 `extractOrders()`（非假 extractor） | 2026-09-25 | **PASS**（针对 `CMP-INCOME-2026-W01` 这一笔真实记录） | 173/173 笔真实订单全部映射成功、0 错误、7/7 天 checksum Matched、整周精算 1297.60 与官方总额一致，Dec/Jan 拆分精确到分。仅确认这一笔真实记录；不代表 Gemini 对任何未来 PDF 都会正确抽取（ADR-005 既有限定不变）。完整链路见下方 Daily Allocation Production Wiring 一节 |

## Daily Allocation Persistence（142 的 Daily_Allocation/Non_Order_Income_Allocation 表）

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Real Google Sheets persistence | `999_PersistenceVerification.js`，Steven 真实执行 | 2026-09-06 | PASS（write/read-back、null 栏位契约、latest-batch 查询、Fully_Allocated guard） | 只验证持久化层本身，当时还没有真实生产呼叫方 |

## Daily Allocation Production Wiring（170 consoleRunDailyAllocation_ + 160 消费逻辑，2026-09-15）

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Node tests（160，7 项情境 + YTD 去重）| `161_Tests_MonthlyProjection.js` | 2026-09-15 | PASS | — |
| Node tests（170，6 项情境）| `171_Tests_OperatorConsole.js` | 2026-09-15 | PASS | 用假 orderExtractor，非真实 Gemini |
| **Real GAS execution（160）** | Steven 真实执行 `161_Tests_MonthlyProjection` | 2026-09-15 | **PASS** | 这是本次 wiring 第一个跨过 Node 测试、真正在真实 GAS 确认的部分 |
| **Real GAS execution（170）** | Steven 真实执行 `171_Tests_OperatorConsole` | 2026-09-15（两轮）第三轮确认 | **第一轮 FAIL**（`require is not defined`，`typeof require` 守卫缺失，pre-existing bug，2 处）→ 修复后 **第二轮 FAIL**（`consoleGetLastFolderId` 断言假设"两版本都回 null"，在有真实 Script Property 值时不成立，测试设计缺陷非生产代码缺陷）→ 修复后 **第三轮 PASS**，含全部 `consoleRunDailyAllocation_` 情境（找不到/幂等重跑/Full记录跳过/fallback吸收的失败/真的逃逸的例外） | 本文件建立时曾因 Governance 冻结而标注"尚未取得"——第三轮 PASS 实际发生于 2026-09-15 当天，只是延后到本次治理更新才补写入 |
| Production integration verification（consoleRunDailyAllocation_ 呼叫真实 Gemini extractOrders）| Steven 真实执行 | 2026-09-25 | **PASS**（针对 `CMP-INCOME-2026-W01`）| 见上方 Gemini Order-Level Extraction 一节同一笔证据；另见下方 2026-09-24/25 两笔 Date 物件缺陷记录 |

**明确禁止的推论**：不得因为这一笔记录跑通就推论"整个 Daily Allocation wiring 对任何 statement 都已经 production ready"——目前只确认过 `CMP-INCOME-2026-W01` 这一笔真实记录的完整链路；chunk fallback 的合并逻辑（切页后 Gemini 结果能否正确合并）仍然从未被真实数据触发过，Console UI 的 partially_allocated/unallocated_non_order_income 尚无任何前端呈现（见下方新增一节）。**2026-09-29 新增证据进一步支持这个禁止推论，而不是削弱它**：见下方"Gemini API Defects & Operational Blockers"一节——2026-09-25 之后同一笔记录的重复真实呼叫，4/4 次全部落回 `Needs_Review`，原因跟 accuracy 无关（quota 用完），但结果是「跑通一次」不等于「这条链路现在能重复跑通」。

## Gemini API Defects & Operational Blockers（2026-09-27～29，真实 GAS 触发）

`127_LLMExtractor.js`／`142_DailyOrderAllocation.js` 这一段，2026-09-25 成功之后，2026-09-27 起陆续在真实环境发现两类新问题——一类是真的代码缺陷（已修复），一类不是缺陷、是这个专案目前所在的 Gemini 计费层级限制（未修复，需要 Steven 决定要不要处理）：

| # | 类别 | 内容 | 发现方式 | 状态 |
|---|---|---|---|---|
| 1 | 代码缺陷（已修复） | `127` 的 `BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_.days.items.properties.printed_daily_subtotal` 用了 `type: ['number', 'null']`——Gemini 的 `Schema.type` 是单一 non-repeating enum 欄位，这个写法会在请求送达模型推理**之前**就被 API 以 HTTP 400 拒绝，不管配置哪一个 `gemini-*-flash` 模型、额度够不够都一样，每次呼叫都失败，2.74 秒立刻结束——不是模型或额度问题 | 真实 GAS 执行（`manualTest_RealDailyAllocation`，2.74s 就回 `Needs_Review`） | 已修复：改为 `type: 'number', nullable: true`（语意不变，`125_ExtractionValidation.js` 早就用 `!== null` 处理这个欄位，不用跟着改）。Node 新增 schema lint 测试（`128`，mutation-checked：把 `type` 改回阵列会立刻失败），**2026-09-29 真实 GAS 确认此错误不再出现**（当天 4 次真实呼叫全部进入正常的 Gemini 推理耗时，不再是 2.74 秒的即时失败） |
| 2 | 运维限制（未修复，非代码缺陷） | Gemini 免费额度 `generate_content_free_tier_requests, limit: 20`——2026-09-27 曾假设换成较新的 `gemini-3.8-flash`「彻底摆脱限流」，**2026-09-29 真实证据推翻这个假设**：同一天的 429 错误文字明确写着 `model: gemini-3.8-flash`，额度上限一样是 20，说明免费层的这个限制是跟着专案/API key 走，不是特定某个旧模型的问题，换模型不解决额度问题 | 真实 GAS 执行：2026-09-29 同一个早上 4 次真实 `consoleRunDailyAllocation`（10:18/7:28/7:20/7:10，非假 extractor），其中至少 3 次 `full_document`/两个 chunk 全部撞 429（RESOURCE_EXHAUSTED）或 503（UNAVAILABLE），最终 4/4 全部落回 `Needs_Review`，`rowsWritten: 0` | **未修复，待 Steven 决定**：(a) 是否开通 Gemini 计费拿掉 20 次的免费层上限；(b) 或接受目前额度、把测试/重试频率压低。已实作的缓解（不解决额度本身，只避免浪费）：`full_document` 因 429 用完额度而失败时，142 不再接着打 2 次注定失败的 chunk（同一个 quota，重试没有意义）——见下方"额度用尽时跳过 chunk fallback"。**明确不是** accuracy 问题，ADR-005 的 Gate 2 CLOSED（accuracy）判定不受影响，这是一个独立的 availability/quota 问题，详见 ADR-005 新增的 2026-09-29 段落 |
| 3 | 加固（连带修正） | `127` 的 `createRetryingPostJson_`：429 时读 Gemini 建议的等待秒数、累计上限 60 秒——**2026-09-29 真实执行发现这个加固本身有个讯息可读性缺陷**：累计上限触发时把中文说明直接接在被截断到 500 字元的原始 JSON 错误文字后面，读起来像是接在 JSON 结构中间的乱码（例如 `"status": "RESOURCE_EXHAUSTED",\n    "（已累计等待 9 秒...）"`），不影响判断逻辑本身，只影响人看 Cloud logs 的可读性 | 真实 GAS Cloud logs（2026-09-29 执行记录） | 已修复：中文说明改成放在最前面、自成一句，原始错误文字（含截断的 JSON）放在冒号之后，两者不再直接黏在一起 |

**Additive skip 行为新增测试**：`143` 新增测试情境（`full_document` 因 `err.isQuotaExhausted` 为真而失败时，两个 chunk 完全不会被呼叫；只有其中一个 chunk 遇到同样情况时，剩下的 chunk 也会被跳过），`128` 新增测试确认 `createRetryingPostJson_` 只在最终真的因 429 放弃时才设定 `isQuotaExhausted`（503/400 不会设定）。

## GAS Compatibility Bugs Found During Real Verification（2026-09-15）

| 位置 | 性质 | 发现方式 | 状态 |
|---|---|---|---|
| `171_Tests_OperatorConsole.js`（原始行号 87） | 未受保护的 `require()`，GAS 无此全域 | 真实 GAS 执行崩溃 | 已修复（补 `typeof require` 守卫），Node 重跑 PASS，真实 GAS 待确认 |
| `111_Tests_DocumentImport.js:231` | 同类缺陷（全仓库扫描主动发现，非真实执行触发） | Static inspection | 已修复，Node PASS，**真实 GAS 未执行过（PENDING）** |
| `143_Tests_DailyOrderAllocation.js:252` | 同类缺陷（同上） | Static inspection | 已修复，Node PASS（101/106，5 项 pre-existing 失败不变），**真实 GAS 未执行过（PENDING）** |
| `171_Tests_OperatorConsole.js`（`consoleGetLastFolderId` 断言） | 测试设计缺陷，非 GAS 相容性问题 | 真实 GAS 执行产生非预期但正确的结果 | 已修复，Node PASS，真实 GAS 待确认 |

## Date-Object-from-Sheets 缺陷群（2026-09-24/25，真实 GAS 触发）

Sheets 把日期格式储存格读回来时会变成原生 JS `Date` 物件而非写入时的 ISO 字符串——这个失效模式在 2026-08-22 已经出现过一次（`computeMonthlyAllocation_` 当时修过），这次是同一个根因在另外两个消费点重新出现，均已修复：

| 位置 | 触发方式 | 修复 | 状态 |
|---|---|---|---|
| `142_DailyOrderAllocation.js`（`runGeminiOrderExtractionWithFallback_` 的 chunk fallback 分支） | Static inspection 主动发现（`document.totalPages` 从未被任何 production caller 填过），非真实执行触发 | 加上 `Number.isInteger`/`>=1` 显式 guard，非法值直接落既有 Needs_Review 路径（`chunk_fallback_skipped`），不再算出 `NaN` page range | 已修复，Node PASS（新增 4 项测试），**2026-09-24 真实 GAS 执行确认**（`chunk_fallback_skipped` 正确出现，不再有 `chunk_*-NaN`） |
| `170_OperatorConsole.js`（`isoDateStringToParts_`，消费 `Verified_Income.period_start/period_end`） | 真实 GAS 执行报错（173 笔订单全部被拒收，`net_delivery_income` 全部归零） | 改为同时支援原生 `Date` 物件与 ISO 字符串 | Steven 本人独立诊断+修复+验证，**2026-09-25 真实 GAS 确认**（重放证据后 173/173 笔映射成功、7/7 天 Matched）。Claude 已将此修复同步进 sandbox 副本 |
| `160_MonthlyProjection.js`（`yearMonthFromIsoDate_`，消费 `Daily_Allocation.date`） | 真实 GAS 执行报错（`不是合法的 ISO 日期字符串`） | 直接在函式内部呼叫既有的 `normalizeIsoDateString_`（106_Utils.js），而非只补消费端那一个呼叫点——同时保护另外两个既有安全呼叫点跟一个目前未接生产的第四个呼叫点（`142` 的 `orderDateToYearMonth_`，供尚未接线的 Insentif/Tip 日期比对用） | 已修复，Node PASS（新增 Test 8），**2026-09-25 真实 GAS 确认**（`consoleGetDashboard()` 正确输出完整 monthlySummaries） |
| `170_OperatorConsole.js`（`consoleGetDashboard`/`consoleGetIncomeDetail_`，经 `google.script.run` 回传给前端） | 真实 GAS 执行：Console 白屏卡在"载入中"，前端 `Cannot read properties of null (reading 'monthlySummaries')` | 同一根因第四次出现，这次是透过 `google.script.run`（Apps Script 官方文件明写：Date，包含嵌在物件/阵列里的，传参/回传都会让请求失败），不是字符串解析函式。新增 `sanitizeForClient_`（Date→本地 `YYYY-MM-DD`／带时间的 Date→ISO 字符串／`NaN`/`Infinity`→`null`），套用在 `consoleRebuildProjections_`（`consoleGetDashboard`/`consoleBatchImport_`/`consoleRetryFile_`/`consoleManualImport_` 共用）与 `consoleGetIncomeDetail_` 两个出口 | 已修复，Node PASS（171 新增 Date 型 fixture 测试，`TZ=UTC` 与 `TZ=Asia/Kuala_Lumpur` 均跑过），**真实 GAS 未重新执行过（PENDING）**——**2026-09-27 对这次白屏根因的第一次诊断是错的（见下方更正说明），这里记录的是 2026-09-28 更正后的版本** |

**2026-09-27 诊断更正（写在这里，不掩盖过程）**：当时的除错记录把根因归给 `compliance_projection.epf.amount`/`tax.amount` 恒为 `null`，并用"回传 JSON 字符串"当作修复——这个修复本身在真实 GAS 确实解决了白屏（`consoleGetDashboard` 至今维持回传字符串），但对**为什么**有效的判断是错的：null 是 `google.script.run` 合法值，不会导致请求失败；当时用来"排除 Date"的检查（`JSON.stringify` 后找字符串 `"GMT"`）本身就抓不到 Date——`JSON.stringify` 把 Date 写成 UTC ISO 字符串（`"...Z"`），从不产生 `"GMT"` 子字符串，那次检查的"不含 Date"结论无效。2026-09-28 在 Node 用真实 GAS 形状的 Date 型 fixture 重现：`needs_allocation`/`partially_allocated` 原样带出 `Verified_Income.period_start/period_end`，真实 GAS 读回来是原生 Date，这才是更可能的真根因，且与上表其余三笔属于同一个根因家族。"回传 JSON 字符串"当时能解决白屏，副作用是 `JSON.stringify` 顺手把 Date 转掉了——但转成 UTC，`Asia/Kuala_Lumpur`（GMT+8）的 `2025-12-29` 会变成 `"2025-12-28T16:00:00.000Z"`，前端只取前 10 码会显示成前一天，这个显示层的分歧未经真实 GAS 证实、只在 Node 重现，已一并修掉。

**尚未查明**：为什么 `108_SheetSetup.js` 已经把 `period_start`/`period_end`/`date` 等栏位强制成 textColumns，Sheets 读回来时仍然是原生 Date 物件——这次只在每个消费点做防御性修复，没有回头查 108 这层强制格式为什么没生效，留待下次需要时处理。

## Phase-B Historical Baseline Cleanup（2026-09-24，Steven 授权执行）

`999_PhaseB_Baseline_v2.js`/`_v3.js`（历史一次性除错脚本，跟 `_v4.js` 共用 `PHASE_B_W01_FILE_ID`/`runPhaseB_Gate1Only`/`Gate2Only` 等同名 top-level 宣告，会让 `195_Tests_GasLoadSimulation.js` 的 GAS 载入模拟失败）经 Steven 明确授权，已从 repository 移除；`999_PhaseB_Baseline.js`（v1）与 `_v4.js`（Gate 2 最终自洽版本）保留不动，SHA-256 核对与移除前完全一致。移除后 195 的 2 项既有失败清除（195 现况：2 PASS / 0 FAIL）。

**明确限定**：此次确认的是 repository/source 层级——`.clasp.json`/`.claspignore` 显示这两个档案本来就没有被排除在 `clasp push` 之外，移除后未来的 push 不会再引入这个 collision。**Steven 实际真实 GAS 项目里这两个档案是否也已经同步删除，未经确认**——这是 Claude 无法从这个开发环境验证的事（没有到 script.google.com 的网络路径、没有 OAuth）。

## Console UI — 已知未实作的呈现缺口（2026-09-15 发现，持续未处理）

`170_OperatorConsole.html` 完全没有任何代码呈现 `partially_allocated` 或 `unallocated_non_order_income`（grep 全文件确认两个字串出现次数均为零）。已确认会正确显示的：Net Income 卡片（直接绑 `summary.net`）、`needs_allocation` 清空后 ⚠️ 警告消失。已确认不会显示的：哪一笔跨月 statement 贡献了这笔已分配收入的明细、目前真实存在且金额不小的 `unallocated_non_order_income`（2026-09-25 真实资料显示为 RM635.20）在页面上完全没有任何呈现痕迹。**Status: 已知缺口，未授权修复，非本次治理更新新增的问题**——2026-09-24/25 这一系列真实验证工作全程没有涉及这部分前端呈现。

## Compliance Calendar / Reminder OS 串接

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Node tests（引擎本身）| 151 | 持续 | PASS | — |
| Real GAS execution | — | — | **NOT DONE** | `Compliance_Calendar` 表目前没有任何真实义务记录；`EventPublisher` 是占位实作，从未真实推送过通知 |

## Historical 9-file-id Provenance（ADR-005 附属，独立未解决项）

confirmed：这批已验证呼叫用同一个 hardcode 的 fixture ID、harness 本身无 runtime override 路径。not confirmed：历史成因、哪个 session、production 是否有对应风险。不因为 ADR-005 CLOSED 而视为已排除。
