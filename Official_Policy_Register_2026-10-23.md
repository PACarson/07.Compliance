# 官方政策登记表（EPF / Tax / SOCSO / Grab 报销）

- **用途**：授权文件 §4 要求「用官方来源核实政策，逐条登记来源、页面/文件标题、可访问位置、发布/生效日期、适用年度/资格、未确认项；第三方文章只是线索；无法确认就标 PENDING 并设计成可配置规则，不猜」。本表就是这份登记。
- **取得日期**：来源在 2026-10-21 至 2026-10-23（吉隆坡时间）之间抓取。
- **本表不是**：税务/法律/投保建议；也不是任何计算器的输入。设计文档里的 `Policy_Rule` 只引用本表的记录 ID，数值一律以「待核对」状态入库，不写进代码。

## 0. 先读：这份登记表的可信度边界

1. **所有网页内容都是 WebFetch 工具的转述**。该工具先用一个小模型读网页再回答我的提问，所以下面带引号的文字是「工具转述的原文」，**不保证逐字一致**。凡是会影响金额或日期的条目，都列在第 9 节「建议人工抽查清单」，请你（或我在有权限时）打开原网页核对。
2. **页面没有标日期的，一律写「页面日期：NOT STATED」**，不能当作「现行有效」；我只能说「取得当天页面上这么写」。
3. 状态标签（每条记录都有）：
   - 【官方证实】= 机构官方页面/文件上能看到这句话（经工具转述，仍需抽查）。
   - 【官方证实·有限】= 官方来源，但只证实了其中一部分，其余在「未确认」里。
   - 【线索】= 第三方或二手报道，只能当线索，不能当依据。
   - 【PENDING】= 没找到官方说法，设计成可配置规则。
   - 【BLOCKED】= 因 robots 或抓取失败读不到（没有绕过）。
4. **每个机构的「官方」范围**：EPF = kwsp.gov.my；LHDN = hasil.gov.my；PERKESO = perkeso.gov.my；财政部 Budget 2027 = belanjawan.mof.gov.my；人力资源部 = mohr.gov.my / jtksm.gov.my。Grab 页面是**平台自己发布的活动条款**，不是政府来源；你实际拿到多少钱，以你自己的 Grab 正式对账单为准（本次没有看到你的对账单）。
5. **字段对照（授权 §4）**：来源机构；页面/文件标题（= 小标题，或「页面标题」行）；位置（网址）；发布/生效日期（「页面日期」「文件日期」等行）；适用年度/资格；未确认；状态。页面没写明的一律写 NOT STATED，不留空；没有读到的来源记在第 7 节。

## 1. 对你最有用的几句话（先看结论）

| 问题 | 目前能说的 | 标签 |
|---|---|---|
| i-Saraan Plus 的奖励是多少 | EPF 官方页：当年自愿缴款总额的 20%，每年最多 RM600，终身最多 RM6,000（或到 60 岁，以先到者为准）。「达到上限需要至少 RM3,000 缴款」 | 【官方证实】（待抽查） |
| 你能不能拿到 | 资格写的是「以 e-hailing/p-hailing 司机身份自雇」，且需先注册 i-Saraan、60 岁以下。但页面同时写「缴款必须通过平台提供者（platform provider）」，又在 FAQ 10 说也可以「通过现有渠道缴款以争取政府特别奖励」。**自己用 i-Akaun/网银缴的款，到底算不算 Plus 的奖励基数，页面没有说清楚** | 【PENDING】 |
| 「当年」是日历年吗 | 页面只写 current year，没写 calendar year | 【PENDING】 |
| 2026 年以前的缴款算不算 | 页面写「introduced starting 2026」；现有会员的终身上限按「自 2024 年起已收到的奖励」计算；2026 年前的缴款是否计入奖励基数——未说明 | 【PENDING】 |
| CP500 一年几期、什么时候 | LHDN 官方页：最多六期，每两个月一期，从每年三月开始；通知书年初寄出；每期金额由 LHDN 估算，以通知书上的金额和日期为准 | 【官方证实】 |
| 第一次有生意收入的那一年有没有 CP500 | 官方页没有写新开业的规则 | 【PENDING】——所以设计里必须有「尚未收到通知（NOT_NOTIFIED）」这个状态，且永不自己编 CP500 金额 |
| 修改 CP500 的截止日 | LHDN 页面写「每个日历年 6 月 30 日之前」；CP502 说明文件写「30 Jun / 31 Oktober 2026」（工具转述，意思没读清）。两处写法不一致 | 【PENDING】（冲突，待人工看原文） |
| SOCSO 自雇计划金额 | PERKESO 官方页：Plan 1–4，月缴 RM13.10 / 19.40 / 36.90 / 49.40，年缴 RM157.20 / 232.80 / 442.80 / 592.80 | 【官方证实】（页面日期 NOT STATED） |
| SOCSO 保障什么时候开始 | 官方页：「从缴款的日期和时间起生效，以缴款收据为准」。**一次缴好几个月时覆盖期怎么算：官方没写** | 【官方证实·有限】；多月规则【PENDING】 |
| 2026 年 SOCSO 政府配对（70:30 / 50:50） | PERKESO 2026 年 4 月 6 日 FAQ：适用「非强制行业」；按字面，客运、货运/食品运输、小贩属于被排除的强制行业。**这条是否适用于你本人要看原文——我不能替 PERKESO 下结论** | 【官方证实·有限】；适用性【待确认】 |
| Grab 的 SOCSO 补贴 | Grab 页面：2026 年 6–12 月，Ultimate 每月补贴「Plan 1 的 80%，或任何计划最多 RM10.50」；Platinum「Plan 1 的 50%，或最多 RM6.60」且每月至少 30 趟；次月 10 日前付。**申请/审批流程页面没写** | 平台条款（页面无日期）；流程【PENDING】 |
| Act 872（零工法）什么时候生效 | 法案文本：由部长以宪报公告订定日期，可分条文不同日期。我没有找到宪报公告；新闻说 2026 年 3 月（线索） | 【官方证实·有限】；日期【PENDING】 |
| 零工平台自动扣 SOCSO | PERKESO 新闻稿（2026-04-01）与 FAQ（Bil. 2/2026，2026-03-31）：平台按每笔任务 1.25% 自动扣；开始日期 FAQ 没写 | 【官方证实】；开始日期【PENDING】 |

---

## 2. EPF / KWSP

