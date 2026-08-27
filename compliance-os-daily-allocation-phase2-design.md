# Compliance OS — Daily Order-Level Allocation
# Phase 2: Data Model + Algorithm Design（未写任何 production code）

状态：Phase 1 已由 Steven 确认；抽取方式已决定（**确定性文字/表格解析，LLM 不碰 order-level**）。本文件是 Phase 2 的完整交付——Data Model + 五个 Algorithm + Error 条件 + Idempotency + Test Plan。**没有修改任何 `.js` 文件**，142/143 目前只是提案编号，还不存在。

---

## 0. 文件编号：142/143 二次确认

对整个 repo 重新 grep 了一次 `142`、`143_`、`DailyAllocation`、`Order_Allocation` 等关键字——除了 Phase 1 报告本身留下的那笔 memory 记录以外，**代码库里没有任何隐藏引用**。142/143 是干净的：

- `142_DailyOrderAllocation.js`
- `143_Tests_DailyOrderAllocation.js`

位置落在 `140_VerifiedIncome.js` 之后、`150_ComplianceCalendar.js` 之前，符合 handoff 自己画的 `Verified Income → Daily Allocation → Monthly Projection` 顺序。

---

## 1. Status 词汇：沿用现有，不另造一套

现有系统里已经有的（都读过实际代码确认）：

| 模块 | 词汇 |
|---|---|
| `110_DocumentImport.js` | `Imported` / `Already_Imported` / `Duplicate_Skipped` |
| `130_Reconciliation.js` | `Not_Performed` / `Matched` / `Discrepancy_Flagged` |
| `150_ComplianceCalendar.js` | `Upcoming` / `Due_Soon` / `Overdue` / `Completed` |
| `160_MonthlyProjection.js` | `Missing_Period` / `Full` / `Needs_Allocation` / `Not_Configured` |
| CMP-P10 canonical 例子 | `Failed_Parse` / `Needs_Review` |

**决定**：

- **Checksum 结果**（order rows→daily subtotal、daily→statement）直接**沿用 `Matched` / `Discrepancy_Flagged`**——这跟 Reconciliation 本质上是同一件事（拿一个算出来的数字比对一个官方陈述的数字），没有理由另造 `Checksum_Passed/Failed`。唯一差异是**容差**：Reconciliation 比对的是两个独立来源（Statement vs Rider OS 估计），所以有 RM5/0.5% 容差；这里两边数字都来自**同一份 PDF**（订单行 vs 印出来的小计），理论上该完全相等，所以容差 = 0（只用 `round2_` 消除浮点误差，不做业务容差）。这点会在 §4 明确写。
- **Allocation 完整度**：`Fully_Allocated` / `Partially_Allocated` / `Needs_Review` 是新词，因为现有词汇里没有对应的（`Needs_Allocation` 语意不同，见下）。`Not_Performed` 直接沿用 Reconciliation 的。
- 你原本列的 `Failed_Checksum` 我建议**折进 `Needs_Review`**，不单独设——两者在这个语境下没有实质区别（都是"人要看一眼"），CMP-P10 自己举的例子就是 `Needs_Review`，多一个近义词只会增加以后要维护"这两个到底差在哪"的心智负担。如果你觉得需要区分"数字对不上"跟"数字对上但资讯不完整"这两种不同的人工介入，跟我说，我可以把 `checksum_status`（细）跟 `allocation_status`（粗）分开存，细的那层已经天然靠 `checksum_status: Discrepancy_Flagged` 承担了。
- `160_MonthlyProjection.js` 的 `Needs_Allocation` 现在的语意是"整份 Statement 不知道该算进哪个月"（粗颗粒）。Daily Allocation 上线后，凡是能做到 `Fully_Allocated` 或 `Partially_Allocated` 的 cross-month statement，理论上都不再需要停在 `Needs_Allocation`——这个状态会**收窄**成只在 Daily Allocation 自己也失败时才出现（比如 checksum 对不上）。这个收窄不在这次 Phase 2/3 scope 内做（不动 160），先记在这里，等 Phase 5"接入 Monthly Projection"时再处理。

---

## 2. Data Model

### 2.0 设计原则：CMP-P6 逐栏检验

