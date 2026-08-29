# PDF Extraction Feasibility / POC Report
## Compliance OS — Daily Order-Level Allocation（Butiran Tempahan 是否可以不依赖 Gemini）
2026-08-29

本报告回答 Steven 提出的问题：**Butiran Tempahan（订单级明细）能不能完全用 deterministic text/layout extraction 完成，不依赖 Gemini？** 测试对象是两份真实官方 PDF：W01（24 页，跨月）、W33（23 页，单月）。没有修改 112/127/142 任何一行production code——全部比较跟 POC parser 都是独立的新脚本，只在最后阶段直接呼叫 142 现有、未修改的 `candidateFromGeminiOrderRow_` / `computeDailyChecksum_` / `computeStatementChecksum_`。

（第一版报告时 W33 的 PDF 中途从沙盒消失过，你重新传了一次之后，下面已经是 W01+W33 两份都完整跑过 order-row 级别验证、直接呼叫真实 142 函数产生的最终结果。）

---

## 1. 先回答一个前提问题：GAS 原生能不能拿到 PDF 文字层

答案是**不能直接拿到文字层本身**，只有一条路：`Drive.Files.insert(pdfBlob, {ocr:true})` 把 PDF 转成 Google Doc，再用 `DocumentApp` 读出转换后的文字。这个 API 参数本身就叫 `ocr:true`——代表即使 PDF 有完整文字层，GAS 走这条路也是让 Google 重新用视觉辨识"读"一次页面，不是直接读 PDF 内部的文字物件。这跟这次在 sandbox 里用 `pdftotext`/`pdfplumber`/`pymupdf` 直接读文字层，是两种不同性质的操作。

另外，检查了现有代码：`112_DocumentTextExtractor.js` 里 OCR 那个槽位（`placeholderOcrExtractor_`）从一开始就是明确的占位符，直接 throw error，注释写着"尚未实作"。`121_GrabWeeklyParser.js` 的正则解析也从来没真的接过 GAS 产生的文字——从头到尾都在测 mock 字符串。**这个专案里，deterministic 抽取从来没有真的在 GAS 上跑过一次**，就连最简单的 Ringkasan 摘要栏位都没有。所以这次的问题不是"要不要放弃一条已证明能用的路径"，而是"这条路径从零开始，跟 Gemini 上周三之前的处境一样，完全未经真实环境验证"。

**这个未知数没办法在这个 sandbox 里解决**——只有你在真实 GAS 跑一次 `Drive.Files.insert(..., {ocr:true})` 才能知道 Google 的 OCR 转换对这份表格的还原度如何。下面第 2-6 节证明的是"如果能拿到乾净的文字/坐标，deterministic 解析逻辑能不能做对"，这是必要但不是充分的条件。

---

## 2. 抽取方法比较：用已知会出问题的那一行做压力测试

W01 第 21 页、Isnin 29 Disember、订单 `8PRUR5AGXAQRAV`，这行之前被证实是 `pdftotext -layout` 的已知 artefact。五种方法直接在真实 PDF 上重跑：

| 方法 | 这一行的重建结果 |
|---|---|
| `pdftotext`（plain，无 -layout） | 完全打散：`ATanpa` 粘在一起，金额跟 ID 脱节 |
| `pdftotext -layout`（既有 baseline） | **重现已知 artefact**：金额行先出现，Order ID 跟付款方式被推到下一行，`GrabFood` 悬空 |
| `pdfplumber`（默认 `.extract_text()`） | 另一种打散：金额被排到 ID 跟平台名"之前"，`A-` 悬空排到最后 |
| `pymupdf`（`get_text("text")`） | **完全正确重建**：`Pesanan Tunggal / GrabFood / A- / 8PRUR5AGXAQRAV / Tanpa / tunai / 2.20 / 1.80 / 4.00`，顺序、分组全部正确 |
| Claude 上传管线自动产生的文字（对照组） | 同样完全正确重建 |

**结论**：这个已知 artefact 是 `pdftotext -layout` 这个特定算法（靠字符网格对齐列）的弱点，不是这份 PDF 本质上读不出来。至少两种独立方法（pymupdf 的阅读顺序演算法、以及产生你附件预览文字的那个管线）完全不受影响。这件事本身就是重要证据：**"deterministic extraction 靠不住"这个印象，主要来自一直只测过 `pdftotext -layout` 这一种做法，换一种演算法结果完全不同。**

---

## 3. 版面陷阱 1：小计的位置比想象中反直觉

肉眼读 linear text 很容易读错——我自己第一次读的时候就理解错了。用 `pdfplumber` 把 W01 全部「RM 小计」跟「日期标题」按真实阅读顺序（page, 然后 y 坐标）排出来后，真相是：

```
Ahad, 4 Januari  ← 标题
  [Ahad 的订单...]
RM205.50         ← 这其实是 Ahad 自己的小计
Sabtu, 3 Januari ← 下一天标题
  [Sabtu 的订单...]
RM213.50         ← 这其实是 Sabtu 自己的小计
Jumaat, 2 Januari ← 下一天标题
  ...
```

