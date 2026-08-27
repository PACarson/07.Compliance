# Compliance OS — Daily Order-Level Allocation (ADR-004/005)
# Session Checkpoint / Handoff — 2026-08-25

本文件是 Steven 要求的完整核对结果：重新检查本窗口全部讨论，对照**当前实际 repository 状态**（不是对照"讨论过什么"）逐项核实。下一个窗口应该以这份文件为主要依据，不是重读整个对话记录。

**本次核对方法**：对整个 07.Compliance-main 目录跟原始上传的 zip 做逐文件 diff；对全部 18 组 `runAllXTests()` 逐一重新执行（不是引用之前turn 报告的数字）；对每个 .js 文件重新做语法检查；重新跑 `195_Tests_GasLoadSimulation.js`。以下结论全部基于这次重新执行的结果。

---

## 1. 当前项目状态

**Daily Order-Level Allocation**——把跨月 Grab Weekly Statement 的收入，从 `160_MonthlyProjection.js` 现有的整周粗颗粒 `Needs_Allocation` 标记，改成逐日、逐笔订单精确归属。这是 Compliance OS 主项目下的一个子专案（ADR-004/ADR-005），**不影响** Compliance OS 既有的、已经在真实 GAS 跑过的核心链路（Import→Parse→VerifiedIncome→Reconciliation→ComplianceCalendar→OperatorConsole）——这次全部改动都是新文件或既有文件的加法性扩充，既有 16 组 `runAllXTests()` 重新跑过全部依然通过，零回归。

**当前进度**：设计（Phase 1-2）与代码实作（Phase 3-4）都已完成到"Node 模拟环境验证通过"这一步。**从未在真实 GAS 环境跑过，也从未对真实 Gemini API 打过一次真的请求**——这是当前状态里最重要的一句话，下面每一节都会重复强调，因为这直接决定了下一步该做什么。

---

## 2. 本窗口重要决定（已同步写入 900/901/governance-draft.md，不只是记在这里）

| # | 决定 | 状态 | 对应治理文档位置 |
|---|---|---|---|
| 1 | Daily Order-Level Allocation 采用四层数据模型（Order_Allocation / Non_Order_Income_Allocation / Daily_Allocation / Monthly_Allocation），Verified_Income 本身不改一个欄位 | **Decided**（设计层级） | ADR-004，900 adrs[]，governance-draft.md §2.7 |
| 2 | Checksum 状态沿用既有 `Matched`/`Discrepancy_Flagged`（130 的词汇，零容差变体）；Allocation 完整度新增 `Fully_Allocated`/`Partially_Allocated`/`Needs_Review`；提案的 `Failed_Checksum` 被否决，折进 `Needs_Review` | **Decided** | governance-draft.md §2.7 |
| 3 | `Daily_Allocation` 不存 `month` 欄位（CMP-P6，查询时用 `yearMonthFromIsoDate_` 算） | **Decided** | governance-draft.md §2.7 |
| 4 | 文件编号：`142_DailyOrderAllocation.js` / `143_Tests_DailyOrderAllocation.js`（170 已被 Operator Console 占用，改用 140-150 之间的空档） | **Decided，已实作** | 901 modules[] |
| 5 | Sekaligus 合法性判准：至少 1 个可识别订单号即合法，不是至少 2 个——**用真实 2026-W33 PDF 原件第 14 页肉眼核对过**，不是猜测 | **Decided（有真实证据）** | CMP-CR6，900 principles[] |
| 6 | Butiran Tempahan（订单层级）抽取改用 **Gemini 作为 Extraction Adapter + 142 确定性验证**，取代 Phase 2 一度倾向的纯确定性文字/正规表达式解析 | **Decided（方向）**；实作存在但未经真实 API/GAS 验证 | ADR-005，900 adrs[]，governance-draft.md §2.8 |
| 7 | 整份 PDF 一次呼叫 Gemini 是首选，但必须有分页/分块 fallback（安全合并去重、失败不能让整个 Statement 中断） | **Decided（架构要求）**；分块路径的合并逻辑已实作并测试，但从未对真实 Gemini 分块结果验证过能否正确合并 | ADR-005 |
| 8 | Checksum 通过不等于整个 extraction 正确（订单号可能抄错但金额/日期仍对）——验证拆成独立的 Structural / Arithmetic / Traceability 三层，不是只有 checksum | **Decided，已实作** | ADR-005，125_ExtractionValidation.js |
| 9 | W01 的 `A-8PRUR5AGXAQRAV` 解析失败 = 本地 `pdftotext -layout` 文字素材重排造成的**工具层 artefact**，不是 Grab 数据或 142 解析逻辑的问题——**用原始 PDF 第 21 页肉眼核对过**，明确决定不加 workaround | **Decided（有真实证据）** | 901 142 模块条目 |

