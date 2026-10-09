# ADR-006: PDF Import Recovery Center

- **Status**: **PROPOSED**（整体架构方向——评估/分类方式本身，等 Steven 明确确认才能改 `ACCEPTED`，目前只是外部 AI 起草的 Implementation Authorization Prompt + Steven 转发/延续执行，不等同 Steven 本人明确批准这个架构）。后端代码本身（`consoleGetRecoveryStatus_` 等 4 个函式）已经写完、属于 `IMPLEMENTED`（代码已写），2026-10-07 补做了 mutation testing；UI（`170_OperatorConsole.html` 的「PDF 汇入恢复中心」区块）2026-10-07 也已实作、属于 `IMPLEMENTED`。两者都只经过 Node 测试、未经真实 GAS/浏览器环境，所以都不是 `VERIFIED`。逐层标注，不要把整条 ADR 概括成单一状态——见下方「实作范围」表格。
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
| Node 测试（后端：`171` 约 20 项，涵盖 Pending/Failed/Completed 分类、证据档读取失败、order 层级证据不误判、时间预算提早停止等；2026-10-07 mutation testing 后另外补 4 条断言） | ✅ 全部 PASS |
| Mutation testing（刻意改坏逻辑确认测试真的抓得到） | ✅ 2026-10-07 补做。**后端** 26 种变异：初次有 4 个幸存者——`Completed` 的 `incomeIds` 取错栏位、`Failed` 的 `lastAttemptAt` 被整个拿掉、`consoleRetrySelectedFiles_` 拿掉 `isRetry=true`（会让每次「重试」都新增重复的 Documents 记录，总数 2 → 4，而原有断言只数「原本那两个 id 还在」所以照样通过）、回传少了 `rebuild`——都是原有测试的真实缺口；补 4 条断言（只新增、没改动原有测试）后 26 种全部被抓到。**UI** 30 种变异：1 个幸存者（Completed 分页「不能重试」的守卫没有任何测试碰到），补测试后全部被抓到 |
| 真实 GAS 环境验证 | ❌ 未执行 |
| `170_OperatorConsole.html` 新增 Recovery Center UI（Pending/Failed/Completed 分页、单档/选取多档 Retry 按钮、Filter、Refresh） | ✅ 2026-10-07 已实作，Node 测试 `171` 新增 21 项（从 HTML 抽出真正的函式，配假 DOM + 假 `google.script.run`，手动控制「后端什么时候回来」才测得到进行中状态）。**真实浏览器/HTML Service 里渲染 ❌ 未验证**（`171` 末尾人工验证清单 (a)–(f)） |
| Steven 真实操作验证（`2026-W06.pdf` 这个真实案例是否真的被正确分类、重试后是否真的解决） | ❌ 未执行——UI 已有，等部署到真实 GAS 后由 Steven 实际操作 |

> **2026-10-07 一致性核对（已解决）**：修完 debug 回到 handoff 时，当时上传的 repo 快照（`07_Compliance-main.zip`）里找不到上表「后端逻辑」那一行对应的函式（`consoleGetRecoveryStatus_`/`summarizeEvidenceFailure_`/`consoleRetrySelectedFiles_`/`realEvidenceScanner_`），`171` 也没有对应测试，`127`/`112` 也缺 handoff 的 H/I 项——快照跟这份 ADR 不一致。**同日 Steven 上传了那 5 个档案**（`127`/`112`/`170_OperatorConsole.js`/`128`/`171`），已逐项核对：4 个函式、公开薄壳、测试都在，合并进 repo 后 `128` 94/0、`171`（Steven 版本）103/0。缺档案期间没有凭文字描述重写后端。详见 `VERIFICATION_STATUS.md` 第 11 项。

## UI（2026-10-07 实作；范围刻意守在上表写的那几样）

- **手动读取**：区块有「刷新状态」钮，页面载入时只渲染一句初始提示、**不自动呼叫后端**——后端对每份文件要查一次 Drive 证据资料夹，不该拖慢页面载入（`171` 有测试挡着：页面载入不得出现 `loadRecoveryStatus`）。
- **三个分页**：Failed / Pending / Completed 各自显示数量；首次读取依序落在第一个非空的分页（Failed → Pending → Completed）。Failed 显示失败原因、最近一次尝试时间、证据档份数；Pending 区分「证据档里还没有」跟「证据资料夹没接上、判断不出」（后者另有明确警告，不假装分得出）；Completed 只显示、没有勾选框/Retry。
- **重试一律手动**：只有「单档 Retry」（`consoleRetryFile`）跟「重试选中的」（`consoleRetrySelectedFiles`）两个入口；**没有自动重试、没有「全部重试」**（`171` 以程式结构检查：重试入口的标识符只有这两个）。
- **选取语义**：「重试选中的」只动「选中 ∩ 目前分页+筛选下看得到 ∩ 有 Drive file id」的文件——被 Filter 筛掉看不到的选取不会被偷偷重试；全选也只作用于看得到的。重试后处理过的从选取拿掉，没处理到的（时间预算提早停止）保持选中，再点一次接着做。
- **Filter**：不分大小写，空白分隔的每个词都要命中（AND），比对路径/document id/期间/失败原因/income id。Filter 输入框是静态的，重绘清单不会抢走焦点。
- **进行中的保护**：请求进行中所有 Retry 钮、勾选框、刷新都禁用，再点（含不存在的、没有 file id 的）都不会发第二个请求。
- **诚实的错误处理**：后端回传 `null` / 格式不对（`google.script.run` 传输失败的样子，2026-09-27 `consoleGetDashboard` 撞过）= 明确显示错误、保留上一次的资料并标明、不崩；批次重试回传 `null` = 不假装知道结果、不显示假摘要、重新读取现况。
- **还没做的**：真实 GAS/浏览器验证；窄萤幕排版；这些设计取舍（分页顺序、Filter 语义、选取语义）Steven 尚未逐项审阅，ADR-006 整体架构仍是 `PROPOSED`。

## Related

ADR-004, ADR-005
