# Phase O — PDF 页数识别：技术调查报告与方案建议

| 项目 | 内容 |
|---|---|
| 日期 | 2026-10-14（Asia/Kuala_Lumpur） |
| 授权依据 | Steven 2026-10-11 的 N → O → P 分阶段授权；本文件只涵盖 Phase O |
| 性质 | **调查与方案。没有修改任何生产文件、测试文件或治理文件。** 本文件是 repo 内这一阶段唯一的新增物 |
| 对象 | `ASSUMED_STATEMENT_TOTAL_PAGES_ = 24`（`170_OperatorConsole.js`）的替代方案 |
| 验证层级 | 所有实验都是 Node / Python 本地实验。**真实 GAS、真实 Gemini、真实浏览器均为 PENDING**（§11） |

证据层级标记（全文使用）：

- **【实测】** 本次直接从 W14 原件的位元组读到，可重现。
- **【实验】** Node / Python 本地实验。语料里除 W14 与 `debug.pdf` 外都是我合成的，**不代表真实世界的比例**。
- **【文件】** repo 既有文档的记载；本次拿不到原始位元组复核。
- **【未验证】** 没有证据，只是判断。

---

## 0. 结论摘要

1. **这个常数只影响 chunk fallback 的页码范围。** 唯一的生产赋值是 `170:833`，唯一的消费者是 `142:848–872`。整份文件一次抽取（`full_document`）成功时，完全用不到这个数字。
2. **出错方向是单边的。** 假设值 T ≥ 真实页数 P 时，两个 chunk 范围的并集盖得住 1…P；T < P 时，第 T+1…P 页不在任何 chunk 范围里。漏掉的订单会被既有的逐日小计 checksum 与整周 checksum 挡下，落到 `Needs_Review`（fail-closed；这是既有行为，Node 模拟下测过，真实 GAS 仍 PENDING）。所以这是**可用性问题**（成功率、白花调用），**不是数据正确性问题**。
3. **现状至今没有造成实际问题，但余量很窄。** W01 = 24 页【文件】，W14 = 25 页【实测】。W14 的订单页是第 8–23 页，T = 24 只留 1 页余量：版面相同时，总页数到 27 页以上（订单延伸到第 25 页起）才会漏订单页。页数也不是订单数的函数（W01 173 笔 → 24 页；W14 166 笔 → 25 页）；W14 的前 7 页是 Tip / 奖励明细，这类篇幅看来随周而变（W01 的页面构成本次没有量测，属推测）。
4. **没有官方 API 直接给 PDF 页数。** Drive File resource 没有页数栏位【文件：官方参考，读了前 100,000 / 116,240 字元，顶层栏位无页数】。能做的只有「读 PDF 位元组自己判断」或「引入 PDF 函式库」。
5. **社群写法与天真写法都不可靠。** labnol 文章的 `Pages\/Count (\d+)` 在 W14 与目前 Google Docs 导出的 PDF 上都**没有答案**。「第一个 `/Count`」在 W14 上直接得到 **0**——W14 里有 16 个 `/Count 0`（大纲项目）和 1 个 `/Count 25`。仅凭「读 `/Count`」连 W14 这一份都会读错，除非知道读的是根 `/Pages` 节点的那一个；而且当 `/Count` 写成间接引用（`/Count 5 0 R`）时，读 `/Count` 的写法读到的是**对象号**而不是页数（§6.4.1）。
6. **「在 W14 上成功」不等于「对目标文件类型可靠」。** 目标类型（wkhtmltopdf / Qt 4.8.7 产生的 Grab 周结单）目前**只有 W14 一份位元组证据**；W01 是文件记载同一产生器；W05 / W06 / W33 未知。
7. **我做了一个三态原型（`ok` / `unrecognized` / `error`）**，要求「沿 `/Kids` 数到的叶节点数」与「根 `/Count`」两个独立讯号一致，并先通过结构闸门。【实验】28 份语料：12 对 / 0 错 / 16 弃权；W14 的 18 个合法变体：13 / 0 / 5；4 个手写的间接对象 PDF：1 / 0 / 3（§6.4.1）；对 W14 的 13,000 个随机损坏（两个种子）：可评分样本上 **0 错**，另有 49 例在「成熟工具之间本身不一致」的样本上给了答案（§6.5）。弃权率反映的是我刻意造的对抗样本，**不是**真实世界的弃权率。
8. **建议：现在不改任何生产页数逻辑。** 若要往前推，走「证据先行」三道门（真实样本 → GAS 探针 → shadow 记录），通过后才讨论接线；无法识别时一律回到今天的行为（Option A）。若真实样本大量落到 `unrecognized`，不要加更多解析器，改考虑 Option C（第二段改成「第 12 页到最后一页」，根本不需要页数）。需要你决定的事项见 §9。

---

## 1. 范围、方法与授权要求对照

| 授权要求 | 本报告章节 |
|---|---|
| 1. 追踪所有使用该常数的生产路径 | §2 |
| 2. 调查当前 GAS 环境中可行的页数识别方式 | §5 |
| 3. 区分「W14 上验证成功」与「对目标文件类型可靠」 | §4、§6.6 |
| 4. 检查 PDF 版本、页树结构、间接对象、压缩对象流、解析失败时的行为 | §6（间接对象见 §6.4.1）、§7 |
| 5. 不得仅凭一份 PDF 的 `/Count` 认定所有文件可同样解析 | §4、§6.1、§6.6 |
| 6. 最小方案，并明确成功 / 无法识别 / 解析异常的处理语义 | §8 |
| 7. 没有充分证据前不修改生产页数识别逻辑 | §0、§9、§12（未改任何生产文件） |

方法：读 repo（Phase N 交付版本）追踪用法；对 W14 原件做位元组级检查；构造语料、用成熟工具（pikepdf、qpdf、pdfinfo、pypdf）取「真值」，比较 8 种识别法；另做 18 个合法变体与 13,000 个随机损坏样本；查官方文件与社群来源。原型 detector 只是实验程序，**不在 repo 里、没有交付、没有接进任何流程**。

---

## 2. 生产路径追踪

行号以 Phase N 交付版本为准。

| 位置 | 角色 | 备注 |
|---|---|---|
| `170_OperatorConsole.js:665–680` | 定义 `var ASSUMED_STATEMENT_TOTAL_PAGES_ = 24;` 与注解 | 注解自述：2026-09-27 真实 GAS 除错时写死；只在 chunk fallback 用 |
| `170_OperatorConsole.js:833` | `consoleRunDailyAllocation_` 建 `document` 时赋 `totalPages` | **唯一的生产赋值** |
| `170_OperatorConsole.js:1027` | 测试可见的导出清单 | 非执行路径 |
| `142_DailyOrderAllocation.js:848–872` | `runGeminiOrderExtractionWithFallback_` 的 chunk fallback：`hasValidTotalPages` → `midpoint = ceil(T/2)` → 两个范围 | **唯一的消费者**。T 缺失或不是正整数 → `chunk_fallback_skipped`（fail-closed，143 L720–741 已有测试） |
| `127_LLMExtractor.js:129–131、157–163、549–556` | `pageRange` 只进 prompt 文字；每次请求的 `inline_data` 都带**整份** PDF | **页码范围不会裁切送出的位元组** |
| `127_LLMExtractor.js:950` | 每次 `extractOrders` 都 `DriveApp.getFileById(id).getBlob().getBytes()` | production 本来就在每次呼叫读取全部位元组 |
| `125_ExtractionValidation.js:297` | `extraction_scope.first_page_seen / last_page_seen` 只验「正整数」 | 不拿它跟真实页数比对 |
| `142_DailyOrderAllocation.js:765` | 合并后的 `extraction_scope` 由 chunk 范围算出 | |
| `171_Tests_OperatorConsole.js:7、463` | 断言 extractor 每次收到的 `document.totalPages` 就是该具名常数 | 若改变来源，这条测试要同步改 |
| `143_Tests_DailyOrderAllocation.js`（L529–795 多处） | 以 `totalPages: 24`、`25`（W14，L671）、缺失、`0` 作 fixture | 纯逻辑测试，和常数本身无耦合 |
| `999_LatencyReliabilityObservation.js:129`、`999_PhaseB_Baseline.js:13`、`999_PhaseB_Baseline_v4.js:44,96` | 历史观察 / 基线脚本，硬编码 `totalPages: 24`（W01） | 非 production 路径；属历史基线，不动 |
| `110_DocumentImport.js:33` `DOCUMENTS_COLUMNS` | Documents 只有 9 个栏位（`document_id … status`），**没有页数栏位** | ADR-005 L101 所说「真实页数应该来自 Documents」需要新增栏位（持久化契约变更，不在本阶段决定） |

