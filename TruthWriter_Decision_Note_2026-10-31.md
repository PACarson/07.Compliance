# TruthWriter 写入边界决策说明（TruthWriter Decision Note）

| 项 | 值 |
|---|---|
| **状态** | **DESIGN ONLY** |
| **本轮是否修改代码** | **NO**（没有修改任何业务代码、测试代码、治理文件或正式配置；只读检查 + 文档交付） |
| **是否运行真实 GAS** | **NO**（也没有访问或修改任何生产数据、没有新增 Sheet、没有调用 Gemini） |
| **是否部署** | **NO** |
| **尚未解决的阻塞事项** | 见下方 B-1 … B-5（全部是 UNVERIFIED / BLOCKED / PENDING，不是"已知没问题"） |
| 文档日期 | 2026-10-31 起草，2026-11-01 定稿（Asia/Kuala_Lumpur；文件名沿用本轮日期后缀） |
| 对应任务 | 2026-10-29 来信「Compliance OS — S1 Final Design 收敛任务」§4-B |
| 同批文件 | `S1_Final_Design_2026-10-31.md`、`S1_Test_Plan_2026-10-31.md`（本轮只交付这三份） |

**尚未解决的阻塞事项**

| # | 标记 | 内容 |
|---|---|---|
| B-1 | **UNVERIFIED** | 真实 GAS 的锁与 `flush` 行为没有任何仓库内证据：`waitLock(10000)` 超时是否抛异常；同一次执行里再次获取同一个脚本锁会怎样；`appendRow` 之后不 `flush`，另一个执行是否立刻读得到；`appendRow` 失败是否可能留下半行。`116_Tests_TruthWriter.js:60–61` 的人工验证项（并发写入时锁是否真的排队）至今未勾；`MODULE_CATALOG.md:44` 写着「真实 GAS 验证过」但没有说明验证了哪些项，**不能当作锁语义的证据**。官方 Lock 文档本会话重新抓取时被拒绝（`PROVENANCE_REQUIRED`），**没有绕过**；之前经工具转述的内容只算线索。 |
| B-2 | **UNVERIFIED** | UCR6 的原文不在本仓库：`900_Constitution.js:204` 只说 CMP-CR「建立在 UEF 的 UCR1-7 之上」；UCR6 只在 `115_TruthWriter.js:3`、`901_System_Architecture.js:132`、`MODULE_CATALOG.md:43` 等处被引用。本文把 UCR6 理解为「Sheet 写入唯一出口、只追加」，这是从这些引用处读出来的，不是原文。 |
| B-3 | **UNVERIFIED** | 基线是 10-21 上传的 `07.Compliance-main.zip` 的只读工作副本（77 个文件）。之后你如果改过任何文件，本文不知道。 |
| B-4 | **UNVERIFIED** | 本轮禁止访问真实 Sheet：真实表头有没有漂移、真实并发有多频繁、现存数据长什么样，均未知。 |
| B-5 | **PENDING（待你决定）** | 是否批准 Architecture Freeze 例外去改已批准的 `115_TruthWriter.js`（`compliance-os-governance-draft.md:420`）。这决定推荐方案能不能落地（见 §6、§12）。 |

证据标签：【源码证实】= 我这一轮亲自读过那一行；【设计建议】= 我的设计判断；【UNVERIFIED】= 没有证据，不得当事实；【待确认】= 需要你决定或你去核对。所有行号都指向 B-3 所说的基线副本。

---

## 0. 结论摘要

1. **推荐方案 A，且采用"通用的受保护追加能力"的形状**：在 `TruthWriter` 里新增**一个**通用方法，把「新鲜读取 → 调用方给的纯函数判断 → 追加 → flush」放进**同一把锁**；S1 的领域规则（键、序号、证据检查）留在 S1 自己的纯函数里，**不进 `115`**。既有的 `appendValidatedRow` 一行不动。【设计建议】
2. **条件**：你批准 Freeze 例外。不批准则退到 **B1**（外层持锁，内层复用 `createTruthWriter_` 但注入空操作锁；不改任何已批准文件），并且必须同时满足 §6.3 的 5 条守则。**B2（绕过 `appendValidatedRow` 直接 `appendRow`）和 B3（在外层锁里调用带锁的单例，嵌套获取脚本锁）不推荐。**
3. **最小变更范围**：方案 A = 只改 `115_TruthWriter.js` 一个已批准文件，且全部是新增（约 30–50 行，**估计值，不是测量值**）；其余全部是新文件。方案 B1 = 不改任何已批准文件。详见 §9。
4. **无论选 A 还是 B1，并发保护是否真的成立，都取决于 B-1 里那些没验证的 GAS 行为。** 在真实 GAS 验证（`S1_Test_Plan` 的 V3–V5）完成之前，只能对外声称：「设计上，检查与追加在同一个锁范围内；Node 模拟通过」，**不能**声称「已验证并发安全」。S1 的安全底线因此不依赖锁：**重试收敛**（同一请求重发，要么写入，要么 `Already_Recorded`）+ **有效视图吸收相同重复**。
5. 三条必须说清楚的现状事实：（a）现有 `appendValidatedRow` 完全不做幂等——「是否已存在」的检查在调用方、在锁外、用旧快照（§3）；（b）本决策**不修复** Phase P 的 Verified_Income 重复风险，那是另案授权；（c）`TruthWriter` "只追加"的意图目前**没有**被测试守住：契约测试只断言有 `appendValidatedRow`（`190_Tests_Contracts.js:42`）。

---

## 1. 方法与范围

