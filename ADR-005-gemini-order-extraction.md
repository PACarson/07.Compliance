# ADR-005: Butiran Tempahan（订单层级）抽取改用 Gemini Extraction Adapter + 确定性验证

- **Status**: **CLOSED**（Gate 2 完整验证链完成，2026-09-15；见下方"含义"说明，`CLOSED` 不等于 `VERIFIED` 或 `IMPLEMENTED` 覆盖全部范围——本 ADR 只对锁定的 W01 fixture 做过完整验证）。**2026-09-29 新增一个独立于此状态的 open item**：Gemini 免费额度是目前的 availability 瓶颈，不影响这里的 accuracy CLOSED 判定——见下方同日期段落。**2026-10-01**：第二份真实 statement（W05）的 accuracy 证据（非完整管线）+ 503 自动切模型修复，同样不影响、不重开 Gate 2——见下方同日期段落。**2026-10-07**：真实 GAS 日志命中 fail-closed 的未知 platform gate（`4-Hour Delivery`），以带证据的别名表修复，同样不影响、不重开 Gate 2——见下方同日期段落
- **Historical date**: 2026-08-25（方向决定），Gate 2 验证链 2026-09-06～2026-09-15
- **Recovery evidence**: `compliance-os-governance-draft.md` §2.8、§8（原始决策）；`900_Constitution.js` ADR-005 条目全文（changelog 多笔，2026-08-21/25、2026-09-06/09/10/15）；`Gate2_ReClose_Evidence_Proposal_2026-09-10.md`；`Gate2_Independent_Source_Verification_v2_2026-09-14.md`

## Context

订单层级（Butiran Tempahan）的抽取，Phase 2 一度倾向纯确定性文字解析（regex/token-matching）。但 GAS 唯一原生的 PDF 转文字方式（Drive OCR）会把订单记录扫描顺序打乱（一笔订单的 ID 位移到下一笔记录开头，没有一致规则可以逆转），而 LLM（Gemini）直接吃原始 PDF 可以正确理解结构。

## Decision

订单层级抽取改用 Gemini（`127_LLMExtractor.js` 的 `extractOrders()`），产生的候选值经过 `142_DailyOrderAllocation.js`/`125_ExtractionValidation.js` 的确定性验证（schema/arithmetic/checksum）才能成为 Verified 数据——**LLM 是 Extraction Engine，不是 Truth Engine**（CMP-P14）。

## Rationale

POC 证实确定性解析逻辑本身没问题（干净文字下 98.5% 精确匹配），瓶颈是 GAS 拿不到干净文字；Gemini 直接读 PDF 绕过这个瓶颈。

## Gate 2 — Accuracy Verification History（完整时间序，不省略任何一个转折）

| 日期 | 事件 |
|---|---|
| 2026-09-04 | Gate 2 首次真实通过（`999_PhaseB_Baseline_v4.js`，173/173，143.3s） |
| 2026-09-06 | 13 次独立真实抽取，只有 3/13（~23%）正确识别真实周期——**Gate 2 REOPENED / BLOCKED**。同日修复 `resolveDateFromDayMonth_` 一个真实的日期边界验证漏洞 |
| 2026-09-09 | 15 份 evidence JSON 的 forensic 分析发现 9 个不同 `drive_file_id`（本应固定）——同一 file_id 重复出现时结果 100% 一致，提示问题可能出在"读到哪个档案"而非 Gemini 本身。标记 PENDING，未证实 |
| 2026-09-10 | 锁定单一确认正确的 `drive_file_id`（`1fUrux2zoQgvKe0DvsPrR5Xma9pxa57yA`），10 次独立真实呼叫，逐笔核对（period/70 项 daily checksum/`8PRUR5AGXAQRAV`/35 笔 Sekaligus）全部一致。唯一残留：2 笔订单 ID 字符级分歧 |
| 2026-09-14 | 针对原始 PDF（`2026-W01.pdf`，非 Gemini 输出本身）做独立 source-grounded 核对：statement period、7 个 daily subtotal、weekly 总额、`8PRUR5AGXAQRAV`、2 笔分歧 ID 全部对上（分歧 ID 的真值直接读自 PDF 印刷字符，不是套用多数决） |
| 2026-09-15 | **Gate 2 CLOSED**——`900_Constitution.js` 正式记录 |

## "CLOSED" 的确切含义（避免过度解读）

已确认（PASS）：对**锁定的 W01 fixture**，file 引用固定的前提下，重复真实呼叫能可靠得出正确的 statement period、7 个 daily checksum、weekly 总额、已知订单案例（`8PRUR5AGXAQRAV`）、Sekaligus 捆绑正确性。

