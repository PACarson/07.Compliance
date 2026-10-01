# ADR-005: Butiran Tempahan（订单层级）抽取改用 Gemini Extraction Adapter + 确定性验证

- **Status**: **CLOSED**（Gate 2 完整验证链完成，2026-09-15；见下方"含义"说明，`CLOSED` 不等于 `VERIFIED` 或 `IMPLEMENTED` 覆盖全部范围——本 ADR 只对锁定的 W01 fixture 做过完整验证）。**2026-09-29 新增一个独立于此状态的 open item**：Gemini 免费额度是目前的 availability 瓶颈，不影响这里的 accuracy CLOSED 判定——见下方同日期段落。**2026-10-01**：第二份真实 statement（W05）的 accuracy 证据（非完整管线）+ 503 自动切模型修复，同样不影响、不重开 Gate 2——见下方同日期段落
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

## Related

ADR-002, ADR-004