**Pending / 未最终决定**（明确标出来，不要误读成已批准）：
- Gemini 分块 fallback 的具体切法（目前是"对半切，1 页重叠"）——Phase 4 design 文件里明确写"完全没有真实证据支持任何一种切法比较可靠"，属于**待真实测试后调整**的实作细节，不是已经拍板的方案
- `Daily_Allocation.date` 该不该额外存 `month`——CMP-P6 建议不存，142 目前照建议做，但 142 代码注解里明确留了"如果你有别的理由想存，跟我说"，**这不是 Steven 已经反对存的意思，只是目前默认不存**

---

## 3. 已完成 / 未完成 / Blocked（六类，逐项标注）

### ✅ 已完成且已验证（Node 模拟环境）
- Phase 1 真实 schema 调查（两份真实 PDF，Butiran Tempahan 结构、Insentif/Tip/Bayaran-lain-lain 的可分配程度）——Steven 已确认
- Phase 2 data model + algorithm 设计文件——Steven 已确认，含明确的修正（4 层不是 3 层等）
- `142_DailyOrderAllocation.js` 的文字解析/checksum/日期分配纯逻辑——用两份真实 PDF（W01 跨月、W33 单月）反复验证，逐日/整周 net_delivery_income 可精确重建到分
- Sekaligus 规则修正（≥1 ID）+ W01 artefact 判定——都用原始 PDF 肉眼核对过，不是猜测
- `125/126/127/128` 的订单层级四层验证 + Gemini extraction adapter 骨架——用 mock/fake httpClient 验证过 request 组装、response 解析、四层验证、chunk 合并去重、fallback 编排的**逻辑本身**
- 全部既有 16 组 `runAllXTests()` 零回归（今天重新逐一执行过，不是引用旧结果）
- `195_Tests_GasLoadSimulation.js`（含全部新文件）——今天重新执行，通过

### ⚠️ 已实现但未验证（这是最容易被误读成"做完了"的一类，务必留意）
- `127_LLMExtractor.js` 的 `extractOrders()`——**从未对真实 Gemini API 打过一次真的请求**。这个开发环境没有到 Google API 的网络路由，技术上做不到，不是漏做
- `runGeminiOrderExtractionWithFallback_()` 的分块 fallback + 合并逻辑——只用合成的假资料测过合并算法本身对不对，"真的把同一份 PDF 切两段分别丢给 Gemini，两段结果能不能正确拼回去"这件事完全没有证据
- Gemini prompt 本身的措辞（"不要推断"、"不要计算"等 11 条规则）——**从未验证过 Gemini 实际会不会遵守**，只验证过 prompt 文字本身包含这些规则的字样
- 任何 GAS 特定行为——`UrlFetchApp`/`DriveApp`/trigger 断点续跑——全部只是照 Google 官方文件的行为写代码，Node 环境测不到，从未在真实 GAS 项目跑过
- W01 那笔已知的 fixture artefact——**没有**在 Gemini 抽取路径下重新验证过（因为 Gemini 从未真的跑过），不能假设换了抽取方式这笔就会自动解决

### 🔄 正在进行 / 半成品（这次审计特别要求记录的"做到一半"状态）
**没有真正"做到一半中断"的代码**——142/125/126/127/128 每一次编辑后都立刻用 `node -c` 检查语法、跑过对应测试，中途出现过的语法错误（例如 901 编辑时一度把 `pipeline: [` 整行删掉导致文件损毁）都已经在同一个 turn 内发现并修复，**不存在当前处于损毁状态的文件**。今天审计的重新执行结果（第 0 节）确认了这一点。

如果一定要说"进行中"的东西：`compliance-os-governance-draft.md` 的更新是这次审计过程中做的，范围是新增 §2.7/§2.8、更新 §6/§8/§9 里跟 ADR-004/005 直接相关的部分，**没有对整份 423 行文件做逐行重新校对**——如果这份文件在本次触及范围以外还有其他陈旧内容，这次没有系统性抓出来（本次审计过程中顺手发现并修正了两处不相关的既有 drift：112 的"Drive OCR 已实作"旧说法、CMP-P 数量旧说法，但这是偶然发现，不代表已经全面校验过）。

### ❌ 尚未实现
- `Monthly_Allocation` 实体表——Steven 自己的 Phase 3 指示只要求到 `Daily_Allocation` + 查询用的 date→month 函数，这张表本身没有建
- 108_SheetSetup.js 的对应 Sheet schema——没有定义，没有真的 Sheet
- 110_DocumentImport.js 的接线——`runImportPipeline_` 完全没有调用任何 142 的函数
- 170_OperatorConsole.js 的对应 UI——Console 完全看不到 Daily Allocation 的任何数据
- 历史资料批次回填（原始 handoff 文件的 PHASE 9/10）
- EPF/SOCSO/Tax 计算——明确排除在这次范围外，从未开始