chunk 范围的计算（`142:869–873`）：

```
midpoint = ceil(T / 2)
range 1 = [1,            min(midpoint + 1, T)]
range 2 = [max(midpoint, 1), T]            // T = 24 → 1–13 与 12–24
```

---

## 3. 影响分析

### 3.1 什么时候用得到

只有 `full_document` 失败（例外、或候选未通过 125 的验证）而进入 chunk fallback 时才会读 T。`full_document` 成功就完全碰不到。

### 3.2 出错的方向是单边的

- **T ≥ P**：range 1 盖 1…min(mid+1, T)，range 2 盖 mid…T，并集 ⊇ 1…P。**不漏页。** 代价：T 远大于 P 时 chunk 变大（削弱「分块」的意义），第二段可能落在文件之外（模型如何处理「不存在的页」未验证，真实 Gemini PENDING）。
- **T < P**：第 T+1…P 页不在任何 chunk 的 prompt 范围里。若这些页含订单 → 订单漏掉。

既有安全网（170 L665–679 的注解、142 的合并 + 125 验证 + checksum；Node + 假 extractor 测过，真实 GAS PENDING）：漏单会让逐日 printed subtotal checksum 或整周对 `Verified_Income` 的 checksum 对不上，结果是 `Needs_Review`，**不会静默写进错的数字**。代价是白花最多 2 次 API 呼叫（Phase N 的执行预算已限制总呼叫数）。

### 3.3 W14 的页面构成【实测】

用 `pdftotext -layout` 逐页量（只数「行首记号」，不涉及任何订单内容）：

| 页 | 内容（依标题行判读） | 以 `Pesanan` 起头的行数 |
|---|---|---|
| 1 | 封面汇总（`Penyata Pemandu` / `Ringkasan` / `Butiran pendapatan`）+ `Tip` 表头 | 0 |
| 2 | `Tip` 明细（14 个 `A-` 订单号记号，不是 `Pesanan` 行格式） | 0 |
| 3–7 | `Insentif`（奖励）明细 | 0 |
| 8 | `Pengeluaran Wang`（提款）、`Bayaran Balik Promo`、**订单表开始**（`Butiran Tempahan - Penghantaran`） | 2 |
| 9–23 | 订单明细 | 每页 4–11 行 |
| 24–25 | 名词说明（无订单） | 0 |

订单页 = 第 8–23 页（16 页），与 ADR-005 L101 的记载一致；`Pesanan` 起头的行共 117 行（批次订单一行含多个订单号；ADR-005 记载整份共 166 笔订单）。页 1–7 的 Tip / 奖励篇幅、页末的名词说明各有几页，W14 以外只有 W01 的总页数（24）可参照，**其余周的前后篇幅【未验证】**。

### 3.3.1 页数不是订单数的函数

| 周 | 订单数 | 总页数 | 来源 |
|---|---|---|---|
| W01 | 173 | 24 | 【文件】Gate2 记载 |
| W14 | 166 | 25 | 【实测】订单数取 ADR-005 记载 |

订单更少，页数反而更多：页数不由订单数决定。W14 的前 7 页是 Tip / 奖励明细，这类篇幅看来随周而变（W01 的页面构成本次没有量测，属推测）。所以不能用「订单数」或某个固定比例推算页数。

### 3.4 T = 24 的覆盖边界（假设版面与 W14 相同：订单页之后固定 2 页名词说明）

| 真实总页数 P | 最后一个订单页 | T = 24 的范围 | 是否有订单页落在范围外 |
|---|---|---|---|
| 25（W14） | 23 | 1–13 / 12–24 | 否（第 25 页是名词说明） |
| 26 | 24 | 同上 | 否 |
| 27 | 25 | 同上 | **是**（第 25 页） |
| 30 | 28 | 同上 | 是（第 25–28 页） |

需要同时满足「`full_document` 失败」与「P ≥ 27」才会碰到。目前只有两个样本（24、25），**P 的分布没有数据**；这个风险有界、概率未知。

---

## 4. 目标 PDF 类型的证据：已验证 vs 文件记载 vs 未知

| 样本 | 总页数 | 产生器 / 结构 | 证据层级 |
|---|---|---|---|
| **W14**（`2026-W14.pdf`，122,680 bytes） | 25 | wkhtmltopdf 0.12.6.1 / Qt 4.8.7；`%PDF-1.4`；传统 xref 表；`startxref` 与 `%%EOF` 各 1 个；无 `/Encrypt`、无 `/ObjStm`、无 `/Type /XRef`、trailer 无 `/Prev`；根 `/Pages`（物件 2）**平铺** 25 个叶节点、`/Count 25`；180 个物件 | **【实测】** |
| W01 | 24 | wkhtmltopdf 0.12.6.1（HTML → PDF），Roboto 字体嵌入；`extraction_scope` 10 / 10 回报 1–24 页 | **【文件】** Gate2_Independent_Source_Verification_v2_2026-09-14.md L16–17、Gate2_ReClose_Evidence_Proposal_2026-09-10.md L68；本次没有它的位元组 |
| W33 | 未记载 | 未记载（文件只记 151 / 151 笔订单） | **【未验证】** |
| W05（2026-01-26～02-01）、W06 | 未记载 | 未记载 | **【未验证】** |
| `debug.pdf` | 3 | `Skia/PDF m156 Google Docs Renderer`；PDF 1.4；传统 xref；`/Type /Pages` 后面紧跟 `/Count 3` 再接 `/Kids` | **【实测】**——它是 Google Docs 导出的 Cloud log，**不是目标类型**，只用来对照另一种产生器 |

所以：

- 「读根 `/Count` 得到 25」只证明 **W14 这一份**能这样读。它不能推出「所有 Grab 周结单都是 PDF 1.4 + 传统 xref + 平铺页树 + 单一版本」。
- 「Qt 4.8.7 的 PDF 输出结构跨周稳定」是一个合理的猜测，但手上只有一份位元组证据，**【未验证】**。
- 另一个会改变结构的因素是文件到 Drive 之前有没有被二次处理（预览程序另存、合并、裁页）。W14 与 W01 都是原产生器的输出；之后的文件是否也是，**【未验证】**。§6.4 用工具模拟了几种二次处理，结果是：多数仍可读，但被 cairo 一类工具重存后会变成对象流（原始位元组里看不见页对象）。

---

## 5. GAS 里可行的识别方式

