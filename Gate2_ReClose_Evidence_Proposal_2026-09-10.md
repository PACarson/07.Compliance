# Gate 2 Re-close Evidence Proposal

**日期**：2026-09-10
**Fixture**：CMP-DOC-LATENCY-OBS-W01
**产出性质**：Evidence Proposal —— 不是 ADR closure，不包含任何代码变更
**状态**：PROPOSED FOR RE-CLOSE（待 Steven 审阅）

**本轮唯一动作**：Verify（Code → Verify → Governance 的第二步）。本文件不修改 `900_Constitution.js` 的 ADR-005，不实现 majority-vote / ID normalization / 任何新的 Parser 或 Gemini prompt 逻辑。

**原始依据档案**：
- `compliance_os_latency_observations_jsonl.txt`（本批次全新起始的 JSONL，10 笔记录，`2026-09-10T15:17:28.008Z` ～ `2026-09-10T15:52:13.535Z`）
- 10 份 `CMP-DOC-LATENCY-OBS-W01__orders-full__*.json` evidence 档案，与上述 10 笔 JSONL 记录一一对应
- `LATENCY_OBS_W01_FILE_ID` 本次由 Steven 确认锁定为 `1fUrux2zoQgvKe0DvsPrR5Xma9pxa57yA`

---

## A. Gate 2 Evidence Summary

### CONFIRMED（本轮证据直接证明）

1. **drive_file_id 一致性**——10/10 evidence 档案的 `drive_file_id` 皆为 `1fUrux2zoQgvKe0DvsPrR5Xma9pxa57yA`，与 Steven 声明的锁定值完全相符。
2. **Statement period 一致性**——10/10 呼叫解析出的 7 天区间完全相同：Isnin 29 Disember – Ahad 4 Januari，即这份 W01 fixture 历史上唯一被确认正确的周期。
3. **weekday/day/month/printed_daily_subtotal 一致性**——7 天 × 10 次 = 70 组栏位逐一比对完全相同（明细见 B 节）。
4. **每日订单数量一致性**——10/10 呼叫的逐日笔数分布相同（21/28/23/22/20/28/31，合计 173）。
5. **Daily subtotal arithmetic**——70/70（7 天 × 10 次）独立重新计算 `sum(net_income)`，全部等于 `printed_daily_subtotal`（见 B 节）。
6. **`8PRUR5AGXAQRAV` 历史案例**——10/10 逐字段（`platform_raw` / `payment_method_raw` / `base_income` / `other_income` / `income_adjustment` / `net_income` / `source_page` / `low_confidence`）完全一致。
7. **Sekaligus/and-N 一致性**——35 笔 Sekaligus 类型订单（以第一次呼叫为基准），`order_ids_raw` 与 `and_more_count` 在其余 9 次呼叫中逐笔比对，0/10 出现任何缺漏或增加（见 C 节）。
8. **173 笔订单 × 10 次呼叫的 cross-run 比较**——除 D 节所述 2 处订单 ID 字符级分歧外，其余 171 笔订单的全部栏位在 10 次呼叫中逐笔完全相同。
9. **代码层面无 override 路径**——`999_LatencyReliabilityObservation.js` 内 `LATENCY_OBS_W01_FILE_ID` 是直接 hardcode 的 const；脚本中仅有的两处 `PropertiesService.getScriptProperties()` 读取分别对应 `LLM_EXTRACTOR_MODEL` 与 `EXTRACTION_EVIDENCE_FOLDER_ID`，与 file_id 无关——不存在会在运行时静默替换档案的路径。

### STRONGLY SUPPORTED（本轮证据强力支持，非直接证明）

> "23% correctness" 的主要原因是 file reference / file identity inconsistency，而不是 Gemini 对同一输入文件的随机不稳定。

理由：在 file_id 被独立证实锁定为同一份档案的前提下（CONFIRMED #1），10 次独立真实呼叫在 period / checksum / 已知历史案例 / bundling 逻辑上取得零失误的一致结果；而 2026-09-06 那批"23% 正确率"样本，回顾来看正是混杂了至少 9 个不同 `drive_file_id` 的样本。之所以列为 STRONGLY SUPPORTED 而非 CONFIRMED，是因为当时那 9 个 file_id 各自对应的错误率并未逐一分组重新计算过，无法排除其他次要因素同时存在的可能。

### NOT YET CONFIRMED（明确保留，不视为已证实）

- **为什么历史上曾出现 9 个不同 `drive_file_id`，具体发生在哪个 session、由什么人为过程造成**——本轮未追查，也不视为已证实的人为操作。代码层面已排除"脚本自动切换档案"的可能（CONFIRMED #9），但"人为编辑/贴错"目前只是排除法下的唯一剩余解释，不是被直接证实的事实。详见 E 节。
- **2 笔订单 ID 字符级分歧中哪一种读法是真值**——10 次呼叫本身不构成 ground truth，详见 D 节。

