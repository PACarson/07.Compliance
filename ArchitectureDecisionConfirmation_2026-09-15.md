# Architecture Decision Confirmation — Separate Daily Allocation Execution Boundary

**未修改任何代码。这份只是确认文件，等你回复后才动 110/160。**

---

## 1. 当前 110 execution boundary

`runImportPipeline_` 是一次完整、同步的 GAS execution：`importDocument_`（去重+写 Documents）→ `DocumentTextExtractor.extract()`（127 的 `extract()`，一次 Gemini 呼叫，statement 层级周总额）→ 验证/normalize → `verifyAndPublishIncome_`（写 Verified_Income，这一步完成即代表 durable persisted）→ `runReconciliationForWeek_`（non-blocking，try/catch 包住，失败只记 WARN）。触发来源：Console 的 `consoleBatchImport_`/`consoleManualImport`，每次对应一份新导入的 PDF。这个 execution 完成时，Verified_Income 要嘛已经落地，要嘛整条链在落地前就已经带着明确的失败状态（Extraction_Failed/Needs_Review/Parse_Failed 等既有阶段名）结束——不会有"卡在中间"的暧昧状态。

## 2. 当前 142 execution boundary

现在生产环境里不存在——这正是原本的 gap。按这次的设计，Execution B 是一个**独立触发**的 GAS execution：输入是一个已经存在的 `verified_income_id`（不是当次 import 的任何变量），执行 `runGeminiOrderExtractionWithFallback_`（内部自己打一次 `extractOrders()`）→ `writeDailyAllocationBatch_`。触发方式我建议沿用项目现有的 wrapper-function 惯例（CMP-CR5）：新增一个公开的 `consoleRunDailyAllocation`（转发到新的 `_` 实作），让 Console 在任何 Needs_Allocation 记录旁边给一个"Run Daily Allocation"的按钮——每次点击就是一次全新的、独立的 `google.script.run` 呼叫，天然就是分开的 execution，不需要 trigger/scheduler。这符合你 Section 6 说的"不要新增 generic scheduler"，也符合"复用现有 142 API"。之后 Historical Backfill 要处理多笔时，会重复呼叫同一个函数、每条记录各自一次 execution，不是我这次要做的事，但设计上是兼容的。

## 3. 为什么不能在同一次 execution 中安全完成

Gate 2 那批真实数据：`extractOrders()` 单次 115–289 秒。110 现有流程本身（extract + 验证 + 写入 + reconciliation）也不是瞬间完成——Gate 1/2 早期就真实撞过 360 秒上限一次（2026-09-04，后来是靠换到更快的模型才稳定下来，不是靠加大 timeout）。两个都放进同一次 execution，跨月周会真实地有机会撞 360 秒硬限，而 GAS 撞到执行上限时不是"优雅失败在某个检查点"，是被强制中止，中止的确切时间点决定了当时写到哪一步——这跟这个专案一路要求的"每个阶段都要有明确的结果状态"是冲突的，不能靠"这种情况很少见"带过去。

## 4. Verified Income 如何作为 durable handoff

`verifyAndPublishIncome_` 在 Execution A 返回之前，就已经把一行写进 Verified_Income 这张真实 Sheet（透过 TruthWriter）——这个写入独立于 Execution A 这次呼叫本身的生命周期，Sheet 是持久存储，不是内存。Execution B 不管是接下来立刻跑、还是几小时/几天后才跑，都只需要重新去读这张 Sheet，不依赖 Execution A 当时任何变量、UI 状态或执行期缓存——这正是你 Section 5 写的那几条"不得依赖"的反面：它依赖的只有 Sheet 里那一行是否存在。

## 5. verified_income_id 如何连接 A → B

Verified_Income 自己的主键栏位是 `income_id`（例如 `CMP-INCOME-2026-W01` 这种形状，110 的 reconciliation 那段已经在用这个栏位）；`Daily_Allocation` 表把它存成 `verified_income_id` 栏位——两边栏位名字不同，存的是同一个值。Execution B 收到的输入就是这个 id 字符串，用它去读 Verified_Income 那一行（拿 period_start/period_end/document 相关字段），再用它当 `verified_income_id` 写进 Daily_Allocation。这条连接完全靠这一个字符串，不靠位置、不靠"最近一次"这种隐含状态。