| # | 方式 | 能取得页数吗 | 证据层级 | 评语 |
|---|---|---|---|---|
| 1 | Drive / `DriveApp` / Drive API 元数据 | **否** | 【文件】官方 File resource（v3）：只有 `imageMediaMetadata`、`videoMediaMetadata`，无 PDF 页数栏位；只读了该页前 100,000 / 116,240 字元 | 没有现成栏位可用 |
| 2 | 读原始位元组、自己判断（纯 JS：`getBytes()` → 字符串 → 结构判断） | 视结构而定（§6） | 【实验】Node；GAS 内**【未验证】** | production 本来就每次 `getBytes()`（127:950），读取不是新风险；只依赖 `& 0xff` 与 `String.fromCharCode`，不依赖 `getDataAsString(charset)` |
| 3 | 社群写法：`Blob.getDataAsString()` + `/Pages\/Count (\d+)/g` 取最大值（labnol） | W14、`debug.pdf` **都没有答案** | 【实测】+ 文章原文 | 文章的示例针对「Google Doc 导出成 PDF」，没有写任何适用范围限制。目前 Google 导出器写成 `/Type /Pages` 换行 `/Count 3`，字面不匹配 |
| 4 | PDF 函式库（pdf-lib 1.17.1，MIT，压缩后 525,099 bytes） | 是（语料 21 / 28 对，0 错，7 例外） | 【实验】Node；GAS 内**【未验证】** | 要把 525 KB 放进专案，或运行期下载后 `eval`（新依赖 / 供应链 / GAS V8 相容性 / 执行时间都未验证）；加密、截断、非 PDF 会丢例外；对这个需求偏重 |
| 5 | 问 Gemini（`countTokens`，或在 prompt 里问页数） | 近似 / 非确定 | **【未验证】**（本环境没有 API 存取，没实测） | token 数到页数不是确定性映射；多一次网络呼叫与配额；与「确定性验证」原则不一致 |
| 6 | 复用既有 `extraction_scope.last_page_seen`（模型自己回报） | 有时 | W01 10 / 10 一致【文件】；W14 无证据 | 该栏位的设计目的就是侦测「模型只看到部分页面」，拿它当页数来源有循环论证；`full_document` 抛例外时根本没有候选 |
| 7 | 转成 Google Doc / OCR 再数 | 未调查 | — | 未调查；会让含收入明细的文件多经过一道 Drive 转换 |
| 8 | 外部 PDF 服务 | 未评估 | — | 把含收入 / 订单数据的文件送到第三方，与现有数据边界不符，不予考虑 |

---

## 6. 实验

### 6.1 W14 的位元结构【实测】

- 档头 `%PDF-1.4`；一个传统 `xref` 表；trailer：`/Size 181 /Info 1 0 R /Root 166 0 R`（无 `/Prev`）。
- Catalog（物件 166）：`/Type /Catalog /Pages 2 0 R /Outlines 149 0 R /PageMode /UseOutlines /Dests 148 0 R`。
- 根 Pages（物件 2）：`/Type /Pages`，`/Kids` 直接列 25 个叶节点（**没有中间节点**），`/Count 25` 排在 `/Kids` 之后。
- 整份文件有 17 个 `/Count`：**16 个 `/Count 0`（大纲项目）+ 1 个 `/Count 25`（根 Pages）**。所以「第一个 `/Count`」= 0；「取最大 `/Count`」= 25 只是碰巧对。
- `/Type /Page` 这个子串出现 26 次（25 个叶节点 + 1 个 `/Type /Pages`）；排除 `/Pages` 的正则得 25。
- 14 个 `/Prev` 全部在大纲项目里，不在 trailer。

这些都只对 W14 成立。

### 6.2 语料与「真值」的定义【实验】

「真值」= pikepdf 沿页树 `/Kids` 数到的页数（打不开 = 无法解析）。另记录 qpdf、pdfinfo、pypdf，用来观察成熟工具之间是否一致。

28 份语料：

| 组 | 份数 | 内容 |
|---|---|---|
| A 真实原件 | 2 | A1 = W14；A2 = `debug.pdf`（Google Docs / Skia） |
| B W14 的结构变体 | 11 | B1 对象流（PDF 1.5）；B2 线性化；B3 增量更新（新版本把页树改成 24 页，旧的第 25 个页物件留成孤儿）；B4 AES-256 加密；B5 加密 + 对象流；B6 截断到 95%；B7 截断到 50%；B8a / B8b 根 `/Count` 写错（29、7）；B9 档头前加 100 位元组垃圾；B10 大纲根 `/Count` 调成 40 |
| C 别的产生器 / 页树形状 | 11 | reportlab（C1 压缩 10 页；C1b 不压缩 6 页、内文含诱饵字串）；Chromium / Skia（C2 12 页；C2b 70 页，嵌套页树）；pdf-lib（C3 对象流 9 页；C3b 无对象流 9 页；C3c 对象流 60 页）；pypdf 空白 30 页（C4）；pikepdf 嵌套页树 3×10（C5）；pikepdf 对象流 30 页（C6）；C7 = 5 页文件里**未压缩地**附带整份 25 页 W14 |
| D 边界 / 非 PDF | 4 | D1 单页；D2 HTML 错误页但副档名 `.pdf`；D3 0 位元组；D4 `%PDF-1.4` 后接随机位元组 |

**这批语料除 A1 / A2 外都是我合成的，用来刻画「识别法在哪些结构下会错」，不是「Grab 的文件长这样」的证据。** 成熟工具在不一致的文件上也会给出不同答案：B8a / B8b 里 qpdf 与 pdfinfo 信任根 `/Count`（29、7），pypdf 与 pikepdf 沿 `/Kids` 数（25）。「页数」在畸形文件上本来就取决于定义——这正是下面的方案要求「两个讯号一致才回答」的原因。

### 6.3 28 份语料的结果

表中的 M1–M8 是 8 种识别法（定义见表后图例；与语料档名里的 D1–D4 无关）。格式：数字 = 该方法给出的答案；`✓` 对、`✗` 自信地给了错答案（错 = 最危险的一类）、`—` 无答案、`弃权·原因` 三态方法明确回报「无法识别」、`例外` 丢出例外。真值栏 `无法解析` = 成熟工具打不开，此时给任何数字都算错。

| 文件 | 真值 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|---|---|---|---|---|---|---|---|---|---|
| A1_real_W14_wkhtmltopdf | 25 | — | 0 ✗ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| A2_real_debug_gdocs_skia | 3 | — | 3 ✓ | 3 ✓ | 4 ✗ | 3 ✓ | 3 ✓ | 3 ✓ | 3 ✓ |
| B10_W14_outlines_root_count40 | 25 | — | 40 ✗ | 40 ✗ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| B1_W14_objstm_pdf15 | 25 | — | — | — | — | — | — | 弃权·object_streams | 25 ✓ |
| B2_W14_linearized | 25 | — | 0 ✗ | 25 ✓ | 26 ✗ | 25 ✓ | — | 弃权·multiple_revisions_or_missing_trailer | 25 ✓ |
| B3_W14_incremental_update_24pages | 24 | — | 0 ✗ | 25 ✗ | 27 ✗ | 25 ✗ | 24 ✓ | 弃权·multiple_revisions_or_missing_trailer | 24 ✓ |
| B4_W14_encrypted_aes256 | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 弃权·encrypted | 例外 |
| B5_W14_encrypted_plus_objstm | 25 | — | — | — | — | — | — | 弃权·object_streams | 例外 |
| B6_W14_truncated_95pct | 无法解析 | — | 0 ✗ | 0 ✗ | 25 ✗ | 25 ✗ | — | 弃权·multiple_revisions_or_missing_trailer | 例外 |
| B7_W14_truncated_50pct | 无法解析 | — | — | — | 16 ✗ | 16 ✗ | — | 弃权·multiple_revisions_or_missing_trailer | 例外 |
| B8a_W14_root_count_wrong_29 | 25 | — | 0 ✗ | 29 ✗ | 26 ✗ | 25 ✓ | 29 ✗ | 弃权·count_mismatch | 25 ✓ |
| B8b_W14_root_count_wrong_07 | 25 | — | 0 ✗ | 7 ✗ | 26 ✗ | 25 ✓ | 7 ✗ | 弃权·count_mismatch | 25 ✓ |
| B9_W14_junk_prefix_100B | 25 | — | 0 ✗ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| C1_reportlab_10p_compressed | 10 | — | 10 ✓ | 10 ✓ | 11 ✗ | 10 ✓ | 10 ✓ | 10 ✓ | 10 ✓ |
| C1b_reportlab_6p_uncompressed_decoy_text | 6 | — | 6 ✓ | 99 ✗ | 19 ✗ | 12 ✗ | 6 ✓ | 6 ✓ | 6 ✓ |
| C2_chromium_skia_12p | 12 | — | 8 ✗ | 12 ✓ | 15 ✗ | 12 ✓ | 12 ✓ | 12 ✓ | 12 ✓ |
| C2b_chromium_skia_70p | 70 | — | 8 ✗ | 70 ✓ | 81 ✗ | 70 ✓ | 70 ✓ | 70 ✓ | 70 ✓ |
| C3_pdflib_objstm_9p | 9 | — | — | — | — | — | — | 弃权·object_streams | 9 ✓ |
| C3b_pdflib_noobjstm_9p | 9 | — | 9 ✓ | 9 ✓ | 10 ✗ | 9 ✓ | 9 ✓ | 9 ✓ | 9 ✓ |
| C3c_pdflib_objstm_60p | 60 | — | — | — | — | — | — | 弃权·object_streams | 60 ✓ |
| C4_pypdf_blank_30p | 30 | — | 30 ✓ | 30 ✓ | 31 ✗ | 30 ✓ | 30 ✓ | 30 ✓ | 30 ✓ |
| C5_pikepdf_nested_tree_3x10 | 30 | — | 30 ✓ | 30 ✓ | 34 ✗ | 30 ✓ | 30 ✓ | 30 ✓ | 30 ✓ |
| C6_pikepdf_objstm_30p | 30 | — | — | — | — | — | — | 弃权·object_streams | 30 ✓ |
| C7_embedded_uncompressed_25p_attachment_in_5p | 5 | — | 5 ✓ | 25 ✗ | 32 ✗ | 30 ✗ | — | 弃权·multiple_revisions_or_missing_trailer | 5 ✓ |
| D1_one_page | 1 | — | 1 ✓ | 1 ✓ | 2 ✗ | 1 ✓ | 1 ✓ | 1 ✓ | 1 ✓ |
| D2_html_error_page_named_pdf | 无法解析 | — | — | — | — | — | — | 弃权·not_pdf | 例外 |
| D3_zero_bytes | 无法解析 | — | — | — | — | — | — | 弃权·too_small | 例外 |
| D4_pdf_header_then_random | 无法解析 | — | — | — | — | — | — | 弃权·multiple_revisions_or_missing_trailer | 例外 |