你列的三层，我逐栏问了一次"这是真的 Fact，还是能从别的栏位 + 时间即时算出来"（CMP-P6：可推导的状态不存储）。结论是**四层**，不是三层——多切出一张表，理由见下面 2.2。

还有一个不是"能不能推导"、而是"该不该存"的判断：**checksum 的结果本身**（`printed_daily_subtotal`、`checksum_difference`、`checksum_status`）技术上都能从 Order_Allocation 现场重算，但我建议照样存——这跟 `Reconciliation_Log` 是同一个模式（`statement_total`/`rider_total` 也都"能重算"，但照样整笔存进 log）：**"我们检查过、结果是这样"这件事本身就是要保留的事实**，不是纯衍生值。CMP-P10 也要求"尝试过"要留痕。

**完全不碰 `Verified_Income`**——跟 Reconciliation 一样，这整层是事后附加的 annotation，不写、不改、不删 `Verified_Income` 的任何栏位（CMP-P5/CMP-P12 精神）。

### 2.1 `Order_Allocation` —— 逐行 Butiran Tempahan 证据

```
allocation_row_id      TEXT  PK.  {allocation_batch_id}-R{rowIndex}
verified_income_id     TEXT  FK → Verified_Income
document_id            TEXT  drive_file_id（CMP-P11，不存路径）
allocation_batch_id    TEXT  这次 parse 产生的批次 id，见 §2.5
order_date             TEXT  ISO YYYY-MM-DD（日+月来自 PDF，年份靠 period 推断，见 §5）
order_row_type         TEXT  'Tunggal' | 'Sekaligus'
platform               TEXT  'GrabFood' | 'GrabMart' | 'GrabExpress'
order_id_primary       TEXT  Butiran 栏第一个订单号
order_id_raw           TEXT  Butiran 栏原始全文（含 "and N"），逐字保留，CMP-P5
bundled_order_count    NUM   Tunggal=1；Sekaligus= 明列的 id 数 + "and N" 的 N
order_identity_status  TEXT  'Fully_Known' | 'Partially_Known'（有 and N 省略时）
payment_method         TEXT  'Tanpa_Tunai' | 'Tunai' | 'Mixed'
base_income            NUM   Pendapatan asas（陈述值）
other_income           NUM   Pendapatan lain（陈述值，常是 0）
income_adjustment      NUM   Pelarasan Pendapatan（陈述值）
net_income             NUM   Pendapatan bersih（陈述值，CMP-P5 权威）
source_page            NUM   PDF 页码
source_section         TEXT  常量 'Butiran_Tempahan_Penghantaran'（为将来其他 section 预留栏位，不是现在需要用到）
extraction_method      TEXT  'Deterministic_Text_Parse_v1'
created_at             TEXT  ISO timestamp
```

`textColumns`（跟着 108_SheetSetup.js 的规则：ID/代码/字串一律强制文字格式，金额/整数栏位不列入）：除了 `bundled_order_count`、`base_income`、`other_income`、`income_adjustment`、`net_income` 以外全部。

**没有存 `order_month`**——100% 能从 `order_date.slice(0,7)` 即时算，CMP-P6，不重复存。

### 2.2 `Non_Order_Income_Allocation` —— 为什么要多切一张表

你原本的三层设计里，Tip/Insentif/Bayaran lain-lain 的"能不能分配到日期"是被塞进 `Daily_Allocation` 的 `allocatable_incentive`/`unallocated_incentive` 这类栏位。我改成**独立一张表，一行对一条 PDF 上的原始条目**，理由：

1. 三个 component 判断"这行有没有日期证据"的逻辑本质相同（找星期几字样／找订单号交叉比对／找显式日期区间文字），拆成三种栏位反而要重复三次几乎一样的逻辑。
2. **完全没有日期证据的条目根本不属于任何一天**——Phase 1 已经证实（W01 的 Insentif 100% 无日期）。硬塞一个 `unallocated_incentive` 栏位在 `Daily_Allocation` 上，意味着要选一天来放这个"没有日期"的数字，这本身就违反你自己那条最重要的原则："不能因为它出现在这份 Statement 里就自动归到某一天/某一月"。所以无日期的条目**不进 `Daily_Allocation`，只留在这张表**，`allocated_date` 是 NULL。

