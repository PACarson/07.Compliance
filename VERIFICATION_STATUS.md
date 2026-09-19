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
| Production integration verification | — | — | **NOT DONE** | `extractOrders()` 本身准确，但截至本文件建立时，触发它的 `consoleRunDailyAllocation_` 尚未在真实 GAS 环境实际执行过（见下方 Daily Allocation Wiring） |

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
| **Real GAS execution（170）** | Steven 真实执行 `171_Tests_OperatorConsole` | 2026-09-15（两轮） | **第一轮 FAIL**（`require is not defined`，`typeof require` 守卫缺失，pre-existing bug，2 处）→ 修复后 **第二轮 FAIL**（`consoleGetLastFolderId` 断言假设"两版本都回 null"，在有真实 Script Property 值时不成立，测试设计缺陷非生产代码缺陷）→ 已修复，**尚待 Steven 第三轮重新确认** | 截至本文件建立，`171` 的真实 GAS 全数通过**尚未取得** |
| Production integration verification（consoleRunDailyAllocation_ 呼叫真实 Gemini extractOrders）| — | — | **NOT DONE** | 只用假 extractor 测过编排逻辑，从未真实呼叫过 Gemini 的 `extractOrders()` 走这条新路径 |

**明确禁止的推论**：不得因为"160 真实 GAS PASS"就推论"整个 Daily Allocation wiring 已经 production ready"——170 的真实 GAS 验证仍在进行中，`consoleRunDailyAllocation_` 从未真的呼叫过 Gemini。

## GAS Compatibility Bugs Found During Real Verification（2026-09-15）

| 位置 | 性质 | 发现方式 | 状态 |
|---|---|---|---|
| `171_Tests_OperatorConsole.js`（原始行号 87） | 未受保护的 `require()`，GAS 无此全域 | 真实 GAS 执行崩溃 | 已修复（补 `typeof require` 守卫），Node 重跑 PASS，真实 GAS 待确认 |
| `111_Tests_DocumentImport.js:231` | 同类缺陷（全仓库扫描主动发现，非真实执行触发） | Static inspection | 已修复，Node PASS，**真实 GAS 未执行过（PENDING）** |
| `143_Tests_DailyOrderAllocation.js:252` | 同类缺陷（同上） | Static inspection | 已修复，Node PASS（101/106，5 项 pre-existing 失败不变），**真实 GAS 未执行过（PENDING）** |
| `171_Tests_OperatorConsole.js`（`consoleGetLastFolderId` 断言） | 测试设计缺陷，非 GAS 相容性问题 | 真实 GAS 执行产生非预期但正确的结果 | 已修复，Node PASS，真实 GAS 待确认 |

## Compliance Calendar / Reminder OS 串接

| Scope | Evidence source | Date | Result | Limitations |
|---|---|---|---|---|
| Node tests（引擎本身）| 151 | 持续 | PASS | — |
| Real GAS execution | — | — | **NOT DONE** | `Compliance_Calendar` 表目前没有任何真实义务记录；`EventPublisher` 是占位实作，从未真实推送过通知 |

## Historical 9-file-id Provenance（ADR-005 附属，独立未解决项）

confirmed：这批已验证呼叫用同一个 hardcode 的 fixture ID、harness 本身无 runtime override 路径。not confirmed：历史成因、哪个 session、production 是否有对应风险。不因为 ADR-005 CLOSED 而视为已排除。