- M1 = labnol 社群写法 Pages/Count 取最大
- M2 = 第一个 /Count
- M3 = 所有 /Count 取最大
- M4 = 子字串 "/Type /Page" 计数
- M5 = 正则数 /Type /Page（排除 /Pages）
- M6 = 只读 trailer→Root→Pages→/Count
- M7 = 提案：严格三态（遍历页树 = 根 /Count）
- M8 = pdf-lib PDFDocument.load().getPageCount()

汇总（28 份；「错」= 自信地给了错答案）：

| detector | 对 | 错（自信的错答案）| 弃权/无答案 | 例外 |
|---|---|---|---|---|
| M1 | 0 | 0 | 28 | 0 |
| M2 | 9 | 10 | 9 | 0 |
| M3 | 12 | 7 | 9 | 0 |
| M4 | 0 | 20 | 8 | 0 |
| M5 | 15 | 5 | 8 | 0 |
| M6 | 14 | 2 | 12 | 0 |
| M7 | 12 | 0 | 16 | 0 |
| M8 | 21 | 0 | 0 | 7 |

读法：

- M1（labnol 字面写法）28 份全部无答案，包括 W14 与 `debug.pdf`。把它改成容许空白的 `/Pages\s*/Count\s+(\d+)` 后，28 份里只有 4 份有答案且全对（A2、C2、C2b、C4——都是 `/Count` 紧接在 `/Type /Pages` 后面的写法），W14 仍然无答案。
- M5（数 `/Type /Page` 的正则）在页对象看得见的合法文件上都对（A1、A2、B2、B4、B9、B10、C1、C2、C2b、C3b、C4、C5、D1），连根 `/Count` 写错的 B8a / B8b 也对（它数的是页对象，不看根 `/Count`）；错在增量更新（B3，旧页物件成了孤儿）、截断（B6、B7）、诱饵字串（C1b）、嵌入的另一份 PDF（C7）；对象流文件无答案。
- M6（只读根 `/Count`）错在根 `/Count` 写错的两份（B8a、B8b）。
- M7（三态原型）没有一个「自信的错答案」；弃权的 16 份里，11 份是合法 PDF 但结构不适合从原始位元组读（对象流、线性化、增量更新、加密、`/Count` 不一致、嵌入另一份 PDF），5 份是不合法或被截断的文件。
- M8（pdf-lib）读得懂对象流，是唯一一个对 B1 / C3 / C6 这类文件给出答案的方法；代价见 §5 第 4 行。

### 6.4 W14 的 18 个「合法变体」（二次处理模拟）【实验】

把 W14 用别的工具重存 / 合并 / 裁页（qpdf、pdftocairo、pdfunite、pdftk、pikepdf 的各种存法），每一份都是合法 PDF，真值已知。这些变体是我用工具模拟的二次处理，**不是 Grab 或你实际会遇到的证据**。

| 文件 | 真值 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|---|---|---|---|---|---|---|---|---|---|
| V01_qpdf_qdf_normalized | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V02_qpdf_streams_uncompressed | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V03_qpdf_linearized_noobjstm | 25 | — | 0 ✗ | 25 ✓ | 26 ✗ | 25 ✓ | — | 弃权·multiple_revisions_or_missing_trailer | 25 ✓ |
| V04_qpdf_linearized_objstm | 25 | — | — | — | 25 ✓ | 25 ✓ | — | 弃权·object_streams | 25 ✓ |
| V05_qpdf_subset_1-24 | 24 | — | 24 ✓ | 24 ✓ | 25 ✗ | 24 ✓ | 24 ✓ | 24 ✓ | 24 ✓ |
| V06_qpdf_two_ranges_merged | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V07_qpdf_W14_twice_50p | 50 | — | 50 ✓ | 50 ✓ | 51 ✗ | 50 ✓ | 50 ✓ | 50 ✓ | 50 ✓ |
| V08_pdftocairo_rewrite | 25 | — | — | — | — | — | — | 弃权·object_streams | 25 ✓ |
| V09_pdfunite_W14_twice_50p | 50 | — | 50 ✓ | 50 ✓ | 51 ✗ | 50 ✓ | 50 ✓ | 50 ✓ | 50 ✓ |
| V10_pdftk_resave | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V11_pdftk_cat_1-24 | 24 | — | 24 ✓ | 24 ✓ | 25 ✗ | 24 ✓ | 24 ✓ | 24 ✓ | 24 ✓ |
| V12_pdftk_resave_compress | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V13_pikepdf_save_disable | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V13_pikepdf_save_generate | 25 | — | — | — | — | — | — | 弃权·object_streams | 25 ✓ |
| V13_pikepdf_save_preserve | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V14_pikepdf_linearize | 25 | — | 0 ✗ | 25 ✓ | 26 ✗ | 25 ✓ | — | 弃权·multiple_revisions_or_missing_trailer | 25 ✓ |
| V15_pikepdf_normalize_content | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |
| V16_pikepdf_xmp_metadata | 25 | — | 25 ✓ | 25 ✓ | 26 ✗ | 25 ✓ | 25 ✓ | 25 ✓ | 25 ✓ |

M1–M8 的定义同 §6.3。汇总（18 份）：

| detector | 对 | 错（自信的错答案）| 弃权/无答案 | 例外 |
|---|---|---|---|---|
| M1 | 0 | 0 | 18 | 0 |
| M2 | 13 | 2 | 3 | 0 |
| M3 | 15 | 0 | 3 | 0 |
| M4 | 1 | 15 | 2 | 0 |
| M5 | 16 | 0 | 2 | 0 |
| M6 | 13 | 0 | 5 | 0 |
| M7 | 13 | 0 | 5 | 0 |
| M8 | 18 | 0 | 0 | 0 |

读法：