**明确不代表**：Gemini 全面准确、Gemini 不会 hallucinate、未来任何 PDF 都会正确抽取、production 的 file-identity 风险已完全排除。

## Unresolved（独立于 CLOSED 状态，不算 Gate 2 failure）

历史上为什么会出现 9 个不同 `drive_file_id`——**confirmed**：这批已验证呼叫用同一个 hardcode 的 fixture ID、且 harness 本身没有 runtime override 路径；**not confirmed**：历史上那 9 个值具体怎么产生、哪个 session、production 的 document-import 路径是否有对应风险。不定性为人为失误或 test harness 操作痕迹（未经独立证实）。

## Non-Order Income — 明确排除范围

Insentif/Tip/Bayaran lain-lain 目前没有逐笔可靠日期抽取能力——这是 ADR-005 抽取范围本身就没有涵盖的部分（Gemini 的 statement 层级 `extract()` 只回报这三类的周总额），不是 Gate 2 的失败项，也不在 2026-09-15 Production Wiring Slice 的范围内（见 ADR-004）。

## 2026-09-29 新增（独立于 CLOSED 状态，不是 accuracy 问题，不重开 Gate 2）——Free-tier quota 是一个未解决的 availability 限制

**跟上面的 CLOSED 判定完全无关**：Gate 2 关的是"Gemini 抽出来的答案准不准"，这里发现的是"Gemini 到底愿不愿意接这次呼叫"——两个是不同的轴，这次发现不影响、也不重开 accuracy 的 CLOSED 状态。

2026-09-25 那次真实端到端成功（173/173）之后，2026-09-29 同一个早上再跑了 4 次真实 `consoleRunDailyAllocation`（同一笔 `CMP-INCOME-2026-W01`），4 次全部因为 Gemini 免费额度用完（`generate_content_free_tier_requests, limit: 20`，HTTP 429 RESOURCE_EXHAUSTED）或伴随的 503 而落回 `Needs_Review`，`rowsWritten: 0`——完整证据见 `VERIFICATION_STATUS.md` 新增的"Gemini API Defects & Operational Blockers"一节。

**2026-09-27 曾经有个未经查证的假设**：把 `LLM_EXTRACTOR_MODEL` 从 `gemini-3.5-flash` 换成较新的 `gemini-3.8-flash` 可以「彻底摆脱限流与拥堵」。**2026-09-29 的真实证据推翻了这个假设**：429 错误文字明确写着 `model: gemini-3.8-flash`、`limit: 20`——免费层的这个 20 次上限看起来是跟着专案/API key 走的计费层级限制，不是某个特定旧模型才有的问题，换模型不解决这个问题。

**这不是本 ADR 决定要解决的范围**——是否要开通 Gemini 计费拿掉这个上限，是 Steven 的商业/预算决定，不是架构决定，不在这份 ADR 授权范围内。已经做的、单纯避免浪费而不解决额度本身的缓解：`142_DailyOrderAllocation.js` 的 `runGeminiOrderExtractionWithFallback_` 现在会在 `full_document` 因为额度用完而失败时，直接跳过 chunk fallback（同一个已经用完的 quota，切页重打不会有不同结果，只会多浪费 2 次本来就稀缺的当日额度）——这是效率修正，不是新的 accuracy 判准，不影响上面 Gate 2 的 CLOSED 状态或验证范围。

**Open（留给 Steven）**：要不要开通计费；如果不开通，日常操作上大概要怎么控制呼叫频率才不会一天之内就把 20 次用完（目前没有任何用量追踪或节流机制）。

## 2026-10-01 新增——第二份真实 statement 验证通过（额外 accuracy 证据）+ 503 自动切模型 + 一个查证发现（2.5 系列现在不该再用）

**额外证据，不改变 Gate 2 的锁定范围**：2026-01-26～02-01 那份真实 Grab 周结单（Steven 称 2026-W05，`Jumlah Mingguan RM1,833.80`，逐笔订单加总 `Pendapatan bersih penghantaran RM1,233.50`）经真实 Gemini 抽取，7 天全数精确匹配官方印出的逐日小计（Ahad 207.30／Sabtu 219.60／Jumaat 206.80／Khamis 151.40／Rabu 129.00／Selasa 154.00／Isnin 165.40，加总 1,233.50）——这是继 W01 之后第二份独立真实 statement 通过逐日 checksum 比对。**范围限定**：这次是外部一次性诊断脚本直接调用 Gemini 原始抽取 + 手动逐日比对，不是走 `consoleRunDailyAllocation_`/`142` 的完整管线（没有经过 125 的候选验证、142 的 checksum 判定、`Daily_Allocation` 写入）——是"Gemini 原始抽取对第二份真实资料也准"的证据，不是"完整管线也对这份资料跑通"的证据，两者不要混为一谈。