### POL-EPF-01 i-Saraan（自雇者自愿缴款与政府奖励）
- **来源机构**：KWSP（EPF）
- **页面标题**：「i-Saraan: Voluntary Contributions for the Self-Employed - KWSP Malaysia」
- **位置**：https://www.kwsp.gov.my/en/member/savings/i-saraan
- **取得日期**：2026-10-22
- **页面发布/更新日期**：**NOT STATED**
- **适用年度/资格**：资格（FAQ）：「Registered as an EPF member」；「Malaysian citizen」；「Below 60 years of age」；对象为「Self-employed individuals with no fixed income」「workers in the gig economy sector」。
- **工具转述的要点**：
  - 奖励：「Receive a special incentive of 20% (up to a maximum of RM500)」。
  - 终身上限：「Lifetime incentive limit of RM5,000 or when the member turns 60, whichever is earlier.」；FAQ：「The RM5,000 lifetime special incentive limit takes effect from 2024」。
  - 入账：「will be credited to the member's EPF account twice a year」，条件「subject to the receipt of special incentive payments from the Government」；未满 55 岁入 Akaun Persaraan（Account 1），55 岁以上入 Akaun Emas。
  - 注册：KWSP i-Akaun 手机应用、EPF 网站在线注册、EPF 办事处填表。
  - 缴款：渠道含 i-Akaun、网银、银行代理柜台、自助终端（SST）；最低 RM1；最高「RM100,000 per year」（页面称为「The maximum accumulated limit for Voluntary Contributions」）；可一次性或设置定期缴款（Auto Simpan，经 DuitNow AutoDebit）；电子缴款「within 3 working days」入账，其他渠道「7 working days」。
  - i-Saraan Plus：该页只在缴款上限段落里提到名称，**没有 Plus 的条款**。
- **未确认**：页面日期；「year」是否日历年；奖励的计算基数是否含其他自愿缴款。
- **设计影响**：`epf.i_saraan.*` 规则行（见第 8 节）；缴款与奖励入账是两种不同的官方记录；奖励入账时间不确定（半年一次且取决于政府拨款），所以「预期奖励」与「已确认奖励」必须分开。
- **状态**：【官方证实】（待抽查）

### POL-EPF-02 i-Saraan Plus（e-hailing / p-hailing 司机）
- **来源机构**：KWSP（EPF）
- **页面标题**：「i-Saraan Plus for e-Hailing & p-Hailing Drivers - KWSP Malaysia」
- **位置**：https://www.kwsp.gov.my/en/member/savings/i-saraan-plus
- **取得日期**：2026-10-22（两次提问：06:25 与 06:35）
- **页面发布/更新日期**：**NOT STATED**
- **适用年度/资格**：马来西亚公民（FAQ 8：永久居民持 MyPR 亦可），「self-employed individuals working as e-hailing and/or p-hailing drivers」；须为 i-Saraan 注册会员（FAQ 4：已注册 i-Saraan 的人不必重新注册）且 60 岁以下；「Contributions must be made through a platform provider」（Who Is Eligible）；FAQ 5：「Participation in i-Saraan Plus is automatic once a member makes a voluntary contribution」。
- **工具转述的要点**：
  - 奖励：「20% (up to a maximum of RM600 per year) of the total voluntary contributions received in the current year」（FAQ 14）；达到每年上限需要至少 RM3,000 缴款。
  - 终身：RM6,000，或到 60 岁，以先到者为准；「introduced starting 2026」（FAQ 1）；新符合资格者从 2026 起计，现有会员按「自 2024 年起已收到的奖励」计算（FAQ 16）。
  - 一年只给一次：「Members are only eligible to receive one (1) incentive in the current year.」（FAQ 17）。
  - 入账：一年两次，未满 55 岁入 Account 1，55 岁及以上入 Akaun Emas（FAQ 18–19）。
  - 缴款：平台提供者经 i-Akaun (Employer) 代缴；FAQ 10：「may make voluntary contributions through existing channels to maximise the Government special incentive」；每笔最低 RM1；所有自愿缴款合计最高 RM100,000/年；「All i-Saraan Plus contributions paid to the EPF are final」（不可退）。
  - 凭证：页面**没有**说明如何取得缴款或奖励的证明（statement / i-Akaun 记录 / 收据）。
- **未确认**：见第 1 节表格——自己缴的款是否计入 Plus 奖励；「current year」是否日历年；20% 基数是否把 i-Saraan 与 i-Saraan Plus 的缴款合并；2026 年前或注册前的缴款是否计入；EPF 如何确认司机身份；凭证形式；页面日期；生效日的精确日期（只有 2026 年）。
- **设计影响**：这是 EPF 预算设计里最大的不确定项。设计上必须能同时保存「方案 A：全部自己缴」「方案 B：经平台缴」的预算与预期奖励，且预期奖励金额在规则未确认前只接受人工输入，不能自动算。
- **状态**：【官方证实·有限】；上述未确认项【PENDING】

### POL-EPF-03 KWSP 文章「Belanjawan 2026: 4 Benefits EPF Member Should Know」
- **来源机构**：KWSP
- **位置**：https://www.kwsp.gov.my/en/w/article/belanjawan-2026-epf-benefits
- **取得日期**：2026-10-22
- **页面日期**：「Date: 14 Nov 2025」
- **适用年度/资格**：Budget 2026 措施的宣传性文章；文中写「launched in 2026」；没有资格条款，实施细则「will be announced in due course」（页面未写明，NOT STATED）。
- **要点（工具转述）**：「matching contributions from the government of up to RM600 per year」；「lifetime cap of RM6,000」；对照现有 i-Saraan「up to RM500 per year」「lifetime cap of RM 5,000」；「launched in 2026」；「Further details on the implementation of the measures under Budget 2026 will be announced in due course.」
- **未确认**：具体生效日；e-hailing/p-hailing 与其他自雇者是否有不同上限（该文没分开列）。
- **状态**：【官方证实·有限】（宣传性文章，不是规则文本）

### POL-EPF-04 KWSP 新闻「EPF's Policy and Product Enhancements in 2026」
- **来源机构**：KWSP
- **位置**：https://www.kwsp.gov.my/en/w/news/epf-policy-product-enhancements-2026
- **取得日期**：2026-10-22
- **页面日期**：「Date: 31 Dec 2025」
- **适用年度/资格**：2026 年措施（工具称列在「Key initiatives taking effect from 1 January 2026 include:」之下，精确生效日页面未写明）；资格：e-hailing 与 p-hailing 司机，经参与的平台提供者登记为 EPF 会员。
- **要点（工具转述）**：i-Saraan Plus 是「a voluntary contribution facility designed specifically for e-hailing and p-hailing drivers」，「offers a higher government matching incentive of up to RM600 annually, subject to a lifetime cap of RM6,000」；「Eligible e-hailing and p-hailing drivers will be registered as EPF members through participating platform providers」，「which will facilitate contribution deductions at rates determined by the drivers」；工具称 i-Saraan Plus 出现在「Key initiatives taking effect from 1 January 2026 include:」这个标题之下，但同时说该页没有给出具体的生效日期，所以我只把它当作「2026 年 1 月 1 日起生效的措施之列」的线索，**不当作精确生效日**（请抽查原文）。同页另有 i-Suri 的措施（与你无关，不展开）。
- **未确认**：i-Saraan Plus 的精确生效日期；「rates determined by the drivers」是否意味着司机可自订每次扣款比例（平台代扣机制尚未见到细则）。
- **状态**：【官方证实·有限】

