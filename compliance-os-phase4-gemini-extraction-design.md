# Compliance OS — Daily Order-Level Allocation
# Phase 4: Gemini PDF Extraction — Design & Contract（未动 112/127/142 production code）

状态：Phase 3 的两个真实问题已核实并处理完（见文末「Phase 3 收尾」）；这份文件回答你提的 15 个问题，是设计，不是实作。142/143 的四层数据设计、`month` 不存储、`Needs_Review`、append-only batch/idempotency——这份文件全部原样沿用，没有因为换了抽取方式就重新讨论。

## 总体判断：同意 Gemini，但有两个 checksum 覆盖不到的地方要先说清楚

同意用 Gemini 取代 Drive OCR——你给的理由（视觉位置关系对这张表很重要、OCR 转出文字也保证不了栏位对应关系）不是空泛的"LLM 比较强"，是 Phase 3 已经踩出来的真实证据：我自己用 `pdftotext` 处理同一批真实 PDF 时，就是被这个"同一格的字被拆到不相邻位置"的问题卡住，花了大半个 Phase 3 在写容错 token 搜寻去绕过它。一个真正看得懂表格视觉结构的模型，从根上不会有这类问题。

但既有 checksum 机制能保证的，跟不能保证的，要分清楚，不然容易误以为"checksum 过了 = Gemini 完全没错"：

- **能保证**：漏行、多算、金额抄错——只要不是恰好互相抵消，逐日 + 整周 checksum 几乎必定抓到（7 个独立的逐日校验，恰好抵消的机率非常低）。这是你问题 15 的答案，下面会再展开。
- **不能保证**：**订单号本身抄错，但金额、日期都对**——checksum 只验证金额加总，不验证订单号字符串本身对不对。这笔钱的归属日期还是对的，不影响 Daily/Monthly Allocation 的数字，但会影响未来"从某一天的收入一路追溯到具体是哪一笔 Grab 订单"这个可追溯性（Phase 2 design §12 提过的 source traceability）。这个风险不需要现在解决，但要留着——如果哪天真的靠订单号去反查 Rider OS 或者对账，这个盲点要记得。

下面照你 15 个问题的顺序回答。

---

### 1. Gemini 在 GAS 中实际如何读取 PDF Blob

不是新问题——`127_LLMExtractor.js` 现在就是这样做的（`DriveApp.getFileById(document_id).getBlob()` → `Utilities.base64Encode()` → 塞进 request body 的 `inline_data`）。Phase 4 直接沿用这条既有路径，不重新发明。

唯一值得考虑的调整：如果同一份 PDF 要打多次 Gemini API（例如后面 §2 万一真的要分块），重复对同一份 blob 做 base64 encode + inline 传输会浪费流量——可以改用 Gemini 的 File API（先上传一次拿到 `file_uri`，后续请求都引用同一个 uri）。但如果 §2 采用「整份 PDF 一次呼叫」，这个优化就不需要，直接沿用 127 现在的做法即可。

### 2. 如何按 PDF page/range 分块

**我的建议是：先不分块，一份 Statement 的 Butiran Tempahan 一次呼叫处理完，除非实测证明不可行。**

理由：Phase 1 已经量出真实数据规模——Butiran Tempahan 大约 150–170 笔印出来的行，横跨 15–18 页。这个量级换算成 Gemini 的输出 token（下面 §14 会细算）大概是 8–10K output tokens，远低于现在主流 Gemini 模型的输出上限（通常是数万 token 起跳）。人为分块反而会制造一个真实数据里本来不存在的新问题：**日期分组会跨页**（Phase 1 实测 W01 的 "Ahad, 4 Januari" 横跨 3 页），如果按页切块，切块边界如果刚好落在一个日期分组中间，就要在两次 Gemini 呼叫之间做"这个日期分组到底完整了没有"的拼接跟去重——这个复杂度，实测数据量根本用不上就要背。

如果之后实测发现整份丢给 Gemini 会漏行/变慢/不稳定，才需要分块——分块的话，**分块边界只能切在日期分组的边界上，不能切在页码的边界上**（理由见 §9：只有日期分组边界才有 PDF 自己印出来的小计可以核对，页码边界没有）。

### 3. 每一块的 extraction schema