**发现的问题（跟这份新 statement 本身的内容无关，是同一个 503/额度问题的第三次真实出现）**：跟 09-27（gemini-3.7-flash）、09-29（gemini-3.8-flash）一样，这次首选模型一样先撞 HTTP 503（高峰期无算力），换一个模型立刻就通——三次都要靠 Steven 另外请一次外部除错助手手写一次性诊断脚本才做到，production 代码本身没有这个能力。**已修复**：`127_LLMExtractor.js` 的 `createLLMExtractor_` 新增内建的 503 自动切模型（`postJsonWithModelFallback_`）——主模型撞 503 用完重试仍未恢复时，自动换 `LLM_EXTRACTOR_FALLBACK_MODEL`（Script Property，没设定就用默认值）重打一次，呼叫方（142/170）完全不用知道切换过模型；只在 503（`isCapacityIssue`）触发，429（额度用尽）维持现有的"跳过 fallback、不浪费额度"处理不变——换模型对 429 有没有用尚未证实，不在这次假设有用。

**一个连带查证发现，值得记录**：这几次除错记录里，外部除错助手反复建议 `gemini-2.5-flash` 是"稳定不挤兑"的选项。2026-10-01 查证 Google 官方 deprecations 页面：2.5 系列（含 `gemini-2.5-flash`）目前**限制成只有以前真的呼叫过的专案才能继续用**，官方原文明确写"新专案请改用 3.5 Flash-Lite 或 3.8 Flash"——这个专案从未真的呼叫过 2.5-flash，选它当 fallback 默认值很可能直接连不上（跟 09-27 把模型写死进代码、事后才发现有问题是同一类教训：外部建议的模型名字，没有查证是不是现在还真的能用就采用）。默认 fallback 模型定为 `gemini-3.5-flash`（官方页面未列出任何下线日期，且 09-30 这次真实成功正是用它）。

## 2026-10-02 新增——模型链从两层扩成三层（Steven 明确要求）+ consoleBatchImport 真实被 GAS 平台硬杀，拆成两种重试预算

**(a) 三层模型链，取代上面 2026-10-01 段落描述的两层版本**：Steven 明确要求"如果 `LLM_EXTRACTOR_MODEL`/`LLM_EXTRACTOR_FALLBACK_MODEL` 都失败了，还要有第三个可以用，没设定就默认用 `gemini-3.5-flash`"。`postJsonWithModelFallback_` 的签名从 `(primaryModel, fallbackModel, ...)` 改成 `(models[], ...)`，依序尝试、只在 `isCapacityIssue`（503）才换下一个；新增 `allModelsCapacityExhausted` 旗标（全部候选模型都因为 503 失败才是 true，中途撞到非 503 的例外——例如 429——会立刻停止，这个旗标维持 false）。`resolveLLMExtractorConfig_` 新增 `LLM_EXTRACTOR_FALLBACK_MODEL_2`（Script Property）/`fallbackModel2`/`modelChain`（去重后的完整尝试顺序）。默认值链：`gemini-3.8-flash` → `gemini-3.6-flash`（原本两层版本的 fallback 默认值是 `gemini-3.5-flash`，现在让给第三层，第二层改用 `gemini-3.6-flash`——2026-07-21 发布、官方页面同样没有列出下线日期）→ `gemini-3.5-flash`。Node 新增约 15 项测试覆盖三层链的各种分支（mutation-checked）。

**(b) 真实 GAS 事故**：2026-10-01 20:25:11～20:31:11（真实 Executions 记录），`consoleBatchImport` 被 GAS 平台硬杀——"Exceeded maximum execution time"，耗时 360.418 秒，正好卡在 6 分钟上限。这不是 catchable 的例外，`consoleImportOneDriveFile_` 的 try/catch 完全接不住，连一个干净的失败结果都救不回来，是这次新增三层模型链之后才会显著放大的风险：`consoleBatchImport_`/`consoleRetryFile_`/`consoleManualImport_`（经 `112` 的 `lazyLLMExtractor_`）在同一次 GAS 执行里要处理多份文件、6 分钟要分给全部文件，但沿用的是跟 `consoleRunDailyAllocation_`（一次只处理一笔、整个 6 分钟都是它的）一样有耐心的重试+换模型预算——模型链从两层扩成三层只会让这个风险更大，不是更小。