### POL-EPF-05 Budget 2027「Appendix 1 Summary of Budget 2027 Measures」
- **来源机构**：财政部（MOF）
- **位置**：https://belanjawan.mof.gov.my/pdf/belanjawan2027/ucapan/touchpoint-budget-en.pdf
- **取得日期**：2026-10-22
- **文件日期**：文件内容**未写日期**；RTM 报道称 Budget 2027 于 2026-10-09 在 Dewan Rakyat 提呈（见 POL-SOC-08）。
- **适用年度/资格**：Budget 2027 措施摘要；适用年度、资格与生效日：摘要未写明（NOT STATED，见「未确认」）。
- **要点（工具转述，第 5 页）**：「with EPF matching contributions of up to RM600 per year or RM6,000 per lifetime」（i-Saraan、i-Saraan Plus 和 i-Suri）；「Automatic registration of every citizen as an EPF member upon reaching the age of 18」。
- **未确认**：预算案措施是**宣布**，不等于执行细则；是否改变现行条款、何时生效——未说明。工具读到的内容被截断，后续页面未审阅。
- **状态**：【官方证实·有限】；生效/变更【PENDING】

---

## 3. 税务 / LHDN（HASiL）

### POL-TAX-01 「Bayaran Pendahuluan Anggaran Cukai」（CP500 说明页，马来文）
- **来源机构**：LHDN（HASiL）
- **位置**：https://www.hasil.gov.my/individu/kitaran-cukai-individu/bayaran/bayaran-pendahuluan-anggaran-cukai/
- **取得日期**：2026-10-22
- **页面日期**：**NOT STATED**
- **适用资格**：「Pembayar cukai yang mempunyai sumber pendapatan selain daripada penggajian」（第 4 点：有雇佣以外收入的纳税人，如生意、租金、特许权使用费）。
- **要点（工具转述）**：
  - 通知书发出时间：「akan dihantar kepada pembayar cukai pada setiap awal tahun」（第 1 点）。
  - 期数：「sehingga enam kali ansuran mulai daripada bulan Mac setiap tahun」（第 4 点）；每两个月一期；具体日期以通知书为准。
  - 金额：「Amaun ansuran akan dianggarkan oleh LHDN」（第 1 点）；计算方法页面没写。
  - 修改：「Pindaan CP500 boleh dibuat sebelum 30 Jun setiap tahun kalender」（第 5 点）；该页**没有提到** CP502 表格名称；罚款：NOT STATED。
  - 取得 CP500 副本：通过 MyTax 或 HASiL 联络中心 03-89111000（第 6 点）；页面提到「没有在二月底前收到 CP500 的人」。
- **未确认**：新开业/没有上一年评税记录的人的规则（NOT STATED）；每期付款期限天数（该页没写，见 POL-TAX-02）；付款渠道与付款凭证（NOT STATED）；逾期罚款。
- **设计影响**：「NOT_NOTIFIED」状态必须存在；计划行必须来自通知书（有通知书证据才可标「官方分期」）；金额永不推算。
- **状态**：【官方证实】；新开业规则【PENDING】

### POL-TAX-02 「Tanggungjawab Percukaian bagi Individu (Perniagaan)」
- **来源机构**：LHDN（HASiL）
- **位置**：https://www.hasil.gov.my/media/bkfgsyoo/tanggungjawab-percukaian-bagi-individu-perniagaan.pdf
- **取得日期**：2026-10-22
- **文件日期**：**NOT STATED**
- **适用年度/资格**：经营业务的个人（标题「…bagi Individu (Perniagaan)」）；适用评税年：文件未写明（NOT STATED）。
- **要点（工具转述）**：
  - 「Bayaran 6 kali setahun (dwi-bulanan) bermula Mac setiap tahun.」
  - 「Pembayar cukai diberi tempoh 30 hari dari tarikh kena bayar bagi menjelaskan ansuran yang telah ditetapkan.」
  - 「Melaporkan pendapatan perniagaan menggunakan Borang Nyata yang ditetapkan sebelum 30 Jun」；「Bayar cukai pendapatan (jika ada) sebelum 30 Jun menggunakan ByrHASiL」。
  - 「Simpan rekod perniagaan untuk tempoh 7 tahun bagi pembuktian pelaporan Borang Nyata.」
- **未确认**：文件日期；新开业时分期何时开始（NOT STATED）；此处写「30 Jun」，而 POL-TAX-04 写电子申报可到 15 July，两者并存（后者页面有更新日期 2026-06-25，更具体）。
- **设计影响**：`tax.cp500.payment_grace_days = 30` 作为可配置规则（待抽查）；每期的「通知书上的应付日期」与「宽限后的最后缴款日」是两个不同日期，必须分开存。
- **状态**：【官方证实】（待抽查 30 天规则）

### POL-TAX-03 CP502「Nota Penerangan」（修改 CP500 分期的说明）
- **来源机构**：LHDN（HASiL）
- **位置**：https://www.hasil.gov.my/media/xejj2kk0/nota-penerangan-cp502.pdf
- **取得日期**：2026-10-22（第二次尝试因权限请求未回应而失败，没有重试）
- **文件日期**：没有独立发行日期；表格示例使用 2026 年 2 月与 10 月
- **适用年度/资格**：不同意 CP500 金额、要求修改分期的纳税人；表格示例用 2026 年；适用评税年：文件未写明（NOT STATED，见「未确认」）。
- **要点（工具转述）**：
  - 资格：「Sekiranya tuan tidak bersetuju dengan amaun Notis Bayaran Ansuran (CP500) tuan dibenarkan untuk meminda bayaran」。
  - 截止：「Permohonan pindaan kali pertama hendaklah dikemukakan tidak lewat daripada 30 Jun/ 31 Oktober 2026」；工具称另有第二次申请截至 31 Oktober 2026，逾期不受理。
  - 罚款：「Kenaikan cukai 10% akan dikenakan sekiranya perbezaan di antara Cukai Kena Dibayar dengan Jumlah Bayaran Ansuran」超过应缴税款的 30%；公式「[(CKD – AP) - (30% x CKD)] x 10%」。
  - 修改后每期金额：「Amaun Bayaran Ansuran Dipinda dikira dengan membahagikan Jumlah Bayaran Ansuran Dipinda dengan baki bilangan ansuran.」；零头并入最后一期；工具称会发出 CP503X 通知。
  - 提交方式：亲交、电邮、邮寄、或经在线客户反馈表；该文件没有列出需附的证明文件。