- 只读：读了 `115_TruthWriter.js`（全文）、`117_SheetReader.js`、`116_Tests_TruthWriter.js`、`105_TestUtils.js`、`108_SheetSetup.js`、`109_Tests_SheetSetup.js`、`190_Tests_Contracts.js`、`140_VerifiedIncome.js`、`170_OperatorConsole.js`（写入前存在性检查与 `readAll` 调用点）、`106_Utils.js`、`900_Constitution.js`、`MODULE_CATALOG.md`、`VERIFICATION_STATUS.md`、治理草案相关行。
- 没有运行任何测试、脚本或 GAS；没有改动任何文件。文中所有"测试会怎样"都是**设计预期**，不是已执行结果。
- 先核对契约（§2、§3），再比较方案（§4–§5），最后才给推荐（§6）——这是来信 §4-B 的顺序要求。

---

## 2. 现有契约核对（锁 / 校验 / 追加 / 失败处理 / 读取）

| # | 契约点 | 现状（【源码证实】） | 证据 | 对 S1 的含义 |
|---|---|---|---|---|
| C1 | 工厂与注入 | `createTruthWriter_(sheetAccessor, lockProvider)`；JSDoc 只声明访问器有 `appendRow`；真实访问器 `gasSheetAccessor_()` 另有 `getAllRows`（供 `SheetReader` 用） | `115:19–22`、`115:73–88`、`117:33` | 访问器和锁都是依赖注入，Node 测试可换假件；新增能力可以只加方法，不改既有签名 |
| C2 | 校验 | 只做两件事：`rowObject` 为空则抛错（**在锁外**）；按 `columnOrder` 取值，`undefined` 抛错（缺栏位），`null` 转 `''`（**在锁内**）。**不检查类型、格式、取值范围、是否重复** | `115:32`、`115:36–38`、`115:41` | 现有"校验"只保证栏位齐全（CMP-P10）；金额位数、日期真伪、枚举、外键、幂等全都不在这里，S1 必须自己做 |
| C3 | 参数顺序 | `appendValidatedRow(sheetName, rowObject, columnOrder)`，返回实际写入的数组 | `115:31`、`115:44` | 返回值没有 outcome，调用方无法区分「新写入」与「别的情况」 |
| C4 | 加锁范围 | `lockProvider.withLock(...)` 包住「按栏位取值 + `appendRow`」，**仅此而已** | `115:33–45` | 检查"是否已存在"不在这个范围内 |
| C5 | 真实锁实现 | `getScriptLock()` → `waitLock(10000)` → `try { return fn(); } finally { releaseLock(); }`；**没有 `flush`** | `115:90–102`（`:93`、`:94`、`:95–99`） | 脚本级锁，10 秒等待；超时行为与 flush 必要性 **UNVERIFIED**（B-1） |
| C6 | 追加 | 真实访问器：缺 Sheet 抛错；否则 `sheet.appendRow(rowArray)` | `115:75–79` | 失败只能靠异常；`appendRow` 自身的失败原子性 UNVERIFIED |
| C7 | 失败处理 | 没有返回码、没有 try/catch、没有阶段信息：栏位校验异常、缺 Sheet 异常、锁超时异常，对调用方都是"抛了个错"，**无法判断抛错之前有没有写进去** | `115:31–46`、`115:90–102` | S1 需要"阶段化的失败结果"才能做到可识别、可恢复（§5 点 3） |
| C8 | 读取 | 真实 `getAllRows`：缺 Sheet 抛错；`lastRow < 2` 返回 `[]`；否则 `getRange(2, 1, lastRow-1, getLastColumn()).getValues()`（**跳过第 1 行表头**） | `115:80–86`（`:82`、`:84`、`:85`） | 「读取失败 = 异常，没有记录 = `[]`」这条区分在底层已经存在；但**表头漂移读不出来** |
| C9 | 读取校验 | `SheetReader.readAll`：行宽与 `columnOrder` 不符则抛错；按位置映射，**不校验表头文字** | `117:32–42`（`:33`、`:35–37`） | 栏位被插/删会在读取时抛错（fail closed）；但"表头被改名、栏数不变"读不出来 |
| C10 | 表头校验时机 | 只在建表/升级时：`ensureSheetSchema_` 逐栏比较表头，不一致抛错 | `108_SheetSetup.js:140–148` | 读写路径上没有表头校验；S1 要自己加一道前置检查（见 Final Design §8） |
| C11 | 单例与接线 | `TruthWriter` 单例（GAS 环境才创建）；`buildConsoleDeps_` 把它注入控制台 | `115:106–108`、`170_OperatorConsole.js:151–153` | 全局作用域里谁都能直接引用单例——"别在外层锁里误调单例"只能靠测试与评审，无法靠结构（§6.3） |
| C12 | 测试契约 | `116` 有 3 个用例（栏位排序与写入内容一致、缺栏位抛错、`null` 转空字符串）；`190:42` 只断言 `TruthWriter` **有** `appendValidatedRow`；没有任何测试断言"**没有**别的方法" | `116_Tests_TruthWriter.js:14–36`、`190_Tests_Contracts.js:42` | "只追加"是现状，不是被守住的约束（来信 §5 已知风险第 1 条） |
| C13 | 测试替身 | `fakeSheetAccessor_`：`getAllRows` 永远不抛错，缺 Sheet 也只返回 `[]`；`fakeLockProvider_`：`withLock(fn){ return fn(); }`，没有互斥 | `105_TestUtils.js:27–38` | 现有替身**既不能模拟读取失败，也不能模拟并发交错**；S1 测试必须自带失败注入与交错替身（见 Test Plan §2） |
| C14 | 真实 GAS 验证状态 | `116` 的人工清单里「并发写入时锁真的排队」未勾；`MODULE_CATALOG.md:44` 写「Node PASS；真实 GAS 验证过」但不分项 | `116_Tests_TruthWriter.js:60–61`、`MODULE_CATALOG.md:43–44` | 锁语义没有可引用的真实 GAS 证据（B-1）；"验证过"的范围【UNVERIFIED】 |

---

## 3. 现有"存在性检查"的调用路径：确实在锁外、用的是调用方带来的快照

