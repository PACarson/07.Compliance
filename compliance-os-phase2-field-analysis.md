# Compliance OS — Phase 2 · Step 1-2：Grab Weekly Statement 字段分析 + JSON Schema 提案

> 只做字段分析和 Schema 设计，还没写 Parser 代码——按治理层定的顺序，Schema 你确认后再动手写 `GrabWeeklyParser`（Phase 2 Step 3）。

---

## 0. 样本概览

- 类型：Grab「Penyata Pemandu」（司机周结单），马来文
- 期间：20–26 Julai 2026（即 **2026-W30**，星期一至星期日）
- 22 页结构：p1 封面/汇总 → p2–20 逐项分类账 → p21–22 术语表（Cara membaca penyata）

---

## 1. 关键发现：收入是分层的，不是 9 项并列相加

这一点很重要，直接影响 Reconciliation 会不会算错。样本页 1「Butiran pendapatan」列出 9 行，但**「Pendapatan bersih penghantaran」本身就是其中 4 项算出来的小计**，不是跟其他 8 项平行的独立项——如果 Parser 把 9 行直接加总，会把这一部分重复算一次。

```
Jumlah Pendapatan
 = Pendapatan bersih penghantaran   ← 本身是小计，不是独立加项
 + Insentif
 + Tip
 + Bayaran lain-lain

Pendapatan bersih penghantaran
 = Pendapatan asas makanan
 + Pendapatan asas Express
 + Bonus add-on Express
 + Pelarasan Pendapatan
 − Komisen
```

用这份样本的实际数字核对（脚本验证过）：
- `750.30 + 68.40 + 0.00 + 327.30 − 0.00 = 1146.00` ✓ 等于样本上的「Pendapatan bersih penghantaran」
- `1146.00 + 557.10 + 19.00 + 12.00 = 1734.10` ✓ 等于样本上的「Jumlah Pendapatan」
- 如果 9 行直接加总（不当小计处理）会得到 2880.10，明显不对——证实了上面的层级关系

Insentif（557.10）本身也是两个子账目相加：「Layak」子清单小计 534.00（逐条日常奖金 + Shift Top-Up + 双倍周奖金）+ 另一笔「30 trip 奖金」23.10。这两级也用脚本核对过，完全对得上。

---

## 2. 完整字段清单

**2.1 文件元数据**

| 字段 | 样本值 | 说明 |
|---|---|---|
| 文件类型 | Penyata Pemandu | 固定，Grab 周结单 |
| 期间起 / 止 | 20 Julai 2026 / 26 Julai 2026 | 马来文月份，Parser 需要月份名对照表 |
| 司机姓名 | （样本上的姓名）| |
| 收款银行 / 账号 | Malayan Banking Berhad，末 4 位遮罩 | |

**2.2 顶层汇总（Ringkasan）**

| 字段 | 说明（译自术语表）|
|---|---|
| Jumlah Pendapatan | 总收入 |
| Jumlah Penolakan | 总扣除 |
| Jumlah Mingguan | 周净额 = 总收入 − 总扣除 |

**2.3 收入结构（Butiran Pendapatan，9 行，见 §1 的层级关系）**

| 字段 | 术语表定义（意译）|
|---|---|
| Pendapatan bersih penghantaran | 派送净收入（下面 4 项的小计）|
| Pendapatan asas makanan | 食品派送基本收入 |
| Pendapatan asas Express | Express 基本收入 |
| Bonus add-on Express | 完成附加 Express 订单的奖励 |
| Komisen | 应付 Grab 的抽成（从小计里扣）|
| Pelarasan Pendapatan | Grab 额外补贴的收入调整 |
| Insentif | 奖励金（本身分「Layak」子清单 + 其他奖金，见 §1）|
| Tip | 乘客/客户小费 |
| Bayaran lain-lain | 其他杂项收入（样本里是「long wait time 补偿」）|

**2.4 逐项分类账（各自有 Dompet Tunai / Dompet Kredit / Subtotal 三栏）**

- **Tip**：按日期/时间/订单号逐笔列出
- **Insentif → Layak**：逐笔列出，每笔有 insentif ID、达成条件说明（例如「完成 27 趟不重复行程，门槛 15 趟」），部分注明「已扣预扣税」（cukai pegangan）——这是个税务线索，Phase 2 先不处理
- **Bonus**（样本中另一笔「30 trip 奖金」）
- **Bayaran lain-lain**：样本里是长时间等待补偿