- **未确认**：「30 Jun/ 31 Oktober」是两类纳税人的两个截止日，还是第一次/第二次修改的截止日——**工具没有读清**；与 POL-TAX-01「30 Jun 之前」不一致；CP503X 是否确为修改后通知书的名称；适用的评税年。
- **设计影响**：修改后的通知书是新的正式文件，计划行必须能「被取代」（追加修订记录，不覆盖历史）；10% 罚款不在本期范围，不计算。
- **状态**：【官方证实·有限】；截止日【PENDING】（冲突）

### POL-TAX-04 「Balance of Tax Payment」（余额税款）
- **来源机构**：LHDN（HASiL）
- **位置**：https://www.hasil.gov.my/en/individu/bayaran/baki-cukai-kena-bayar/
- **取得日期**：2026-10-22
- **页面更新日期**：「Last updated on: 25/06/2026 03:22 PM」（页面元数据 2026-06-25）
- **适用年度/资格**：有生意收入、需缴余额税款的纳税人；页面没有写具体评税年（见「未确认」）。
- **要点（工具转述）**：有生意收入者，余额税款「must be paid ... no later than the following year after the year of assessment」——纸质申报 6 月 30 日，电子申报（e-Filing）7 月 15 日；「an assessment must be made between the CP500 instalment payments and the actual tax payable」；有欠税的生意纳税人「may also apply for tax instalment」。
- **未确认**：付款渠道、付款凭证（均 NOT STATED）；页面没有写具体评税年。
- **设计影响**：余额税款不是 CP500 分期，本期设计只把它记为「TAX_OTHER」，不参与计划对比；年度结算（税额计算）不在范围。
- **状态**：【官方证实】

### POL-TAX-05 邻近事项：Budget 2027 与 PERKESO 缴款的税务扣除（不在本期范围，仅登记）
- **来源**：RTM 新闻（二手，非财政部原文）；见 POL-SOC-08
- **位置**：见 POL-SOC-08 的 RTM 文章网址（二手来源；财政部原文见 POL-EPF-05）。
- **适用年度/资格**：适用评税年与条件：未知（NOT STATED，见「未确认」）。
- **要点（工具转述）**：Budget 2027 将 PERKESO 的税务扣除扩及强制性 Skim Lindung Kendiri 缴款；自愿缴款 Skim Lindung 24 Jam 与 Lindung Kendiri 另有最高 RM150 的额外扣除。
- **未确认**：财政部原文未核；适用评税年与条件未知。
- **设计影响**：只说明一点——SOCSO 缴款凭证以后可能成为报税扣除的证据，所以证据登记要保存发行机构、日期、参考号与文件哈希；本期不设计任何税务估算。
- **状态**：【线索】

---

## 4. SOCSO / PERKESO

### POL-SOC-01 「Self-Employment Social Security Scheme」（SKSPS / Lindung Kendiri）
- **来源机构**：PERKESO
- **位置**：https://www.perkeso.gov.my/en/our-services/protection/self-employed.html
- **取得日期**：2026-10-22
- **页面日期**：**NOT STATED**（页内历史日期：2017-06-01 起首个强制行业，2020-01-01 扩至 19 个行业，2024-06-01 丧葬津贴 RM3,000 生效）
- **资格**：马来西亚公民或永久居民，无年龄限制，为自己工作谋生者。
- **计划表（工具转述）**：

| Plan | Insured Monthly Earning | 每月 | 每年 |
|---|---|---|---|
| 1 | RM1,050 | RM13.10 | RM157.20 |
| 2 | RM1,550 | RM19.40 | RM232.80 |
| 3 | RM2,950 | RM36.90 | RM442.80 |
| 4 | RM3,950 | RM49.40 | RM592.80 |

- **缴款期**：页面只给出月缴和年缴金额；季缴、半年缴等：NOT STATED。
- **保障起算**：保障「from the date and time the contribution is paid」，以缴款收据确认。**缴款之后覆盖期如何确定：NOT STATED。**
- **缴款方式**：Prihatin 手机应用或 prihatin.perkeso.gov.my；如何取得收据：NOT STATED。
- **未确认**：页面日期；缴款期（季缴、半年缴等）；缴款之后覆盖期如何确定（尤其一次缴多个月）；如何取得缴款收据。
- **设计影响**：`socso.sksps.plan.*` 规则行；**覆盖起止日由收据/证书上的日期录入（stated），系统不推算**；一次缴多个月的覆盖期规则未知（PENDING），所以模型必须允许一笔付款对应任意长度的覆盖区间。现有 160 里写死的 49.40 与此处 Plan 4 月缴额一致，但是否选 Plan 4 是你的决定。
- **状态**：【官方证实·有限】

### POL-SOC-02 PERKESO SKSPS 宣传单（Flyer BI）
- **来源机构**：PERKESO
- **位置**：https://www.perkeso.gov.my/images/flyers/sksps/041024%20-%20Flyers%20BI%20SKSPS%20-%2004%20Oct_compressed.pdf
- **取得日期**：2026-10-22
- **文件日期**：内容里 **NOT STATED**（文件名含「041024」「04 Oct」，仅为文件名推测，**不当作日期**）
- **适用年度/资格**：与 POL-SOC-01 的四档计划与资格相同；适用年度：内容未写明（NOT STATED）。
- **要点（工具转述）**：与 POL-SOC-01 相同的四档计划；「Contributions can be paid monthly or yearly」；保障起算「from the date and time of contribution payment」并以收据确认；暂时性丧失工作能力津贴须医疗假至少 4 天（含事故日）；永久伤残与受养人津贴按所选投保月收入的 90% 计算。
- **未确认**：文件日期；一次缴多个月时覆盖期如何确定（均 NOT STATED）。
- **状态**：【官方证实】

