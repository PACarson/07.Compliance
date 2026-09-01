# Phase A — AI Studio Extraction Prompt → 127 responseSchema 设计转换审查
## Compliance OS — Daily Order-Level Allocation
2026-09-01

本文件是 Phase A 的完整交付：把在 AI Studio 对真实 W01 PDF 验证成功的 extraction prompt，对照 `127_LLMExtractor.js` 现有的 `responseSchema` + prompt 逐条核对。**没有修改 112/125/127/142 任何一行 production code**——本文件全部是审查 + 一份独立的 mock 一致性验证脚本。

**先说最重要的结论**：核对下来，AI Studio 验证过的规则，绝大部分**已经在 127 现有的 schema/prompt 里**，不是要新写一份。这跟原本预期"要做转换设计"不太一样，但这是核对出来的事实，不是我为了省事简化——细节见下面逐条表格。真正还没被验证过的，从来就不是"规则有没有写对"，而是"这个已经写好、从没改过的 schema+prompt，套进真实 API 的 `responseSchema` 硬约束之后，表现好不好"——这正是 Phase B 要测的。

---

## 1. 逐条核对：AI Studio 的 23 条规则，现在各自在哪里

| # | AI Studio 规则 | 现状 |
|---|---|---|
| 1-3 | 只转录实际存在的资料；不推断/不补充；不为了凑数字改金额 | **已在现有 prompt 第 1、2 条**，文字更严格（"就算加起来对不上，也是照抄···不是你要修正的事"） |
| 4 | Order ID 逐字保留，看不清楚标记 low_confidence | **已在现有 prompt 第 6 条 + schema `low_confidence`**，且现有版本更细致：要求先给"能辨识到的最佳读数"，完全无法辨识才留 null，不是看不清楚就直接放弃 |
| 5-6 | Sekaligus 可以 1 个或多个 ID，也可能用 "and N"；一行就是一个 allocation row，不要拆开 | **已在现有 prompt 第 3、4 条 + schema `order_ids_raw`/`and_more_count`**，语意完全一致（`and_more_count` = "and" 后面那个数字本身，不是总数，跟我们这次讨论时定义的一样） |
| 7 | 日期用日期分组标题判断 | **已在现有 prompt 第 5 条** |
| 8 | 保留 period_start/period_end | 不适用于这份 schema——period 是**呼叫方（142）传进来的参数**，不是要 Gemini 抽取的东西；`resolveDateFromDayMonth_` 用这两个参数配合 Gemini 回传的 day/month 去解析完整日期，这条本来就不该出现在这个 schema 里 |
| 9 | 跨年份日期解析（12 月/1 月分别套对年份） | **这条其实是多余的，应该拿掉，不是要新加**——Gemini 在现有 schema 里从来不需要处理年份，它只回报 `day`/`month_name`（例如 "29"/"Disember"），年份解析完全是 142 的 `resolveDateFromDayMonth_` 在做，而且这条既有的确定性逻辑本来就该比信任 LLM 自己算跨年份更可靠。这次在 AI Studio 测的版本让 Gemini 自己算年份、也算对了，但那是测试用的 prompt 多要求的东西，不代表正式 schema 应该学它这样做——让 LLM 少做一件事，交给已经测过的确定性代码，是更稳的方向，不是退步 |
| 10-13 | Butiran Tempahan 每行都留；4 个金额栏位都留 | **已在现有 schema 完整覆盖**（base_income/other_income/income_adjustment/net_income） |
| **12（重点）** | **Pendapatan lain 栏位空白 = 0，不是 null** | **已经在现有 schema 里**（`other_income` 的 description 原文就是"这一栏空白（没有印数字）就填 0，不是不确定，是这一栏本来就没有数字"）——这条我原本以为是这次新发现、新加进去的规则，实际上 Phase 4 设计的时候就已经写对了，我这次是从真实 PDF 独立验证出这条规则的必要性，不是发明了它 |
| 14 | 保留 payment method | **已在现有 schema** `payment_method_raw` |
| 15 | 保留 platform / order type | **已在现有 schema** `platform_raw` / `order_row_type`（含 enum 限制在 Tunggal/Sekaligus，比自由文字更安全） |
| 16 | 保留 PDF page number | **已在现有 schema** `source_page` |
| 17-19 | Tip/Insentif/Bayaran lain-lain 独立记录，日期不确定就是 null，不要强行分配 | **不在这份 schema 的范围内**——这份 schema 从设计上只处理 Butiran Tempahan（订单），Tip/Insentif 这些是完全不同的资料，现有架构里目前**没有**对应的逐笔+日期抽取与分配函数（142 只处理 order-level）。这是这次 AI Studio 测试证明可行、但目前系统里还没有消费端的**全新能力**，不是"转换"就能纳入，需要另外立项设计（见第 5 节） |
| 20-21 | 保留印刷的 daily subtotal；不自己生成 | **已在现有 schema** `printed_daily_subtotal`（`nullable: true`，这是 2026-08-27 真实 GAS 测试抓到、已经修好的那个 schema bug涉及的欄位，目前状态正确） |
| 22 | Bayaran Balik Promo 不算进任何一天的 daily subtotal | **现有 schema/prompt 没有明写这条**，但这次 AI Studio 两次测试（自由发挥 CSV + schema 约束 JSON）都显示 Gemini 自己正确地没有把这笔归到任何一天——因为 Gemini 是直接看 PDF 版面（这个跟人眼判断"这是另一个独立表格"的方式一样），不是靠线性文字重建顺序，不会像 `pdftotext`/坐标 parser 那样把这两个表格搞混。这条不是必须加，但成本很低，属于「不确定要不要需要，但加了也不会有副作用」的防御性补强——建议列成**可选项**，Phase B 先用现有、完全不动的版本测一次，如果结果证明不需要，就不要加（原则：一次只改一个变数，先证明现状够不够） |
| 23 | 输出要能独立算出逐日/整周/各 component 加总 | **已经可以**——`computeDailyChecksum_`/`computeStatementChecksum_` 就是做这件事，不需要 schema 额外配合 |