来信 §5 要求"核对具体调用路径"。以下是本轮读到的路径（不是全部写入点，只是与"先查后写"有关的）：

| 路径 | 存在性检查 | 在锁内？ | 证据 |
|---|---|---|---|
| `verifyAndPublishIncome_`（Verified_Income 写入） | `existingIncomeIds.indexOf(record.income_id) !== -1`，`existingIncomeIds` 由**调用方传入**；通过后才 `writeVerifiedIncome_` → `appendValidatedRow` | **否**：锁只包住 `appendValidatedRow` 内部 | `140_VerifiedIncome.js:189–198`（`:191`）、`:167–169`、`115:33` |
| `consoleImportOneDriveFile_` | 用调用方给的 `documentsRowsSnapshot` / `verifiedIncomeSnapshot`；没给就自己 `readAll` 一次；之后整个管线用这份快照做重复判断 | **否** | `170_OperatorConsole.js:234–237` |
| `consoleBatchImport_` | 批次开始前**一次性**读 Documents 与 Verified_Income，之后整批共用同一份快照 | **否**（且批次内快照会变旧） | `170_OperatorConsole.js:314–315`；另见 `:533–534` |
| 重试 / 去重路径 | `existingHashes`、`existingIncomeIds` 来自 `readAll` | **否** | `170_OperatorConsole.js:575–576` |
| 每日分配写入 | `existingDailyAllocationRows = readAll('Daily_Allocation')`，然后 `writeDailyAllocationBatch_(...)` | **否** | `170_OperatorConsole.js:870–871` |

**含义**：现有"先查后写"是三步（读快照 → 判断 → 加锁写），只有最后一步在锁里。我方上一轮的 Phase P 调查用 Node 模拟复现了这种结构下的重复（同批多文件、同批相同内容、两次执行的读都早于对方的写；见 `PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md:131–133` 的 R3–R5 与 `tooling/phaseP_dup/repro_dup.observed.txt`）——那是 **Node 模拟，不是真实 GAS 观察**。另外，现有 id 里混入时间戳的地方（`110_DocumentImport.js:47`、`:210`；`130_Reconciliation.js:103`；`150_ComplianceCalendar.js:172`）说明"重试产生不同 id"是现有风格，S1 **不得沿用**（来信 §5 第 3 条：时间戳不应未经分析就充当稳定身份）。

读取失败在调用点的处理也不统一（与 §5 点 5 相关）：`170:234–259` 与 `170:821–885` 的 `try/catch` 把异常转成带 `error` 的结果对象；`170:804–808` 的 `readAll` 在 `try` **之外**，异常会直接冒出去；找不到记录与读取失败在这些结果里都叫 `status: 'Error'`，只靠文字区分（`170:806–807`）。S1 要求两者是**不同类型的结果**（见 Final Design §8）。

---

## 4. 方案定义

> 下面的代码形状是**设计草图**，用来说明边界在哪里；它不是实现、不得直接复制进仓库，名字（`appendGuarded` 等）是暂定名，不构成 API 承诺。

### 4.1 方案 A：在受控写入边界内提供幂等追加能力

在 `createTruthWriter_` 返回的对象里新增一个**通用**方法（暂定名 `appendGuarded`），签名 `(sheetName, columnOrder, decide)`：

```
phase = 'LOCK'
return lockProvider.withLock(() => {
  phase = 'READ';    rows = sheetAccessor.getAllRows(sheetName)           // 锁内新鲜读取；异常 → 不追加
  readOther = (name) => sheetAccessor.getAllRows(name)                   // 同一把锁内读别的表（外键检查用），只读
  phase = 'DECIDE';  d = decide(rows, readOther)                         // 调用方给的纯函数；拿不到任何写入对象
  if (d.action !== 'append') return { outcome: d.outcome, written: 'NO', detail: d.detail }
  phase = 'APPEND';  row = columnCheck(columnOrder, d.rowObject)         // 语义与 appendValidatedRow 相同：undefined 抛错、null → ''
                     sheetAccessor.appendRow(sheetName, row)
  phase = 'FLUSH';   if (sheetAccessor.flush) sheetAccessor.flush()      // GAS 访问器新增；旧假访问器没有也行
  return { outcome: 'Appended', written: 'YES', row }
})
// 锁外 catch：return { outcome: 'Failed', phase, written: (phase 是 APPEND 或 FLUSH) ? 'MAYBE' : 'NO', error }
```

要点：
- **通用**：`115` 里没有任何 S1 领域规则（键、序号、证据、金额、日期都不在这里）；这些在 S1 的纯函数 `decide` 里，Node 里不需要任何 GAS 就能测。
- **单一锁范围**：读、判断、追加、flush 在同一次 `withLock` 里，中间没有空隙。
- **不嵌套**：`decide` 只拿到"读"，没有写入对象；方法内部不调用 `appendValidatedRow`（否则会嵌套同一个注入锁），所以栏位检查要有一份自己的实现（约 8 行），与 `appendValidatedRow` 的检查做**一致性测试**（见 Test Plan）。
- **返回类型化结果而不是抛异常**：与控制台层"永远回明确的结果状态，不留没接住的例外"的既有原则一致（`170_OperatorConsole.js:815–820` 的注释）。
- **`outcome` 的取值由调用方定义**：原语只透传 `decide` 返回的 `outcome` 与 `detail`，自己只产生 `Appended` 与 `Failed`；S1 使用的全部取值（`Already_Recorded` / `Conflict` / `Stale_Sequence` / `Rejected(code)` 等）见 Final Design §4.7 与 §9.2。
- 既有 `appendValidatedRow`、`gasLockProvider_`、单例装配一行不动。

### 4.2 方案 B：外层持锁、内部复用现有写入函数

来信把 B 定义为"外层持锁、内部复用现有写入函数"。`115` 的结构允许三种做法，后果差别很大：

