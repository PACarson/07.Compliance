# ADR-006: PDF Import Recovery Center

- **Status**: **PROPOSED**（整体架构方向——评估/分类方式本身，等 Steven 明确确认才能改 `ACCEPTED`，目前只是外部 AI 起草的 Implementation Authorization Prompt + Steven 转发/延续执行，不等同 Steven 本人明确批准这个架构）。后端代码本身（`consoleGetRecoveryStatus_` 等 4 个函式）已经写完、属于 `IMPLEMENTED`（代码已写），但只经过 Node 测试、未经真实 GAS 环境，所以不是 `VERIFIED`。UI 完全没开始，连 `PROPOSED` 都谈不上（只有文字 spec，没有代码）。逐层标注，不要把整条 ADR 概括成单一状态——见下方「实作范围」表格。
- **Historical date**: 2026-10-04
- **Recovery evidence**: 本窗口对话记录（Steven 上传的 Implementation Authorization Prompt + 2026-W06.pdf 真实卡住的问题描述）；`170_OperatorConsole.js` 的 `consoleGetRecoveryStatus_`/`summarizeEvidenceFailure_`/`consoleRetrySelectedFiles_`/`realEvidenceScanner_`；`171_Tests_OperatorConsole.js` 新增约 20 项测试

## Context

Steven 真实撞到：`2026-W06.pdf` 从 Google Drive 汇入后，Console 报告"已汇入"，但这份文件从未出现在 Included Statements 里；重新执行汇入也不会让它再次出现在汇入结果中；唯一能让它再次出现的方法是手动删除 Google Sheets 里 `Documents` 表的对应记录，重新汇入。这个做法有数据完整性风险（可能破坏既有登记记录的连续性），也不方便追踪究竟卡在哪个处理阶段。

外部 AI 起草了一份 "Implementation Authorization Prompt"，要求先做一次强制性审计（追完整条 Drive file → Documents registration → PDF reading → extraction → validation → Verified Income → Included Statements 的生命周期，回答 10 个具体问题），再实作一个 Recovery Center，并明确要求"不要只因为文件不在 Included Statements 就推论它失败"。

## 审计发现（追完整条生命周期后确认，逐项有代码证据，不是猜测）

1. **`Documents.status` 这个欄位写入后永远是 `'Imported'`**——`110_DocumentImport.js` 的 `buildDocumentRecord_` 只写这一种值；`TruthWriter` 只增不改（append-only），从来没有、也不可能被改写成 `'Failed'`/`'Verified'` 之类的其他状态。Documents 这个 sheet 本身完全没有能力记录"这份文件后来到底发生了什么"。
2. **`runImportPipeline_`（110）回传的 stage**（`Extraction_Failed`/`Needs_Review`/`Parse_Failed`/`Verify_Failed`/`Already_Verified`/`Verified`）**只存在于那一次呼叫的回传值里，从来没有被写进任何 Sheet**——`consoleBatchImport_`/`consoleRetryFile_` 的回传结果只有发起那次 `google.script.run` 呼叫的页面看得到，刷新页面（`consoleGetDashboard` 重新呼叫）就看不到了，不是"问题解决了"，是这份资料本来就没有要长期保留。
3. **Included Statements（170.html）严格只显示 `Verified_Income` 里、完整落在该月的记录**（`160` 的 `computeMonthlyIncomeSummary_` 算出的 `_computed_from`）——没进 `Verified_Income` 的文件，不管是还没处理、还是处理失败，都"正确地"不会出现在这里，这是设计使然，**不能把"不在 Included Statements"直接当成某个特定失败阶段的证据**（Implementation Authorization Prompt 自己也明确要求不要这样推论）。
4. **`consoleScanFolder_` 的 `needsRetry` 分类（审计报告 HIGH-3，2026-08-23）逻辑本身是对的**：Documents 有记录但查无对应 Verified_Income 时标成 `needsRetry: true`，下一次 `consoleBatchImport_` 的候选清单（`scan.files.filter(f => !f.alreadyImported)`）会自动包含它、自动重试——**不需要手动删除 Documents 记录，自动重试机制本身没有坏**。
5. **真正的缺口**：`consoleScanFolder_` 依赖一次即时的 Drive 资料夹扫描，而且它的结果只活在那一次 `google.script.run` 呼叫的回传值里——操作者没有一个可以几小时后回来、不用重新扫描资料夹、不用重新触发一次昂贵批次抽取，就能看到"哪些文件还卡着、卡在哪里"的持续性检视画面。Steven 手动删除 Documents 记录，实际上是在用"强迫它变成全新文件"这个笨办法，换取一个他知道一定看得到结果的重新汇入——不是自动重试逻辑真的坏掉，是没有一个地方可以不动声色地回去看现状。

## Decision（后端部分，已实作+已 Node 测试）

