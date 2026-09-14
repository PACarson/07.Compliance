# Gate 2 Independent Source Verification (完成版)

**说明**：这份取代同一天稍早产出的 BLOCKED 版本（`Gate2_Independent_Source_Verification_2026-09-14.md`）——那份不删除，作为过程记录保留。Steven 提供原始 PDF（`2026-W01.pdf`）之后，本次完成完整的 source-grounded 独立验证。
**产出性质**：Verification artifact —— 不是 ADR closure，不包含任何代码变更
**承接**：`Gate2_ReClose_Evidence_Proposal_2026-09-10.md`（PROPOSED FOR RE-CLOSE）

---

## Source

| 项目 | 值 |
|---|---|
| Drive file ID | `1fUrux2zoQgvKe0DvsPrR5Xma9pxa57yA` |
| Filename（本次上传） | `2026-W01.pdf` |
| MIME type | application/pdf |
| 页数 | 24（与 `extraction_scope.last_page_seen` 一致） |
| 产生方式 | wkhtmltopdf 0.12.6.1（HTML → PDF），非扫描件 |
| 字体 | Roboto-Light / Roboto-Bold，CID TrueType，Identity-H，**已嵌入且带 ToUnicode 映射**（emb=yes, uni=yes）——文字层可高可信度提取 |
| **Source accessibility** | **ACCESSIBLE**（本次由 Steven 直接上传） |

**方法**：`pdftotext -layout` 做位置保留的文字提取（用 7 个日期标题的行号界定每天区块的边界，避免线性文字导致的顺序误判），再用 `pdftoppm -r 150` 把关键页面（9、10、21）栅格化后直接视觉核对字符，两种方法互相印证。

---

## Ground-Truth Results

**Statement period**：页面 1 印出的原文是 **"29 Disember, 2025 - 4 Januari, 2026"**，与 Gemini 解析出的 Isnin 29 Disember – Ahad 4 Januari 一致。

**七个 daily printed subtotals**——全部逐一核对到，位置精确对应每个日期标题的前一行或后一行：

| Date | PDF（位置核实） | Gemini（10/10 次） | Result |
|---|---|---|---|
| 29 Disember | RM157.90 | RM157.90 | PASS |
| 30 Disember | RM196.00 | RM196.00 | PASS |
| 31 Disember | RM174.70 | RM174.70 | PASS |
| 1 Januari | RM187.60 | RM187.60 | PASS |
| 2 Januari | RM162.40 | RM162.40 | PASS |
| 3 Januari | RM213.50 | RM213.50 | PASS |
| 4 Januari | RM205.50 | RM205.50 | PASS |

**Weekly total**——PDF 本身有两个不同范围的数字，先厘清：页 1「Ringkasan」印的「Jumlah Mingguan」是 **RM1,932.80**（含 Insentif/Tip/Pelarasan Pendapatan/Bayaran lain-lain 等全部收入项）；「Butiran pendapatan」表格里单独一行「Pendapatan bersih penghantaran」印的才是 **RM1,297.60**——这是 Gemini 订单层级抽取（Butiran Tempahan）对应的正确比对基准，与 Steven 任务卡里指定的数字一致。两个数字都是真的，只是范围不同，不是矛盾。

**`8PRUR5AGXAQRAV`**（页 21，视觉核对）：GrabFood / Tanpa tunai / base 2.20 / adjustment 1.80 / net 4.00——与 10 次呼叫逐字段一致，PASS。

**Ambiguous ID #1**（原判定 Sabtu 区块，10 次中 3 vs 7）：页 10 第一行清楚印着 **A-8QHEGDFGX8OKAV**。`pdftotext -layout` 全文只有这一处匹配，栅格图确认字符清晰无模糊。判定：**PDF 真值 = 8QHEGDFGX8OKAV**，对应 7/10 的多数读法；3/10 读法（少一个 Q）是 Gemini 的误读。

**Ambiguous ID #2**（原判定 Ahad 区块，10 次中 1 vs 9）：页 9 清楚印着 **A-8QJRNFPWWTKQAV**。这个 ID 在全文出现两次——一次在这里的订单区块，一次在页 2 的 Tip 明细——两处都写作 8QJRNFPWWTKQAV，互相印证。判定：**PDF 真值 = 8QJRNFPWWTKQAV**，对应 9/10 的多数读法；1/10 读法（少一个 J）是 Gemini 的误读。