**没有采纳的两个 AI Studio 测试用欄位**：`order_id_primary`（冗余，`order_ids_raw[0]` 已经够用，142 现有代码本来就这样取）、`order_identity_status`（跟既有 `low_confidence` 语意重叠，两个栏位同时存在只会增加"两者对不上该信哪个"的风险，不是加分）。这两个是我在设计验证 prompt 时为了这次测试方便加的，不建议正式收进 schema。

---

## 2. 确认没有被动到、也不需要动的部分

- `postJson_` 的 429/5xx 重试机制（1s/2s/4s 退避，最多 4 次）——不变
- 证据留存机制（raw response + candidate + request 写入 Drive JSON）——不变
- `runGeminiOrderExtractionWithFallback_` 的 full-document → chunk fallback 编排——不变
- `candidateFromGeminiOrderRow_` / `computeDailyChecksum_` / `computeStatementChecksum_`——一行没动
- 125 的 Structural/Arithmetic/Traceability 三层验证——不变，而且完全不需要知道资料是不是来自这次的 schema，它验证的是 `candidateFromGeminiOrderRow_` 产生出来的 candidate，跟资料来源无关
- 直接核对过 `candidateFromGeminiOrderRow_` 的解构签名（`geminiOrder.platform_raw`/`order_ids_raw`/`and_more_count`/`payment_method_raw`）跟 `BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_` 的栏位名称**逐字对上**，两者从 Phase 4 设计的时候就已经是完全匹配的一组

---

## 3. Mock 一致性验证（严正声明：这不是真实 API 验证，只是设计一致性检查）

用我自己之前 POC 已经验证过金额、但**刻意排除掉 3 笔坐标错位订单**（170 笔，不是全部 173 笔）的资料，重新整形成完全符合现有 `BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_` 形状的 mock response，直接跑过完全未修改的 `candidateFromGeminiOrderRow_`/`computeDailyChecksum_`/`computeStatementChecksum_`：

```
Ahad 4 Januari:   30笔 算得=199.0  印刷=205.5 -> Discrepancy_Flagged（刻意缺 1 笔）
Sabtu 3 Januari:  28笔 算得=213.5  印刷=213.5 -> Matched
Jumaat 2 Januari: 20笔 算得=162.4  印刷=162.4 -> Matched
Khamis 1 Januari: 22笔 算得=187.6  印刷=187.6 -> Matched
Rabu 31 Disember: 23笔 算得=174.7  印刷=174.7 -> Matched
Selasa 30 Disember: 27笔 算得=190.5 印刷=196.0 -> Discrepancy_Flagged（刻意缺 1 笔）
Isnin 29 Disember: 20笔 算得=153.9 印刷=157.9 -> Discrepancy_Flagged（刻意缺 1 笔）
候选建构拒绝笔数: 0
```

这个结果**故意**不是 173/173 Matched——刻意排除的 3 天正确地显示 Discrepancy_Flagged，不是被隐藏。这证明的只有一件事：**给定符合现有 schema 形状的资料，142 现有管线能正确处理、正确算出 checksum、零笔被莫名拒绝**。它完全不能证明"真实 Gemini API 会不会真的回传这样的资料"——这件事只有 Phase B 能回答，我不会拿这次 AI Studio 的 JSON 结果去填满这 3 天再谎称是 mock 测试通过，那样等于把两种不同证据混在一起。

---

## 4. 建议 Phase B 怎么测

**建议先用现有、完全不动的 schema + prompt**（不加第 22 条那个可选的 Bayaran Balik Promo 提醒），理由：这份 schema/prompt 从 Phase 4 设计以来从没真正被真实 API 呼叫成功过（之前两次真实测试都卡在 400/503/429，从没拿到过一次真正的结构化回应）——先测最原始、未变动的版本，如果验收标准全过，代表现有设计本来就没问题；如果有缺口，才知道具体是哪里、要不要加第 22 条这类补强，而不是一次改两个变数搞不清楚是哪个起作用。

验收标准（原样保留你订的）：
- 173/173 orders 正确抽取，173/173 low_confidence=false
- 所有金额栏位没有不应有的 null
- 7/7 daily checksum Matched，weekly checksum Matched
- 8PRUR5AGXAQRAV 必须正确识别（作为本轮最重要的 regression case）
- Sekaligus / and N / 数量逻辑必须正确
- 跨年份 2025-12-29 → 2026-01-04 全部正确（这次验证的是 `resolveDateFromDayMonth_` 这个既有确定性函数，不是 Gemini）

如果没达标：照你说的，原样报告 discrepancy，不放宽 validation、不改 expected value。

不会开发 Drive OCR rescue parser。

---

## 5. 明确列为「未来另外立项」，这次不做

Tip / Insentif / Bayaran lain-lain 的逐笔+日期抽取（AI Studio 证明可行，但 142/125 目前没有对应的消费函数）——如果之后要做，需要新的 candidate 建构函数跟对应的 `Non_Order_Income_Allocation` 写入逻辑，是独立的一块设计工作，不建议这次顺便塞进来。

---

## 状态

Phase A 到此为止，等你决定要不要进入 Phase B。
