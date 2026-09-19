# Compliance OS — Governance Foundation

这个目录是 Compliance OS 治理文件的正式入口，建立于 2026-09-15，把原本分散在 `compliance-os-governance-draft.md`、多份 checkpoint/handoff 文件、以及 `900_Constitution.js`/`901_System_Architecture.js` 里的治理内容整理成结构化目录。**旧文件不删除**（历史证据），新决策/新状态查询以这个目录为准。

## 文件职责

| 文件 | 内容 |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统边界、核心流程、CURRENT vs PROPOSED 的明确区分 |
| [MODULE_CATALOG.md](MODULE_CATALOG.md) | 每个模块的职责、数据、依赖、验证状态 |
| [DATA_OWNERSHIP.md](DATA_OWNERSHIP.md) | 每张表/每类数据的所有权与性质分类 |
| [VERIFICATION_STATUS.md](VERIFICATION_STATUS.md) | Node/GAS/真实 Sheet/真实 Gemini/独立来源核对等不同验证层级的现况 |
| [CHANGELOG.md](CHANGELOG.md) | 治理/架构/schema/抽取契约/生产代码变更的记录（区分 Code→Verify→Governance 与 Governance→Authorized Implementation 两种流程） |
| [adr/](adr/README.md) | Architecture Decision Records，含编号规则与状态词汇 |

## ADR 编号与命名规则

见 [adr/README.md](adr/README.md)。

## 如何提出、批准、实施、验证一项架构决策

1. **Code → Verify → Governance**（多数情况）：先看实际代码/先跑验证，确认事实，再写进治理文件。治理文件永远不是先写、代码再去配合。
2. **Governance → Authorized Implementation**（少数情况，例如这次 Production Wiring Slice 的 Architecture Decision）：先有明确的架构决定（通常是 Steven 直接决定），再据此授权实作，实作完成后把验证结果（不是意图）写回治理文件。
3. 两种流程都必须在 ADR 或 CHANGELOG 里说明走的是哪一种，不能事后混淆成"先有 governance 决定，事实自动跟上"。

## 如何记录 superseded / rejected / deprecated / closed

见 [adr/README.md](adr/README.md) 的状态词汇表。核心原则：**旧记录不删除、不改写**，新增字段说明后续状态；`CLOSED` 有专门定义，不等同 `IMPLEMENTED` 或 `VERIFIED`。

## 如何记录尚未验证的实现

任何字段/状态如果没有真实证据支持，必须明确标注 `PENDING`、`NOT YET VERIFIED`、或 `UNKNOWN — REQUIRES VERIFICATION`（视精确程度而定），不得留空造成"看起来已确认"的错觉，也不得用"应该是 XX"这种语气代替明确标注。

## 如何避免治理文件与实际代码脱节

- 每次 Governance 文件更新前，先对照实际代码/实际测试结果核对一次（Discovery Rule：不凭文件名或先前记录推断）
- `compliance-os-governance-draft.md` 本身在 2026-08-25 那次审计就已经抓到过两处这类 drift（112 的 Drive OCR 状态描述过时）——这类 drift 是正常会发生的事，重点是定期核对、发现了就照实修正并注记，不是假装不会发生
- 治理文件不能取代代码和真实运行证据本身——任何时候治理文件跟实际代码/真实环境结果冲突，以后者为准，治理文件需要更新