| 变体 | 做法 | 评价 |
|---|---|---|
| **B1** | S1 服务层自己 `withLock`：锁内读 → `decide` → 用 `createTruthWriter_(gasSheetAccessor_(), 空操作锁)` 这个**内层 writer** 调 `appendValidatedRow` → 锁内 `SpreadsheetApp.flush()` | 唯一可行的 B。不改任何已批准文件；栏位检查与 `appendValidatedRow` **逐字一致**（因为就是它）；代价：锁的所有权分到两处，生产代码里出现一个**无锁的 writer 实例** |
| **B2** | 外层持锁，但不经 `appendValidatedRow`，直接调 `sheetAccessor.appendRow` | **不采纳**：绕过唯一写入出口与栏位检查，违反 UCR6 的字面意思（`115:3–5`） |
| **B3** | 外层持锁，内部调用**带锁的单例** `TruthWriter.appendValidatedRow` | **不采纳**：同一次执行里嵌套获取同一个脚本锁，行为 **UNVERIFIED**（B-1）；可能直接自锁到超时，也可能无害——不能拿未知行为做基础 |

---

## 5. 来信要求的六点分析

| # | 问题 | 基线：现状原样使用 | **方案 A** | **方案 B1** | B2 / B3 |
|---|---|---|---|---|---|
| 1 | 幂等检查与追加是否在**同一个并发保护范围** | **否**。检查在锁外、用旧快照（§3）；锁只包栏位取值 + `appendRow`（`115:33–45`） | **是，由结构保证**：读、判断、追加、flush 在同一次 `withLock` 里，调用方没有办法把它们拆开 | **是，但由约定保证**：取决于每个 S1 调用点都在 `withLock` 里完成"读→判断→写"，没有结构手段阻止谁绕开 | B2：外层锁是同样的约定；B3：范围成立，但嵌套锁行为 UNVERIFIED |
| 2 | **重试会不会产生重复记录** | **会**（Phase P 的 Node 复现；现有 id 含时间戳 `110:47`、`150:172`） | **不会**：键由业务事实确定；锁内按「同键同序号同内容 → `Already_Recorded`；同状态 → `Already_Recorded`」判断。注意：**重试安全来自确定性键 + 锁内比较，不来自锁本身**——锁只保证比较时没有人在旁边写 | 同 A | 同 A（B2/B3 只在锁的归属上有差别） |
| 3 | **部分失败如何识别与恢复** | **无法识别**：全是异常，无阶段、无"是否已写"（C7） | **阶段化结果**：`LOCK / READ / DECIDE` 阶段失败 → `written: NO`（确定没写）；`APPEND / FLUSH` 阶段失败 → `written: MAYBE`（可能写了）。恢复统一为「**原样重发**」：没写 → `Appended`；写了 → `Already_Recorded`；**不会两行**。多行操作（证据 → 付款 → 链接）每步各自幂等，重跑收敛 | 同 A，但阶段标注要由 S1 服务层自己实现 | B3 的 `LOCK` 阶段失败含义不明（可能是自锁） |
| 4 | **是否保留历史、不覆盖原始事实** | 追加式但**未被测试强制**：工厂只返回 `appendValidatedRow`（`115:48`），契约只测"有"（`190:42`） | 新方法只追加；**新增契约测试把工厂表面固定为白名单**（`appendValidatedRow`、新方法），并断言没有 update/delete/remove/overwrite/clear 类名——可以放进新测试文件，不必改 `190` | 内层 writer 仍是只追加；但外层 S1 代码**理论上**能直接调 Sheet API 改写——需要静态检查（S1 模块不得出现 `setValue(s)`、`deleteRow`、`clear*`、直接 `appendRow`） | B2 直接绕过 |
| 5 | **如何区分"记录不存在"与"读取失败"** | 底层已区分：失败 = 异常（缺表 `115:82`、行宽 `117:35`），空 = `[]`（`115:84`）；**但**调用点结果里两者都叫 `Error`（`170:806–807`），表头漂移读不出来（C9、C10） | 锁内读取异常 → **不追加**，返回 `Failed{phase: READ}`；`[]` 才表示"链不存在" → 可以写 `ORIGINAL`。读取侧另设 `Read_Failed` / `Not_Found` 两种类型（Final Design §8）。表头检查放在 S1 前置守卫（锁外，写入前与读取前各做一次） | 同 A | — |
| 6 | **会不会绕过既有校验或治理规则** | 不绕过（但既有校验很薄，C2） | **不绕过**：新方法的栏位检查与 `appendValidatedRow` 语义一致（一致性测试守住）；`appendValidatedRow` 保持原样；写入仍然只经 `TruthWriter` 一个模块。**需要的治理动作**：Freeze 例外 + 模块目录更新（批准后才做）。**仍然不做**的校验（类型、格式、外键）全部在 S1 `decide` 里 | **栏位检查零偏差**（复用原函数）；但「唯一写入出口」在代码层面变成"同一个函数、两个实例、两处锁归属"，`MODULE_CATALOG.md:43` 的描述与现实不再完全一致 | B2 绕过唯一出口与栏位检查（CMP-P10 的显式失败）；B3 不绕过但锁行为未知 |

---

## 6. 推荐

### 6.1 推荐方案：A（通用受保护追加能力），条件是 Freeze 例外获批

理由（每条都对应上表）：
1. **点 1 的保证是结构性的**。B1 的保证依赖"每个 S1 调用点都写对"，而 `TruthWriter` 单例在全局作用域里谁都能引用（`115:106–108`），没有结构手段阻止谁在外层锁里误调它（嵌套锁，UNVERIFIED）或绕开它。
2. **治理一致**。`MODULE_CATALOG.md:43` 把 `TruthWriter` 定义为唯一写入出口；方案 A 让"锁 + 读 + 写协议"继续只在这一个模块里。B1 会让生产代码出现无锁 writer 实例，目录与现实脱节。
3. **契约测试有地方落脚**。方案 A 里被保护的表面（工厂返回的方法集）就在 `TruthWriter` 自己身上，一条白名单断言就能把"只追加"从意图变成被测试守住的约束；B1 里要守的是 S1 模块的写法，靠静态扫描，覆盖面更弱。
4. **phase 标注与 `flush` 只需做一次**，且放在唯一知道锁边界的地方。
5. **改动面小**：新增一个通用方法，不含领域规则；既有 3 个用例（`116:14–36`）与契约（`190:42`）预期原样通过。