### POL-SOC-03 「FAQ Inisiatif Belanjawan 2026 – Lindung Kendiri（Padanan Caruman）」
- **来源机构**：PERKESO
- **位置**：https://www.perkeso.gov.my/images/belanjawan2026/kendiri_padanan_caruman/060426-FAQ%20INISIATIF%20BELANJAWAN%202026%20-%20LINDUNG%20KENDIRI-XNS250112.pdf
- **取得日期**：2026-10-22
- **文件日期**：「6 April 2026（Bil. 1/2026）」
- **适用年度/资格**：2026 年倡议，申请期 2026-04-06 至 2026-12-31；资格：公民或永久居民、无年龄限制、在马来西亚全职或兼职、在非强制行业、尚未登记过 2026 年此项倡议（详见要点）。
- **要点（工具转述）**：
  - 两种配对，都以 Plan 2（RM232.80/年）计：**Padanan70（70:30）**「Baki bayaran RM162.80 (70%) akan dibiayai oleh Kerajaan」，自雇者付 RM70.00；**Padanan50（50:50）**「OBS hanya perlu membayar sebanyak RM116.40 (50%)」。
  - 资格：公民或永久居民，无年龄限制；在马来西亚全职或兼职；**在非强制行业**；尚未登记过 2026 年此项倡议；工具转述称「强制行业（客运、货运/食品运输、小贩）被排除」。
  - 限制：「OBS hanya layak mendapat satu pembiayaan di bawah Inisiatif Belanjawan 2026 bagi bayaran tahun semasa」；政府补贴金额上限、参与人数上限：NOT STATED。
  - 期间：「Permohonan boleh dibuat bermula 6 April 2026 sehingga 31 Disember 2026」（视政府变更）。
  - 保障：12 个月，从收到缴款之日起；续保者在现有保障结束后起算；「Tarikh dan tempoh perlindungan bermula pada tarikh bayaran caruman diterima」。
  - 申请渠道：PERKESO 网站、Prihatin、柜台、SKSPS 代理；Grab 或平台报销：**NOT STATED**。
- **未确认**：这项倡议是否适用于你本人（按字面，配送属被排除的强制行业；以 PERKESO 原文及你自己的登记状态为准）；「续保从现有保障结束后起算」是否也适用于一般 SKSPS 提前多缴。
- **设计影响**：「覆盖区间可由前一笔的结束日接续，而不是缴款日」是官方文件里出现过的情形，所以覆盖起止日必须是**独立录入的字段**，不能默认等于缴款日。
- **状态**：【官方证实·有限】；适用性【待确认】

### POL-SOC-04 Gig Workers Act 2025（Act 872）法案文本
- **来源机构**：人力资源部（jtksm.gov.my，由 jtksm.mohr.gov.my 重定向）
- **位置**：https://jtksm.gov.my/sites/default/files/2026-01/Akta%20872%20-%20AKTA%20PEKERJA%20GIG%202025.pdf（马来文；mohr.gov.my 上的英文 PDF 因 robots 限制未读取）
- **取得日期**：2026-10-23
- **文件日期**：御准 2025-12-16；宪报刊登 2025-12-31
- **适用年度/资格**：适用于零工与平台提供者（s.81 仅适用于聘用零工的平台提供者）；生效日由宪报公告订定，没有读到公告（见「未确认」）。
- **要点（工具转述）**：
  - s.1(2)：「Akta ini mula berkuat kuasa pada tarikh yang ditetapkan oleh Menteri melalui pemberitahuan dalam Warta」，可对不同条文订不同日期；**法案本身没有固定生效日**。
  - 第 VIII 部分（社会保障，ss.78–94）：s.81 仅适用于聘用零工的平台提供者；s.82(a) 零工有权要求从应付收入中扣缴社会保障；s.83(c)–(d) 平台须扣缴并向社会保障计划缴款，「mengikut peratusan amaun caruman sebagaimana yang ditetapkan」；s.83(e) 扣缴不足最低月缴额时，平台须通知零工自行补缴。
  - 「ditetapkan」依 s.2 指部长以法规订定——**费率在法规里，不在法案里**；法规未读到。
  - s.82(b)：零工有权在平台的数字系统中查看扣缴；s.13：非个人实体应零工要求提供收入单；是否必须主动提供缴款对账单：NOT STATED。
  - s.86(a)：未缴纳是罪行（最高 2 年监禁及/或罚款 RM10,000）。
  - s.4、s.5：既有合约与不利条款的过渡规定；社会保障的过渡规定：NOT STATED。
- **未确认**：文本在 s.100(2) 处被截断，后面的条文与附表未读到；宪报生效公告（NOT FOUND）；费率法规（NOT FOUND）。
- **状态**：【官方证实·有限】；生效日【PENDING】

### POL-SOC-05 PERKESO 新闻稿「Siaran Media Sambut Akta Pekerja Gig（Akta 872）」
- **来源机构**：PERKESO
- **位置**：https://www.perkeso.gov.my/images/kenyataan_media/2026/010426%20SIARAN%20MEDIA%20SAMBUT%20AKTA%20PEKERJA%20GIG%20AKTA%20872%20-%20latest.pdf
- **取得日期**：2026-10-22
- **文件日期**：2026-04-01（禁发布至当日中午 12:00）
- **适用年度/资格**：适用于零工平台（按每笔收入交易自动扣缴 1.25%）；适用年度、生效日、分阶段时间表：新闻稿未写明（NOT STATED）。
- **要点（工具转述）**：「potongan caruman dilaksanakan secara automatik daripada setiap transaksi pekerja gig」；经 PERKESO 与平台的 API 整合；「caruman pada kadar 1.25 peratus akan dilaksanakan secara automatik ke atas setiap transaksi pembayaran pendapatan」；PERKESO「kini berada pada tahap kesiapsiagaan penuh」；敦促平台准备系统。
- **未确认**：生效日期、平台分阶段时间表、由谁承担、现有 Lindung Kendiri 缴款人的处理、是否有配对——全部 NOT STATED。
- **状态**：【官方证实】；以上缺项【PENDING】