不管分不分块，schema 都设计成这样（沿用 127 现有的 `responseSchema` 结构化输出机制，不用文字 prompt 让 Gemini 自由发挥格式）：

```
{
  days: [
    {
      weekday_name: string,       // PDF 上印的原文，例如 "Ahad"
      day: number,
      month_name: string,         // PDF 上印的原文，例如 "Januari"
      printed_daily_subtotal: number,  // 该日结尾印出来的 "RM x,xxx.xx"，逐字读出，不要 Gemini 自己算
      orders: [
        {
          order_row_type: string,      // "Tunggal" | "Sekaligus"，照 PDF 原文
          platform_raw: string,        // 照 PDF 原文，不要正规化
          order_ids_raw: string[],     // 明确印出来的订单号，逐个列出，原文不改
          and_more_count: number,      // "and N" 的 N，没有就是 0——不要因为看到 Sekaligus 就自己猜一个数字
          payment_method_raw: string,  // 照 PDF 原文
          base_income: number,
          other_income: number,        // 空白栏一律回 0，不要省略这个字段
          income_adjustment: number,
          net_income: number,
          source_page: number          // 这一行视觉上在第几页
        }
      ]
    }
  ]
}
```

关键设计原则：**凡是 PDF 上写什么就照抄什么，不要求 Gemini 做任何判断、正规化、或推断**（这条界线很重要——Gemini 的职责到"忠实转录"为止，"这个订单号该不该信"、"日期该是哪一年"这些判断，全部留给 142 做，跟你在 §5 讲的"LLM 是 Extraction Adapter"完全对应）。`and_more_count` 这个字段专门用来防止 Gemini 自己把 "and 2" 悄悄脑补成 2 个假订单号——明确要求它把这个数字原样回报，142 现有的 `bundled_order_count`/`order_identity_status` 逻辑本来就是为了处理这个字段设计的，不用改。

### 4. 如何处理跨页的 date block

如果照 §2 走「整份一次呼叫」，这个问题不存在——Gemini 看的是连续的完整页面，日期分组横跨几页是它自己内部的事，我们只在乎它回报出来的最终 JSON 里，"Ahad, 4 Januari" 底下有没有把 3 页份的订单都算进去。**这一点必须实测验证，不能假设 Gemini 一定做得对**：Phase 5（真正接线）第一批真实数据测试，务必挑 W01 这份横跨 3 页的日期分组当测试用例，核对 Gemini 回报的 order 数量是不是等于 142 现有 parser 从文字层解析出来的数量（31 笔，我这边已经验证过）。

### 5. 如何处理重复 header/footer

同样交给 Gemini 的视觉理解处理（它看到的是页面渲染结果，不是文字流，天然就分得出"这是标题"还是"这是数据"）。142 这边加一道防御性检查即可：如果 Gemini 回报的某个字段值恰好等于已知的标题文字（例如 `platform_raw === "Jenis Tempahan"`），直接判 `Needs_Review`，不要让它混进正常数据——这种情况理论上不该发生，但 CMP-P10 的原则是宁可多一道用不到的检查，也不要假设不会发生。

### 6. 如何处理 Sekaligus / "and N"

已经在 §3 的 schema 里回答了——`order_ids_raw` 只列 PDF 明确印出来的，`and_more_count` 单独一个字段记录省略掉几个，两者都不要求 Gemini 推断。**今天刚确认的真实规则**（Sekaligus 可以只有 1 个订单号、没有 and N）不需要额外告诉 Gemini 什么特殊逻辑——反正它就是照抄，"只印 1 个"这件事本身就会原样反映在 `order_ids_raw` 长度是 1、`and_more_count` 是 0，142 那边今天已经改成接受这种情况了。

### 7. 如何保证一个订单行不会被重复提取

「整份一次呼叫」的设计下，这个问题不存在（没有多次呼叫，就没有重复提取的机会）。如果之后真的需要分块（§2 的例外情况），分块边界如§2 所说必须切在日期边界上，不切在订单行中间，天然也不会重复。

### 8. 如何处理 Gemini 输出 JSON 不完整、格式错误或漏行

不完整/格式错误：整个照抄 `125_ExtractionValidation.js` 现有的作法——`JSON.parse` 包 try/catch，schema 验证失败直接标 `Extraction_Failed`（沿用既有状态词汇），不重试着"修补"一个不完整的 JSON，也不把它当成部分数据接受。

