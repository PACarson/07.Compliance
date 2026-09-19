# ADR-002: Official Truth Principle（CMP-P1）

- **Status**: ACCEPTED（历史决策，恢复记录）
- **Historical date**: Unknown exact date — 早于 v0.6（同 ADR-000）
- **Recovery evidence**: `compliance-os-governance-draft.md` §3.2；`900_Constitution.js` CMP-P1

## Context

多个 Domain OS（Finance OS 等）都需要用到"这个人这周赚了多少"这类官方/法定事实，如果每个 Domain 自己各自解析原始文件，会有多份不一致的"真相"。

## Decision

只有 Compliance OS 可以解析官方文件、或推导出具有官方性质的结果（Official Result）。其他 Domain 可以自由使用 Compliance OS 已发布的 Verified Result 做自己的下游计算（例如 Finance OS 算净资产），但不能自己重新解析或推导官方性质的原始数据。

## Rationale

避免同一份官方事实在生态里出现多个互相矛盾的版本；把"official 判定"的职责收敛到一个地方，责任边界清楚。

## Consequences

Finance OS 只读 Compliance OS 发布的 Verified Income，不直接读 Grab Statement 原文或自己解析。这项原则贯穿后续所有 ADR（ADR-004/005 的 Gemini 抽取 + 确定性验证边界，本质上都是这条原则的具体落地）。

## Related

ADR-000, ADR-004, ADR-005