**已修复**：`realLLMExtractor_(profile)` 新增 `profile` 参数——`'single'`（默认，170 的 `lazyOrderExtractor_` 用）保留完整三层链 + 原本的耐心预算（`SINGLE_RETRY_BUDGET_`：单次最长 55 秒／累计最长 60 秒）；`'batch'`（112 的 `lazyLLMExtractor_` 明确传入）收窄成只用主模型（不换模型）+ 收紧的 `BATCH_RETRY_BUDGET_`（单次 8 秒／累计 10 秒）——高峰期没算力就让这一份文件快速、干净地失败，下一份文件才有机会在剩下的时间内处理。`createRetryingPostJson_`/`realLLMExtractorDeps_` 新增可选的 `retryBudget` 参数，不传就照旧用模组层级默认值（既有呼叫方行为不变）。Node 新增测试验证 `retryBudget` 覆盖值确实生效、`BATCH_RETRY_BUDGET_` 确实比 `SINGLE_RETRY_BUDGET_` 收紧（mutation-checked）。

**未完全解决的部分，诚实记录**：这是缓解（大幅降低风险），不是数学上证明过的绝对上限——`consoleRunDailyAllocation_` 经 `142` 最坏情况仍可能呼叫三次 `extractOrders()`（full_document + 两个 chunk），每次都可能走完整三层模型链，理论最坏情况的总耗时仍有可能逼近甚至超过 6 分钟，只是 `BATCH_RETRY_BUDGET_` 单独解决了已经真实发生过的那个事故（consoleBatchImport 多文件情境）。`'single'` 情境尚未真实复现过类似的硬杀，这次没有进一步收紧，留作已知、未解决的理论风险。

**真实 GAS 重新验证**：PENDING——这整段修复目前只有 Node 测试验证过，`consoleBatchImport`/`consoleRunDailyAllocation` 都还没有在真实 GAS 环境重新跑过确认。

## 2026-10-07 新增——Platform 别名表：未知 platform 的 fail-closed gate 抓到真实的新原文 "4-Hour Delivery"（Steven 提供 debug 日志 + W14 原件）

**触发**：Steven 提供 `debug.pdf`（真实 GAS Cloud log，2026-10-03 20:48:18，`[DailyAllocation] 未能完全分配`）：`attempts` 只有 `full_document`（`stage: null, errorCount: 0`——Gemini 抽取跟 `125` 的四层验证都过了），`nonRetryableErrors` 只有一条：`{day: "Jumaat 3 April", errors: ["platform_raw 无法归类到已知 platform：4-Hour Delivery"]}`。随后 Steven 上传了该 Statement 的原件 `2026-W14.pdf`（30 Mac–5 April 2026，25 页）。

**根因（对照实际代码核实，不是照抄外部分析）**：Gemini 照 `127` schema 的要求（`platform_raw` 照 PDF 原文、不正规化）忠实回报了 `"4-Hour Delivery"`；`142` 的 `candidateFromGeminiOrderRow_` 原本只认 `PLATFORM_NAMES_`（`GrabExpress`/`GrabFood`/`GrabMart`）的子字串，认不出就回 `valid:false`，该笔订单不进 `orderRows`；当天 `computeDailyChecksum_` 因此少算该笔 → `Discrepancy_Flagged` → 整批 `Needs_Review`；跨月 Statement 因此不会被拆月。

**这是 gate 在正常工作，不是 gate 太严**：拒收未知 platform 是刻意的 fail-closed（CMP-P10）。这次它抓到的是 Grab 真实印出来的新原文。正确的修法是把「已确认归属的」名称显式加进别名表，不是放宽 gate。

**修复**（只动 `142`，不动 `127` 的 schema/prompt——Gemini 抽得没错，不碰 LLM 端的契约）：
- 新增 `PLATFORM_ALIASES_`（`alias` → 规范 `platform`，必填 `evidence`）、`normalizePlatformLabel_`、`classifyPlatform_`。规范名称的比对规则**完全不变**（区分大小写的子字串）；找不到才查别名表，别名比对是「小写 + 连续空白/连字号折成单一空格 + 完整词边界」（"4-Hour Delivery"/"4 hour delivery"/换行写法都命中，"24-Hour Delivery" 不命中——Grab 自己的模板里同一个服务名的连字号写法就不一致，真实 fixture 里 "Instant -- Bike" 跟 "Instant - Bike" 并存）。认不出来仍回 null、仍然 fail closed。
- `classifyPlatform_` 是全专案唯一做这个判定的地方：`candidateFromGeminiOrderRow_`（生产路径）跟 `parseOrderRowCandidate_`（Phase 1-3 遗留死代码）都改成呼叫它，不再各自保留一份白名单（单一事实来源）。
- 候选新增 `platform_raw`（PDF 原文）跟 `platform`（判定出的规范名称）并存，别名判定的依据留得下来（加法性，不是 schema 变更——`Daily_Allocation`/`Non_Order_Income_Allocation` 的栏位没动）。
- 未知 platform 的错误讯息带出订单号、PDF 页码、已知名称/别名，原有前缀文字不变——这次 debug 是靠人工翻 PDF 才定位到那一笔。