- 除了 M2（第一个 `/Count`，在线性化文件上读到 0，共 2 份错）与 M4（子字串，几乎全错）之外，其余方法只要有答案就对。三态原型弃权的 5 份是：线性化的两份（V03、V14，档案里有两组 `startxref` / `%%EOF`）和对象流的三份（V04 = 线性化 + 对象流、V08 = pdftocairo 重存、V13 `generate`）。
- 在这批「合法、单一版本、传统 xref」的文件上，天真的 M5 一样全对。**三态设计的价值不在合法文件，而在文件不合法或被改过的时候**（§6.3、§6.5）。
- cairo 一类工具重存会产生对象流：原始位元组里看不见页对象，只有 pdf-lib 能读。

### 6.4.1 间接对象补充：`/Kids` 或 `/Count` 写成间接引用【实验】

规格允许 `/Kids` 是指向阵列的间接引用、`/Count` 是指向整数的间接引用。W14 没有这种写法，语料里也没有；这里手写 4 个最小的 3 页 PDF（脚本 `o_indirect.py`，真值 = 3，qpdf、pdfinfo、pypdf、pikepdf 全部一致）：J1 间接 `/Kids`；J2 间接 `/Count`；J3 两者皆间接；J4 全部直接（对照）。pikepdf 没办法构造 J2（它写出时会把简单的间接整数展开成直接值），所以用手写。

M1–M8 的定义同 §6.3。

| 文件 | 真值 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|---|---|---|---|---|---|---|---|---|---|
| J1_indirect_kids_array_3p | 3 | — | 3 ✓ | 3 ✓ | 4 ✗ | 3 ✓ | 3 ✓ | 弃权·kids_is_indirect | 3 ✓ |
| J2_indirect_count_integer_3p | 3 | — | 5 ✗ | 5 ✗ | 4 ✗ | 3 ✓ | 5 ✗ | 弃权·count_mismatch | 3 ✓ |
| J3_indirect_kids_and_count_3p | 3 | — | 5 ✗ | 5 ✗ | 4 ✗ | 3 ✓ | 5 ✗ | 弃权·kids_is_indirect | 3 ✓ |
| J4_direct_baseline_3p | 3 | — | 3 ✓ | 3 ✓ | 4 ✗ | 3 ✓ | 3 ✓ | 3 ✓ | 3 ✓ |

发现：

- **J2 / J3：读 `/Count` 的写法（M2、M3、M6）读到 5——那是间接整数物件的「对象号」，不是页数。** 数页对象的 M5 与 pdf-lib（M8）是对的。
- 三态原型对 J1 / J3 弃权（`kids_is_indirect`，是设计内的行为）；对 J2 弃权的原因码是 `count_mismatch`——**那是碰巧**：原型的 `/Count\s+(\d+)` 把对象号 5 当成页数，遍历数到 3，两个讯号不一致才弃权。结果是安全的，但原因码不精确，而且安全性靠的是「两个讯号一致」这一道，不是靠识别出间接形式。**正式实作要显式识别 `/Count N G R`（原因码 `count_is_indirect`）**；这是对方案的设计要求，原型没有实作，我也没有为此改动原型（改了就得把前面所有实验重跑）。

### 6.5 对 W14 的随机损坏测试【实验】

可复现：seed 与参数见附录 A。13 个「变异族」均匀轮流，每族每个 seed 500 份，共 6,500 份 / seed；两个 seed（`20261014`、`424242`）。**这些都是合成的损坏，不是真实世界会遇到的比例**；它回答的只是「识别法在损坏输入下会不会自信地说错」。

「真值」同样取 pikepdf；另取 qpdf。**两者不一致的样本标记为 `ambiguous`，不计入对错**（页树自相矛盾的文件，成熟工具本身就没有共同答案），另外单独统计各方法在 `ambiguous` 样本上「仍然给出答案」的次数。

变异族：

| 族 | 做了什么 | 产物 |
|---|---|---|
| `flip` | 随机翻转 1–20 个位元组 | 多半损坏 |
| `delete_span` | 删除一段 1–4,000 位元组 | 损坏 |
| `truncate` | 截断到随机长度（0.1%–99.9%） | 损坏 |
| `duplicate_span` | 复制一段 1–3,000 位元组插到随机位置 | 损坏 |
| `header_junk` | 档头前加 1–1,500 位元组乱码 | 超过 1,024 位元组则档头不在规格容许范围内 |
| `trailing_garbage` | `%%EOF` 后追加 1–5,000 位元组 | 通常仍可开 |
| `kids_drop_one` | 根 `/Kids` 拿掉一个 ref，`/Count` 仍 25 | 页树自相矛盾 |
| `kids_dup_one` | 根 `/Kids` 里某个 ref 换成另一个已有 ref | 同一页物件出现两次 |
| `kids_bogus_ref` | 某个 ref 改成不存在的物件号 | 悬空引用 |
| `count_wrong` | 根 `/Count` 改成 1–120 的其他数 | 页树自相矛盾 |
| `kids_and_count_consistent_shrink` | `/Kids` 与 `/Count` 一致地缩成前 k 页（1–24），孤儿页物件仍留在档案里 | 合法页树，xref 偏移错位（工具会重建） |
| `leaf_type_broken` | 某个叶节点 `/Type /Page` 改成 `/Type /Pagx` | 节点型别异常 |
| `incremental_revision_valid` | 追加合法的增量更新，把页树改成前 k 页（1–24） | 合法，真值 = k |

seed `20261014` 的结果（每格 = 对 / 错 / 弃权；四种方法的「例外」全为 0）：

| 变异族 | 份数 | ambiguous | strict | regexLeaf | maxCount | rootCount | firstCount |
|---|---|---|---|---|---|---|---|
| flip | 500 | 25 | 457 / 0 / 18 | 464 / 11 / 0 | 475 / 0 / 0 | 475 / 0 / 0 | 0 / 475 / 0 |
| delete_span | 500 | 222 | 270 / 0 / 8 | 270 / 8 / 0 | 270 / 8 / 0 | 270 / 0 / 8 | 1 / 277 / 0 |
| truncate | 500 | 17 | 0 / 0 / 483 | 0 / 472 / 11 | 0 / 105 / 378 | 0 / 0 / 483 | 0 / 105 / 378 |
| duplicate_span | 500 | 21 | 253 / 0 / 226 | 343 / 136 / 0 | 477 / 2 / 0 | 477 / 1 / 1 | 9 / 470 / 0 |
| header_junk | 500 | 0 | 303 / 0 / 197 | 500 / 0 / 0 | 500 / 0 / 0 | 500 / 0 / 0 | 0 / 500 / 0 |
| trailing_garbage | 500 | 0 | 500 / 0 / 0 | 500 / 0 / 0 | 500 / 0 / 0 | 500 / 0 / 0 | 0 / 500 / 0 |
| kids_drop_one | 500 | 500 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| kids_dup_one | 500 | 135 | 17 / 0 / 348 | 365 / 0 / 0 | 365 / 0 / 0 | 365 / 0 / 0 | 0 / 365 / 0 |
| kids_bogus_ref | 500 | 500 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| count_wrong | 500 | 500 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| kids_and_count_consistent_shrink | 500 | 0 | 500 / 0 / 0 | 0 / 500 / 0 | 500 / 0 / 0 | 500 / 0 / 0 | 0 / 500 / 0 |
| leaf_type_broken | 500 | 0 | 0 / 0 / 500 | 0 / 500 / 0 | 500 / 0 / 0 | 500 / 0 / 0 | 0 / 500 / 0 |
| incremental_revision_valid | 500 | 0 | 0 / 0 / 500 | 0 / 500 / 0 | 0 / 500 / 0 | 500 / 0 / 0 | 0 / 500 / 0 |
| **合计** | 6500 | 1920 | 2300 / 0 / 2280 | 2442 / 2127 / 11 | 3587 / 615 / 378 | 4087 / 1 / 492 | 10 / 4192 / 378 |

两个 seed 的合计（可评分样本 = 总数 − ambiguous）：