漏行：这是 JSON 本身"看起来完整"但内容有缺的情况，光看 JSON 结构看不出来——**这正是逐日 checksum 存在的意义**，也是问题 15 的核心答案，见下面。

### 9. 如何做 page-level checksum / block-level validation

**不需要 page-level 或 block-level checksum，只需要现有的 day-level + statement-level 两层（142 已经做好了）。** 原因很直接：Grab 的 PDF 只在「日期分组」这个粒度印出独立小计（"Jumlah RM xxx.xx"），从来没有在任意页码边界或人为分块边界印过小计——page-level checksum 没有一个真实、权威的数字可以拿来比对，做出来也只是自己算自己、验证不了任何东西。这也是 §2 建议不分块（或分块也要切在日期边界）的另一个理由：只有跟真实数据的既有颗粒度（日期）对齐，checksum 才有意义。

### 10. 如何与现有 142 "Daily_Allocation" / "Non_Order_Income_Allocation" 对接

142 现在的 `parseOrderRowCandidate_` 其实做了两件事混在一起：①从原始文字里用 token 搜寻抠出栏位，②验证抠出来的栏位算术站不站得住。Phase 4 要接 Gemini 的话，①这一步不需要了（Gemini 的 JSON 已经是结构化栏位，不用再从文字里猜），但②完全照样需要——建议 Phase 4 实作时把 142 拆成两半：一个新的 `candidateFromGeminiRow_(geminiJson)` 做栏位映射（把 §3 schema 的字段名对应到 142 现有 candidate 的字段名），映射完直接丢给 `parseOrderRowCandidate_` 现有的算术验证部分（略调整，让它可以接受已经结构化好的输入，不用重新从文字抠）。`computeDailyChecksum_`、`computeStatementChecksum_`、`matchInsentifLineDate_` 等等完全不用动，这些函数的输入本来就是干净的结构化数据，不在乎数据是从文字 regex 来的还是从 Gemini JSON 来的。

### 11. Retry / partial extraction / idempotency

沿用 142 已经确认的 `allocation_batch_id` append-only 设计——一次 Gemini 呼叫失败或不完整，就是没有产生一个「完整」的 batch，重试就是开一个新 batch，查询时只认最新一个「完整」的 batch，旧的失败尝试不用清理、留着当审计记录。「完整」的判定：这份 Statement 的每一个日期分组都要有一个 `checksum_status`（不管是 Matched 还是 Discrepancy_Flagged 都算「有判定」），只要有任何一个日期分组完全没有被处理到，整个 batch 就标 `Incomplete_Extraction`（沿用 `Needs_Review` 大类，细节原因用这个子状态记录），不能被后续查询当成「当前有效结果」采用。

### 12. 6 分钟 GAS runtime 下如何断点续跑

如果 §2 的「整份一次呼叫」成立，单一 Gemini API 呼叫本身几乎不可能接近 6 分钟（一次结构化提取，正常是几秒到几十秒等级）——**6 分钟限制真正会撞到的场景是"一次处理很多份 Statement"（例如原始 handoff 提过的 Jan→current 历史回填），不是单一 Statement 内部**。断点续跑的设计应该放在「批次处理多份 Statement」这一层，不是放进 142 内部：用 `PropertiesService` 或者一个专门的「回填进度」记录（哪些 `document_id` 已经跑完），每次 trigger 只处理一小批（例如一次几份），跑到接近时间上限就用 `ScriptApp.newTrigger().timeBased()` 排一个接续的 trigger，下次从进度记录接着跑——这是 GAS 常见的批次处理模式，不是这个 feature 特有的新问题，如果 Personal AI Core 那边已经有类似模式，应该直接沿用，不要在 Compliance OS 这边重新发明。

### 13. Gemini API failure / quota / timeout 如何恢复

单次呼叫内：对 5xx、quota-exceeded 做有限次数（例如 2–3 次）的重试 + 退避，超过次数直接落 `Extraction_Failed`，不要在单次 trigger 执行时间里无限重试导致自己反而撞到 6 分钟限制。跨 trigger 的重试：交给 §12 的批次进度机制，下一轮 trigger 自然会重新尝试标记为失败/不完整的 `document_id`。**不管哪一层重试，重试次数用完之后一律显式失败，不允许静默跳过某份 Statement 或者用一个猜测值顶替**——这跟 CMP-P10 是同一条线。