### POL-SOC-06 PERKESO「FAQ Akta Pekerja Gig」
- **来源机构**：PERKESO
- **位置**：https://www.perkeso.gov.my/images/lindung/kendiri/080425-FAQ%20AKTA%20PEKERJA%20GIG.pdf
- **取得日期**：2026-10-23（前一次尝试因会话额度中断）
- **文件日期**：「BIL. 2/2026 | 31 MAC 2026」
- **适用年度/资格**：适用于零工及平台提供者（FAQ 编号 BIL. 2/2026）；生效日：NOT STATED。
- **要点（工具转述）**：「Penyedia platform bertanggungjawab untuk membuat potongan daripada pendapatan pekerja gig」；「Kadar potongan caruman adalah sebanyak 1.25% daripada setiap transaksi tugasan」；扣缴不足可到 PRIHATIN 补缴；保障期「bermula dari penerimaan tugasan atau 'job' pertama」；既有 SKSPS 缴款人：「Ya. Potongan caruman melalui penyedia platform tetap akan dibuat.」；「Potongan akan terhenti sekiranya caruman pekerja gig telah genap 24 bulan.」；保障期「akan bersambung」；查缴款状态请用 PRIHATIN 门户或应用。
- **未确认**：生效日（NOT STATED）；对账单/收据形式（NOT STATED）；与政府或 Grab 配对的关系（NOT STATED）；「24 个月」那句的确切含义（**请人工核对原句**）。
- **设计影响**：这是「平台自动扣款」将来出现时的官方背景；所以付款记录要预留 `payer_channel`（自缴 / 平台扣缴）这个字段，而当前（Grab 没有自动扣款）全部是自缴。
- **状态**：【官方证实】；24 个月句【待抽查】

### POL-SOC-07 PERKESO「Contribution Payment」页（已检查，**不适用**）
- **来源机构**：PERKESO
- **位置**：https://www.perkeso.gov.my/en/contribution-payment.html
- **取得日期**：2026-10-22
- **页面日期**：登记时未记录（NOT RECORDED）；该页不适用于你，不影响设计。
- **适用年度/资格**：**不适用**——该页以雇主为对象，页面没有说明适用于 SKSPS / Lindung Kendiri。
- **内容**：以雇主为对象——「Contributions payable for any month must be paid no later than the 15th day of each succeeding month」；迟缴利息 6% 年率；渠道含 ASSIST 门户、网银、柜台、PRIHATIN。页面**没有**说明适用于 SKSPS / Lindung Kendiri，也没有 SKSPS 的缴款细节与收据说明。
- **未确认**：无需追踪（不适用）。
- **设计影响**：**不得**把「次月 15 日」或「6% 利息」套到你的自雇缴款上。
- **状态**：【官方证实】但**不适用**

### POL-SOC-08 Budget 2027 的 PERKESO 措施
- **来源**：财政部 Appendix 1（见 POL-EPF-05，第 5 页）；RTM 新闻（二手）
- **位置**：RTM 文章「Sektor Gig: Pakej RM160 juta tingkat pendapatan, kebajikan pekerja」https://berita.rtm.gov.my/nasional/senarai-berita-nasional/senarai-artikel/sektor-gig-pakej-rm160-juta-tingkat-pendapatan-kebajikan-pekerja/ （网址是登记之后用搜索补上的，没有重新抓取；财政部原文见 POL-EPF-05）。
- **RTM 文章**：2026-10-09 17:20 发布；Budget 2027 当日在 Dewan Rakyat 提呈。
- **适用年度/资格**：宣布性措施；对象：e-hailing/p-hailing 从业者，以及 17 个非强制行业的自雇人士（工具转述）；适用年度与条件：NOT STATED（RTM 文字称「mulai 2027」，原文措辞待核）。
- **要点（工具转述）**：「Provision of a 35% PERKESO matching contribution incentive to e-hailing and p-hailing workers」，「which may be raised to 50% if platform operators also share in the contributions of these workers」；「coverage of 70% of contributions for more than 200,000 Self-Employed Persons in 17 non-mandatory sectors」；RTM：工具转述称整个零工方案「funded with Grab」，并有「mulai 2027」（自 2027 起）的字样（原文措辞请核对）；该项配对的补贴上限与开始日期 NOT STATED。
- **未确认**：生效日期、上限、与现有 Grab 补贴的关系。
- **状态**：宣布性措施，【PENDING】

---

## 5. Grab（平台条款；你的实际对账单才是记录依据）

### POL-GRAB-01 「SOCSO LINDUNG KENDIRI Scheme」页
- **来源**：Grab Malaysia
- **位置**：https://www.grab.com/my/grab-benefits/protection/socso-lindung-kendiri/
- **取得日期**：2026-10-22
- **页面日期**：**NOT STATED**（页脚 ©2010–2026）；活动期写在条款里
- **适用年度/资格**：活动期 2026 年 6–12 月（付款周期 2026 年 7 月至 2027 年 1 月）；资格：Ultimate / Platinum 等级（Platinum 每月至少 30 趟），持有有效且未过期的 LINDUNG KENDIRI 计划；Gold 及其他等级不适用。
- **要点（工具转述）**：
  - 形式：「partial sponsorship monthly (Terms & Conditions apply)」；期间「From June to December 2026」，付款周期「begins in July 2026 and ends on January 2027」。
  - Ultimate：每月「80% of Plan 1, or up to RM10.50 on any plan」；Platinum：每月「50% of Plan 1 or up to RM6.60 on any plan」，且「minimum of 30 trips per month」；Gold 及其他等级不适用；须有有效、未过期的计划。
  - 流程：①自行注册并加入任一 LINDUNG KENDIRI 计划；②每月自行向 SOCSO 缴款并保持等级；③符合条件则 Grab「by the 10th of the following month」报销。页面示例：2026 年 6 月 Ultimate → RM10.50，2026-07-10 前支付；2026 年 8 月 Platinum → RM6.60，2026-09-10 支付；2026 年 9 月 Gold → 无。
  - 自动扣款：Grab 称「working on a smart system (API) with SOCSO」，后续公布。
  - 申请审批、支付方式、所需文件：**NOT STATED**。
- **未确认**：页面日期；你是否需要「申请」才有报销；一次多缴几个月时 Grab 如何按月计算（页面写的是「每月自行缴款」）。
- **设计影响**：报销是**每个月一个独立的索偿项**（等级按月决定），不是一笔付款对一笔报销；所以报销记录自带「对应月份」与「等级」，与付款记录之间靠**明确的链接**对应，而不是假设。
- **状态**：平台条款；流程【PENDING】

### POL-GRAB-02 Grab 博客「Level Up Rakan — SPS Gig contribution matching」
- **来源机构**：Grab Malaysia（平台博客，非政府来源）
- **位置**：https://www.grab.com/my/blog/driver/sps-gig-contribution-matching/
- **取得日期**：2026-10-22；**页面日期 NOT STATED**
- **适用年度/资格**：按季度等级方案；适用年度：页面未写明（NOT STATED，见「判断」）。
- **要点（工具转述）**：按季度等级——Level 1「Complete a minimum of 100 bookings / orders by the same yearly quarter」得 RM20；Level 2「Maintain the Ultimate tier for two yearly quarters in a row」得 RM70；到「Grab Cash Wallet」于下一季度第一个月前；政府补贴「70% (RM162.80) of the yearly contribution amount of RM232.80」。
- **判断**：与 POL-GRAB-01 的「每月」方案结构不同，页面没有日期，应视为**旧方案**，不得当作现行规则。
- **未确认**：页面日期；该方案是否仍有效（按「判断」视为旧方案）。
- **状态**：【线索】（历史）