**每一天的小计，印在那一天订单结束之后、下一天标题出现之前**——不是像直觉以为的"标题后面接的数字就是那天的小计"。用这个规则重新切分 W01 全部 7 天，7 个小计加起来 = **1,297.60**，跟官方 Verified Income 的 net_delivery_income 完全一致，一分钱不差。W33 用同一套规则也验证过（第 5 节）。这个规则是机械、一致、可编码的——不是运气——但如果没有专门去验证，很容易写出一个"看起来合理但对不上"的 parser。

---

## 4. 版面陷阱 2：金额栏位「值是 0 就整格留白」

第二个真正会让 naive parser 出错的地方：`Pendapatan lain`（other_income）这一栏，只要值是 0，PDF 就直接留白，完全不印 "0.00"，其他三栏（asas / Pelarasan Pendapatan / bersih）不管是不是 0 都照印。这代表**同一笔订单有时候只印 3 个数字，有时候印 4 个**，如果 parser 用「照顺序读 4 个数字」这种逻辑，会把值读到错的栏位去（用金额加总去反推"应该是哪一栏"这件事，在纯粹只有 3 个数字时数学上是双解的，猜不出来）。

正确做法：不能只看"读到几个数字"，要看**每个数字实际印在页面哪个 x 坐标**，比对 4 个栏位表头各自的 x 范围来分栏。这需要坐标级的抽取（`pdfplumber`/`pdftohtml -xml` 这类能给 x/y 的方法），纯 linear text（不管是 `pdftotext` 还是 `pymupdf` 的 `get_text("text")`）都拿不到这个信息，会在这类留白栏位上出错——这也是为什么第 2 节 pymupdf 表现最好，但真的要把这整张表格解析对，还是需要坐标，不能只靠阅读顺序乾净就够。

---

## 5. 完整 POC 结果（W01 + W33，都直接呼叫真实、未修改的 142 函数）

用 `pdfplumber` 坐标分栏版 parser 产生 day/order 候选，逐笔呼叫 `candidateFromGeminiOrderRow_`，再用 `computeDailyChecksum_` / `computeStatementChecksum_`——三个函数全部是 142 现有代码，一行没改：

### W01（24 页，跨月）

| 日期 | 笔数 | 算得 | 印刷 | 状态 |
|---|---|---|---|---|
| Ahad 4 Januari | 30（+1 Needs_Review） | 199.00 | 205.50 | Discrepancy_Flagged |
| Sabtu 3 Januari | 28 | 213.50 | 213.50 | **Matched** |
| Jumaat 2 Januari | 20 | 162.40 | 162.40 | **Matched** |
| Khamis 1 Januari | 22 | 187.60 | 187.60 | **Matched** |
| Rabu 31 Disember | 23 | 174.70 | 174.70 | **Matched** |
| Selasa 30 Disember | 27（+1 Needs_Review） | 190.50 | 196.00 | Discrepancy_Flagged |
| Isnin 29 Disember | 20（+1 Needs_Review） | 153.90 | 157.90 | Discrepancy_Flagged |
| **整周** | **170+3 NR＝173** | **1,281.60** | **1,297.60** | Discrepancy_Flagged |

### W33（23 页，单月）

| 日期 | 笔数 | 算得 | 印刷 | 状态 |
|---|---|---|---|---|
| Ahad 16 Ogos | 26 | 192.30 | 192.30 | **Matched** |
| Sabtu 15 Ogos | 22 | 184.50 | 184.50 | **Matched** |
| Jumaat 14 Ogos | 27 | 193.70 | 193.70 | **Matched** |
| Khamis 13 Ogos | 22 | 157.30 | 157.30 | **Matched** |
| Rabu 12 Ogos | 11（+1 Needs_Review） | 112.30 | 118.10 | Discrepancy_Flagged |
| Selasa 11 Ogos | 18（+1 Needs_Review） | 145.50 | 160.10 | Discrepancy_Flagged |
| Isnin 10 Ogos | 23 | 189.10 | 189.10 | **Matched** |
| **整周** | **149+2 NR＝151** | **1,174.70** | **1,195.10** | Discrepancy_Flagged |

**这个 Discrepancy_Flagged 是对的，不是 bug**——`computeDailyChecksum_` 本来就只加总真正建构成功的 order，Needs_Review 那几笔被正确排除在外，所以含 Needs_Review 的那几天正确地"没有 Matched"，而不是假装没事。两份合计 324 笔订单里，319 笔（98.5%）栏位全部正确、直接 Matched；5 笔（W01 三笔、W33 两笔）**金额全部正确**（每一笔的净额刚好等于该天的差额：6.50/5.50/4.00/5.80/14.60），只有 `order_id_raw` 因为这份 PDF 在这几个位置的文字物件坐标排列方式而无法可靠归属，正确地进 Needs_Review，不是猜一个 ID 硬填、也没有为了凑 checksum 动过任何金额。**这 5 笔的 order ID 只要人工对照原始 PDF 确认一次（金额已经确定是对的，只是补 ID），14 个 daily checksum + 2 个 statement checksum 会全部变成 Matched。**