| 方法 | seed 20261014：对 / 错 / 弃权 | seed 424242：对 / 错 / 弃权 | `ambiguous` 样本上给出答案的次数（两个 seed） |
|---|---|---|---|
| strict（三态原型） | 2,300 / **0** / 2,280 | 2,329 / **0** / 2,246 | 24 / 1,920 与 25 / 1,925 |
| regexLeaf（数 `/Type /Page`） | 2,442 / 2,127 / 11 | 2,422 / 2,143 / 10 | 1,920 / 1,920 与 1,925 / 1,925 |
| maxCount（取最大 `/Count`） | 3,587 / 615 / 378 | 3,583 / 605 / 387 | 1,920 与 1,925（全部） |
| rootCount（只读根 `/Count`） | 4,087 / 1 / 492 | 4,083 / 0 / 492 | 1,883 与 1,894 |
| firstCount（第一个 `/Count`） | 10 / 4,192 / 378 | 6 / 4,182 / 387 | 1,920 与 1,925（全部） |

关于 strict 在 `ambiguous` 样本上给出答案的那 49 例（24 + 25）：全部是 strict = 25，对照 pikepdf = 24（或 23、或打不开）、qpdf = 25（或 0）。我逐一检视了其中 5 例（`flip__02886`、`flip__03016`、`flip__02340`、`delete_span__00014`、`duplicate_span__00562`）：qpdf 的警告显示都是**页树文字结构完整，但某个叶节点的字典或 xref 被破坏**（例如 object 108「kid 17 MediaBox is undefined」；xref 损坏后 qpdf 重建），其余 44 例的数字模式相同但我没有逐一检视。strict 回的 25 就是页树宣告的页数，也等于原档的页数。我没有把它们算成「错」，因为成熟工具之间本身不一致；但它说明了一个**已知局限**：strict 只做文字层面的结构检查，**看不见「叶节点内部的语法损坏」**，这类档案它会说 `ok`。

### 6.6 这些实验能说明什么、不能说明什么

成立的：

1. 在**合法、未被改动**的文件上，凡是读得懂结构的方法都是对的。差别出现在文件被改动或不合法时。
2. 天真方法在不合法 / 被改动的结构上会**自信地给错答案**：数 `/Type /Page` 的正则在增量更新、截断、诱饵、孤儿页上错；取最大 `/Count` 在大纲 `/Count` 较大、增量更新上错；只读根 `/Count` 在根 `/Count` 写错、或 `/Count` 是间接引用（读到对象号）时错；第一个 `/Count` 在 W14 上就错。
3. 三态原型在四批实验里**没有产生过「自信的错答案」**：语料 0 / 28、合法变体 0 / 18、间接对象 0 / 4、随机损坏可评分样本 0 / 9,155；它的弃权全部带有明确原因码（J2 的原因码不精确，见 §6.4.1）。
4. 弃权的代价是真实存在的：语料 16 / 28、变体 5 / 18、间接对象 3 / 4、随机损坏可评分样本的约一半。后三类都是我造的样本，真实世界的弃权率**未知**。在方案 A 里，弃权 = 今天的行为，所以弃权不会让事情变坏，只是放弃了改善。

不成立的（**不能**由这些实验推出）：

1. 任何关于 Grab 周结单整体的结论：W14 以外没有真实目标类型的位元组。
2. 「原型在真实 GAS 里行为一致」：GAS 的 V8、`getBytes()` 的元素型态、执行耗时与记忆体都没有验证。
3. 「覆盖率 / 弃权率代表真实世界」：语料与损坏都是合成的。
4. 「strict 永远不会自信地说错」：它在可评分的样本（语料 28、变体 18、间接对象 4、随机损坏 9,155）里没有，另有 49 例落在「成熟工具互相不一致」的样本里（§6.5）；这是**没有找到**，不是证明；§6.5 末的叶节点内部损坏是已知的盲区。

---

## 7. 解析失败时的行为

| 输入 | strict（三态原型） | pdf-lib | 天真方法（regex） |
|---|---|---|---|
| 非 PDF（语料 D2：HTML 错误页，副档名 `.pdf`） | `unrecognized: not_pdf` | 例外：`Failed to parse PDF document (line:0 …): No PDF header found`（讯息清楚） | 无答案 |
| 0 位元组（语料 D3） | `unrecognized: too_small` | 例外：`Failed to parse PDF document (line:0 col:0 offset=0): No PDF header found` | 无答案 |
| 档头合法、其余是乱码（语料 D4） | `unrecognized: multiple_revisions_or_missing_trailer` | 例外：`Cannot read properties of undefined (reading 'Pages')`（一般的属性读取错误，**不是**描述性讯息） | 无答案 |
| 截断 95%（B6） | `unrecognized` | 例外：`Failed to parse PDF document (line … offset …)` | 子字串 / 正则法给出 25、第一个 / 最大 `/Count` 给出 0——**对一个任何成熟工具都打不开的文件给了数字** |
| AES-256 加密（B4） | `unrecognized: encrypted`（策略性弃权） | 例外：文件已加密 | 页树字典没被加密，多数 regex 仍读得出 25 |
| 加密 + 对象流（B5） | `unrecognized: object_streams` | 例外：文件已加密 | 无答案 |
| 对象流（B1、C3、C6…） | `unrecognized: object_streams` | 读得出 | 无答案（看不见页对象） |

要点：

- 呼叫端必须接住**所有**例外（pdf-lib 对语料 D4 丢的例外就不是描述性的）；三态设计把「例外」收敛成 `error` 状态，不外抛。
- 没有答案与错误答案要分开：天真方法对不可解析文件**给了数字**。
- 加密或非 PDF 的文件，在 Gemini 那一步也可能失败（这是推测，**【未验证】**），页数识别只是更早得知。`not_pdf` / `too_small` 是目前唯一能**确定性**判断「Drive 给回来的不是 PDF」的证据，和 Phase P 的失败分类（Drive 读取失败 / 解析失败…）有交集，留到 Phase P 一并考虑。

---

## 8. 最小方案

### 8.1 函数契约（设计，未实现）

纯函数、无 I/O、**永不外抛**：

```
detectPdfPageCount_(latin1String)
  → { status: 'ok',           pages: <整数 1..5000>, method: 'kids_traversal_equals_root_count' }
  | { status: 'unrecognized', reason: <原因码> }
  | { status: 'error',        reason: 'exception', message: <字符串> }
```

输入是「一个位元组对应一个字符」的 Latin-1 字符串。转换用 `byte & 0xff`（对有号或无号阵列都成立），不依赖 `Blob.getDataAsString(charset)`（官方 Blob 参考页没有取得方法细节，**【未验证】**）。

### 8.2 判定规则

任何一步不满足 → `unrecognized` + 对应原因码；**不猜**。

1. 输入过小（< 64）→ `too_small`；前 1,024 字符内没有 `%PDF-d.d` → `not_pdf`。
2. 结构闸门（这些情况下原始位元组里看得见的页物件可能和真实页数不一致）：出现 `/Type /ObjStm` → `object_streams`；出现 `/Type /XRef` → `xref_stream`；`startxref` 或 `%%EOF` 不是恰好 1 个 → `multiple_revisions_or_missing_trailer`；无 trailer → `no_trailer`；trailer 字典含 `/Encrypt` → `encrypted`；含 `/Prev` → `multiple_revisions`（只看 trailer 字典；大纲项目里的 `/Prev` 不算）。
3. 找 `/Root` → Catalog → `/Pages` → 根节点；物件号出现重复 → `duplicate_object_number`；沿途任何物件找不到 → `no_root`、`root_object_missing`、`no_pages_ref`、`pages_root_missing`、`root_count_missing`。
4. 沿根节点的 `/Kids`（只接受直接写在字典里的阵列；间接 `/Kids` → 弃权）遍历，数 `/Type /Page` 叶节点；深度上限 16、有环路防护；节点型别未知 / 悬空 / 环路 → `page_tree_node_type_unknown`、`page_tree_object_missing`、`page_tree_cycle`、`page_tree_too_deep`、`kids_missing`、`kids_is_indirect`。
5. **两个独立讯号必须一致**：遍历得到的叶节点数 = 根 `/Count`，否则 `count_mismatch`；页数不在 1…5,000 → `count_out_of_range`。**设计要求（原型尚未实作，见 §6.4.1）**：`/Count` 若写成间接引用（`/Count N G R`）→ 显式弃权 `count_is_indirect`，不要把对象号当成页数。
6. 全部通过 → `ok`。呼叫端的包装把任何例外收成 `error`。

