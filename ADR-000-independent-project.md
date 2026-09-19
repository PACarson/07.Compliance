# ADR-000: Compliance OS 是独立 GAS 专案，不是 Rider OS 或 Finance OS 的模块

- **Status**: ACCEPTED（历史决策，本次治理建设时恢复记录，不是新决定）
- **Historical date**: Unknown exact date — 证据显示这项决定早于 `compliance-os-governance-draft.md` v0.6（2026-08-01 前后，Architecture Freeze 生效时已经是既定事实），本次治理建设（2026-09-15+）没有改变或重新讨论这项决定
- **Recovery evidence**: `compliance-os-governance-draft.md` §1（"ADR-000（新增，UEF §1a 要求...）"）；`900_Constitution.js` 的 ADR-000 条目

## Context

官方文件（Grab Weekly Statement 等）的导入、解析、对账、验证要不要独立成一个 GAS 专案，还是塞进 Rider OS（已经有 Reward Sheet/Daily Estimate）或 Finance OS（收入的最终消费者）里当一个模块。

## Decision

独立成一个 GAS 专案（即现在的 Compliance OS，前身概念为 "Government OS"）。

## Rationale

官方文件解析涉及的知识（Grab/EPF/SOCSO/LHDN 各自的格式、法规）跟 Rider OS 的日常营运知识、Finance OS 的财富管理知识不是同一个 domain。塞进任何一边都会让该项目背负不属于它的职责，也会违反 ADR-002（Official Truth Principle）——如果解析逻辑长在 Finance OS 里，"只有 Compliance OS 能解析官方文件"这条规则就没有意义。

## Alternatives Considered

- (a) 塞进 Rider OS
- (b) 塞进 Finance OS
- (c) 独立专案 ← 采用

## Evidence

Finance OS 现有 904_Data_Ownership 草案范围明确是净值/目标/资产，没有解析逻辑；Rider OS 范围是营运。两者都不该扩权。

## Consequences

Compliance OS 拥有全部 Official Records（income proof、tax、EPF/SOCSO/EIS、路税、JPJ、保险、证件），Finance OS 只读取 Compliance OS 发布的 Verified Income，不直接读取原始收入来源；Rider OS 与 Compliance OS 通过 ADR-001 定义的 Adapter 模式互动。

## Related

ADR-001, ADR-002