两处的判定依据都是"直接读到 PDF 上印的字符"，不是"哪个读法次数比较多"——这次刚好两次都是多数读法为真，但这是核对出来的事实，不是套用多数决规则得出的结论。

**关于 "SOURCE ITSELF AMBIGUOUS"**：不适用。这份 PDF 是 wkhtmltopdf 产生的向量文字，不是扫描件，两处争议字符在 150 DPI 栅格图上都清晰无歧义。字符层面的分歧完全出在 Gemini 偶发的读取失误，不是原始文件本身不清楚。

---

## Verification Matrix

| Verification Item | PDF Ground Truth | Gemini Result | Result |
|---|---|---|---|
| Statement period | 29 Disember, 2025 - 4 Januari, 2026 | Isnin 29 Disember – Ahad 4 Januari | PASS |
| 29 Dec subtotal | RM157.90 | RM157.90 | PASS |
| 30 Dec subtotal | RM196.00 | RM196.00 | PASS |
| 31 Dec subtotal | RM174.70 | RM174.70 | PASS |
| 1 Jan subtotal | RM187.60 | RM187.60 | PASS |
| 2 Jan subtotal | RM162.40 | RM162.40 | PASS |
| 3 Jan subtotal | RM213.50 | RM213.50 | PASS |
| 4 Jan subtotal | RM205.50 | RM205.50 | PASS |
| Weekly total（Pendapatan bersih penghantaran） | RM1,297.60 | RM1,297.60 | PASS |
| "8PRUR5AGXAQRAV" | 2.20 / 1.80 / 4.00, GrabFood, Tanpa tunai, p.21 | 逐字段一致 | PASS |
| Ambiguous ID #1 | A-8QHEGDFGX8OKAV | 7/10 一致，3/10 少一个 Q | PASS（真值=多数读法） |
| Ambiguous ID #2 | A-8QJRNFPWWTKQAV | 9/10 一致，1/10 少一个 J | PASS（真值=多数读法） |

---

## Gate 2 Status

**PASS — READY FOR ADR-005 CLOSURE**

Steven 原定的 5 个 PASS 条件——statement period 相符、七个 subtotal 全部相符、weekly total 相符、`8PRUR5AGXAQRAV` 相符、两个 ambiguous ID 都对着原始 PDF 解决——本次全部满足，没有一项需要动用"PDF 本身就模糊"的例外条款。

---

## Repository Change Status

**NO CODE CHANGE.** 本次全程只读：在 Claude 自己的 sandbox scratch 目录处理上传的 PDF 副本（`pdfinfo`/`pdffonts`/`pdftotext`/`pdftoppm`）。未修改 `900_Constitution.js`、`127_LLMExtractor.js`、`125_ExtractionValidation.js`、`142_DailyOrderAllocation.js`、`108_SheetSetup.js`、`999_LatencyReliabilityObservation.js`；未触碰 ADR-005、checksum、manifest 或任何 production 档案；未执行任何额外 Gemini 呼叫；未变更 locked fixture file ID；未加入 majority-vote、ID normalization、parser 或 checksum 逻辑。

---

## Remaining Non-Blocking Uncertainty

只剩一项，与本次 source verification 无关，本次未重新调查（按指示不扩大范围）：

**历史上为什么会出现 9 个不同 `drive_file_id`**：
- confirmed：这批已验证的 10 次呼叫，observation harness 用的是同一个 hardcode 的 fixture ID
- confirmed：harness 本身没有 runtime file-ID override 路径
- not confirmed：历史上那 9 个不同 file_id 具体是怎么产生的
- not confirmed：production 的 document-import 路径是否完全不会有类似的 file-identity drift 风险
- 不把这个历史问题定性为"人为失误"或"test harness 操作痕迹"——这两种说法目前都没有被独立证实

（先前 Evidence Proposal 列为"待解决"的 2 个 order-ID 字符级真值问题，本次已经解决，从这份清单移除。）

---

*本文件是 verification artifact。ADR-005 的实际修改与否，仍是 Code→Verify→Governance 流程里 Governance 那一步，等 Steven 决定。*