值得注意：不同抽取方法踩到的雷不一样——`pdftotext -layout` 过去只在 W01 的 Isnin 那 1 笔出问题；这次坐标分栏法在 W01 额外抓到 2 笔（Ahad、Selasa 各 1）、W33 抓到 2 笔（Rabu、Selasa 各 1）也是同一类问题。没有一份"标准答案清单"能涵盖所有雷，这正是为什么 checksum 必须是最终防线，不能只靠"清单外都算过"这种假设。

另外，W33 的单-ID Sekaligus 也确认存在：`Pesanan Sekaligus / GrabFood / A- 9N6CL8JWWDKLAV`，只有 1 个 ID、没有 "and N"，在 Khamis 13 Ogos——直接从真实 PDF 程式化扫出来，不是沿用旧 fixture 的说法。

---

## 6. 最重要的判断

**结论：C，Hybrid——但跟一般"各做一半"的 hybrid 不一样，这里的分工建议是「deterministic 当 primary，Gemini 当 fallback／交叉验证」，理由如下，不是因为已经写了 Gemini code 就预设选它：**

- 支持"deterministic 可以当 primary"的证据（本报告用两份真实 statement 实测）：格式是固定模板；解析逻辑在拿到坐标级文字时，W01+W33 合计 324 笔里 319 笔（98.5%）完全正确、直接呼叫真实 142 函数就是 Matched，其余 5 笔正确地落到 Needs_Review 而不是猜错、且金额全部正确；两个真正的版面陷阱（小计位置、栏位留白）都已经用两份真实 PDF 各自独立验证一致，且是**机械、确定性的规则**，不是启发式猜测；完全不产生 Gemini 的 token 成本、也没有 quota/503/429 这类外部依赖。
- 唯一没有解决、也解决不了的：**GAS 原生能不能产出坐标级或至少跟 pymupdf 一样乾净的文字**，这个只有 `Drive.Files.insert(...,{ocr:true})` 真的在 GAS 里跑一次才知道，无法在这个 sandbox 验证。如果 GAS 的 OCR 转换品质够好（哪怕比不上 pdfplumber，只要不比 `pdftotext -layout` 差），deterministic 当 primary 是有真实证据支撑的；如果 GAS 的 OCR 品质明显更差（比如常态性把栏位读错、行序打乱），那就应该退回 B（Gemini 当 primary）。
- Gemini 的角色不会因此消失：至少在 (a) 真实 GAS 环境验证 OCR 品质之前、(b) 遇到本报告这 5 笔这类 Needs_Review 的情况时，Gemini 仍然是有价值的 fallback / 第二意见来源——这跟你原本 Phase 4 的"Gemini 不是 Truth Engine，checksum 才是"完全一致，只是现在 checksum 通过的第一顺位候选人可能从 Gemini 变成 deterministic。

**建议的下一步（不是现在就决定）**：你在真实 GAS 跑一次 `Drive.Files.insert(pdfId, {ocr:true})` 转换 W01，把转出来的 Google Doc 文字贴回来，我直接拿这份真实 GAS 产出的文字去跑同一套 checksum 验证——这一步做完，A vs C 的判断就有真实环境证据，不用再靠这个 sandbox 的推测。

---

## 7. PDF → Gemini 直接 vs PDF → deterministic text → Gemini

没有真实 Gemini API 可以在这里实测，以下是基于本次发现推理出的判断，不是实测结论：

**倾向 PDF → Gemini 直接（不要先转文字再喂给它）**，理由：
- 第 4 节发现的"栏位留白"问题，本质上是**丢失了空间/视觉资讯就无法正确判断**——Gemini 直接读 PDF（原生多模态）时能利用跟人眼一样的视觉线索去分辨"这一格是空的"，而不是像纯文字流那样，3 个数字要嘛全部读对要嘛数学上有歧义
- 先转文字这一步，等于用了本报告一直在验证的其中一种（可能不完美的）deterministic 方法，把它的误差直接传给 Gemini，等于两层误差叠加，而不是两条独立的验证路径
- 唯一支持"先转文字再喂 Gemini"的理由是省 token/成本，但 Phase 4 设计阶段已经算过这份文件用 Gemini 直接读的成本（每份 statement 约 $0.03-0.05），不构成真正的限制

如果你想要 Gemini 当 fallback 而不是唯一防线，直接喂原始 PDF 应该更稳，也更符合现有 142/127 已经写好的架构（Gemini Adapter 本来就是直接吃 PDF blob）。

---

## 状态

Deterministic 解析逻辑在 W01、W33 两份真实 statement 上都已经完整验证到 checksum 层级（直接呼叫真实、未修改的 142 函数）。GAS 原生文字抽取品质是唯一没办法在这里解决的未知数，等同于当初 Gemini 需要真实环境验证的处境，等你跑一次 `Drive.Files.insert(...,{ocr:true})` 才能补齐。112/127/142 全部未修改，本报告全部是独立的新脚本产生。