```
allocation_line_id       TEXT  PK.  {allocation_batch_id}-L{lineIndex}
verified_income_id       TEXT  FK
document_id              TEXT
allocation_batch_id      TEXT
component_type           TEXT  'Tip' | 'Insentif' | 'Bayaran_Lain_Lain'
line_description_raw     TEXT  原始文字逐字保留（审计用，也是 date_source 判断的依据）
amount                    NUM   陈述值
allocated_date            TEXT  ISO YYYY-MM-DD，NULLABLE
date_source               TEXT  'Order_ID_Match' | 'Weekday_Label_Match' | 'Explicit_Period_Reference' | 'Not_Determinable'
referenced_source_period  TEXT  YYYY-MM，NULLABLE——只有 date_source='Explicit_Period_Reference' 才填，见 §5 的 source period 原则
linked_order_id            TEXT  NULLABLE——date_source='Order_ID_Match' 时，对应到的 Order_Allocation 订单号
source_page                NUM
created_at                 TEXT
```

statement 级别"这份 Statement 有多少完全无法分配"的数字，**不另开一张表**，即时查询：

```
getUnallocatedRemainder_(verified_income_id, batch)
  = Σ amount  WHERE allocated_date IS NULL  GROUP BY component_type
```

CMP-P6：这是纯聚合，不存。永远显式标 `Needs_Review`，永远不进任何一个月的 `Monthly_Allocation`。

### 2.3 `Daily_Allocation` —— 每天一行，checksum log + 已分配收入

```
daily_allocation_id    TEXT  PK.  {allocation_batch_id}-D{date}
verified_income_id     TEXT  FK
allocation_batch_id    TEXT
date                   TEXT  ISO YYYY-MM-DD
order_row_count        NUM   当天 Order_Allocation 行数
net_delivery_income    NUM   Σ Order_Allocation.net_income WHERE date=此日
printed_daily_subtotal NUM   PDF 上印出来的当天 "Jumlah RMxxx.xx"（独立陈述值）
checksum_difference    NUM   round2_(net_delivery_income − printed_daily_subtotal)
checksum_status        TEXT  'Matched' | 'Discrepancy_Flagged'
tip_allocated           NUM   Σ Non_Order_Income_Allocation WHERE component='Tip' AND allocated_date=此日
incentive_allocated     NUM   同上，component='Insentif'
other_income_allocated  NUM   同上，component='Bayaran_Lain_Lain'
created_at              TEXT
```

**没有 `month` 栏位**——这跟你原本列的字段不一样，我保留下来但明确标出来给你判断：`month` 100% 能从 `date.slice(0,7)` 算，CMP-P6 应该不存。如果你有别的理由想存（比如未来要直接对 `month` 建索引/做 GAS 端简单查询，Sheets 公式比字串切割方便），跟我说一声，我可以改回来存——这不是原则性的坚持，只是照 CMP-P6 先标出来，不要我自己悄悄决定。

**这张表只对 `net_delivery_income` 做 checksum**——因为**只有它在 PDF 上有印出来的逐日小计**。Tip/Insentif/Bayaran lain-lain 在 PDF 上都只有整周的合计，没有逐日合计可以拿来核对，所以它们没有 `checksum_status`，只在 §2.4 的整周层级做核对。这点值得明确写出来，不然容易被誤以为四个 component 都有一样的两层 checksum。

### 2.4 `Monthly_Allocation` —— 每个月一行

```
monthly_allocation_id  TEXT  PK.  {allocation_batch_id}-M{month}
verified_income_id     TEXT  FK
allocation_batch_id    TEXT
month                  TEXT  YYYY-MM  ←这个是真的该存：它是聚合 key，本身横跨很多天，不是单一 row 能推导出来的
net_delivery_income    NUM   Σ Daily_Allocation.net_delivery_income WHERE date 落在此月
tip                    NUM   Σ Daily_Allocation.tip_allocated ditto
incentive_allocated    NUM   Σ Daily_Allocation.incentive_allocated ditto
other_income_allocated NUM   Σ Daily_Allocation.other_income_allocated ditto
allocated_total         NUM   以上四项加总
days_covered             NUM   此月内有几个 Daily_Allocation 行
all_days_matched          BOOL  此月内每一天的 checksum_status 是否全部 Matched
allocation_status         TEXT  'Fully_Allocated' | 'Partially_Allocated' | 'Needs_Review'（算法见 §7）
created_at                TEXT
```