**别名 `4-Hour Delivery` → `GrabExpress` 的证据**（依强度排序）：
1. **Statement 自己的汇总（W14 原件，最硬）**：印刷的「Pendapatan asas Express」53.50 = 7 笔 GrabExpress(Instant) 基本收入 47.50 + 这笔 4-Hour Delivery 的 6.00。Grab 自己就把它算进 Express，拿掉它就对不上。`143` 的 `W14真实.别名证据` 测试把这个对帐写成可执行的算术。
2. Grab 官网 `https://www.grab.com/my/express/` 把 4-Hour Delivery 列为 GrabExpress 的服务之一，跟 Instant、Scheduled 并列。
3. 本 repo 两份真实 fixture（W01、W33）各 19 笔 `PLAN-1-` 订单号、各 19 个 GrabExpress 平台栏位，笔数一一对应；W14 那笔订单号同样是 `PLAN-1-HWRQ5Q8GW4QH`。

**用 W14 原件核对 `debug.pdf` 里的外部分析时发现的差异**：(1) 外部分析说 3 April 的印刷小计是 RM207.70——**不对**：每天的小计印在该天表格的末尾（下一天标题之上），RM207.70 是 4 April 的，3 April 的是 RM222.20；「丢掉这笔就差 9.10」的机制不变（逐笔加总 222.20，少了这笔是 213.10）。(2) 那笔的 3.10 在「Pelarasan Pendapatan」栏，不是「Pendapatan lain」栏——外部分析写的「调整 3.10」是对的。(3) 外部分析引用的行号（138/575）跟 repo 对不上（实际在 83/591），逻辑一致。原件的订单号、金额、平台原文都已逐项核对（PDF 第 14 页）。

**验证**（层级见 `VERIFICATION_STATUS.md` 第 8–9 项）：
- Node：`143` 新增 17 项；mutation 测试 10 种破坏全数被抓到；GAS 式单一全域 scope 模拟同样通过。
- **整份真实 W14 数据（166 笔订单、7 天，用 pdfplumber 对原件逐笔抽出，当作「Gemini 抽对了会长什么样」的确定性替身，通过 `125` 的订单层级验证）喂进真实管线**：修复前 = `Needs_Review`、165 笔、只有 2026-04-03 被标 `Discrepancy_Flagged`（-9.10）、statement 差 -9.10、`nonRetryableErrors` 指向 "Jumaat 3 April"——跟 debug 日志同一个形状；修复后 = `Fully_Allocated`、166 笔、7 天全 `Matched`、statement `Matched`，跨月拆分 2026-03 = 333.70 / 2026-04 = 964.10。
- **仍然 PENDING**：真实 GAS 重新跑一次 `consoleRunDailyAllocation`。上面的替身证明的是「Gemini 抽出一份通过验证的候选之后，确定性管线的行为」，不证明真实 Gemini 对这份原件抽出来的就是同一份候选（debug 日志的 `errorCount: 0` 只说明上次抽出的候选通过了验证）。Daily_Allocation 是 append-only：重跑追加新 batch（`batch_id` 带时间戳，最新的为准），旧的 `Needs_Review` batch 留作历史，不会被改写。
- 顺带观察：W14 是 25 页（订单在第 8–23 页），`ASSUMED_STATEMENT_TOTAL_PAGES_` 是 24——chunk fallback 的页码范围（1–13 / 12–24）仍然覆盖所有订单页，这次没有实际影响；但这个假设值仍是 handoff 的 O 项（真实页数应该来自 Documents）。

**以后遇到新的 platform 名称怎么办**：它会继续被拒收、整批 `Needs_Review`——这是设计，不是缺陷。流程：先确认它的归属（最好是 statement 自己的汇总能对上，其次官方来源或真实订单号模式），再在 `PLATFORM_ALIASES_` 加一行带 `evidence` 的条目并补一条测试；`143` 的别名表完整性测试会挡下没有证据、或指向不存在 platform 的条目。不做自动学习/猜测。

## Related

ADR-002, ADR-004, ADR-006