### 14. 成本估算

用 2026 年 8 月现在的 Gemini API 定价（Flash 量级，$0.75/1M input、$3.75/1M output——这是目前主打的性价比档位；便宜档位 Flash-Lite 大约是这个的 1/7，但预计 2026-10-16 停售，不建议现在选它作为长期方案）粗算一份 Statement：

- Input：24 页 PDF 视觉内容 + 少量 prompt 文字，抓个概数约 7,000–8,000 tokens
- Output：150–170 笔订单结构化 JSON，抓个概数约 8,000–10,000 tokens

单份 Statement 大约 **USD $0.03–0.05**。就算整个 2025-01 到现在的历史回填（约 80–90 份周结单），总成本大概落在 **USD $3–5** 这个量级——**成本在这个功能上完全不是需要权衡的因素**，选模型应该完全看抽取准确度，不用因为省钱去选比较弱的档位。这个估算基于目前公开的定价资讯，实际请求的 prompt 长度定案后建议实测几份真实 Statement 校正一次，但数量级不会变。

### 15. 最重要：如何证明 Gemini 没有漏掉订单或编造金额

这题不需要 Phase 4 发明新机制——**142 在 Phase 3 已经做好的两层 checksum，就是答案**：

```
Gemini 回报的订单行（含它自己读到的 order_ids_raw / and_more_count）
        ↓ 加总 net_income
每日计算总额
        ↓ 对比
PDF 自己印出来的当日 "Jumlah RM xxx.xx"（Gemini 也是从同一页读出来的，
但这是独立于逐行加总的另一个数字，不是从订单行反推出来的）
        ↓ 一致 → Matched；不一致 → Discrepancy_Flagged → Needs_Review
```

只要 Gemini 漏掉一行、多算一行、或改动了任何一笔金额，除非恰好被其他误差完全抵消（在 7 个独立日期 × 2 份真实统计里目前从未发生过这种巧合），这个校验就会失败并显式标出来，不会被当成正常数据发布。**这也是为什么 §2 建议先不分块**：分块越多，"恰好被抵消掉所以骗过 checksum"的组合可能性理论上越复杂——保持一次呼叫、颗粒度对齐到日期分组，检验最干净。

唯一 checksum 顾不到的（文首已经提过）：订单号字符串本身抄错但金额和日期都对，这个盲点不影响这次的数字，但影响未来的可追溯性，值得记住不代表现在需要解决。

---

## Phase 3 收尾（照你的要求正式记录）

- **Issue A — RESOLVED**：Sekaligus 只要求至少 1 个可识别订单号，不再要求 ≥2；已经用 W33 原始 PDF 第 14 页肉眼核对（同一页刚好同时有 2-ID、1-ID-无-and-N、1-ID-带-and-N 三种变体可以对照），确认是 Grab 真实模板行为，不是解析缺陷。142.js 已修正，143 重新跑过。
- **Issue B — TOOL ARTEFACT / NOT PRODUCT BUG**：也用 W01 原始 PDF 第 21 页肉眼核对过，`A-8PRUR5AGXAQRAV` 那一行在原始 PDF 里完全正常，问题 100% 出在这次 Phase 3 用 `pdftotext -layout` 产生测试用文字素材时的重排——没有针对它加 workaround，等 Phase 5 真正接上 Gemini extraction 之后，用 Gemini 的输出重新验证这个日期的 checksum。
- 重新跑测试结果：**51/56 PASS**（比 Sekaligus 修正前的 47/56 多转正 4 个）。W33 现在 151/151 笔订单全部干净解析、7 天 checksum 全过。W01 172/173 笔干净，剩下的 5 个 FAIL（TEST 3.W01.2025-12-29、TEST 16.W01、TEST H、TEST 4.W01、跨月投影）全部、唯一、可追溯到那一笔已经记录在案的 Issue B，没有新的、未解释的失败。

142.js 已更新（附件），没有为了通过测试而增加任何 hard-coded 特例。

你看完这份设计，确认没问题我再进 implementation；现在 112/127/142 都还没有真的改动production 逻辑。