一份 Statement 有多少 `Needs_Review` 的无日期剩余（见 2.2 的即时查询），**不会出现在任何一行 `Monthly_Allocation` 里**——这是刻意的，呼应你自己讲的那条原则："不能因为它出现在这份 Weekly Statement 就自动认为它属于 Statement period"。Console 显示某份 Statement 的月度分配结果时，`Monthly_Allocation` 的几行 + 这笔 remainder 要一起显示，remainder 永远单独标注，不并进任何月份的总数。

### 2.5 `allocation_batch_id`：Idempotency 的核心机制（先说明，细节见 §8）

同一份 `document_id` 重新 parse，不覆写、不更新旧的 Order_Allocation/Daily_Allocation/Monthly_Allocation——直接 append 一批新的（batch_id 用 `CMP-OALB-{verified_income_id}-{now.getTime()}`，跟 `130_Reconciliation.js` 的 `CMP-REC-${week}-${now.getTime()}` 完全同一个套路）。**"目前有效的一批"用查询时取该 `verified_income_id` 底下最新的 `allocation_batch_id`**——跟 `getCurrentReconciliationStatus_()`、`150_ComplianceCalendar.js` 的 `Completed` 判定同一个 EP4 模式，不用另外维护一个"作废旧记录"的更新逻辑（TruthWriter/UCR6 本来就只支援 append）。

---

## 3. Parser Algorithm

```
parseButiranTempahan_(rawText, statementPeriod):

  1. 定界（CMP-P8，跟 121_GrabWeeklyParser.js 现有的 Ringkasan/Butiran-pendapatan
     scoping 同一原则——这条本来就是从真实踩雷学到的，Butiran Tempahan
     一样适用）：
       section = rawText 从 "Butiran Tempahan - Penghantaran" 开始，
                 到 "Cara membaca penyata"（词汇表）为止。
       绝不对整份文件做全文搜索——词汇表会重复出现 "Insentif"、
       "Bayaran lain-lain" 等字样，是诱饵。

  2. 逐日分组：section 内按
       /^(Ahad|Isnin|Selasa|Rabu|Khamis|Jumaat|Sabtu),\s*(\d{1,2}\s+\S+)$/
     切出 day boundary，每个 boundary 到下一个 boundary（或到该日的
     RM 小计为止）算一组。

  3. 页首/页尾噪音：忽略 `Page \d+ of \d+`；忽略重复出现的栏位表头行
     （"Jenis Tempahan / Butiran / Cara pembayaran / ..."）——这行只在每页
     顶端重印，不是订单资料。

  4. 逐行订单：在每个 day group 内，找 `Pesanan (Tunggal|Sekaligus)` 起始的
     row block，抓 platform / 订单号（含 "and N" 侦测）/ payment method /
     三个金额栏（asas / lain / pelarasan，第四个 bersih 用减法验证：
     asas+lain+pelarasan 应该等于 bersih，不等就整行标 Needs_Review，
     不静默接受——CMP-P10）。

  5. 小计：每个 day group 结尾会有一个独立一行的 "RM x,xxx.xx"——这就是
     printed_daily_subtotal，直接存，不重算。

  6. 跨页续接：day group 可能跨好几页（Phase 1 实测 W01 的 "Ahad, 4 Januari"
     横跨 page 7-9）——第 2-5 步的 day-group 累积逻辑本身就是跨页的（不是
     以页为单位重置），所以不需要特别的"跨页合并"步骤，只要不要把
     "day boundary" 的判定跟"换页"搞混就好。

  7. 输出：一组 Order_Allocation 候选行 + 一组 day→printed_subtotal 的对照，
     交给 §4 的 checksum 算法验证后才能变成正式记录。
```

已知的真实资料怪癖（Phase 1 实测过，parser 必须容忍）：`Instant - Bike` 跟 `Instant -- Bike` 两种连字符都要接受；订单号前缀目前只见过 `A-`（GrabFood/GrabMart）和 `PLAN-1-`（GrabExpress），但 regex 不要写死成 `PLAN-1-`，用 `PLAN-\d+-` 留余量；`Pendapatan lain` 栏经常是空白（不是 "0.00"），当 0 处理。