---

## B. Arithmetic Verification

以第一次呼叫（`2026-09-10T15:17:28.008Z`）的日期区块为基准列出，每一格数值均已在其余 9 次呼叫中逐一核对相同：

| Weekday | Date | Orders | Printed Daily Subtotal (RM) | Recomputed Sum (independent) | Result |
|---|---|---|---|---|---|
| Isnin | 29 Disember | 21 | 157.9 | 157.9 | PASS (10/10) |
| Selasa | 30 Disember | 28 | 196.0 | 196.0 | PASS (10/10) |
| Rabu | 31 Disember | 23 | 174.7 | 174.7 | PASS (10/10) |
| Khamis | 1 Januari | 22 | 187.6 | 187.6 | PASS (10/10) |
| Jumaat | 2 Januari | 20 | 162.4 | 162.4 | PASS (10/10) |
| Sabtu | 3 Januari | 28 | 213.5 | 213.5 | PASS (10/10) |
| Ahad | 4 Januari | 31 | 205.5 | 205.5 | PASS (10/10) |
| **Total** | — | **173** | **RM 1297.6** | — | **70/70 PASS** |

**计算方法**：对每一次呼叫、每一天，独立加总该天全部订单的 `net_income`，与该次呼叫回报的 `printed_daily_subtotal` 比对——不依赖脚本本身回报的 `checksum_status` 标签。70 组比对（7 天 × 10 次）全部在浮点误差 0.01 以内吻合，无一例外。

---

## C. Cross-run Consistency

| 检查项 | 结果 |
|---|---|
| `drive_file_id` | 10/10 相同（`1fUrux2zoQgvKe0DvsPrR5Xma9pxa57yA`） |
| `extraction_scope`（first/last_page_seen） | 10/10 相同（1–24 页） |
| Statement period（7 天 weekday/day/month） | 10/10 相同 |
| 每日 `printed_daily_subtotal` | 10/10 相同（7 项数值逐一相同） |
| 每日订单数量 | 10/10 相同 |
| `8PRUR5AGXAQRAV` 案例逐字段 | 10/10 相同 |
| 35 笔 Sekaligus 的 `order_ids_raw` + `and_more_count` | 10/10 相同（0 笔缺漏/增加） |
| 其余 171 笔订单（非 D 节所列 2 笔）全部栏位 | 10/10 相同 |
| `request_prompt`（送进 Gemini 的实际内容，hash 比对） | 10/10 相同 |
| `extractor_id` / `finish_reason` | 10/10 相同（`gemini-3.5-flash` / `STOP`） |
| `promptTokenCount` | 10/10 相同（13180） |

唯一未落在"10/10 相同"的项目是 D 节所述的 2 笔订单 ID。

*附注（不计入本提案 uncertainty，仅供记录）：`candidatesTokenCount`（26759–27855）与 `thoughtsTokenCount`（12713–34272）在 10 次呼叫间有明显波动，属于 Gemini 内部推理长度的正常变化，与 extraction correctness 判定无关。*

---

## D. Two ID Ambiguities

**状态：OBSERVED AMBIGUITY — NO CODE CHANGE**

### 观测记录

- 2 / 1,730 笔 cross-run order-ID observations（173 笔订单 × 10 次呼叫）出现字符级 reading disagreement。
- 两笔的 `order_row_type` 均为 `Tunggal`（单笔），不是 Sekaligus，不涉及 bundled 计数。
- 两笔的 `base_income` / `other_income` / `income_adjustment` / `net_income` / `platform_raw` / `payment_method_raw` / `source_page` 在两种读法下完全一致，仅订单 ID 字符串本身相差一个字符。
- 第一笔（Sabtu 3 Januari）：10 次中 3 次 vs 7 次两种读法。
- 第二笔（Ahad 4 Januari）：10 次中 1 次 vs 9 次两种读法。
- 两笔均不影响本次 Gate 2 的 aggregate arithmetic——checksum 比对的是金额而非 ID 字符串，B 节的 70/70 PASS 与这两笔订单取哪一种读法无关。

### 本轮明确不做的事

- 不加 majority-vote 逻辑
- 不修改 Parser（`127`/`125`/`142`/`108` 一行未动，本提案也不建议动）
- 不修改 Gemini prompt
- 不做 ID normalization
- 不修改 checksum 计算方式
- 不修改 order ID extraction 规则