### POL-GRAB-03 Grab 新闻稿（2023-11-02）
- **来源机构**：Grab Malaysia（新闻稿）
- **取得日期**：2026-10-21 至 2026-10-23 之间（本条未单独记录）
- **文件日期**：2023-11-02（标题所注）
- **适用年度/资格**：2023 年公告：Ultimate 伙伴的 SPS Padanan Caruman 全额补贴；其余条件未写明（NOT STATED）。
- **位置**：https://www.grab.com/my/press/others/grab-malaysia-extends-partnership-with-perkeso-to-support-top-partners-self-contributions/
- **要点（工具转述）**：Ultimate 伙伴「full subsidy covering an entire year's contribution to SPS Padanan Caruman」；流程、期间、生效日 NOT STATED。
- **判断**：2023 年的旧公告，仅作历史线索。
- **未确认**：流程、期间、生效日（均 NOT STATED）；是否仍然有效（视为历史线索）。
- **状态**：【线索】（历史）

### POL-GRAB-04 未取回 / 缺失
- **来源机构**：Grab Malaysia（博客页）；你自己的 Grab 对账单不属于任何网页来源。
- Grab 博客「Padanan Caruman SPS Gig PERKESO」（https://www.grab.com/my/blog/driver/padanan-caruman-sps-gig-perkeso/）：抓取失败（CLIENT_ERROR），**未读取**。
- 你自己的 Grab 正式对账单、付款通知或站内信：**本次没有提供**。报销记录的证据依据以它们为准，这些文件的格式我没有见过，所以报销记录的证据类型只能先设计成通用的（见设计文档 §5）。
- **页面日期 / 适用年度/资格**：未读取，无从记录（抓取失败，没有绕过）。
- **未确认**：该博客页的全部内容；你的 Grab 正式对账单/通知的格式。
- **状态**：【PENDING】

---

## 6. 第三方来源（只是线索，**不作依据**）

| 来源 | 日期 | 它说了什么 | 为什么只算线索 |
|---|---|---|---|
| Malay Mail「Budget 2026: gig workers to get up to RM600 a year in EPF matching under new i-Saraan Plus scheme」 | 2025-10-10 | e-hailing/p-hailing 零工每年最多 RM600、终身 RM6,000；其他自雇 RM500 / RM5,000；未写配对比率与开始日期 | 新闻；与 POL-EPF-01/02 的数字一致，但不是规则文本 |
| SQL Accounting「What is CP500?」 | 页面无日期 | 6 期、从三月起、每期自应付日起 30 天；逾期未缴罚 10%；CP502 须在 6 月 30 日前；修改后总额低于实际应缴税 30% 以上则罚 10% | 软件公司说明；其中「逾期罚 10%」LHDN 官方页没有写（POL-TAX-01 的罚款项为 NOT STATED） |
| NST「Better protection for gig workers under new law」 | 2026-03-25 | 法案「本月生效」；平台须与 PERKESO 系统连接以自动扣款；2025 年 3 月只有 26% 零工缴 Lindung Kendiri | 新闻；生效日期没有宪报公告佐证 |
| beancount.io「Malaysia gig workers act SOCSO mandatory 2026 guide」 | 2026-08-13 | 每笔任务 1.25%；「postpaid model」于 2026-05-19 由 SOCSO 确认；保障自首次接单起一年；Act 872 于 2026 年 3 月生效；旧年缴方案约 RM157 至 RM593 | 第三方指南；其中「5 月 19 日」「3 月生效」均无官方文件佐证（官方年缴额是 RM157.20 至 RM592.80） |
| RTM「Sektor Gig: Pakej RM160 juta…」（网址见 POL-SOC-08） | 2026-10-09 | Budget 2027 零工措施（见 POL-SOC-08） | 新闻转述，不是财政部原文 |
| 其他仅看到标题、没有抓取的：Bernama、theedgemalaysia、says.com、ringgitplus 等关于 Budget 2026/2027 的文章；KWSP 文章「How To Save For Retirement As A Gig Worker Or Freelancer?」等 | 各异 | — | 未读取内容，不引用 |

---

## 7. 没找到 / 被阻挡 / 未取回（不要当作「不存在」）

| # | 事项 | 状态 | 说明 |
|---|---|---|---|
| N1 | Act 872 的宪报生效公告；费率法规（1.25% 的法律依据） | NOT FOUND | 只在新闻稿与 FAQ 里看到 1.25%；法案正文把费率指向法规 |
| N2 | 人力资源部 2026-03-31 新闻稿（KSM.100-2/1/1 JLD.5 (71)）；mohr.gov.my 上的 Act 872 英文 PDF | **BLOCKED**（robots_disallowed） | 没有绕过；Act 872 改读 jtksm.gov.my 的官方文本（被截断在 s.100(2)） |
| N3 | LHDN 新闻稿 2025-10-07（YA2025 修改 CP500 的截止日）与 2026-01-05（CP500 罚款宽免）| 抓取失败（CLIENT_ERROR） | 只在搜索结果里看到文件名，**内容未读**，不作依据。第一份可能能解释 POL-TAX-03 的「30 Jun / 31 Oktober」——需要你打开原文 |
| N4 | 新开业、没有上一年评税记录者的 CP500 规则 | NOT STATED | 官方页没写 |
| N5 | CP500 逾期罚款的官方依据；分期付款渠道与凭证（ByrHASiL 收据）的格式 | NOT STATED | 只有第三方线索 |
| N6 | EPF 缴款与奖励的凭证形式（收据、对账单、i-Akaun 记录）与参考号格式 | NOT STATED | i-Saraan Plus 页面没写 |
| N7 | PERKESO SKSPS 的收据/参考号格式；多月预缴的覆盖期规则 | NOT STATED | 只有「从缴款日期和时间起」 |
| N8 | Budget 2027：PERKESO 35%/50% 配对与 EPF 措施的生效日期与上限 | PENDING | MOF 文件被截断，只读到摘要页 |
| N9 | Grab 报销的申请/审批流程、支付方式、所需文件；你自己的 Grab 对账单格式 | PENDING | 页面没写，你的文件未提供 |
| N10 | i-Saraan Plus 的 7 项缺口（自缴是否计入、current year、20% 基数、2026 前缴款、司机身份验证、凭证、页面日期） | PENDING | 见 POL-EPF-02 |

---