### 6.2 不推荐 A 的情形（诚实的反面）

- 你不愿意为 S1 开 Freeze 例外：`115` 是**所有**表的唯一写入出口，改它的影响面是整个系统；Freeze 原话是「不因为"讨论起来合理"就继续加，只有……真实需求才动」（`compliance-os-governance-draft.md:420`），而 Steven 2026-08-17 也明确列过「为了"以后可能需要"而加的 Infrastructure」不做（`:196`）。这是**你的治理决定**，我只负责把理由和范围写清楚。S1 的"真实需求"理由是：来信要求 S1 做到"重试与并发重复提交不留下认不出来的重复正式记录"，而现状路径做不到（§3）。
- 你想先在真实 GAS 里把锁行为验证完再决定：那就走 B1 起步（零改动），用验证结果决定要不要升级成 A。

### 6.3 若走 B1，必须同时满足的 5 条守则（缺一条就不要走 B1）

| # | 守则 | 检验方式 |
|---|---|---|
| G1 | 内层 writer 只在 S1 服务层的**一个函数内部**创建、不导出、不缓存 | 静态检查 |
| G2 | 空操作锁只能在**已持有真实锁的闭包里**构造（每次调用现建），不得成为模块级常量 | 静态检查 + 评审 |
| G3 | S1 模块不得引用 `TruthWriter` 单例，不得出现 `appendRow` / `setValue(s)` / `deleteRow` / `clear*` 等直接写 Sheet 的调用 | 静态检查 |
| G4 | 锁内顺序固定为「读 → 判断 → 追加 → flush」，由一个共用函数实现，S1 各表不得各写各的 | 评审 + Node 测试 |
| G5 | 单例工厂表面白名单测试（`appendValidatedRow` 之外不得多出写类方法）放进新测试文件 | Node |

### 6.4 无论选哪个，都要承认的限制

- 并发保护 **UNVERIFIED**（B-1）。真实 GAS 验证项见 Test Plan 的 V3–V5；在此之前不得写"已验证"。
- 本决策**不修复** Phase P；该原语将来可以被 Phase P 的修复复用，但那是另案授权，本轮不碰（来信 §2）。
- 这是单人使用系统：真实并发的来源只可能是重复点击、重试、多页签、将来的触发器——暴露面小，但不是零。

### 6.5 与上一轮设计（`ADR-DRAFT-CPR-1` 里的 P2/P3）的差别

上一轮我推荐的是 P2：把整套"记录链 + 序号 + 比较 + 校验"逻辑放进 `TruthWriter` 的新方法 `appendEntryIfNext`。核对契约之后我**收窄**了它：

| | 上一轮 P2 | 本文方案 A |
|---|---|---|
| `115` 里放什么 | 键、序号、比较、校验回调全套 | 只放**通用**的「锁内读 → 调用方纯函数判断 → 追加 → flush」；领域规则留在 S1 纯函数里 |
| 失败表达 | `Lock_Timeout` 等枚举 + 异常混用 | 统一 `Failed{phase, written}`（`written` ∈ `NO / MAYBE`），不抛异常 |
| 重试 | 同键同序号同内容 → `Already_Recorded` | 增加「**同状态** → `Already_Recorded`」：重试时调用方重新读取并重算了序号，也不会多写一条"没有变化的修订"（见 Final Design §4.4） |
| 对 `115` 的改动量 | 较大（领域逻辑进入已批准文件） | 较小（约 30–50 行，估计值，全部新增） |

`ADR-DRAFT-CPR-1` 草案（`ADR_Drafts_Contribution_Planning_2026-10-26.md:60`）里写的写入原语部分因此需要在你确认方案后同步修订。草案仍是 `PROPOSED / DRAFT`；**本轮没有改它，也没有分配任何正式 ADR 编号**。

---

## 7. 风险登记