新增 `consoleGetRecoveryStatus_(deps)`——不依赖即时 Drive 资料夹扫描，只读 `Documents`/`Verified_Income`/证据资料夹既有内容，重建现状：

- 有 `Verified_Income` 匹配 → **Completed**（只带 `documentId`/`driveFileId`/`drivePath`/`incomeIds`/`period` 最少欄位，不复制 `Verified_Income` 完整内容——Included Statements 本来就是这些资料的权威呈现，这里只是给 Recovery Center 一个"这份不是卡住的"确认，不建第二个 source of truth）
- 没有 `Verified_Income` 匹配，且证据资料夹里找不到任何 `${document_id}__*.json`（排除 `orders:` scope tag，那是 Daily Allocation 层级的证据，不在这次范围内）→ **Pending**（还没真的被抽取尝试过）
- 没有 `Verified_Income` 匹配，但证据资料夹里找得到至少一份 → **Failed**（真的打过 Gemini，但没能走到 Verified_Income）；`summarizeEvidenceFailure_` 读最新一份证据档内容摘出人看得懂的原因（优先序：API 错误 > finishReason 不是 STOP > candidate 是 null > 已切换模型但仍失败 > 验证没过）；`attemptCount` 数有几份证据档

新增 `consoleRetrySelectedFiles_(fileRefs, deps)`——沿用既有 `consoleImportOneDriveFile_`（跟 `consoleBatchImport_`/`consoleRetryFile_` 共用同一个函式，不是新的处理引擎），比照 `consoleBatchImport_` 的时间预算安全机制逐一处理，接近预算就提早停止、回报 `stoppedEarly`/`remainingCount`，不会被 GAS 平台硬杀。

新增 `realEvidenceScanner_()`——真的调 Drive API 列出/读取证据资料夹内容那一层，跟既有 `realFolderScanner_` 同一个模式（只能在真实 GAS 环境跑，Node 测不了，透过 `deps.evidenceScanner` 注入）。

公开薄壳：`consoleGetRecoveryStatus`、`consoleRetrySelectedFiles`（170 既有的"不带底线公开转发"惯例）。

## 一个真实的 Schema 缺口（已识别，这次不解决）

现有资料模型完全没有欄位记录"最后处理到哪一步/为什么失败/尝试过几次"——Documents 表是 append-only、单一 `'Imported'` 状态。上面的 Decision 用「证据档案是否存在」这个既有、从未被使用过的信号去推断 Pending/Failed，是刻意选择的、沿用既有架构的替代方案（不发明新的持久化欄位、不开新的 database、不发明新的 lifecycle——Implementation Authorization Prompt 明确要求的边界）。这个替代方案的已知限制：

- 无法区分"这次重试" vs "上次重试"的证据档案时间差太近时的真正尝试间隔
- `lastError` 是从证据档案内容现场摘出来的，不是一个持久化欄位本身——如果 127 未来改了 evidence 的 schema，`summarizeEvidenceFailure_` 可能需要跟着更新
- 如果 Steven 想要更精确的「阶段」追踪（例如区分 Drive 读档失败 vs LLM 调用失败 vs 验证失败），现有证据档案只覆盖「LLM 调用」这一段——Drive 读档失败（档案被移动/权限问题）目前不会产生任何证据档案，会被归类成 Pending 而不是一个更精确的「Drive 存取失败」分类，这是本 ADR 没有解决的已知限制

## 实作范围（诚实列出，不要合并成一句"做完了"）

| 项目 | 状态 |
|---|---|
| 审计（10 个问题，追完整生命周期） | ✅ 完成，代码证据见上方「审计发现」 |
| `consoleGetRecoveryStatus_`/`summarizeEvidenceFailure_`/`consoleRetrySelectedFiles_`/`realEvidenceScanner_`（后端逻辑） | ✅ 已实作 |
| Node 测试（`171`，约 20 项，涵盖 Pending/Failed/Completed 分类、证据档读取失败、order 层级证据不误判、时间预算提早停止等） | ✅ 全部 PASS |
| Mutation testing（刻意改坏逻辑确认测试真的抓得到） | ❌ 未执行——这批新测试目前只确认「现在的代码行为符合预期」，没有额外验证「测试本身真的会在逻辑写错时失败」，跟这次窗口其他部分（例如 127 的重试逻辑）的验证严谨度不一致，诚实记录这个落差 |
| 真实 GAS 环境验证 | ❌ 未执行 |
| `170_OperatorConsole.html` 新增 Recovery Center UI（Pending/Failed/Completed 分页、单档/选取多档 Retry 按钮、Filter、Refresh） | ❌ 未开始 |
| Steven 真实操作验证（`2026-W06.pdf` 这个真实案例是否真的被正确分类、重试后是否真的解决） | ❌ 未执行——等 UI 做完才有办法让 Steven 实际操作 |

## Related

ADR-004, ADR-005