---

## 4. Checksum Algorithm

**两层，都用 `round2_`，都是 zero-tolerance exact match**（不是 Reconciliation 那种 RM5/0.5% 容差——两边数字同源于一份 PDF，理论上该完全相等，容差只会掩盖真实的解析错误）：

```
Level 1（每一天）：
  difference = round2_(Σ Order_Allocation.net_income[date=D] − printed_daily_subtotal[D])
  status = difference === 0 ? 'Matched' : 'Discrepancy_Flagged'
  → 写进 Daily_Allocation.checksum_status

Level 2（整份 Statement）：
  difference = round2_(Σ Daily_Allocation.net_delivery_income − Verified_Income.net_delivery_income)
  （Verified_Income 里对应"Pendapatan bersih penghantaran"的那个陈述值栏位——
   如果目前 140_VerifiedIncome.js 的 schema 还没单独存这个分项，需要先补上，
   不在这次改，先记下来）
  status = 同上二选一
  → 不写成一张新表；这个数字本身可以在 Console 汇总画面即时算+显示，
    因为它是 Level 1 结果的直接加总，CMP-P6

补充（统计层级，不是逐日）：Tip / Insentif / Bayaran lain-lain 各自也要做一次
"Σ Non_Order_Income_Allocation[component] vs Verified_Income 对应分项" 的整周
核对——Phase 1 已经证实这个整周核对两份样本都能对上（Tip: 50.00 exact；
Insentif: 566.20 = 449.50+116.70 exact）。这层核对**不是**"日期分配"，
是"有没有漏抓/多抓行"的完整性检查，跟第 5 节的日期归属是两件事。
```

任何一层 `Discrepancy_Flagged`：**不阻断、不撤销**已经发布的 `Verified_Income`（CMP-P12/ADR-003 同一个精神——这层是 annotation，不是 publication gate），但会让该 `Monthly_Allocation.allocation_status` 落到 `Needs_Review`（见 §7），不能标成 `Fully_Allocated`。

---

## 5. Income Component Allocation Algorithm

| Component | 分配逻辑 | 证据状态 |
|---|---|---|
| **net_delivery_income** | `order_date` 直接来自 Butiran Tempahan 逐行，Level-1 checksum 通过才算数 | Phase 1 两份样本 100% 验证 |
| **Tip** | 每笔有自己的日期+订单号，直接用；跟 Order_Allocation 一样逐笔存进 Non_Order_Income_Allocation，`date_source='Weekday_Label_Match'` 或直接是完整日期（Tip 台账本身就带日期，不用像 Insentif 那样从文字猜） | Phase 1 验证（W01 exact match） |
| **Insentif** | 逐行扫描 `line_description_raw`：命中 `Bonus Harian (Isnin\|Selasa\|...\|Ahad)` → `date_source='Weekday_Label_Match'`，用星期几+ statement period 算出确切日期；命中不到任何日期字样（Shift Top-Up、Bonus Mingguan Berganda、trip-count Bonus）→ `allocated_date=NULL`, `date_source='Not_Determinable'`。**不假设固定 sub-type 清单**——W01 全部无日期、W33 有 7 笔 Bonus Harian，两份样本本身就证明了这一点因周而异 | Phase 1 验证 |
| **Bayaran lain-lain** | 优先序：① 文字里含一个跟 Butiran Tempahan 订单号格式相符的 code（`A-XXX...`）且能在同一份 Statement 的 Order_Allocation 里查到 → `date_source='Order_ID_Match'`，`linked_order_id` 填上，`allocated_date` = 该订单的 `order_date`；② 命中已知的固定文案 pattern（下面单独说）→ `date_source='Explicit_Period_Reference'`；③ 都没命中 → `Not_Determinable` | ①②Phase 1 都有真实例子 |
| **Komisen / Bonus add-on express** | 两份样本全程 0.00，**没有非零证据**。先不写任何分配逻辑——真的遇到非零值时，先落 `Not_Determinable` + Needs_Review，不要现在猜行为 | 无证据，CMP-P10 |
| 未来新 component | 不要求改这三份文件的核心逻辑——`date_source` 判断做成一个小规则表（pattern → date_source），新 component 出现时加一条规则，不是改分支结构 | — |