| # | 风险 | 影响 | 设计内的缓解 | 剩余风险与关闭方式 |
|---|---|---|---|---|
| R-TW-1 | 改已批准的 `115`（仅方案 A） | `115` 是所有表的唯一写入出口；GAS 把所有文件载入同一个全局作用域，一个语法错误会让整个项目载入失败（`105_TestUtils.js:5–10` 的说明） | 只新增、不改既有行；`116:14–36` 三个用例与 `190:42` 预期原样通过；`195` 的载入模拟会载入它（`195_Tests_GasLoadSimulation.js:38–42`） | Freeze 例外是你的治理决定；实施阶段要跑**全量**回归（本轮没跑） |
| R-TW-2 | `decide` 里误用 `TruthWriter` 单例 → 同一次执行嵌套获取脚本锁（A、B1 都有） | 行为 UNVERIFIED：可能无害，也可能自锁到超时 | `decide` 拿不到任何写入对象；静态检查 S1 的 `decide` 模块不得出现 `TruthWriter`；评审 | 无法靠结构杜绝（单例在全局作用域，`115:106–108`）；V3 验证重入行为 |
| R-TW-3 | `flush` 的必要性与副作用未知 | 不 `flush` 时，另一个执行可能读不到刚追加的行 → 重复；或者 `flush` 本身没有必要 | 方法在追加后、释放锁前调用 `flush`（可选，访问器没有就跳过）；无害 | V4：对比有/无 `flush` 时另一个执行的可见性 |
| R-TW-4 | `appendRow` 失败可能留下半行（UNVERIFIED） | 写入的是单行数组、一次调用；半行会让读取侧行宽检查抛错 | 读取侧 fail closed（`117:35–37`）；写入后返回 `written: MAYBE`，重试收敛 | V7 |
| R-TW-5 | 脚本锁是脚本级的，等待只有 10 秒（`115:94`） | 多页签/触发器并发时 `Failed{phase: LOCK}` | `written: NO`，原样重试安全；UI 要明确提示"可以重试"（1b 范围，本轮不设计 UI） | V5 同时测等待时间与超时行为 |
| R-TW-6 | 表头被改名但栏数不变，读不出来（C9、C10） | 数据被按错误栏位解释 | S1 前置守卫：读写前读第 1 行并与代码里的栏位逐栏比较，不符 → `Failed{phase: SCHEMA}` / `Read_Failed{SCHEMA_MISMATCH}`，**绝不当作"空表"** | 守卫与读写之间不是原子的；人手改表头仍可能发生；V2 |
| R-TW-7 | 契约测试只测"有"（C12） | "只追加"仍然只是意图 | 新增白名单测试（新文件）；静态检查 | 测试在新文件里，被删就失效；将来可合并进 `190`（需批准） |
| R-TW-8 | `phase` 变量更新顺序出错 → `written` 误分类 | 把"可能已写"当成"没写"，调用方就会放心重试之外的操作 | 对每个阶段分别注入失败，断言 `phase` 与 `written`（Test Plan B3） | 变异检查 M5 |
| R-TW-9 | 锁内读整表（O(n)）+ 读多张表，持锁时间随数据量增长 | 持锁久 → 别人等锁超时 | S1 数据量小（每月几行）；每次写入最多读 2–3 张表 | 真实耗时 UNVERIFIED；V5 一并测 |
| R-TW-10 | 时间戳被当成身份（来信 §5 第 3 条） | 重试产生新身份 → 重复 | S1 键只由业务事实构成；`recorded_at` 只用于审计，不参与键、排序、"相同"比较（Final Design §4） | Test Plan G4 / 变异检查 |
| R-TW-11 | 现有 id 含时间戳的位置（`110:47,210`、`130:103`、`150:172`） | 这些是现有风格，不是 S1 的 | **本轮与 S1 都不改**；Phase P 另案 | 另案授权 |

---

## 8. 尚待确认事项（以及怎么关闭）

| # | 标记 | 未知 | 关闭方式 | 谁来做 |
|---|---|---|---|---|
| U1 | UNVERIFIED | `waitLock` 超时是否抛异常 | V3（在 Spreadsheet **副本**上） | 你（我看你贴回的日志判断） |
| U2 | UNVERIFIED | 同一次执行里再次获取同一个脚本锁会怎样 | V3 | 你 |
| U3 | UNVERIFIED | `appendRow` 后不 `flush`，另一个执行是否立刻可见；`flush` 是否必要 | V4 | 你 |
| U4 | UNVERIFIED | 两个重叠执行是否真的会发生（Web App 并发请求、多页签、触发器） | V5 | 你 |
| U5 | UNVERIFIED | `appendRow` 失败的原子性（会不会留下半行） | V7 | 你 |
| U6 | 文档已记载 / 原因 UNVERIFIED | 真实 GAS 里已设文本格式的列读回原生 `Date` 对象：仓库自己的验证记录写明发生过并且根因"尚未查明"（`VERIFICATION_STATUS.md:100–107`）。我没有独立验证 | V6 | 你 |
| U7 | UNVERIFIED | UCR6 原文 | 你提供 UEF 原文 | 你 |
| U8 | UNVERIFIED | `MODULE_CATALOG.md:44`「真实 GAS 验证过」具体验证了哪些项 | 你确认 | 你 |
| U9 | UNVERIFIED | 基线是否仍是当前代码 | 你确认，或提供最新的只读副本 | 你 |
| U10 | BLOCKED（本会话） | 官方 Lock 文档（本会话抓取被拒，`PROVENANCE_REQUIRED`） | 你自己核对官方文档，或在允许的会话里重新抓取；我不会绕过 | 你 |

---

## 9. 最小变更范围

| 范围 | 方案 A | 方案 B1 |
|---|---|---|
| 已批准文件 | **只有** `115_TruthWriter.js`：①`createTruthWriter_` 内新增 1 个函数，并让返回对象多 1 个键（现为 `115:48` 的 `return { appendValidatedRow };`）；②`gasSheetAccessor_`（`115:73–88`）新增 `flush()`；③`115:19` 的 JSDoc 补充"访问器可选 `flush`"。**不改**：`appendValidatedRow`（`:31–46`）、`gasLockProvider_`（`:90–102`）、单例装配（`:106–108`）、导出（`:110–112`）。规模约 30–50 行（估计，非测量） | **无** |
| 其它已批准文件 | **无**：`108`、`109`、`105`、`116`、`190`、`170`、`900`、`901` 都不改（前提：采用零改动建表路线，Final Design D-S1-8 的默认值） | 同左 |
| 新增文件（临时编号，待 File Map 批准） | S1 纯函数模块（常量、校验、键、有效视图、`decide`）、S1 服务层、S1 建表函数、S1 测试文件（含失败注入 / 交错 / 表头替身；文件名含 `Tests`，以便被 `195_Tests_GasLoadSimulation.js:38–42` 的载入模拟排除） | 同左，外加 S1 服务层里一个共用的"锁内读 → 判断 → 写 → flush"函数 |
| 治理文件同步 | MODULE_CATALOG、File Map、Data Ownership、Verification Status、ADR：**批准实施之后才做**；本轮不改 | 同左 |
| 明确不碰 | Phase P 相关路径（`110`、`140`、`170` 的导入流程）、日历（`150`、`151`）、`160` | 同左 |

---

## 10. 对既有测试契约的影响（设计预期，**本轮没有运行任何测试**）