### 🚫 未解决 / Blocked（含原因）
- **真实 Gemini API 验证**——Blocked：这个开发环境没有到 `generativelanguage.googleapis.com`（或其他 Google API 网域）的网络路由。**必须由 Steven 在有 Gemini API key 的真实环境执行**，这个环境技术上做不到，不是优先级问题
- **真实 GAS runtime 验证**——Blocked：这个开发环境不是真的 Google Apps Script 执行环境，`UrlFetchApp`/`DriveApp`/`PropertiesService`/trigger 都只存在于真实 GAS 里。**必须由 Steven 在真实 GAS 项目里跑**
- **W01 那笔 fixture artefact 是否在真实抽取路径下依然存在**——Blocked on 上面两项，因为要先有真的 Gemini 抽取结果才能重新判断

### 🔀 已被后续决定取代（历史，避免误用旧结论）
- Phase 2 一度倾向的「Butiran Tempahan 用纯确定性文字/正规表达式解析，完全不碰 LLM」——**已被 ADR-005 取代**：Phase 3 实测撞到真实的文字重排问题后，Phase 4 改成 Gemini 结构化输出 + 142 确定性验证。如果下一个窗口看到早期 turn 讨论"不要用 LLM"，那是**已经过时的立场**，当前立场以 ADR-005 为准
- 原本提案的 `Failed_Checksum` 独立状态——已被否决，折进既有 `Needs_Review`（见上表 #2）

---

## 4. 当前 Implementation Checkpoint（精确到文件）

**实际改动的文件**（今天对照原始 zip 重新 diff 过，不是凭记忆列的）：

| 文件 | 状态 | 说明 |
|---|---|---|
| `142_DailyOrderAllocation.js` | **新文件** | 564 行。日期解析/checksum/文字解析/Gemini candidate 映射/chunk 合并/fallback 编排，全部纯逻辑（无 GAS 服务调用） |
| `143_Tests_DailyOrderAllocation.js` | **新文件** | 内嵌两份真实 PDF（W01/W33）的 `pdftotext -layout` 抽取文字当 fixture，67 项测试 |
| `125_ExtractionValidation.js` | **既有文件，加法性扩充** | 新增订单层级 Schema/Structural/Arithmetic/Traceability 四层验证函数，statement 层级既有函数一行未改 |
| `126_Tests_ExtractionValidation.js` | **既有文件，加法性扩充** | 新增对应测试 |
| `127_LLMExtractor.js` | **既有文件，加法性扩充** | 新增 `extractOrders()` + Butiran Tempahan schema/prompt，既有 `extract()` 一行未改 |
| `128_Tests_LLMExtractor.js` | **既有文件，加法性扩充** | 新增对应测试 + Phase 4 专属人工验证清单（文件末尾） |
| `900_Constitution.js` | **既有文件，加法性扩充** | 新增 CMP-CR6、ADR-004/005 索引、changelog 条目 |
| `901_System_Architecture.js` | **既有文件，加法性扩充** | 新增 142/143 模块条目，更新 125/127 条目说明，新增 verificationHistory 条目 |
| `compliance-os-governance-draft.md` | **既有文件，扩充+修正** | 新增 §2.7/§2.8（ADR-004/005 完整记录），更新 §6/§8/§9，顺手修正两处发现的既有 drift |

**没有改动**（明确排除，今天 diff 确认过）：110/108/112/115/117/120/121/123/130/140/150/160/170/171/190/195 全部**零改动**；appsscript.json 未改动。

**测试结果**（今天重新执行，非引用）：
- 既有 16 组 `runAllXTests()`：**全部通过，零回归**
- `195_Tests_GasLoadSimulation.js`：**通过**（含全部新文件，无撞名/加载顺序问题）
- `126_Tests_ExtractionValidation.js`：**全部通过**（含新增订单层级测试）
- `128_Tests_LLMExtractor.js`：**全部通过**（含新增 Gemini order-extraction 测试）
- `143_Tests_DailyOrderAllocation.js`：**62/67 通过**，5 项失败**全部**可追溯到同一笔已知的 W01 fixture artefact（见上面「已被验证」的 #9），没有新的、未解释的失败

**中断点**：没有中断——最后一个动作是完成这份 checkpoint 前的最终验证跑分，全部文件语法正常、全部测试组的结果跟这次审计重新执行的结果一致。**下一步是全新的一步（真实环境验证），不是接续某个半完成的编码动作**。

---

## 5. 下一步准确操作