**"Explicit_Period_Reference" 的已知固定文案**（Phase 1 在两份样本里都见过，不是假设性的）：

```
"Weekly compensation for long wait time (DD Month YYYY - DD Month YYYY)"
  → referenced_source_period = 该区间所在的 YYYY-MM
"<描述> Reimbursement <Month> <YYYY>"（例："PERKESO Subscription Reimbursement July 2026"）
  → referenced_source_period = <YYYY>-<Month>
```

这两个 pattern 是**已知、可信的**，因为两份互不相关的真实 Statement 都用了几乎一样的措辞——像是 Grab 自己固定的文案模板。除了这两个已知 pattern，**不做自由文字日期解析**——命中不到就是 `Not_Determinable`，不要为了"看起来更完整"去猜一个通用的日期抽取器。

---

## 6. Cross-Month / Source-Period Algorithm

```
月份归属唯一依据 = 经济归属日期，不是 Statement 出现在哪份文件里：

  Order_Allocation:              order_date（订单实际发生日）→ month
  Non_Order_Income_Allocation:
    date_source = Weekday_Label_Match / Order_ID_Match
                                → allocated_date → month（正常流程）
    date_source = Explicit_Period_Reference
                                → referenced_source_period 直接就是 month，
                                  可能完全不等于 statement 自己横跨的任一个月
                                  份——例如 8 月的 Statement 里一笔写着
                                  "July 2026" 的 reimbursement，
                                  这笔的月份就是 2026-07，不是 2026-08，
                                  即使它印在 8 月的 PDF 上
    date_source = Not_Determinable
                                → 不归入任何月份，只留在整份 Statement 的
                                  Needs_Review remainder（§2.2）
```

这条原则的直接后果：**一份 Statement 的 `Monthly_Allocation` 行，月份不一定局限在 order_date 落点的那两个月**——如果里面有 `Explicit_Period_Reference` 命中一个第三方月份（例如上面的 July 例子），那笔钱会让**该 Statement 也贡献一行 `2026-07` 的 `Monthly_Allocation`**，即使这份 Statement 的订单全部发生在 8 月。这是刻意的，直接对应你说的"不能因为出现在这份 Statement 就自动归到这份 Statement 的月份"。

---

## 7. Error / Needs Review 条件（汇总表）

| 情况 | 落在哪一层 | 状态 |
|---|---|---|
| 找不到 asas+lain+pelarasan=bersih（算术不合） | Order_Allocation 该行 | 该行标 `Needs_Review`，不写入正常 net_income，不计入该日 checksum 的分子 |
| 当天 Level-1 checksum 差额 ≠ 0 | Daily_Allocation | `checksum_status='Discrepancy_Flagged'`，该日 `net_delivery_income` 不视为可信 |
| 整周 Level-2 checksum 差额 ≠ 0 | 整份 Statement | 即使每天都 Matched，整体仍标注需要复核（理论上不该发生，发生了代表 Level-1 逻辑本身有 bug，比数值误差更严重） |
| Insentif/Bayaran-lain-lain 整周核对（§4 补充）对不上 | 整份 Statement | 代表漏抓或多抓了某一行台账，Needs_Review，不是日期问题 |
| 某月 `all_days_matched=false` | Monthly_Allocation | `allocation_status` 不能是 `Fully_Allocated`，见下面判定式 |
| 该月有 `date_source='Not_Determinable'` 或 remainder 非零 | Monthly_Allocation | 同上，落 `Partially_Allocated` 或 `Needs_Review` |
| PDF 完全没有 Butiran Tempahan 区块（理论上不该发生，但要防） | 整份 Statement | 直接 `Needs_Review`，不猜测任何分配 |

`Monthly_Allocation.allocation_status` 判定式：

```
if (!all_days_matched)                         → 'Needs_Review'
else if (该月对应的 remainder 完全为 0
          且 100% 的 Non_Order_Income_Allocation 都有 allocated_date) → 'Fully_Allocated'
else                                             → 'Partially_Allocated'
```

**任何单一 component 的 `Needs_Review`，都不阻断已经验证过的其他 component**——`net_delivery_income` 可以是 `Fully_Allocated`，同一个月的 `Monthly_Allocation.allocation_status` 整体因为 Insentif 未知而是 `Partially_Allocated`，两件事同时成立，UI 上分开显示（跟 ADR-003 的精神一致：不要让一个还没搞定的次要 component 拖累已经验证扎实的核心事实）。