| 既有测试 | 位置 | 方案 A 下的预期 | 方案 B1 下的预期 | 备注 |
|---|---|---|---|---|
| TruthWriter 三个用例 | `116_Tests_TruthWriter.js:14–36` | 原样应通过（`appendValidatedRow` 不改） | 原样应通过 | 实施阶段必须实际跑 |
| TruthWriter 契约（只断言有 `appendValidatedRow`） | `190_Tests_Contracts.js:42` | 原样应通过（新增方法不影响"有"） | 原样应通过 | 它**测不到**"多了什么方法"——所以要新增白名单测试 |
| Sheet 表数量断言（恰好 7 张） | `109_Tests_SheetSetup.js:25–28` | **与本决策无关**：只取决于是否把 S1 表登记进 `buildSheetSchemas_`（Final Design D-S1-8）。零改动路线：原样通过；登记路线：该断言**一定失败**，需要经批准修改 | 同左 | 来信 §4-C 点名的回归项 |
| 载入模拟（重名顶层函数、载入顺序） | `195_Tests_GasLoadSimulation.js:38–42,96–111` | 新增的非测试文件会被载入：函数名必须唯一、常量必须是纯字面量 | 同左 | S1 模块命名要带模块前缀 |
| 测试替身 | `105_TestUtils.js:27–38` | 不改；S1 测试自带失败注入 / 交错替身 | 同左 | |
| **新增**（新文件） | — | 工厂表面白名单；栏位检查一致性（新方法 vs `appendValidatedRow`）；每个阶段注入失败 → `phase` / `written` 正确 | 静态守则 G1–G3；工厂白名单 | 详见 `S1_Test_Plan` |

---

## 11. 设计决定 vs 事实证据

**事实（有证据；"源码证实"= 本轮读过那一行，不等于真实 GAS 观察）**

| # | 事实 | 证据 | 标签 |
|---|---|---|---|
| F1 | 锁只包住「栏位取值 + `appendRow`」 | `115:33–45` | 源码证实 |
| F2 | 校验只查空 `rowObject` 与 `undefined` 栏位，不查类型/格式/重复 | `115:32`、`115:36–38` | 源码证实 |
| F3 | 工厂只返回 `appendValidatedRow`；契约只测"有" | `115:48`、`190:42` | 源码证实 |
| F4 | 真实锁：脚本锁 + `waitLock(10000)` + `finally releaseLock`，无 `flush` | `115:90–102` | 源码证实 |
| F5 | `getAllRows`：缺表抛错，空表 `[]`，跳过表头 | `115:80–86` | 源码证实 |
| F6 | `readAll`：行宽不符抛错，不校验表头文字 | `117:35–37` | 源码证实 |
| F7 | 现有存在性检查在锁外、用调用方快照 | `140:191`；`170:234–237`、`:314–315`、`:575–576`、`:870–871` | 源码证实 |
| F8 | 假访问器不会失败；假锁没有互斥 | `105:27–38` | 源码证实 |
| F9 | 锁排队的人工验证项未勾；目录写"真实 GAS 验证过"但不分项 | `116:60–61`；`MODULE_CATALOG.md:44` | 文档状态属实；验证范围 UNVERIFIED |
| F10 | 现有 id 含时间戳 | `110:47,210`；`130:103`；`150:172` | 源码证实 |
| F11 | 仓库验证记录写明：真实 GAS 里文本格式列读回过 `Date` 对象，根因未查明 | `VERIFICATION_STATUS.md:100–107` | 文档记载（我未独立验证） |
| F12 | 脚本时区 `Asia/Singapore` | `appsscript.json:2` | 源码证实 |

**设计决定（全部是【设计建议】，待你确认；都不是事实）**

| # | 决定 | 理由 |
|---|---|---|
| DD-1 | 推荐方案 A 的"通用受保护追加"形状 | §6.1 |
| DD-2 | `decide` 是纯函数，只拿到"读"，拿不到写入对象 | 防止嵌套锁与绕过唯一出口 |
| DD-3 | 返回类型化结果（`Failed{phase, written}`），不抛异常 | 与 `170:815–820` 的既有原则一致；调用方不会忘记 `catch` |
| DD-4 | `written` 只有 `NO / MAYBE / YES` 三值；`APPEND`、`FLUSH` 阶段失败一律 `MAYBE` | 诚实表达"不知道写没写"，恢复靠重发收敛 |
| DD-5 | `flush` 作为访问器的可选方法，追加后、释放锁前调用 | 官方建议未经本会话核实（B-1/U10），但调用无害 |
| DD-6 | 表头检查放在 S1 前置守卫（锁外），不放进通用方法 | 保持 `115` 的改动最小 |
| DD-7 | `appendValidatedRow` 保持原样；新方法的栏位检查复制一份并用一致性测试守住 | 避免重构已批准函数；代价是约 8 行重复 |
| DD-8 | 不通过时 B1 必须满足 G1–G5 | §6.3 |
| DD-9 | 所有新增测试放新文件，不改 `116`、`190`、`105` | 保持已批准测试不动 |

---

## 12. 待你决定的事项

| # | 问题 | 选项（推荐在前） | 默认 |
|---|---|---|---|
| DT-1 | 是否批准 Architecture Freeze 例外去改 `115_TruthWriter.js`？ | (a) 批准 → 方案 A（推荐）；(b) 不批准 → 方案 B1 + G1–G5；(c) 先 B1，真实 GAS 验证（V3–V5）之后再决定是否升级为 A | **默认，待确认**：(a) |
| DT-2 | 受保护追加是返回类型化结果，还是沿用抛异常的习惯？ | (a) 返回 `Failed{phase, written}`（推荐，与 `170` 的既有原则一致）；(b) 抛异常 + 异常上带 `phase` | **默认，待确认**：(a) |
| DT-3 | 追加后调用 `flush`？ | (a) 调用（推荐，无害）；(b) 不调用，等 V4 证明必要再加 | **默认，待确认**：(a) |
| DT-4 | 对应的 ADR 怎么处理？ | 保持 DRAFT（沿用 `ADR-DRAFT-CPR-1` 草案标签，由你指定正式编号）；本轮不分配编号、不改 ADR 索引 | **默认，待确认**：保持 DRAFT |