**2.5 派送订单明细（Butiran Tempahan - Penghantaran）**

按星期几分组（Isnin 到 Ahad），每笔订单一行：订单类型（Tunggal 单笔 / Sekaligus 合并）、平台（GrabFood / GrabMart / GrabExpress）、订单号、付款方式、以及 4 栏金额（Pendapatan asas / Pendapatan lain / Pelarasan Pendapatan / Pendapatan bersih）。样本里约 100+ 笔。

**2.6 非收入类交易（不算进 Jumlah Pendapatan）**

- **Pengeluaran Wang**（提款）：样本里两笔各 -500.00，是从 Dompet 转去银行户口，跟收入无关
- **Bayaran Balik Promo**：术语表说明这属于「Jumlah Tambang」（总车资）已经包含的部分，不是额外收入

---

## 3. 暂不处理、先标注的部分

- Insentif 部分项目的「预扣税」标注——留给未来 Compliance OS 的 Tax 部分，Phase 2 不处理
- §2.5 逐单明细的 4 栏怎么精确 roll up 到 §2.3 顶层 9 行，光靠文字抽取无法 100% 确认（表格在抽取时可能错位）——Phase 2 先做「顶层 9 行 + 各分类账小计」这两层的精确对账，逐单明细整份存进 `raw_json` 供审计，不强求第一版就把每一笔单都精确对上顶层数字

---

## 4. 修正后的标准 JSON Schema（与具体 PDF 措辞解耦）

用 `code`（稳定、给程序用）+ `label_ms`（当前马来文标签，未来 Grab 改版措辞时才会变）分开存，Parser 认 `code`，不认 `label_ms` 的具体文字。

```
{
  "document_meta": {
    "source": "Grab",
    "document_type": "Weekly Statement",
    "period_start": "2026-07-20",
    "period_end": "2026-07-26",
    "week": "2026-W30",
    "currency": "MYR"
  },
  "summary": {
    "total_income": 1734.10,
    "total_deductions": 0.00,
    "weekly_net": 1734.10
  },
  "income_breakdown": {
    "net_delivery_income": {
      "code": "net_delivery_income",
      "label_ms": "Pendapatan bersih penghantaran",
      "amount": 1146.00,
      "components": {
        "base_food_income":    { "label_ms": "Pendapatan asas makanan",   "amount": 750.30 },
        "base_express_income": { "label_ms": "Pendapatan asas Express",   "amount": 68.40 },
        "express_addon_bonus": { "label_ms": "Bonus add-on express",      "amount": 0.00 },
        "income_adjustment":   { "label_ms": "Pelarasan Pendapatan",      "amount": 327.30 },
        "commission":          { "label_ms": "Komisen",                  "amount": 0.00 }
      }
    },
    "incentive":      { "label_ms": "Insentif",         "amount": 557.10 },
    "tip":            { "label_ms": "Tip",               "amount": 19.00 },
    "other_payments": { "label_ms": "Bayaran lain-lain", "amount": 12.00 }
  },
  "itemized_detail": {
    "tip_transactions": [ /* 逐笔，Phase 3 再展开 */ ],
    "incentive_transactions": [ /* 逐笔，含 insentif ID */ ],
    "delivery_bookings": [ /* 逐单，Phase 3 再展开 */ ]
  }
}
```

Reconciliation 用的公式：
```
weekly_net = income_breakdown.net_delivery_income.amount
           + income_breakdown.incentive.amount
           + income_breakdown.tip.amount
           + income_breakdown.other_payments.amount
           − summary.total_deductions
```

---

## 5. 对 Governance 层的影响（v0.3 → v0.4，属于修正不是扩充）

治理层 v0.3 的 `Verified_Income` 和 `INCOME_VERIFIED` 之前用的是「gross/incentive/adjustment/deduction/net」，是照 doc 1 里简化的示例数字编的，跟真实结构对不上——真实结构没有单一的「gross」，而是「net_delivery_income（本身是小计）+ incentive + tip + other_payments」。已经照 §4 的结构同步改到治理层文档（见另一份 v0.4）。这属于用真实数据修正一个想当然的假设，不算重新扩充治理范围。

---

## 6. 下一步

Schema 你看一下有没有问题；没问题的话下一步（Phase 2 Step 3）才是照这份 Schema 写 `GrabWeeklyParser`，现在还没写。