---

## 8. Idempotency Strategy

不是"写入前检查是否已存在就跳过"（那是 `Verified_Income` 的 CMP-P13 模式，适用于"这份文件只能被正式发布一次"的场景）。这里刻意用另一种、同样在现有代码里有先例的模式：

- 每次重新 parse 同一个 `document_id`，**都允许成功**，产生一批全新的 `allocation_batch_id`，append 进三张表，不检查、不拒绝。
- **"目前有效的结果"永远是查询时取该 `verified_income_id` 底下 `allocation_batch_id` 最新的一批**——旧批次不删除、不标记，就只是不会被查询层选中（EP4：可推导的"当前状态"不用维护额外的作废欄位）。
- 好处：重新 parse、Retry、甚至日后 parser 逻辑升级重跑，都不需要写任何"先删除旧资料"的破坏性逻辑，旧批次自然变成历史，审计时还能回头比对"这次重新解析前后差在哪"。
- 代价：储存量会随重复 parse 累积——如果 Console 提供"Retry"按钮，需要一个之后再谈的清理策略（不影响 Phase 2/3 的正确性，先不处理）。

---

## 9. Test Plan

对应你原本列的 14 个 test，用两份真实 fixture（W01 跨月、W33 单月）+ 合成边界案例：

**用真实 PDF 的（每份都要跑一次，两份都跑）：**
1. Butiran Tempahan section 定界正确（不误抓词汇表里的诱饵字样）
2. 逐日 day-group 切分正确、跨页不断行（W01 的 "Ahad, 4 Januari" 横跨 3 页是现成案例）
3. 每日 Level-1 checksum 全部 `Matched`（这是 Phase 1 已经手工验证过的基准，回归测试要锁住这个结果）
4. 整周 Level-2 checksum `Matched`
5. Tip / Insentif 整周核对 `Matched`
6. Sekaligus 行的 `bundled_order_count`/`order_identity_status` 正确（W01 有 6 笔 "and N" 省略，W33 有 12 笔，两份都要覆盖到）
7. W01：Insentif 100% `Not_Determinable`（无 Bonus Harian）；W33：Insentif 有 7 笔 `Weekday_Label_Match`——同一份逻辑要在两种真实分布下都正确，不是针对其中一份调出来的
8. W33 的 COD reimbursement 正确判定成 `Order_ID_Match` 并关联到正确的 `order_date`
9. W01/W33 的 "long wait time" 补偿正确判定成 `Explicit_Period_Reference`，`referenced_source_period` 算对（尤其 W33 那笔横跨 7/8 月的区间）

**合成边界案例（真实 PDF 没有、但要防的）：**
10. 故意改动某一天的其中一笔金额，验证 `Discrepancy_Flagged` 正确触发，且不影响其他日期/其他 Statement
11. 故意在 `order_id_raw` 塞一个 regex 抓不到日期的畸形 Sekaligus 描述，验证整行落 `Needs_Review` 而不是崩溃或静默漏掉
12. 同一个 `document_id` 重复 parse 两次，验证查询层只取最新 batch，两批不会加总（Idempotency）
13. 年份推断边界：合成一个 12/31 → 1/1 的极端跨年 Statement（W01 是跨月但不跨年；这个必须合成，因为暂时没有真实样本），验证 `order_date` 年份判定正确
14. 完全没有 Butiran Tempahan 区块的畸形输入，验证整份落 `Needs_Review` 而不是抛异常中断整个 batch import

---

## 收尾

以上是完整 Phase 2 设计——Data Model（4 张表）、Parser/Checksum/Component-Allocation/Cross-Month 五个 Algorithm、Error 条件表、Idempotency 策略、Test Plan。**明确跟你原本 3 层 data model 不一样的地方**（多切一张 `Non_Order_Income_Allocation`、`Daily_Allocation` 不存 `month`、checksum 只对 `net_delivery_income` 做逐日层级）都在各节里标出了理由，不是我自己默默改掉——如果你觉得哪个判断不对，指出来我改。

你确认这份设计之后，才进 Phase 3（pure functions + tests，先不接真实 GAS）。142/143 现在还是空的。