---

## 13. 不在本轮范围，以及下一阶段所需的独立授权

**不在本轮范围**：任何实现（含对 `115` 的任何修改）；编写或运行任何测试；真实 GAS 验证；创建 Sheet；Phase P 修复；Freeze 例外的实际登记；ADR 编号分配；MODULE_CATALOG / File Map / Verification Status 等治理文件更新。

**下一阶段各项都需要你另行明确授权（设计完整 ≠ 实施授权）**

| # | 授权 | 内容 |
|---|---|---|
| A-1 | Freeze 例外决定 | 批准 / 拒绝改 `115`（决定走 A 还是 B1） |
| A-2 | S1 实现授权 | 新增 S1 文件；若选 A 含 `115` 的增量；Node 测试可写可跑，**不得**把结果描述成真实 GAS 验证 |
| A-3 | 真实 GAS 验证授权 | 在 Spreadsheet **副本** + 临时 Script Property 上做 V0–V7、V10；不碰生产数据；由你执行、我根据贴回的日志判断 |
| A-4 | 建表授权 | 在真实 Spreadsheet 上创建 S1 的 Sheet（零改动路线下由 S1 自己的建表函数执行） |
| A-5 | 治理文件同步授权 | MODULE_CATALOG、File Map、Data Ownership、Verification Status、ADR 正式编号 |
| A-6 | Phase P 修复（独立） | 与 S1 互不依赖；该原语将来可被复用，但不在本轮、也不在 S1 里 |

---

## 14. 证据索引（文件 / 行号 → 内容）

| 文件 | 行 | 内容 |
|---|---|---|
| `115_TruthWriter.js` | 3–5 | UCR6：Sheet 写入唯一出口 |
| | 19–22 | 工厂 `createTruthWriter_(sheetAccessor, lockProvider)` 与 JSDoc |
| | 31–46 | `appendValidatedRow`：`:32` 空 rowObject 抛错；`:33` 加锁；`:36–38` 缺栏位抛错；`:41` null→''；`:43` appendRow；`:44` 返回行 |
| | 48 | 工厂只返回 `{ appendValidatedRow }` |
| | 73–88 | `gasSheetAccessor_`：`:75–79` appendRow（缺 Sheet 抛错 `:77`）；`:80–86` getAllRows（缺表抛错 `:82`、空表 `[]` `:84`、`:85` 取值） |
| | 90–102 | `gasLockProvider_`：`:93` getScriptLock；`:94` waitLock(10000)；`:95–99` finally releaseLock |
| | 106–108 | 单例 `TruthWriter` |
| `117_SheetReader.js` | 32–42 | `readAll`：`:33` getAllRows；`:35–37` 行宽不符抛错 |
| `116_Tests_TruthWriter.js` | 14–36 | 3 个用例 |
| | 60–61 | 锁排队的人工验证项（未勾） |
| `105_TestUtils.js` | 5–10 | GAS 单一全局作用域、重名会载入失败的说明 |
| | 27–38 | `fakeSheetAccessor_`、`fakeLockProvider_` |
| `190_Tests_Contracts.js` | 42 | `TruthWriter` 契约只断言有 `appendValidatedRow` |
| `109_Tests_SheetSetup.js` | 25–28 | 断言表名恰好是 7 张 |
| `108_SheetSetup.js` | 140–148 | `ensureSheetSchema_` 表头比较 |
| `140_VerifiedIncome.js` | 167–169、189–198 | `writeVerifiedIncome_`；`verifyAndPublishIncome_`（存在性检查 `:191`） |
| `170_OperatorConsole.js` | 151–153 | `buildConsoleDeps_` 注入单例 |
| | 234–237、259 | `consoleImportOneDriveFile_` 快照与 catch |
| | 314–315、533–534、575–576 | 批次/重试路径的快照读取 |
| | 804–808、815–821、870–871、885 | 读取在 try 外；"永远回明确结果"注释；每日分配读取后写入；catch |
| `110_DocumentImport.js` / `130_Reconciliation.js` / `150_ComplianceCalendar.js` | 47、210 / 103 / 172 | 含 `now.getTime()` 的 id |
| `195_Tests_GasLoadSimulation.js` | 38–42、96–111 | 载入模拟：排除含 `Tests` 的文件；重名顶层函数检查 |
| `900_Constitution.js` | 204 | CMP-CR 建立在 UEF 的 UCR1-7 之上（UCR6 原文不在仓库） |
| `901_System_Architecture.js` | 132 | `TruthWriter（UCR6 Sheet 写入唯一出口）` |
| `MODULE_CATALOG.md` | 43–44 | 唯一写入出口；"真实 GAS 验证过"（不分项） |
| `VERIFICATION_STATUS.md` | 100–107 | 真实 GAS 里读回 `Date` 对象的记录与"尚未查明" |
| `compliance-os-governance-draft.md` | 196、420 | 不为"以后可能需要"加基础设施；Architecture Freeze 与例外条款 |
| `appsscript.json` | 2 | `"timeZone": "Asia/Singapore"` |
| 我方上一轮交付 | — | `PhaseP_DuplicateVerifiedIncome_Investigation_2026-10-23.md:131–133`（R3–R5，Node 模拟）；`ADR_Drafts_Contribution_Planning_2026-10-26.md:60`（`ADR-DRAFT-CPR-1`） |

**本文没有声称执行过的事**：没有运行任何测试；没有运行真实 GAS；没有修改任何文件；没有访问生产数据。所有"预期通过 / 预期失败"都是设计预期。