按优先级：

1. **Steven 在真实 GAS 项目里设定好 `GEMINI_API_KEY`（可能已经设定，因为既有 statement 层级抽取已经在用），确认 `extractOrders()` 对真实 W01/W33 PDF 能不能正确跑出结果**——这是唯一一件挡住后面所有事情的事。具体检查清单在 `128_Tests_LLMExtractor.js` 文件末尾的「Phase 4（2026-08-25）新增」区块，逐条对照着做。
2. 确认 W01 那笔 `A-8PRUR5AGXAQRAV` 在真的 Gemini 抽取结果里是否正常（如果正常，证实这纯粹是本地 pdftotext 素材的问题；如果 Gemini 也读不好，需要重新调查）。
3. 确认 W01 跨 3 页的 "Ahad, 4 Januari" 日期分组，Gemini 整份处理时会不会漏抓部分订单。
4. 以上都验证过、且结果良好之后，才考虑：a) 要不要把 142/143 接进 108/110/170（目前完全没接），b) 要不要开始设计 `Monthly_Allocation` 实体表。
5. **在真实证据出现之前，不要**：为 W01 fixture artefact 写任何 workaround；假设分块 fallback 的"对半切"策略是最终方案；把 ADR-004/005 的 status 改成 "Production"。

---

## 6. 新窗口必须先读取的文件

按优先级顺序：

1. **这份 checkpoint 文件本身**——不要跳过直接去读代码或重读整个对话
2. `142_DailyOrderAllocation.js` 顶部的大段注解 + `127_LLMExtractor.js` 里 `BUTIRAN_TEMPAHAN_EXTRACTION_SCHEMA_` 附近的注解——两处都写了完整的设计理由跟已知边界
3. `128_Tests_LLMExtractor.js` 文件末尾的人工验证清单（「Phase 4（2026-08-25）新增」那一段）——真实环境验证要做什么，清单已经列好，不要重新想一遍
4. `compliance-os-governance-draft.md` §2.7/§2.8（ADR-004/ADR-005 完整记录）
5. `900_Constitution.js` 的 `adrs`/`principles` 阵列尾端（ADR-004/005、CMP-CR6）+ `901_System_Architecture.js` 的 142/143 模块条目——比对话记录更权威，如果对话里的描述跟这两个文件对不上，**以这两个文件为准**
6. 如果需要 Phase 1/2 的完整推导过程（真实 schema 调查细节、为什么选四层不选三层等），才需要去读本次对话历史或先前 turn 产出的 `compliance-os-daily-allocation-phase2-design.md`/`compliance-os-phase4-gemini-extraction-design.md` 这两个文件——但这些是设计推导过程，不是当前状态的权威来源，当前状态一律以本 checkpoint + 实际代码 + 900/901/governance-draft.md 为准

---

## 7. 不要重复做的事情 / 不要假设的事情

**不要重复做**：
- 不要重新调查 Butiran Tempahan 的真实 schema——Phase 1 已经用两份真实 PDF 做过，结论在 `compliance-os-daily-allocation-phase2-design.md` 跟 governance-draft.md §2.7
- 不要重新讨论"该不该分四层""该不该存 month"——已经决定，见第 2 节的表格
- 不要重新写 142 的文字解析/checksum 逻辑——已经用两份真实 PDF 验证过能精确重建到分，除非发现真实证据说它是错的
- 不要重新讨论 LLM 该不该碰 Butiran Tempahan——ADR-005 已经决定用 Gemini，Phase 2 时期"完全不用 LLM"的立场已经过时
- 不要重新验证既有 16 组 `runAllXTests()`——今天才重新跑过，全部通过，没有理由怀疟它们

**不要假设**：
- **不要假设这次的代码已经在真实 Gemini API 或真实 GAS 上跑过**——这是整份文件反复强调的一点，因为最容易被后续 turn 不小心当成"已验证"带过去
- 不要假设 W01 那笔 fixture artefact 在 Gemini 路径下也会出现——这纯粹是本地测试工具的产物，没有证据说 Gemini 也会犯同样的错，但也没有证据说不会，必须实测
- 不要假设分块 fallback 的"对半切、1 页重叠"策略是最终方案——这只是"逻辑上说得通、能动"的第一版，设计文件自己就说了没有实证支持
- 不要假设 `compliance-os-governance-draft.md` 现在完全没有陈旧内容——这次审计只处理了跟 ADR-004/005 直接相关、以及顺手发现的两处，没有逐行校对全文
- 不要假设"Decided"等于"Production"——900/901/governance-draft.md 这次新增的每一条都刻意写成两段式（决定层级 vs 验证层级），读的时候两段都要看，不要只看到 "Decided" 就当作可以上生产
