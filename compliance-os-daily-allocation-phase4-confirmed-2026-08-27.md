# Compliance OS — Daily Order-Level Allocation (ADR-004/005)
# Phase 4 Checkpoint 确认 + Real Environment Validation Pending — 2026-08-27

本文件记录 Steven 对 `compliance-os-daily-allocation-checkpoint-2026-08-25.md` 的正式确认，以及本次 phase-gate 转换到 **Real Environment Validation** 的完整交接内容。

**跟 2026-08-25 checkpoint 的关系**：那份文件仍是 Phase 1-4 全部技术内容（真实 schema 调查、四层数据模型、逐文件 implementation 对照表、已知边界）的权威来源，本文件不重复也不取代其中任何一条。本文件只做三件事：(1) 记录 Steven 的确认动作本身；(2) 记录这次针对该确认做的独立重新验证结果（不是照抄 08-25 文件或这次讯息的说法）；(3) 记录下一阶段 Real Environment Validation 的完整测试计划与处理规则。新窗口应该先读 08-25 版，再读这份。

---

## 1. Steven 确认的范围（逐项）

Steven 接受目前的实现方向和测试结果，特别确认以下各项：

| # | 确认项 | 状态 |
|---|---|---|
| 1 | `127_LLMExtractor.js` → Gemini extraction adapter | 已确认 |
| 2 | `125_ExtractionValidation.js` → Structural / Arithmetic / Traceability 三层验证 | 已确认 |
| 3 | `142_DailyOrderAllocation.js` → Gemini candidate mapping + chunk merge + full-document→chunk fallback | 已确认 |
| 4 | Gemini 失败不能让整个 Statement crash | 已确认（架构要求） |
| 5 | LLM 不是 Truth Engine，最终仍由 deterministic validation / checksum 决定 | 已确认（ADR-005 既有立场，本次重申） |
| 6 | 真实 Gemini API / GAS runtime 尚未验证 | **明确记录，不假装通过** |

**明确的否定动作**：143 剩余的 5 个 FAIL，在确认全部来自已记录的 pdftotext fixture artefact（见第 2 节）之后，**不**为了凑到 67/67 而针对这个 artefact 做 workaround。

---

## 2. 独立重新验证结果（今天重新执行，不是引用旧结果或直接采信本次讯息）

对照 Steven 的确认逐项核实，而不是直接采纳：

**全部 17 个测试文件重新执行**：既有 16 组 `runAllXTests()`（109/111/113/116/118/122/124/126/128/131/141/143/151/161/171/190）+ `195_Tests_GasLoadSimulation.js`。除 143 外的 16 个文件**全部通过，零失败**；195 确认 18 个正式代码档案照 GAS 字母序载入，无撞名、无出错。`143_Tests_DailyOrderAllocation.js`：**62/67**，与 checkpoint 声称的数字一致。

**5 个 FAIL 逐项核对**（不是只看总数）：

| 测试 | actual | expected | 差额 |
|---|---|---|---|
| TEST 3.W01.2025-12-29 逐日重建 | 153.9 | 157.9 | −4.00 |
| TEST 16.W01 全周 checksum | 第7天 Discrepancy_Flagged | 全部 Matched | 同一天 |
| TEST H 真实整周加总 | 1293.6 | 1297.6 | −4.00 |
| TEST 4.W01 statement checksum | 1293.6 vs 1297.6 | Matched | −4.00 |
| TEST 跨月投影 2025-12 桶 | 524.6 | 528.6 | −4.00 |

五项差额完全一致（RM4.00），诊断输出精确指到同一笔：`weekday: Isnin, day: 29, month: Disember`，订单号 `8PRUR5AGXAQRAV`，金额 4.00，报错「无法判定付款方式」。对照原始 fixture 文字，这一行确实是已记录的 `pdftotext -layout` 重排（"Pesanan Tunggal" 标签跑到金额行之后，订单号跟金额被拆到不同行）——**同一笔、单一根因，没有新的、未解释的失败**，跟 checkpoint 的说法完全吻合。

**代码结构核对**（直接读函数，不只看测试名字）：
- `127_LLMExtractor.js:384` `extractOrders(document, pageRange)` 存在
- `125_ExtractionValidation.js` 三层函数 `validateOrderCandidateStructural_`(341) / `validateOrderCandidateArithmetic_`(382) / `validateOrderCandidateTraceability_`(407)，组合进 `validateOrderExtractionCandidate_`(433)
- `142_DailyOrderAllocation.js` 三个编排函数 `candidateFromGeminiOrderRow_`(570) / `mergeChunkedExtractionResults_`(632) / `runGeminiOrderExtractionWithFallback_`(696) 均存在
- Phase4.编排三项测试直接验证「Gemini 失败不能让整个 Statement crash」：整份成功不触发 fallback／schema 坏掉自动转 chunk 合并成功／整份+两个 chunk 全部失败仍回传 `Needs_Review` 而不抛例外中断——**全部通过**
- 真的会打网络的那一层（`UrlFetchApp.fetch` 呼叫 `generativelanguage.googleapis.com`）确认被隔离在只有真实 GAS 才能执行的独立函式里，Node 环境完全碰不到——「从未对真实 Gemini API 打过一次真的请求」这句话今天依然成立

**结论**：Steven 的确认前提逐项属实，5 个 FAIL 的根因判定正确。**决定不做 workaround，62/67 作为本次 Phase 4 checkpoint 的正式定格数字。**

---

## 3. 本次冻结的决定

- Phase 4 implementation（142/125/126/127/128 已实作部分）保持现状，不继续扩充
- 143 的 5 个已知 FAIL 不做 workaround，不追求 Node 测试 67/67
- 900/901/governance-draft.md 的 ADR-004/005、CMP-CR6 内容本次不变——今天没有新增或修改任何一条 Governance 记录

---

## 4. 下一阶段：Real Environment Validation（Steven 的测试计划）

Steven 将在真实 GAS + Gemini API 环境执行：

1. 原始 W01 PDF → `extractOrders()`
2. 原始 W33 PDF → `extractOrders()`
3. 检查是否完整抓到所有订单
4. 特别检查 W01 跨页日期 block（"Ahad, 4 Januari" 跨 3 页那组）
5. 检查 W33 的单-ID Sekaligus（CMP-CR6 ≥1-ID 规则的真实场景）
6. 检查 Order ID 是否完整保留
7. 检查 Daily subtotal checksum
8. 检查 Statement checksum
9. 故意制造/模拟 extraction failure，确认 fallback / retry 行为
10. 记录实际 Gemini token / cost / runtime

---

## 5. 处理真实测试发现问题的规则（Steven 明确要求，优先于其他一切判断）

- **真实测试前不修改 Architecture**
- 若真实 W01/W33 测试发现问题：**先记录 evidence → 定位是 Extraction / Validation / Allocation / GAS runtime 哪一层 → 再决定是否修改**
- **不因为一次 Gemini 输出异常就直接修改已 Freeze 的 Governance / Architecture**——即使发现问题，也要先分层定位根因，不能跳过这一步直接动 900/901 或已确认的数据模型

---

## 6. 当前状态

**PAUSED — Real Environment Validation checkpoint。**

等待 Steven 提供真实 GAS + Gemini API 环境的测试结果后才继续。在此之前：不扩充 142/125/127 代码，不修改 900/901/governance-draft.md，不为 143 的已知 FAIL 做 workaround。第 5 节的规则从现在起持续有效，直到 Steven 带回真实测试证据为止。
