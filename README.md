# phaseP_dup —— Phase P 只读复现脚本

用途：为 `PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md` 提供可重跑的证据。
性质：调查脚本，不是测试套件；**不修改任何文件、不联网、不碰真实 GAS / Sheets / Drive / Gemini**。

## 运行

```
cd <任意目录（不要在 Compliance repo 里面）>
node repro_dup.js <Compliance repo 副本目录>
```

脚本把 repo 目录当作参数、用绝对路径 `require` 被测模块；抽取器（`112_DocumentTextExtractor.js` 的单例）在脚本里被临时替换成假实现，结束时还原。
被测代码里的占位输出（EventPublisher / RiderOSAdapter 的 `console.log`）已被过滤。

## 场景

| 场景 | 内容 | 看什么 |
|---|---|---|
| S1 | 同一批 3 份新文件（各自不同周），全部成功 | `document_id` 是否唯一；Drill-down 指向哪个文件 |
| S2 | 同批 2 份，A 抽取失败、B 成功 | Scan / Recovery Center 如何归类 A；Drill-down |
| S3 | 同批 2 份，同一周、内容不同 | Verified_Income / Reconciliation_Log 重复；160 取哪一行；`totalVerifiedCount` |
| S4 | 相同 file_hash：同一批 vs 分两次执行 | hash 去重在同批失效、分次有效（对照） |
| S5 | 两个执行交错处理同一个文件（用冻结的旧快照**模拟**） | 写入前检查的保护范围 |
| S6 | 三次独立执行，第二份是同一周的不同内容文件 | 永远 needsRetry；每次 Batch 重新处理；对账记录增长 |

`repro_dup.observed.txt` 是 2026-10-23 在 repo 副本上跑出的完整输出。

## 限制

- 全部是内存假对象（`105_TestUtils.js` 的 `fakeSheetAccessor_` / `fakeLockProvider_`）。S5 是对「读—写交错」的模拟，**不是**真实 GAS 并发实验。
- 候选数据沿用 `171_Tests_OperatorConsole.js` 里的合法 candidate 结构（`net=450` 对应 `total_income=500`）。