## 6. 142 如何独立 retry

不需要新机制——现有的 `writeDailyAllocationBatch_` 已经有 skip-if-latest-already-`Fully_Allocated`（`force:true` 可覆盖）的守卫。重试就是拿同一个 `verified_income_id` 再呼叫一次 Execution B：如果上一批已经是 `Fully_Allocated`，默认直接跳过（不会重复写、不会重复计入）；如果上一批是 `Needs_Review`（没成功），这个守卫不会拦，会正常产生新的一批（新的 batch_id，因为是 timestamp-based）重新尝试。也就是"能不能安全重试"这件事，现有代码已经处理好了，不需要为这次 wiring 另外发明。

## 7. 160 如何消费完成后的 Daily_Allocation

目前 160 完全不知道 Daily_Allocation 存在。设计上：`computeMonthlyIncomeSummary_`（以及 YTD 版本）在遇到一笔被 `computeMonthlyAllocation_` 判成 `Needs_Allocation` 的 Verified_Income 记录时，改成先用它的 `income_id` 去查 142 已经有的 `getLatestDailyAllocationRows_`——如果最新一批的 `allocation_status` 是 `Fully_Allocated`，就把这批 Daily_Allocation 的每一行按 `allocation_date` 分月加总，分别计入对应月份，而不是整周排除；如果查不到、或最新一批还是 `Needs_Review`，维持现有的排除行为不变。这是纯粹的"查询时判断"（跟 160 一直以来 compute-on-demand 的风格一致），160 完全不需要知道 Execution B 是什么时候、被谁触发的。

## 8. failure 时数据处于什么状态

Execution A 在 `verifyAndPublishIncome_` 成功之前失败——跟现在完全一样，没有 Verified_Income 可言，Execution B 无从谈起。Execution A 成功之后，不管 Execution B 有没有跑、跑了没跑成、还是跑到一半被 GAS 中止——**Verified_Income 那一行完全不受影响，不会被回头修改或作废**。Execution B 本身如果失败（Gemini 例外、超时、验证不过），既有的 `runGeminiOrderExtractionWithFallback_` 设计本来就"全部路径都不抛例外，失败明确回 `Needs_Review`"——所以结果只有两种：`Fully_Allocated`（160 才会拿来用）或 `Needs_Review`/没有任何 Daily_Allocation 记录（160 维持现在的排除+清楚列出待处理）。不会有"看起来处理过、其实数字是错的"这种中间态。

## 9. 为什么这个设计不会破坏 ADR-005

ADR-005 关的是 `extractOrders()` 这个函数本身给定同一份档案时结果可不可靠（period/checksum/已知案例）——这份 Gate 2 证据完全不依赖这个函数是从哪个 execution context 被呼叫的。这次决定完全没碰 Gemini model、prompt、schema、`runGeminiOrderExtractionWithFallback_` 内部逻辑、checksum 定义——只改了"这个已经验证过、没有任何改动的函数，从什么时候、从哪里被呼叫"。ADR-005 管的是正确性，这次决定管的是执行排程，两件事互不影响。

---

## 需要你确认或补的一点

Section 14 说"如果不需要就不要为了形式主义新增 ADR"——我的判断是不需要：这次没有新的 data ownership、没有新的 schema、没有改变任何 invariant，纯粹是执行排程决定，不构成一个新的架构原则。如果你觉得这个 execution-boundary 原则本身值得记录下来（例如未来其他 Domain OS 遇到类似"重 processing step 该不该跟 import 同一次执行"的问题时可以直接引用），可以事后作为 900 的一条 principle 补一句，不需要专门开一个新 ADR——但这个我不会自己决定要不要加，等你说。

---

*等你确认这份设计后，才会开始改 110/160。本轮没有修改任何代码，没有碰 127/125/142，没有做历史回填。*