闸门全部偏保守（只会多弃权，不会多回答）。例如：文字里偶然出现 `%%EOF` 或 `/Type /ObjStm` 会让它弃权，不会让它回答错。

### 8.3 呼叫端的处理语义（提案）

`unrecognized` 与 `error` **都不是故障**，只代表「没有比今天更好的信息」。

| 状态 | 含义 | 呼叫端行为 | 记录（`attempts` / 返回值，供操作者看见） |
|---|---|---|---|
| `ok` | 结构看得懂、两个独立讯号一致 | `totalPages = pages` | `source: 'detected'`、`pages` |
| `unrecognized` | 预期中的结果之一（对象流、加密、增量更新、不是 PDF…） | **A（建议默认）**：`totalPages = 24`（= 今天的行为）；**B（严格）**：不提供 `totalPages` → 走 142 既有的 `chunk_fallback_skipped`（fail-closed） | A：`source: 'assumed_default'` + `reason`；B：`source: 'unavailable'` + `reason` |
| `error` | 侦测函数自己出例外（不应发生） | 同 `unrecognized`，`reason: 'exception'` | 同上 |

A 与 B 的取舍：A 保证「侦测器不会比今天更差」（弃权 = 今天的行为），代价是对无法识别的文件仍沿用一个已知有余量限制的假设值；B 对这类文件直接丢掉 chunk 救援路径，更严格，但可能把今天能成功的救援变成 `Needs_Review`。由于 §3.2 的安全网存在，A 的最坏结果有界。**我倾向 A**，这是你的决定（§9）。

### 8.4 接线草图（仅设计，未实现；是否采用取决于 §10 的门槛）

- **只在 chunk fallback 分支里才解析页数**（lazy）：`full_document` 成功的路径完全不变，零新增成本、零新增风险。做法是在 142 的 deps 增加一个可选的 `pageCountResolver(document)`（沿用本专案 deps 注入的惯例），只有 `document.totalPages` 未提供且进入 fallback 时才呼叫；170 注入的默认实作负责 `getFileBytes` → 转换 → `detectPdfPageCount_`。
- 需要改的既有测试：`171` 里「extractor 收到的 `totalPages` 就是该常数」那条（来源变成有条件）；新增：纯函数逐原因码测试、「永不外抛」性质测试、三种呼叫端语义测试、变异测试。
- 与 Phase N 预算的关系：侦测发生在任何 LLM 呼叫**之前或之间**、耗时是毫秒级、**不增加任何 fetch**，不占用执行预算。
- 不需要新的持久化契约，也不改 Sheet 结构；需要的文件改动是 ADR-005 的一段增补（文件）。
- 模块放在哪个编号、是否独立成档，留到真正授权实作时再定。

### 8.5 成本量级（Node，仅看数量级；GAS 会更慢）

| 输入 | 有号位元组 → Latin-1 字符串 | 三态侦测 | pdf-lib `load()` + `getPageCount()`（对照） |
|---|---|---|---|
| W14（122,680 bytes） | 约 1.6 ms | 约 0.3 ms | 约 14–16 ms，另加 525 KB 函式库 |
| 1.59 MB 的合法变体（V01，qpdf 正规化） | 约 13–20 ms | 约 3 ms | 约 70 ms |

数字取自多次执行的范围（共享机器，负载会造成波动），只用来判断数量级。

与 `extractOrders()` 一次 115–289 s 相比可忽略；GAS 的实际耗时与记忆体**【未验证】**。

### 8.6 方案选项对照

| 选项 | 内容 | 新生产代码 | 依赖的新证据 | 契约变更 | 主要风险 | 我的评价 |
|---|---|---|---|---|---|---|
| **D 现状** | 保持 24 | 无 | 无 | 无 | P ≥ 27 且 `full_document` 失败时漏订单页 → `Needs_Review` + 白花 ≤ 2 次呼叫 | **现在的建议**：风险有界，两个已知样本都覆盖 |
| D′ 调高常数 | 例如 30 | 改一个常数 + ADR / 测试文字 | 无 | 无 | 数字仍是猜测；T 越大 chunk 越大，分块意义越小 | 最便宜，但只是把猜测挪个位置；不建议 |
| **A 检测器 + 未识别退回 24** | §8 | 新纯函数 + 小接线 | 真实样本 + GAS 探针 + shadow（§10） | 无（142 契约不变） | 检测器答错（有界）；GAS 端未验证 | **门槛通过后的首选** |
| B 检测器 + 未识别 fail-closed | 同 A，但未识别时走 142 既有的 `chunk_fallback_skipped` | 同 A | 同 A | 无 | 对无法识别的文件丢掉 chunk 救援 | 比 A 严格；取决于真实世界的弃权比例 |
| **C 开放式最后一段** | 第二段改成「第 12 页到最后一页」，第一段仍 1–13；**不需要页数** | 改 142 范围计算、127 prompt、合并时的 `last_page_seen`、测试 | 需要真实 Gemini 验证「到最后一页」的遵循度（PENDING） | prompt / range 形状变更，需 ADR-005 增补 | 依赖模型遵循「到最后一页」；合并逻辑本来就没用真实 Gemini 验证过 | 唯一不依赖识别的方案；**真实样本大量弃权时的备选** |
| E 引入 pdf-lib | 525 KB 函式库 | 新依赖 + 载入机制 | GAS 内验证 | 无 | 供应链、体积、GAS 相容性；加密 / 截断丢例外 | 对这个需求过重；不建议 |
| F 用模型回报的 `last_page_seen` | 取 `full_document` 候选里的 `extraction_scope.last_page_seen` | 142 小改 | W14 的证据 | 无 | 循环论证；`full_document` 抛例外时没有候选 | 不建议当唯一来源；可作交叉检查 |
| G 导入时侦测并存进 Documents | 新增 `page_count` 栏位 | 110 + Documents 结构 | 同 A | **持久化契约变更** | 旧数据没有值（仍需回退）；与 Phase P 的栏位设计相关 | 不在本阶段决定；可在 Phase P 的栏位设计里一并评估 |

---

## 9. 建议与需要你决定的事项

**建议**

1. **现在不改任何生产页数逻辑**（Option D）。理由：风险有界且有既有安全网；两个已知样本（W01 = 24、W14 = 25）都被覆盖；目标类型的证据只有一份位元组；GAS 内的行为全部没验证；你要求没有充分证据前不动、不实作未验证的解析器。
2. **如果要往前推，走「证据先行」**（§10）：先在 Node 端用更多真实样本验证（零生产风险）→ 再用一个只读、不接流程的 GAS 探针验证三个 PENDING 项 → 再 shadow 记录 → 通过才讨论接线（Option A 或 B）。
3. **如果真实样本显示大量 `unrecognized`（尤其 `object_streams`）**，不要再加解析器，改评估 Option C。

**需要你决定 / 提供**（回复编号即可）

1. 是否提供更多真实 statement PDF（W05、W06、W33，以及手上任何其他周）？我只会在这次会话的工作区里对文件做结构分析（页树、xref、产生器等，不解读订单内容），不会把文件送到任何外部服务。越多不同周越好；另外请顺带告诉我这些文件是不是**原样**从 Grab 下载（没有另存、合并、裁页过）。
2. 是否授权写一个**只读、不接任何流程**的 GAS 探针（读指定 Drive 文件 → 转换 → 侦测 → 记录 `{fileId, bytes 长度, 耗时, status, pages, reason}`），由你在真实 GAS 里执行？
3. （只有 §10 通过后才需要）未识别时选 **A** 还是 **B**？
4. 是否要我把 **Option C** 展开成设计？它会改 prompt / range 形状，需要 ADR-005 增补，所以先问你。
5. Option G（Documents 新增 `page_count`）要不要并入 Phase P 的栏位设计一起评估？