**原因**：目前没有原始 PDF 可比对，无法确认哪一种字符读法是真值。10 次重复呼叫彼此之间的多数结果**不是** ground truth——3/10 vs 7/10、1/10 vs 9/10 只反映这 10 次呼叫彼此的分布,不代表与原始文件的匹配程度。在没有独立于这 10 次呼叫之外的验证手段（例如原始 PDF，或与 Rider OS 订单记录比对）之前，任何"自动选多数"的逻辑都是在用不确定的证据制造一个看似确定的答案，本提案不采用这个做法。

---

## E. Historical 9-file-ID Mystery

**状态：Historical provenance — unresolved**

- 本轮**没有**为追查这个问题扩大调查范围，也没有对哪个 session、哪个操作导致这 9 个 file_id 做任何猜测。
- 本轮从代码层面确认的唯一新事实：`999_LatencyReliabilityObservation.js` 里 `LATENCY_OBS_W01_FILE_ID` 是直接 hardcode 的 const，脚本本身没有会在运行时切换档案的逻辑（见 A 节 CONFIRMED #9）。这排除了"脚本自动跑掉"的可能，但没有解释历史上那 9 个值实际是怎么被输入进去的。
- 就 Gate 2 本身而言，这不构成核心 extraction correctness 的 blocker——只要能确认当前及未来使用的 `LATENCY_OBS_W01_FILE_ID` 保持锁定在已知正确的档案，本轮 10 次结果显示 extraction 本身是可靠的。
- **唯一留给 Steven 的例外**：本轮没有检查 `110_DocumentImport.js` 等实际 production 路径上，文件引用是否存在类似"常数手动设置、可能跨 session 漂移"的风险模式。如果 production 路径的档案来源机制（例如每次都是当次上传的新档案）跟这份 observation 脚本的 hardcode-const 模式本质不同，那这个历史谜团很可能只是 test harness 自身的操作痕迹，与 production 的 extraction correctness 无关；但这一点本轮未验证。若要确认，需要另外查看 110 的档案来源逻辑——这已超出本轮"不扩大范围"的约束，是否需要，留给 Steven 决定。

---

## F. Gate 2 Re-close Recommendation

**状态：PROPOSED FOR RE-CLOSE**（非 CLOSED——本文件不具备 ADR closure 的效力）

**Evidence**
- 10 次独立真实 Gemini 呼叫（非模拟、非重放）
- Same-file proof：10/10 `drive_file_id` 相同，代码层面已排除脚本自动切换档案的可能
- Extraction consistency：原始 Gate 2 验收范围内的核心项目（period、每日 checksum、`8PRUR5AGXAQRAV` 历史案例、Sekaligus/bundling）10/10 或 70/70 全部通过

**Remaining uncertainty**
1. 2 笔订单 ID 的字符级 ambiguity（D 节）——不影响金额/period/checksum，但订单 ID 本身的真值未定
2. 历史上 9 个不同 file_id 的产生过程（E 节）——已排除代码层面成因，人为过程本身未确认；对 production 路径是否有对应风险，本轮未验证

**Impact assessment**
这两项 uncertainty 都不落在 Gate 2 原始验收范围要求回答的核心问题上——#1 是订单 ID 字符串本身的精度问题，只有在 `order_ids_raw` 未来被用作跨系统比对/去重 key 时才会有实质影响，目前 persistence 层尚未接上这类比对逻辑；#2 是一个已排除代码层面成因、且更像是 test harness 操作痕迹而非 production 缺陷的历史悬案。就 Gate 2 本身要回答的问题——"同一份档案重复真实呼叫，是否可靠地得出正确的 statement period 与正确的 checksum"——本轮证据给出的答案是肯定的。是否要因为 #1、#2 而暂缓 re-close，属于判断题，留给 Steven 决定。

---

## G. ADR-005 是否需要修改

**未修改**。本文件本身不是 ADR closure，只是 Verify 阶段完成后产出的 evidence proposal。按 Code → Verify → Governance 原则，是否、以及如何更新 `900_Constitution.js` 的 ADR-005 status，等 Steven 审阅本提案后再决定。

---

## H. 是否有任何 Code Change

**没有**。本轮所有操作均为只读/分析性质：
- 读取（未修改）已交付 zip 快照中的 `999_LatencyReliabilityObservation.js`，确认 `LATENCY_OBS_W01_FILE_ID` 的定义与读取路径
- 读取（未修改）Steven 提供的 10 份 evidence JSON 与 1 份 JSONL 日志
- 独立重新计算 checksum、逐笔比对订单栏位

`127_LLMExtractor.js`、`125_ExtractionValidation.js`、`142_DailyOrderAllocation.js`、`108_SheetSetup.js`、`900_Constitution.js`、`901_System_Architecture.js`——本轮全部零改动。未实现 majority-vote、ID normalization，或任何新的 Parser/LLM 逻辑。

---

*本文件是 evidence proposal，不是正式 ADR closure。经 Steven 审阅、决定是否／如何更新 ADR-005 之后，方为定案。*