## 8. 设计影响：建议的 `Policy_Rule` 种子（仅数据，不进代码）

规则行格式：`rule_key` / `value` / `effective_from` / `effective_to` / `verification_status` / `source_ref`。**`verification_status` 只有三种：`OFFICIAL`（本表有官方来源，仍待抽查）、`PENDING`（没有官方依据，值留空）、`LEAD`（只有线索，不得参与任何判断）**。数值不会出现在任何 `.js` 里。

| rule_key | value | effective_from | status | source_ref |
|---|---|---|---|---|
| epf.i_saraan.match_rate | 0.20 | NOT STATED | OFFICIAL | POL-EPF-01 |
| epf.i_saraan.annual_cap_rm | 500 | NOT STATED | OFFICIAL | POL-EPF-01 |
| epf.i_saraan.lifetime_cap_rm | 5000（或到 60 岁） | 2024（FAQ 称「takes effect from 2024」） | OFFICIAL | POL-EPF-01 |
| epf.i_saraan_plus.match_rate | 0.20（基数：当年自愿缴款总额） | 2026（仅年份） | OFFICIAL | POL-EPF-02 |
| epf.i_saraan_plus.annual_cap_rm | 600 | 2026（仅年份） | OFFICIAL | POL-EPF-02 |
| epf.i_saraan_plus.lifetime_cap_rm | 6000（或到 60 岁） | 2026（仅年份） | OFFICIAL | POL-EPF-02 |
| epf.i_saraan_plus.exact_effective_date | （空） | — | PENDING | POL-EPF-02/03/04 |
| epf.i_saraan_plus.self_paid_counts | （空） | — | PENDING | POL-EPF-02 |
| epf.incentive.year_basis | （空：日历年？） | — | PENDING | POL-EPF-01/02 |
| epf.incentive.max_per_year | 1（FAQ 17；作用范围是否跨 i-Saraan / Plus 未明） | — | OFFICIAL（范围 PENDING） | POL-EPF-02 |
| epf.incentive.credit_frequency | 一年两次，视政府拨款 | — | OFFICIAL | POL-EPF-01/02 |
| epf.voluntary.annual_max_rm | 100000 | — | OFFICIAL | POL-EPF-01/02 |
| epf.budget2027.changes | （空） | — | PENDING | POL-EPF-05 |
| tax.cp500.max_instalments | 6 | — | OFFICIAL | POL-TAX-01/02 |
| tax.cp500.start_month | 3 | — | OFFICIAL | POL-TAX-01/02 |
| tax.cp500.payment_grace_days | 30 | — | OFFICIAL（待抽查） | POL-TAX-02 |
| tax.cp500.revision_deadline | （空） | — | PENDING（冲突） | POL-TAX-01 vs POL-TAX-03 |
| tax.cp502.shortfall_threshold | 0.30 | — | OFFICIAL（待抽查） | POL-TAX-03 |
| tax.cp502.shortfall_penalty_rate | 0.10 | — | OFFICIAL（待抽查） | POL-TAX-03 |
| tax.cp500.first_year_business | （空） | — | PENDING | POL-TAX-01 |
| tax.cp500.late_payment_penalty | （空；线索称 10%） | — | PENDING / LEAD | POL-TAX-01；第三方 |
| tax.form_b.deadline_manual / e_filing | 6 月 30 日 / 7 月 15 日 | — | OFFICIAL | POL-TAX-04 |
| socso.sksps.plan.{1..4}.insured_earning_rm | 1050 / 1550 / 2950 / 3950 | NOT STATED | OFFICIAL | POL-SOC-01/02 |
| socso.sksps.plan.{1..4}.monthly_rm | 13.10 / 19.40 / 36.90 / 49.40 | NOT STATED | OFFICIAL | POL-SOC-01/02 |
| socso.sksps.plan.{1..4}.yearly_rm | 157.20 / 232.80 / 442.80 / 592.80 | NOT STATED | OFFICIAL | POL-SOC-01/02 |
| socso.sksps.coverage_start_rule | 自缴款日期与时间起（以收据为准） | — | OFFICIAL | POL-SOC-01/02 |
| socso.sksps.multi_month_coverage_rule | （空） | — | PENDING | POL-SOC-01 |
| socso.padanan2026.options | 70:30 与 50:50（Plan 2）；申请 2026-04-06 至 2026-12-31；非强制行业 | 2026-04-06 | OFFICIAL（适用性待确认） | POL-SOC-03 |
| socso.gig.deduction_rate | 0.0125（每笔任务） | （空，生效日未知） | OFFICIAL | POL-SOC-05/06 |
| socso.gig.commencement_date | （空） | — | PENDING | POL-SOC-04 |
| socso.budget2027.match_e_hailing | 0.35；平台共同承担则 0.50 | （空） | PENDING | POL-SOC-08 |
| grab.sponsorship.2026.ultimate / platinum | 见 POL-GRAB-01 | 2026-06 至 2026-12 | 平台条款（页面无日期） | POL-GRAB-01 |

规则解析的约定（详见设计文档 §6）：**任何 PENDING 或缺失的规则，查询时回「Rule_Pending」，不使用默认值**。

---

## 9. 方法限制与建议人工抽查清单

**限制**：①WebFetch 是转述；②多数页面没有日期；③我只抓取了公开页面，没有登录任何系统；④没有看到你本人的任何官方收据、通知书或 Grab 对账单，所以「收据上的参考号长什么样」「Grab 对账单写什么」完全未知；⑤有两次抓取是因会话额度中断，后来补抓。

**建议你打开原网页核对的 10 项**（因为会直接影响设计里的规则值）：

1. EPF i-Saraan Plus FAQ 5、10、14、17、16、1（自缴是否计入 / 「current year」/ 一年一份奖励 / 2024 与 2026）
2. EPF i-Saraan 页「RM5,000 lifetime… takes effect from 2024」
3. EPF 奖励入账「twice a year」「subject to the receipt…」
4. LHDN 「30 hari dari tarikh kena bayar」（POL-TAX-02）
5. CP502 说明里「30 Jun/ 31 Oktober 2026」的前后文（POL-TAX-03）；LHDN 2025-10-07 新闻稿（N3）
6. CP502 的 30% / 10% 公式与「CP503X」这个名称
7. PERKESO「Potongan akan terhenti sekiranya caruman pekerja gig telah genap 24 bulan」
8. PERKESO 2026 FAQ「强制行业被排除」是否包括你的工作类别
9. Act 872 s.82–83 与 s.1(2) 的原文
10. Grab 页面的等级金额（RM10.50 / RM6.60 / 30 趟）与「by the 10th of the following month」