---

## 10. 验证与解锁门槛

全部门槛通过之前，生产保持现状。门槛是我的提议，数字由你调整。

| 门槛 | 内容 | 通过条件 | 状态 |
|---|---|---|---|
| G1 真实样本（Node） | 用 §9 第 1 点提供的真实 PDF，逐份记录产生器、PDF 版本、xref 型态、页树形状，跑三态原型，对照 pikepdf + qpdf + pdfinfo 的真值 | 建议 ≥ 10 份、涵盖不同周；**所有 `ok` 的答案 0 错**；记录识别率与每个 `unrecognized` 的原因码。任何一个自信的错答案 → 修规则后全部重跑，或放弃该方案 | **PENDING**（等样本） |
| G2 GAS 探针（真实 GAS） | 验证 `getBytes()` 的元素型态与长度、转换耗时与记忆体、侦测函数在 GAS V8 的耗时，并与 Node 对同一份文件的结果逐份比对 | 每份与 G1 的 Node 结果一致；耗时在毫秒到数十毫秒量级 | **PENDING**（等授权与执行） |
| G3 shadow 记录（真实 GAS） | 在真实 `consoleRunDailyAllocation_` 旁路记录 detected 与 assumed，**不改行为** | 累积若干次真实执行；detected 与独立真值（手动 `pdfinfo`）一致 | **PENDING** |
| G4 决策 | 满足 G1–G3 → 你授权接线（A 或 B）+ 测试；否则维持现状，或转 Option C | — | — |

---

## 11. 尚未验证（PENDING）清单

- **真实 GAS**：`getBytes()` 元素型态、Blob → 字符串转换、耗时 / 记忆体、侦测函数在 GAS V8 的行为——全部**PENDING**。
- **真实 Gemini**：chunk fallback 是否遵循页码范围、chunk 合并逻辑（既有 PENDING，本阶段没有改变）、Option C 的「到最后一页」遵循度、估大 T 时落在文件之外的第二段如何处理。
- **目标类型样本覆盖**：W14 以外**全部未验证**（W01 仅文件记载）。
- 「wkhtmltopdf / Qt 4.8.7 对所有周输出同一种结构」：只有 W14 一份位元组证据，**未验证**。
- 文件到 Drive 之前是否被二次处理：**未验证**。
- Apps Script `Blob.getDataAsString(charset)` 对 `ISO-8859-1` 的支持：**未验证**（官方 Blob 参考页抓取未取得方法细节；方案不依赖它）。
- Gemini `countTokens` 的实际行为：**未验证**（本环境没有 API 存取）。
- 语料与随机损坏都是合成的：识别率 / 弃权率**不代表真实世界**；随机损坏的「真值」以 pikepdf / qpdf 为代理，`ambiguous` 以两个工具不一致界定，没有人工逐份标注。
- 三态原型已知盲区：看不见「叶节点内部的语法损坏」（§6.5）；间接 `/Count` 目前靠一致性检查碰巧弃权（§6.4.1）。
- 间接 `/Kids`、`/Count` 只用手写的最小 3 页 PDF 验证过，W14 以及目标类型都没有这种写法的实例。
- 本阶段**没有**重跑 repo 回归（没有改动任何 repo 文件）；Phase N 的结果（两个时区各 779 PASS / 5 legacy FAIL）不受影响，也没有被重新验证。

---

## 12. 本阶段交付

- **修改的文件**：无（没有改动任何 `.js`、`.html`、测试、ADR、治理文件）。
- **新增的文件**：本报告 `PhaseO_PDF_PageCount_Investigation_2026-10-14.md`。
- **证据**：§2（用法追踪）、§3.3 / §6.1（W14 位元组实测）、§6.3–§6.5（语料 28 份、合法变体 18 份、间接对象 4 份、随机损坏 2 × 6,500 份）、§5（官方文件与社群来源）。
- **测试结果**：Node / Python 本地实验，不是 repo 测试，没有 PASS / FAIL 之分；结果见 §6。三态原型与实验脚本**不在 repo 里、没有交付**；需要的话可以附上（原型文件 `o_detect_proto.js` 共 108 行，其中含另外 7 种对照识别法；脚本见附录 A）。
- **尚未验证**：§11。
- **治理文件**（CHANGELOG「Verification-only」、`VERIFICATION_STATUS.md` 第 14 行）：按前面的安排，等 Phase P 完成后一次性同步，不在这一阶段单独改。

---

## 附录 A：复现方式

工具与版本：Node v22.22.0；pdf-lib 1.17.1（MIT）；playwright 1.56.0（Chromium 1194）；Python 3.13.16；pikepdf 10.13.0.post1；pypdf 5.9.0；reportlab 5.0.1；qpdf 11.9.0；poppler `pdfinfo` 24.02.0；`pdftocairo`、`pdfunite`（poppler 24.02.0）；`pdftk`。

脚本（在会话的 scratchpad，未交付）：

| 脚本 | 用途 |
|---|---|
| `o_make_corpus.py` + `o_node_gen.js` | 产生 28 份语料（Python / Node 两部分） |
| `o_truth.py` | 记录每份的 pikepdf / pypdf / qpdf / pdfinfo 页数 |
| `o_detect_proto.js` | 8 种识别法（含三态原型），纯函数，Latin-1 字符串输入 |
| `o_eval.js`（`--compact`） | 逐文件比对与汇总表 |
| `o_variants.py` | 产生 18 个合法变体 |
| `o_indirect.py` | 产生 4 个间接 `/Kids`、`/Count` 的最小 PDF（§6.4.1） |
| `o_truth_fast.py` + `o_fuzz.js` | 随机损坏测试（seed、数量由参数给定） |
| `o_bench.js` | 数量级耗时 |
| `o_w14_pages.py` | W14 逐页行首记号统计（不输出任何订单内容） |

命令（路径依环境替换）：

```
python3 -I o_make_corpus.py <W14.pdf> <debug.pdf> <新的空目录>
NODE_PATH=<node_modules> node o_node_gen.js <同一个目录>
python3 -I o_truth.py <语料目录> truth.json
NODE_PATH=<node_modules> node o_eval.js <语料目录> truth.json --compact
python3 -I o_variants.py <W14.pdf> <新的空目录>
python3 -I o_indirect.py <新的空目录>
NODE_PATH=<node_modules> node o_fuzz.js <W14.pdf> <新的空工作目录> 6500 20261014 <新的空保留目录>
NODE_PATH=<node_modules> node o_fuzz.js <W14.pdf> <新的空工作目录> 6500 424242 <新的空保留目录>
```

同一个 seed 重跑得到逐行相同的结果（已验证 `20261014` 两次一致）。

## 附录 B：来源

- Google Drive API v3，File resource：<https://developers.google.com/drive/v3/reference/files>（读了前 100,000 / 116,240 字元）
- Digital Inspiration，Count Number of Pages in PDF with Google Script：<https://labnol.org/code/20127-count-pdf-pages>
- Apps Script，Class Blob：<https://developers.google.com/apps-script/reference/base/blob>（页面抓取没有取得方法细节，因此 `getDataAsString(charset)` 未验证）
- loslab，Understanding PDF page trees：<https://blog.loslab.com/en-us/pdf-structure/understanding-pdf-page-trees-why-page-order-matters.html>（`/Count` 是子树叶节点数、规格不强制其与实际一致、增量更新后可能过期；建议把 `/Count` 当提示、以遍历为准）
- ISO 32000-1:2008：<https://www.iso.org/standard/51502.html>（只确认标准条目，没有读标准全文）
- repo 内文件：`ADR-005-gemini-order-extraction.md` L101；`Gate2_Independent_Source_Verification_v2_2026-09-14.md` L16–17；`Gate2_ReClose_Evidence_Proposal_2026-09-10.md` L68；`PDF_Extraction_Feasibility_POC_Report.md` L68；`compliance-os-phase4-gemini-extraction-design.md` L141
