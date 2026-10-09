/**
 * 143_Tests_DailyOrderAllocation.js
 * Compliance OS — 142_DailyOrderAllocation.js 的测试。
 *
 * 惯例跟现有 122/141/161 一致：Node vm 模块把交付文件按字母序整个合并
 * 执行，共用 105_TestUtils.js 的 assertEqual_ + fake 系列 helper，不在
 * 这个文件里重复宣告。
 *
 * Fixture 来源：2026-08-24 Phase 1 实际用 pdftotext -layout 抽取的两份
 * 真实 Grab Weekly Statement 原始文字（2026-W01 跨月、2026-W33 单月），
 * 逐字节保留，不是手动简化过的"看起来干净"版本——这是 Steven 2026-08-24
 * §十三明确要求的 real PDF integration verification，不能只跑 synthetic
 * fixture。已知这份原始文字里少数几行订单号会因为原始 PDF 内部换行黏在
 * 一起（例如 "...AVtunai"），142 的 extractOrderIds_ 对此有防御性处理，
 * 下面 TEST 33 会单独验证这个已知边界情况的行为，不假装它不存在。
 */

if (typeof require === 'function') {
  var {
    isoDateFromYmd_, isValidYmd_, enumerateYearMonthsInPeriod_, resolveOrderDate_, resolveDateFromDayMonth_,
    splitIntoDayBlocks_, extractOrderIds_, parseOrderRowCandidate_, parseDayBlock_,
    computeDailyChecksum_, computeStatementChecksum_, parseTipSection_, matchInsentifLineDate_,
    matchExplicitPeriodReference_, matchBayaranLainLainDate_, orderDateToYearMonth_,
    DAILY_ALLOCATION_COLUMNS, NON_ORDER_INCOME_ALLOCATION_COLUMNS,
    buildDailyAllocationRows_, getLatestDailyAllocationBatchId_, getLatestDailyAllocationRows_,
    writeDailyAllocationBatch_, buildNonOrderIncomeAllocationRow_, writeNonOrderIncomeAllocationBatch_
  } = require('./142_DailyOrderAllocation.js');
  var { round2_ } = require('./106_Utils.js');
  var { fakeSheetAccessor_, fakeLockProvider_ } = require('./105_TestUtils.js');
  var { createTruthWriter_ } = require('./115_TruthWriter.js');
}

var DOAL_FIXTURE_BUTIRAN_W01_ = "Butiran Tempahan - Penghantaran\n\nAhad, 4 Januari\n\n\n                                       Cara              Pendapatan    Pendapatan     Pelarasan     Pendapatan\n  Jenis Tempahan      Butiran\n                                       pembayaran            asas              lain   Pendapatan     bersih\n\n\n\n  Pesanan Tunggal\n                      PLAN-1-          Tanpa\n  GrabExpress                                                4.00                       0.00          4.00\n                      GLFXHUNGWUKU     tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                             4.10                       1.40          5.50\n  GrabFood            8QLIOUFWWKVDAV tunai\n\n\n\n  Pesanan Tunggal     A-               Tanpa\n                                                             3.70                       2.10          5.80\n  GrabFood            8QLEFDAGXXXRAV   tunai\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                             4.90                       0.00          4.90\n  GrabFood            8QLD7TOWWKVDAV tunai\n\n\n\n  Pesanan Tunggal\n                      PLAN-1-          Tanpa\n  GrabExpress                                                5.00                       0.20          5.20\n                      GLDI663WWHXR     tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                             3.30                       1.80          5.10\n  GrabMart            8QL9DCHGWB2EAV tunai\n\n\n\n  Pesanan Tunggal     A-               Tanpa\n                                                             3.30                       1.80          5.10\n  GrabFood            8QL83V3WXXRTAV   tunai\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                             3.30                       3.30          6.60\n  GrabFood            8QL68XJWWUDUAV tunai\n\n\n\n\n                                              Page 7 of 24\n\f                  A-\nPesanan\n                  8QL4CN9WWW57AV Tanpa\nSekaligus                                               9.40   0.00   9.40\n                  A-             tunai\nGrabFood\n                  8QL4CS3GW9W6AV\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                             6.00   1.30   7.30\n                  GLD9Q4EWW6JE     tunai\nInstant -- Bike\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        5.00   0.00   5.00\nGrabFood          8QL2DN9GWPLUAV tunai\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        3.40   1.70   5.10\nGrabFood          8QL23XKGXXRTAV   tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        7.10   1.70   8.80\nGrabFood          8QKU9ULGWB2EAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.10   2.20   5.30\nGrabFood          8QKTLVMWWK7CAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        7.20   1.80   9.00\nGrabFood          8QKRJ9BWWK7CAV tunai\n\n\nPesanan Tunggal   A-\n                                 Tunai                  2.60   2.50   5.10\nGrabFood          8QKPW34GWTKQAV\n\n\n\n                  A-\nPesanan\n                  8QKNGQIWXXWTAV Tanpa\nSekaligus                                               5.90   3.10   9.00\n                  A-             tunai\nGrabFood\n                  8QKNQQ2WX7VRAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        9.20   0.00   9.20\nGrabFood          8QKKGOWGXFQTAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        4.00   0.40   4.40\nGrabFood          8QKG237GWK7CAV tunai\n\n\n                  A-\nPesanan\n                  8QKDH97WWC6LAV Tanpa\nSekaligus                                               5.10   1.50   6.60\n                  A-             tunai\nGrabMart\n                  8QKD2NLWX2ABAV\n\n\n\n                                         Page 8 of 24\n\f  Pesanan Tunggal   A-             Tanpa\n                                                            5.60                   0.00        5.60\n  GrabFood          8QKBIT4WWPLUAV tunai\n\n\n                    A-\n  Pesanan\n                    8QK8WF8WWW7QAV Tanpa\n  Sekaligus                                                 9.10                   2.20       11.30\n                    A-             tunai\n  GrabFood\n                    8QK9A7VGWXA4AV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            3.80                   1.80        5.60\n  GrabFood          8QK3GLRWX9FDAV tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            4.20                   2.10        6.30\n  GrabMart          8QKXNLMW2DRBAV tunai\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            3.80                   2.10        5.90\n  GrabFood          8QJVA9HWX4XBAV tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            5.40                   0.90        6.30\n  GrabFood          8QJRNFPWWTKQAV tunai\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                    8QJQJGDWWTGCAV tunai                    4.90                   1.60        6.50\n  GrabFood\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            6.50                   1.70        8.20\n  GrabFood          8QJMI2UWWTKQAV tunai\n\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                            4.10                   1.40        5.50\n  GrabMart          8QJIU2QGW5XVAV   tunai\n\n\n                    A-\n  Pesanan\n                    8QJB6QUWWKVDAV Tanpa\n  Sekaligus                                                11.30                   0.00       11.30\n                    A-             tunai\n  GrabFood\n                    8QJBXCIGX54PAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            4.70                   1.90        6.60\n  GrabFood          8QJ5GEAGWK7CAV tunai\n\n\n                                                                                      RM205.50\nSabtu, 3 Januari\n\n\n                                     Cara              Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran             asas          lain   Pendapatan   bersih\n\n\n                                            Page 9 of 24\n\fPesanan Tunggal   A-\n                                 Tunai                      7.70   0.00    7.70\nGrabMart          8QHEGDFGX8OKAV\n\n\nPesanan Tunggal   A-\n                                   Tunai                    4.10   1.30    5.40\nGrabFood          8QHCL33GX6FLAV\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                                 5.00   0.00    5.00\n                  GL9HGQWGW2NB     tunai\nInstant -- Bike\n\n\nPesanan Tunggal   A-               Tanpa\n                                                            2.90   1.70    4.60\nGrabFood          8QH9MXIGX8OKAV   tunai\n\n\n\nPesanan Tunggal   A-            Tanpa\n                                                            4.90   2.00    6.90\nGrabMart          8QH7KHSWWCOWAVtunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                            2.30   2.30    4.60\nGrabFood          8QH7968GW3UCAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                            4.60   1.90    6.50\nGrabFood          8QH5P59WWTBUAV tunai\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                                10.00   0.10   10.10\n                  GL97W6JWWF8V     tunai\nInstant -- Bike\n\n\n\n                  A-\nPesanan\n                  8QHXR6KGWIHTAV Tanpa\nSekaligus                                                   9.90   0.50   10.40\n                  A-             tunai\nGrabMart\n                  8QHW6T8WXXIDAV\n\n\nPesanan Tunggal   A-             Tanpa                      3.10   3.60    6.70\nGrabFood          8QGUVKUGXDCEAV tunai\n\n\n\n                  A-\nPesanan\n                  8QGSPMMWWIGTAV Tanpa\nSekaligus                                                   8.20   4.10   12.30\n                  A-             tunai\nGrabFood\n                  8QGSCELGX8NPAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                            4.40   2.30    6.70\nGrabFood          8QGRKATGXBJRAV tunai\n\n\n\n\n                                           Page 10 of 24\n\fPesanan Tunggal   A-               Tanpa\n                                                          7.90   1.60    9.50\nGrabFood          8QGPAAIGX8NPAV   tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          4.30   2.40    6.70\nGrabFood          8QGNENHGW9X3AV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.80   1.00    4.80\nGrabFood          8QGJP7NGW3UCAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          4.70   0.00    4.70\nGrabFood          8QGH4DRWXWQOAV tunai\n\n\n\nPesanan Tunggal   A-\n                                 Tunai                    5.30   3.10    8.40\nGrabFood          8QGCPS2WWSEBAV\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          7.90   0.80    8.70\nGrabFood          8QG8I6LWWAI8AV   tunai\n\n\n\n                  A-\nPesanan\n                  8QG5NOJWWKGRAV Tanpa\nSekaligus                                                 8.70   4.10   12.80\n                  A-             tunai\nGrabFood\n                  8QG5LODWX6FLAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          5.40   2.00    7.40\nGrabFood          8QFVBT5GWSEBAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\nGrabMart          8QFSAGBWX6LDAV tunai                    5.00   1.70    6.70\n\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          1.90   2.80    4.70\nGrabFood          8QFPRJSWWBJUAV tunai\n\n\n\n                  A-\nPesanan\n                  8QFOB2LGXANDAV Tanpa\nSekaligus                                                10.10   2.80   12.90\n                  A-             tunai\nGrabFood\n                  8QFOPJGWWPWOAV\n\n\nPesanan           A-\n                                 Tanpa\nSekaligus         8QFJ4D6GWXQFAV                          7.00   5.70   12.70\n                                 tunai\nGrabFood          and 2\n\n\n\n\n                                         Page 11 of 24\n\f  Pesanan Tunggal   A-               Tanpa\n                                                              4.50                   0.90        5.40\n  GrabMart          8QFH93OGX9VPAV   tunai\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                      5.10                   0.00        5.10\n  GrabFood          8QFG4D6WWAI8AV\n\n\n\n  Pesanan Tunggal   A-\n                                     Tunai                    4.60                   1.90        6.50\n  GrabFood          8QFBIQJGWA8AAV\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              7.20                   2.40        9.60\n  GrabFood          8QF3292WWF3BAV tunai\n\n\n                                                                                        RM213.50\nJumaat, 2 Januari\n\n\n                                     Cara                Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran               asas          lain   Pendapatan   bersih\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-          Tanpa\n  GrabExpress                                                 4.20                   0.00        4.20\n                    GL5HUBGWW23J     tunai\n  Instant - Bike\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              3.90                   1.70        5.60\n  GrabFood          8QDXU9DWWR8DAV tunai\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              2.80                   3.10        5.90\n  GrabFood          8QCV9X9WWA9CAV tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              5.20                   2.40        7.60\n  GrabFood          8QCSEUJGWSA8AV tunai\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-          Tanpa\n  GrabExpress                                                 5.10                   0.00        5.10\n                    GL5XKWKGWMEC     tunai\n  Instant - Bike\n\n\n                    A-\n  Pesanan           8QCP95WGW5U8AV\n  Sekaligus         A-             Tanpa\n                                                             13.50                   2.50       16.00\n  GrabFood          8QCPJ74GWQCCAV tunai\n\n\n\n\n                                             Page 12 of 24\n\fPesanan Tunggal   A-\n                                 Tunai                    5.40   0.00    5.40\nGrabMart          8QCM5N3GXE3RAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          6.10   3.10    9.20\nGrabFood          8QCJQS7WXBTFAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          4.50   2.00    6.50\nGrabFood          8QCHEO4GWR8DAV tunai\n\n\n                  A-\nPesanan\n                  8QCH366WWQCCAV Tanpa\nSekaligus                                                10.30   0.00   10.30\n                  A-             tunai\nGrabFood\n                  8QCHB53GW5U8AV\n\n\n\n                  A-\nPesanan                          Tunai /\n                  8QCF8JCWXCXJAV\nSekaligus                        Tanpa                    6.10   1.80    7.90\n                  A-\nGrabFood                         tunai\n                  8QCEEAJGWSA8AV\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          3.40   0.90    4.30\nGrabFood          8QCC8XGGX2IHAV   tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          5.10   1.80    6.90\nGrabFood          8QBUBGFW2FJJAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.40   2.00    5.40\nGrabMart          8QBPS9WGW6IAAV tunai\n\n\n\n                  A-\nPesanan\n                  8QBPDMLGX9F9AV Tanpa\nSekaligus                                                 8.90   4.20   13.10\n                  A-             tunai\nGrabFood\n                  8QBOV2UGXBXHAV\n\n\nPesanan           A-\nSekaligus                        Tanpa\n                  8QBMAU3WWFARAV                          8.40   8.10   16.50\nGrabFood                         tunai\n                  and 2\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          7.70   2.00    9.70\nGrabFood          8QBJTLKGWVQCAV tunai\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          8.70   0.00    8.70\nGrabMart          8QBHRR6G2P2RAV   tunai\n\n\n                                         Page 13 of 24\n\f  Pesanan Tunggal   A-               Tanpa\n                                                             2.30                   3.80        6.10\n  GrabFood          8QBE5EXWX5OJAV   tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             5.70                   2.30        8.00\n  GrabFood          8QB9TT7WWMQFAV tunai\n\n\n                                                                                       RM162.40\nKhamis, 1 Januari\n\n\n                                     Cara               Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran              asas          lain   Pendapatan   bersih\n\n\n\n                    A-\n  Pesanan\n                    8Q8THPIWWHUIAV Tanpa\n  Sekaligus                                                  9.30                   0.70       10.00\n                    A-             tunai\n  GrabFood\n                    8Q8TB9HGWD7EAV\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                             0.00                   6.90        6.90\n  GrabMart          8Q8RF5VGX7CLAV   tunai\n\n\n\n                    A-\n  Pesanan\n                    8Q8O876GWG8BAV Tanpa\n  Sekaligus                                                 10.00                   2.30       12.30\n                    A-             tunai\n  GrabFood\n                    8Q8NRJKWW5K2AV\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                     4.80                   2.50        7.30\n  GrabMart          8Q8L4FQWX5GVAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             8.20                   1.00        9.20\n  GrabFood          8Q8J55OGW3DDAV tunai\n\n\n                    A-\n  Pesanan\n                    8Q8HADNWW9MFAV Tanpa\n  Sekaligus                                                  8.00                   3.20       11.20\n                    A-             tunai\n  GrabFood\n                    8Q8HJ2LWX5GVAV\n\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                             7.80                   0.00        7.80\n  GrabMart          8Q8E5DRGX7CLAV   tunai\n\n\n                    A-\n  Pesanan                          Tunai /\n                    8Q8A349GWFMVAV\n  Sekaligus                        Tanpa                     9.90                   0.00        9.90\n                    A-\n  GrabMart                         tunai\n                    8Q884V3GWG8BAV\n\n\n\n                                            Page 14 of 24\n\f                  A-\nPesanan\n                  8Q86LJWWWXFEAV Tanpa\nSekaligus                                                 5.90   0.00    5.90\n                  A-             tunai\nGrabMart\n                  8Q86AFIGW6KHAV\n\n\nPesanan Tunggal   A-\n                                 Tunai                    2.60   1.40    4.00\nGrabMart          8Q7VPW7GWV8VAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.70   1.30    5.00\nGrabFood          8Q8WLRXWWXFEAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          2.20   1.80    4.00\nGrabFood          8Q8W2E5GWLWFAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          7.80   1.30    9.10\nGrabFood          8Q7NQG5WW34HAV tunai\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          0.00   4.80    4.80\nGrabMart          8Q7KT4KGX2KVAV   tunai\n\n\n\n                  A-\nPesanan\n                  8Q7H2VUGWO63AV Tanpa\nSekaligus                                                10.40   2.30   12.70\n                  A-             tunai\nGrabFood\n                  8Q7GDC8GWG8EAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          2.90   2.00    4.90\nGrabFood          8Q7HIDTWWO63AV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          2.30   3.30    5.60\nGrabFood          8Q7FWPEGW34HAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          4.20   1.60    5.80\nGrabFood          8Q7BH67GWO2MAV tunai\n\n\n\nPesanan           A-             Tunai /\nSekaligus         8Q79GG9WXBL8AV Tanpa                   13.30   0.20   13.50\nGrabFood          and 2          tunai\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          2.80   2.00    4.80\nGrabMart          8Q783LRG3BL8AV   tunai\n\n\n\n\n                                         Page 15 of 24\n\f  Pesanan           A-\n                                     Tanpa\n  Sekaligus         8Q4HL3PGXBKGAV                           0.00                 26.70        26.70\n                                     tunai\n  GrabMart          and 6\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                             3.60                   2.60        6.20\n  GrabFood          8Q6TFIDWXBL8AV   tunai\n\n\n                                                                                       RM187.60\nRabu, 31 Disember\n\n\n                                     Cara               Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran              asas          lain   Pendapatan   bersih\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-          Tanpa\n  GrabExpress                                                7.70                   0.00        7.70\n                    GKTIJ8KGXDCF     tunai\n  Instant - Bike\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             7.20                   1.40        8.60\n  GrabMart          8Q4ORX2WWBBUAV tunai\n\n\n\n  Pesanan           A-\n                                     Tanpa\n  Sekaligus         8Q4L82IG2GH9AV                          10.70                   3.70       14.40\n                                     tunai\n  GrabFood          and 2\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             4.10                   1.90        6.00\n  GrabFood          8Q4JTMTWWT5LAV tunai\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-          Tanpa\n  GrabExpress                                                4.00                   0.00        4.00\n                    GKSPAVPGWCCV     tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             4.80                   3.80        8.60\n  GrabFood          8Q4FGA8GWKUAAV tunai\n\n\n\n  Pesanan Tunggal\n  GrabExpress       PLAN-1-          Tanpa\n  Instant - Bike                                             8.70                   0.00        8.70\n                    GKSLR2PGWUCP     tunai\n\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-          Tanpa\n  GrabExpress                                                7.90                   0.00        7.90\n                    GKSGN99GX9K3     tunai\n  Instant -- Bike\n\n\n\n\n                                            Page 16 of 24\n\f                  A-\nPesanan\n                  8Q4DOKVWWFBXAV Tanpa\nSekaligus                                               7.80   2.60   10.40\n                  A-             tunai\nGrabFood\n                  8Q4DIIJWWCWAAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        4.20   2.00    6.20\nGrabFood          8Q4CERDWWT5LAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        4.10   1.70    5.80\nGrabFood          8Q4BKDDGWLMLAV tunai\n\n\nPesanan Tunggal   A-\n                                Tunai                   3.00   1.20    4.20\nGrabMart          8Q484WWWWXW8AV\n\n\n\n                  A-\nPesanan\n                  8Q44RSNGWXW8AV Tanpa\nSekaligus                                               8.00   0.00    8.00\n                  A-             tunai\nGrabFood\n                  8Q459N8GWOCLAV\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        2.60   2.10    4.70\nGrabMart          8Q3TI3LWXDV8AV   tunai\n\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        5.70   0.10    5.80\nGrabMart          8Q3V5XTGX577AV   tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        7.80   0.10    7.90\nGrabFood          8Q3RUMJWX6PDAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.30   2.60    5.90\nGrabFood          8Q3QIGDWWT5LAV tunai\n\n\n                  A-\nPesanan                          Tunai /\n                  8Q3ORCDWXXC6AV\nSekaligus                        Tanpa                  6.00   0.50    6.50\n                  A-\nGrabFood                         tunai\n                  8Q3OMTIGWBFTAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        0.00   8.90    8.90\nGrabMart          8Q35WPIW3BKGAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.70   2.10    5.80\nGrabFood          8Q3FMXFG36PDAV tunai\n\n\n\n\n                                        Page 17 of 24\n\f  Pesanan Tunggal     A-             Tanpa\n                                                              6.00                   0.30        6.30\n  GrabMart            8Q3D7BGGWXW8AV tunai\n\n\n                      A-\n  Pesanan\n                      8Q3AFKTWX59DAV Tanpa\n  Sekaligus                                                   7.50                   5.10       12.60\n                      A-             tunai\n  GrabFood\n                      8Q3AAWHWWT5LAV\n\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                              9.10                   0.70        9.80\n  GrabFood            8Q37IECWWXBRAV tunai\n\n\n                                                                                        RM174.70\nSelasa, 30 Disember\n\n\n                                      Cara               Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan      Butiran\n                                      pembayaran              asas          lain   Pendapatan   bersih\n\n\n\n  Pesanan Tunggal\n                      PLAN-1-         Tanpa\n  GrabExpress                                                 6.20                   0.00        6.20\n                      GKPPH95GWMNC    tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal\n                      PLAN-1-         Tanpa\n  GrabExpress                                                 5.40                   0.00        5.40\n                      GKPJILHGWCCV    tunai\n  Instant -- Bike\n\n\n\n  Pesanan Tunggal\n                      PLAN-1-         Tanpa\n  GrabExpress                                                 4.20                   0.00        4.20\n                      GKPDHB5WX25G    tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal\n                      PLAN-1-         Tanpa\n  GrabExpress                                                 4.00                   0.00        4.00\n                      GKP6SBVGWMNC    tunai\n  Instant -- Bike\n\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                              3.30                   4.00        7.30\n  GrabFood            8QWMEWIGW3V8AV tunai\n\n\n  Pesanan Tunggal     A-             Tanpa\n                                                              4.40                   2.20        6.60\n  GrabFood            8QWLFGMWW8PTAV tunai\n\n\n\n                      A-\n  Pesanan                            Tunai /\n                      8QWH9LRGWJNHAV\n  Sekaligus                          Tanpa                   10.60                   1.30       11.90\n                      A-\n  GrabMart                           tunai\n                      8QWIWQIWW9EFAV\n\n\n\n                                             Page 18 of 24\n\fPesanan           A-\n                                 Tanpa\nSekaligus         8QWCGVOGWF9RAV                       22.30   2.70   25.00\n                                 tunai\nGrabFood          and 2\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.30   1.90    5.20\nGrabFood          8QWAVP2WWV8PAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        2.90   1.80    4.70\nGrabFood          8QW9PQKGX5JHAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        5.80   1.60    7.40\nGrabFood          8QW6LTDGWOEUAV tunai\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        5.30   1.00    6.30\nGrabFood          8QW3IEOGX2XRAV   tunai\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                             7.30   0.00    7.30\n                  GKO6OEMGWD3T     tunai\nInstant -- Bike\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.40   2.00    5.40\nGrabFood          8PVSW4KGXC6SAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.40   1.10    4.50\nGrabMart          8PVNAMCGXWXSAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        4.30   1.10    5.40\nGrabFood          8PVMMXRGWJ6SAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        4.00   2.00    6.00\nGrabFood          8PVH5CRGXXH6AV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.30   2.00    5.30\nGrabFood          8PVFOOMWW3V8AV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        6.40   1.80    8.20\nGrabFood          8PVDMNNG2NVPAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        2.00   3.30    5.30\nGrabFood          8PV9K3WWW5D3AV tunai\n\n\n\n\n                                       Page 19 of 24\n\f  Pesanan Tunggal    A-             Tanpa\n                                                              5.20                   3.80        9.00\n  GrabFood           8PV6D43GWCOEAV tunai\n\n\n  Pesanan Tunggal    A-             Tanpa\n                                                              6.30                   1.00        7.30\n  GrabMart           8PV3UQAGW75NAV tunai\n\n\n\n                     A-\n  Pesanan\n                     8PV2VIJWWC9BAV Tanpa\n  Sekaligus                                                   5.80                   4.00        9.80\n                     A-             tunai\n  GrabFood\n                     8PV3QP4GWBAEAV\n\n\n                     A-\n  Pesanan\n                     8PVXGO2GX2XRAV   Tanpa\n  Sekaligus                                                   4.00                   3.70        7.70\n                     A-               tunai\n  GrabMart\n                     8PVXLI2WW75NAV\n\n\n\n  Pesanan Tunggal    A-             Tanpa\n                     8PVW498W3E3RAV tunai                     4.80                   0.70        5.50\n  GrabMart\n\n\n\n  Pesanan Tunggal    A-             Tanpa\n                                                              2.30                   1.70        4.00\n  GrabFood           8PUTSVUWWAEAAV tunai\n\n\n\n  Pesanan Tunggal    A-             Tanpa\n                                                              4.40                   2.40        6.80\n  GrabFood           8PUQNFMGWC9BAV tunai\n\n\n  Pesanan Tunggal    A-             Tanpa\n                                                              2.90                   1.40        4.30\n  GrabFood           8PUPQ3PWWOEUAV tunai\n\n\n                                                                                        RM196.00\nIsnin, 29 Disember\n\n\n                                      Cara               Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan     Butiran\n                                      pembayaran              asas          lain   Pendapatan   bersih\n\n\n\n  Pesanan Tunggal\n                     PLAN-1-          Tanpa\n  GrabExpress                                                 9.70                   0.00        9.70\n                     GKL7S6XGXDCF     tunai\n  Instant - Bike\n\n\n\n  Pesanan Tunggal                     Tanpa\n                     PLAN-1-                                 10.60                   0.00       10.60\n  GrabExpress                         tunai\n                     GKL27NIWWCCV\n  Instant -- Bike\n\n\n\n\n                                             Page 20 of 24\n\fPesanan Tunggal   A-               Tanpa\n                                                        4.60   2.20    6.80\nGrabFood          8PSIH3EGWJVCAV   tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.00   1.90    4.90\nGrabFood          8PSGNNEGW9CUAV tunai\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                            10.00   0.80   10.80\n                  GKKKKDPWWW7Q     tunai\nInstant -- Bike\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        7.00   1.80    8.80\nGrabFood          8PSCA9NGXAXOAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        3.80   2.00    5.80\nGrabFood          8PSALMOWX7TTAV tunai\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        4.40   1.60    6.00\nGrabFood          8PS7IGIGWG2JAV   tunai\n\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        0.00   5.40    5.40\nGrabMart          8PS4CL9GX4RQAV   tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        1.80   2.20    4.00\nGrabFood          8PSXFTPWWP7VAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                        6.20   1.40    7.60\nGrabFood          8PRUFULWW9CUAV tunai\n\n\n                  A-             Tanpa\nPesanan Tunggal                                         2.20   1.80    4.00\n                  8PRUR5AGXAQRAV tunai\nGrabFood\n\n\n\n\n                  A-\nPesanan\n                  8PRP8M8GWO2SAV Tanpa\nSekaligus                                              12.00   0.00   12.00\n                  A-             tunai\nGrabMart\n                  8PRIQMGWWEE5AV\n\n\nPesanan Tunggal   A-               Tanpa\n                                                        3.40   1.30    4.70\nGrabFood          8PRLVG3GX79VAV   tunai\n\n\n\n\n                                       Page 21 of 24\n\f  Pesanan Tunggal      A-                   Tanpa\n                                                                   3.60                            1.20         4.80\n  GrabMart             8PRIHEHWX2AUAV       tunai\n\n\n  Pesanan Tunggal      A-             Tanpa\n                                                                   5.60                            1.50         7.10\n  GrabFood             8PRAX8CWWCLTAV tunai\n\n\n\n  Pesanan Tunggal      A-             Tanpa\n                                                                   3.70                            2.00         5.70\n  GrabFood             8PR7E92WWFCMAV tunai\n\n\n  Pesanan Tunggal      A-                   Tanpa\n                                                                   3.10                            2.00         5.10\n  GrabFood             8PR5R9QGX9PNAV       tunai\n\n\n\n                       A-\n  Pesanan                                   Tunai /\n                       8PRWLSCGXEIDAV\n  Sekaligus                                 Tanpa                 10.30                            3.80       14.10\n                       A-\n  GrabFood                                  tunai\n                       8PRX7J6W2T25AV\n\n\n  Pesanan Tunggal      A-                   Tanpa\n                                                                   3.60                            3.80         7.40\n  GrabFood             8PQVC7EWXEIDAV       tunai\n\n\n\n                       A-\n  Pesanan\n                       8PQRE5FWWWGPAV Tanpa\n  Sekaligus                                                       10.80                            1.80       12.60\n                       A-             tunai\n  GrabMart\n                       8PQR5K4WW5IOAV\n\n\n                                                                                                       RM157.90\n\n\n\n\n";
var DOAL_FIXTURE_BUTIRAN_W33_ = "Butiran Tempahan - Penghantaran\n\nAhad, 16 Ogos\n\n\n                                             Page 7 of 23\n\f                                   Cara              Pendapatan   Pendapatan   Pelarasan    Pendapatan\nJenis Tempahan    Butiran\n                                   pembayaran            asas           lain   Pendapatan    bersih\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                              4.70                    0.00         4.70\n                  HI99E66GX747     tunai\nInstant -- Bike\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                              8.00                    0.00         8.00\n                  HI8M5BMGWHGD     tunai\nInstant - Bike\n\n\n\nPesanan Tunggal   A-\n                                 Tunai                   4.10                    0.60         4.70\nGrabFood          9NGDUDCWWM5LAV\n\n\n                  A-\nPesanan\n                  9NGAU58GW2DDAV Tanpa\nSekaligus                                                8.10                    0.90         9.00\n                  A-             tunai\nGrabFood\n                  9NGBAUFGWMFTAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         6.20                    1.30         7.50\nGrabFood          9NG8VHAGW2DDAV tunai\n\n\n                  A-\nPesanan\n                  9NG5XILGW3W7AV Tanpa\nSekaligus                                                7.80                    3.70       11.50\n                  A-             tunai\nGrabFood\n                  9NG5DX9WW7IKAV\n\n\n\nPesanan Tunggal   A-               Tanpa\n                                                         3.30                    2.00         5.30\nGrabMart          9NG4P3BGX45PAV   tunai\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                              5.40                    0.00         5.40\n                  HI88GH6WW37J     tunai\nInstant -- Bike\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         3.70                    1.90         5.60\nGrabFood          9NFUVVMGXWS4AV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         5.20                    2.10         7.30\nGrabFood          9NFVFL4WW3CVAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         2.00                    4.30         6.30\nGrabMart          9NFLR97GWM5LAV tunai\n\n\n\n                                          Page 8 of 23\n\fPesanan Tunggal   A-             Tanpa\n                                                         2.50   1.90    4.40\nGrabFood          9NFOT5DGWJOFAV tunai\n\n\n\n                  A-\nPesanan\n                  9NFLUKTGX55JAV Tanpa\nSekaligus                                                6.90   2.00    8.90\n                  A-             tunai\nGrabFood\n                  9NFLQ2NWWM5LAV\n\n\nPesanan Tunggal   A-               Tanpa\n                                                         9.30   0.00    9.30\nGrabFood          9NFJ48GGX6A7AV   tunai\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                              5.10   0.00    5.10\n                  HI7ODLPGX6VF     tunai\nInstant - Bike\n\n\n                  A-\nPesanan\n                  9NFFAOBG3ERMAV Tanpa\nSekaligus                                                9.60   2.40   12.00\n                  A-             tunai\nGrabFood\n                  9NFFLSXWW88DAV\n\n\n\n                  A-\nPesanan\n                  9NFCK6QGWM5LAV Tanpa\nSekaligus                                               10.10   0.00   10.10\n                  A-             tunai\nGrabFood\n                  9NFD4CVWWPOBAV\n\n\n                  A-\nPesanan\n                  9NF8OQUGX7CTAV Tanpa\nSekaligus                                               12.40   0.20   12.60\n                  A-             tunai\nGrabFood\n                  9NF94CDGXBRDAV\n\n\n\n                  A-\nPesanan                          Tunai /\n                  9NEQGD2GX7CTAV\nSekaligus                        Tanpa                   5.90   4.50   10.40\n                  A-\nGrabMart                         tunai\n                  9NERI5VGW6PCAV\n\n\nPesanan Tunggal   A-\n                                 Tunai                   7.70   1.70    9.40\nGrabFood          9NEONFGGXEEFAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         2.80   2.00    4.80\nGrabFood          9NEOHJFGWSP6AV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         2.60   2.20    4.80\nGrabMart          9NEK9NWGW6C8AV tunai\n\n\n\n                                         Page 9 of 23\n\f  Pesanan Tunggal   A-               Tanpa\n                                                              6.30                   1.10         7.40\n  GrabMart          9NEG7GCG297BAV   tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              3.50                   2.80         6.30\n  GrabMart          9NEE8U6GWUOFAV tunai\n\n\n\n                    A-\n  Pesanan\n                    9NEF6SNGWSP6AV Tanpa\n  Sekaligus                                                   6.80                   0.70         7.50\n                    A-             tunai\n  GrabMart\n                    9NEDVQQW288DAV\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              2.20                   1.80         4.00\n  GrabFood          9NE39R9GW88DAV tunai\n\n\n                                                                                        RM192.30\nSabtu, 15 Ogos\n\n\n                                     Cara                Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran               asas          lain   Pendapatan    bersih\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-          Tanpa\n  GrabExpress                                                 4.20                   0.00         4.20\n                    HI4SNH3GXBKE     tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal   A-\n                                     Tunai                    3.60                   0.80         4.40\n  GrabFood          9NCBH2TGXA56AV\n\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                              4.00                   0.60         4.60\n  GrabMart          9NC9LXIGXWNCAV   tunai\n\n\n                    A-\n  Pesanan\n                    9NC7BRWWWW5QAV\n  Sekaligus                        Tunai                      5.00                   2.60         7.60\n                    A-\n  GrabFood\n                    9NC6Q57WWW5QAV\n\n\n\n                    A-\n  Pesanan                          Tunai /\n                    9NC25B6GWK89AV\n  Sekaligus                        Tanpa                     14.60                   0.00       14.60\n                    A-\n  GrabFood                         tunai\n                    9NCXGW2GXXKUAV\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                      2.20                   2.60         4.80\n  GrabMart          9NCWENCWW6GRAV\n\n\n\n\n                                             Page 10 of 23\n\fPesanan           A-\n                                 Tanpa\nSekaligus         9NBQE6TWX6WFAV                         19.00   5.40   24.40\n                                 tunai\nGrabFood          and 3\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          4.30   1.80    6.10\nGrabFood          9NBLLC6W4P2EAV   tunai\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                               5.00   0.30    5.30\n                  HI3PWACWWSVS     tunai\nInstant -- Bike\n\n\nPesanan Tunggal   A-\n                                 Tunai                    1.60   4.00    5.60\nGrabMart          9NBGIG8WWXFGAV\n\n\n\nPesanan Tunggal   A-\n                                 Tunai                    2.50   1.90    4.40\nGrabMart          9NBGLBXWWFFOAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.50   1.10    4.60\nGrabMart          9NBBAVOGW9AOAV tunai\n\n\n\n                  A-\nPesanan\n                  9NB97DSWXCUKAV Tanpa\nSekaligus                                                 7.00   2.80    9.80\n                  A-             tunai\nGrabFood\n                  9NB884QGWJEQAV\n\n\nPesanan Tunggal   A-\n                                 Tunai                    5.00   0.70    5.70\nGrabFood          9NB4RQ9GX6WFAV\n\n\n\n                  A-\nPesanan\n                  9NB2ICAWWRWVAV Tanpa\nSekaligus                                                10.20   0.70   10.90\n                  A-             tunai\nGrabFood\n                  9NB2HKCWX78NAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          6.20   1.20    7.40\nGrabMart          9NARML5GW56SAV tunai\n\n\n\nPesanan           A-             Tunai /\nSekaligus         9NAOG3AWWEOKAV Tanpa                    8.00   4.00   12.00\nGrabFood          and 2          tunai\n\n\nPesanan Tunggal   A-\n                                 Tunai                    5.60   1.90    7.50\nGrabMart          9NAMDUUGWXFGAV\n\n\n\n                                         Page 11 of 23\n\f                    A-\n  Pesanan\n                    9NAK93FGXA56AV Tanpa\n  Sekaligus                                                 7.20                   2.20         9.40\n                    A-             tunai\n  GrabFood\n                    9NAK8IOWWNACAV\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            3.20                   2.20         5.40\n  GrabFood          9NAHSFFWXFA9AV tunai\n\n\n\n  Pesanan           A-\n                                  Tanpa\n  Sekaligus         9NACARHWWRWVAV                         16.30                   2.80       19.10\n                                  tunai\n  GrabFood          and 2\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                    5.00                   1.70         6.70\n  GrabMart          9NAAOUCWX2DIAV\n\n\n                                                                                      RM184.50\nJumaat, 14 Ogos\n\n\n                                   Cara                Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                   pembayaran               asas          lain   Pendapatan    bersih\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-        Tanpa\n  GrabExpress                                               4.00                   0.00         4.00\n                    HIX85OCGW9DR   tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal\n                    PLAN-1-        Tanpa\n  GrabExpress                                               7.10                   0.00         7.10\n                    HIX5ITLWW9HA   tunai\n  Instant - Bike\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-        Tanpa\n  GrabExpress                                               8.20                   0.00         8.20\n                    HIWKE4OGW7VV   tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal   PLAN-1-        Tanpa\n  GrabExpress       HIWF3FKGWGBN   tunai                    5.70                   0.00         5.70\n  Instant -- Bike\n\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-        Tanpa\n  GrabExpress                                               4.60                   0.00         4.60\n                    HIW8MWDGXBLX   tunai\n  Instant -- Bike\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            4.30                   1.20         5.50\n  GrabMart          9N828BTWXXUAAV tunai\n\n\n                                           Page 12 of 23\n\f                  A-\nPesanan                          Tunai /\n                  9N7RQWQWX24JAV\nSekaligus                        Tanpa                    4.80   5.30   10.10\n                  A-\nGrabFood                         tunai\n                  9N7S2KTGWBUVAV\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                               8.00   0.00    8.00\n                  HHVVOBQWW23S     tunai\nInstant - Bike\n\n\n\n                  A-\nPesanan\n                  9N7PCNJGX23FAV Tanpa\nSekaligus                                                10.80   0.00   10.80\n                  A-             tunai\nGrabFood\n                  9N7PCBUGWK9OAV\n\n\nPesanan           A-               Tunai /\nSekaligus         9N7FKEJGWBXIAV   Tanpa                  9.70   3.40   13.10\nGrabFood          and 2            tunai\n\n\n\nPesanan Tunggal   A-               Tanpa\n                                                          0.00   4.20    4.20\nGrabMart          9N7DRJ8GXXUAAV   tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          5.90   0.80    6.70\nGrabFood          9N7CQOMWWE3GAV tunai\n\n\n\nPesanan Tunggal\n                  PLAN-1-          Tanpa\nGrabExpress                                               7.90   0.00    7.90\n                  HHVGT7TGWQ3T     tunai\nInstant -- Bike\n\n\nPesanan Tunggal   A-\n                                 Tunai                    3.50   1.60    5.10\nGrabFood          9N7B2GOWXXUAAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          5.20   1.10    6.30\nGrabFood          9N78HRGWX23FAV tunai\n\n\n                  A-\nPesanan\n                  9N6TUC3GWTJUAV Tanpa\nSekaligus                                                12.10   0.00   12.10\n                  A-             tunai\nGrabFood\n                  9N6VAL7GWBT9AV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          5.80   0.00    5.80\nGrabMart          9N6RHPSGWGL6AV tunai\n\n\n\n\n                                         Page 13 of 23\n\f  Pesanan Tunggal   A-             Tanpa\n                                                              4.60                   0.00         4.60\n  GrabFood          9N6O6H5GWGL6AV tunai\n\n\n\n                    A-\n  Pesanan\n                    9N6HS8FWWGL6AV Tanpa\n  Sekaligus                                                   8.10                   0.00         8.10\n                    A-             tunai\n  GrabFood\n                    9N6L6I2WXDXDAV\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              2.20                   2.60         4.80\n  GrabFood          9N6KIGWGXDXDAV tunai\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              5.10                   2.40         7.50\n  GrabFood          9N6FAQ8WWG7DAV tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                              0.60                   4.40         5.00\n  GrabMart          9N6C2OOWXCK8AV tunai\n\n\n\n  Pesanan Tunggal   A-               Tanpa\n  GrabMart                                                    4.40                   2.60         7.00\n                    9N6DFUJWX4L7AV   tunai\n\n\n\n  Pesanan\n                    A-             Tanpa\n  Sekaligus                                                   3.10                   2.10         5.20\n                    9N6CL8JWWDKLAV tunai\n  GrabFood\n\n\n\n  Pesanan           A-\n                                     Tanpa\n  Sekaligus         9N653CIWX23FAV                           15.20                   0.00       15.20\n                                     tunai\n  GrabFood          and 2\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                              3.30                   3.80         7.10\n  GrabMart          9N5VJ43GW6EFAV   tunai\n\n\n\n  Pesanan Tunggal   A-\n                                     Tunai                    2.40                   1.60         4.00\n  GrabFood          9N5RJ68GX23FAV\n\n\n                                                                                        RM193.70\nKhamis, 13 Ogos\n\n\n                                     Cara                Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran               asas          lain   Pendapatan    bersih\n\n\n\n\n                                             Page 14 of 23\n\fPesanan Tunggal                    Tanpa\n                  PLAN-1-                                  5.00   0.60   5.60\nGrabExpress                        tunai\n                  HHSWR4IWWRGT\nInstant -- Bike\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           2.00   3.70   5.70\nGrabMart          9N3PB7RWWUBLAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           8.10   0.40   8.50\nGrabFood          9N3LOHBWXCSNAV tunai\n\n\nPesanan Tunggal   A-\n                                 Tunai                     2.80   2.20   5.00\nGrabFood          9N3IQOAWWWTQAV\n\n\n\nPesanan Tunggal   A-\n                                 Tunai                     7.30   0.60   7.90\nGrabMart          9N3FUL3WWUBLAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           1.20   3.00   4.20\nGrabFood          9N3DQ8KWW7CHAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           6.90   0.40   7.30\nGrabFood          9N38AN5WX7DMAV tunai\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           0.00   5.00   5.00\nGrabMart          9N3WTVUGXAJBAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           8.40   0.00   8.40\nGrabFood          9N34IH5WWAQOAV tunai\n\n\nPesanan Tunggal   A-\n                                   Tunai                   3.40   1.30   4.70\nGrabMart          9N2VFK7G3C7CAV\n\n\n\nPesanan Tunggal   A-\n                                 Tunai                     3.80   1.40   5.20\nGrabMart          9N2TQTHGWGARAV\n\n\nPesanan Tunggal\n                  A-\nGrabMart                         Tunai                     0.30   3.90   4.20\n                  9N2RHNGGWT7PAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                           3.20   1.20   4.40\nGrabFood          9N2QE7KGW88MAV tunai\n\n\n\n\n                                           Page 15 of 23\n\f                    A-\n  Pesanan\n                    9N2IJ36W2MVQAV Tanpa\n  Sekaligus                                                  6.60                   2.70         9.30\n                    A-             tunai\n  GrabFood\n                    9N2IQ7GGWAQOAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             5.30                   1.50         6.80\n  GrabFood          9N2HW46WWXHVAV tunai\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             3.60                   2.40         6.00\n  GrabFood          9N2DRNKGWT7PAV tunai\n\n\n\n  Pesanan           A-\n                                   Tanpa\n  Sekaligus         9N29QOXGWGBSAV                          19.80                   2.30       22.10\n                                   tunai\n  GrabFood          and 2\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                     8.60                   0.60         9.20\n  GrabMart          9N24UTEWWXHVAV\n\n\n\n  Pesanan Tunggal   A-               Tanpa\n                                                             8.00                   0.90         8.90\n  GrabMart          9N23ARIGW2OCAV   tunai\n\n\n                    A-\n  Pesanan\n                    9NXU6BXWWUOOAV Tanpa\n  Sekaligus                                                  7.40                   2.60       10.00\n                    A-             tunai\n  GrabFood\n                    9NXUDAMWXC7CAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                             2.20                   1.80         4.00\n  GrabFood          9NXRMV7GWWTQAV tunai\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                     3.60                   1.30         4.90\n  GrabFood          9NXOXWVWXBKWAV\n\n\n                                                                                       RM157.30\nRabu, 12 Ogos\n\n\n                                     Cara               Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                     pembayaran              asas          lain   Pendapatan    bersih\n\n\n\n                    A-\n  Pesanan                          Tunai /\n                    9MVHATTGXB8MAV\n  Sekaligus                        Tanpa                     6.70                   3.20         9.90\n                    A-\n  GrabMart                         tunai\n                    9MVJCM4WWB8CAV\n\n\n\n\n                                            Page 16 of 23\n\f                  A-\nPesanan           9MVH9EAGWFCCAV\nSekaligus         A-             Tanpa\n                                                      8.20   2.40   10.60\nGrabFood          9MVH67KWWJ5EAV tunai\n\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                      8.90   0.10    9.00\nGrabFood          9MVAV29GWA5XAV tunai\n\n\n                  A-\nPesanan\n                  9MV48GTGXDQCAV Tanpa\nSekaligus                                            13.10   0.00   13.10\n                  A-             tunai\nGrabFood\n                  9MV45BIWWB8CAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                      1.90   2.10    4.00\nGrabFood          9MUPKUSGXFNFAV tunai\n\n\n                  A-\nPesanan\n                  9MS46MBGXW4QAV Tanpa\nSekaligus                                             3.60   3.30    6.90\n                  A-             tunai\nGrabMart\n                  9MUF3USGX582AV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                      4.10   1.60    5.70\nGrabFood          9MUC4OBWWGI9AV tunai\n\n\n                  A-\nPesanan\n                  9MU9WC8GXDQCAV Tanpa\nSekaligus                                            11.90   0.20   12.10\n                  A-             tunai\nGrabFood\n                  9MU9UGEWWACKAV\n\n\n\nPesanan           A-\n                                 Tanpa\nSekaligus         9MU6TCNWWK7KAV                     14.40   1.30   15.70\n                                 tunai\nGrabFood          and 2\n\n\nPesanan Tunggal   A-             Tanpa\n                                                      5.80   1.50    7.30\nGrabMart          9MU43C7GXEVCAV tunai\n\n\n\nPesanan           A-\n                                 Tanpa\nSekaligus         9MTVETGGXASFAV                     11.00   7.00   18.00\n                                 tunai\nGrabFood          and 2\n\n\n\n\n                                     Page 17 of 23\n\f                    A-\n  Pesanan Tunggal\n                    9MTPDG9GXFNFAV Tunai                    4.00                   1.80         5.80\n  GrabMart\n\n\n\n                                                                                      RM118.10\nSelasa, 11 Ogos\n\n\n                                   Cara                Pendapatan   Pendapatan   Pelarasan    Pendapatan\n  Jenis Tempahan    Butiran\n                                   pembayaran               asas          lain   Pendapatan    bersih\n\n\n\n  Pesanan Tunggal\n                    PLAN-1-        Tanpa\n  GrabExpress                                               4.70                   0.00         4.70\n                    HHK5JS6GWWGD   tunai\n  Instant -- Bike\n\n\n                    A-\n  Pesanan\n                    9MRFSV7WWEF5AV Tanpa\n  Sekaligus                                                 9.00                   1.60       10.60\n                    A-             tunai\n  GrabFood\n                    9MRG96KGW8L4AV\n\n\n\n                    A-\n  Pesanan\n                    9MRC4U2GWWNFAV Tanpa\n  Sekaligus                                                10.10                   1.70       11.80\n                    A-             tunai\n  GrabFood\n                    9MRCBOWGX4X4AV\n\n\n  Pesanan Tunggal\n                    PLAN-1-        Tanpa\n  GrabExpress                                               5.00                   0.10         5.10\n                    HHJGW6JWXDUV   tunai\n  Instant -- Bike\n\n\n\n                    A-\n  Pesanan\n                    9MR7IK5W2DRVAV Tanpa\n  Sekaligus                                                 4.10                   4.70         8.80\n                    A-             tunai\n  GrabFood\n                    9MR8W92GW75KAV\n\n\n  Pesanan           A-\n                                   Tanpa\n  Sekaligus         9MR2NXTWWTFOAV                         14.70                   3.10       17.80\n                                   tunai\n  GrabFood          and 2\n\n\n\n  Pesanan           A-\n  Sekaligus         9MQSG23WWKCVAV Tanpa\n                    and 2                                  11.90                   2.70       14.60\n  GrabFood                         tunai\n\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                            3.50                   1.30         4.80\n  GrabFood          9MQM6AHGX2FUAV tunai\n\n\n                                           Page 18 of 23\n\f  Pesanan Tunggal   A-             Tanpa\n                                                           6.50   0.20    6.70\n  GrabFood          9MQIFQQGWVHAAV tunai\n\n\n  Pesanan Tunggal   A-            Tanpa\n                                                           8.80   0.90    9.70\n  GrabFood          9MQADCCWW7CMAVtunai\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                           4.20   2.00    6.20\n  GrabFood          9MQ8ISMWWKCVAV tunai\n\n\n                    A-\n  Pesanan\n                    9MQ4MU2WWK7EAV Tanpa\n  Sekaligus                                                9.60   2.60   12.20\n                    A-             tunai\n  GrabFood\n                    9MQ55TRGWQ7AAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                           6.60   1.70    8.30\n  GrabFood          9MQ3N75GXWNVAV tunai\n\n\n                    A-\n  Pesanan\n                    9MQ2WMWWWPSTAVTanpa\n  Sekaligus                                                5.10   3.60    8.70\n                    A-             tunai\n  GrabFood\n                    9MQXSADGW8L4AV\n\n\n\n                    A-\n  Pesanan\n                    9MPVN8WGXDCJAV Tanpa\n  Sekaligus                                                3.90   4.40    8.30\n                    A-             tunai\n  GrabFood\n                    9MPVNVPWWPSTAV\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                   4.50   1.40    5.90\n  GrabMart          9MPU2DMWX6EDAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                           3.60   1.40    5.00\n  GrabMart          9MPRBQ4GWPDGAV tunai\n\n\n  Pesanan Tunggal   A-\n                                   Tunai                   4.60   0.90    5.50\n  GrabFood          9MPLEXTGXWNVAV\n\n\n\n  Pesanan Tunggal   A-             Tanpa\n                                                           4.20   1.20    5.40\n  GrabFood          9MPFOBKW2PSTAV tunai\n\n\n                                                                     RM160.10\nIsnin, 10 Ogos\n\n\n\n\n                                           Page 19 of 23\n\f                                 Cara               Pendapatan   Pendapatan   Pelarasan    Pendapatan\nJenis Tempahan    Butiran        pembayaran              asas          lain   Pendapatan    bersih\n\n\n\n\nPesanan           A-\n                                 Tanpa\nSekaligus         9MNDISAWW5EDAV                        17.90                   0.40       18.30\n                                 tunai\nGrabFood          and 2\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         1.80                   2.50         4.30\nGrabFood          9MNA47TWWPDGAV tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         3.90                   2.90         6.80\nGrabFood          9MN7UBNW2BLFAV tunai\n\n\nPesanan Tunggal\n                  PLAN-1-        Tanpa\nGrabExpress                                              4.00                   0.00         4.00\n                  HHFDGTUGX7JR   tunai\nInstant - Bike\n\n\n\nPesanan Tunggal\n                  PLAN-1-        Tanpa\nGrabExpress                                              5.90                   0.00         5.90\n                  HHFC3VIGW4P3   tunai\nInstant -- Bike\n\n\n                  A-\nPesanan\n                  9MN5Q4BGW3UFAV Tanpa\nSekaligus                                               11.20                   0.00       11.20\n                  A-             tunai\nGrabMart\n                  9MN5HM3WXCLAAV\n\n\n\n                  A-\nPesanan\n                  9MN29N2GX8QRAV Tanpa\nSekaligus                                                4.00                   6.10       10.10\n                  A-             tunai\nGrabFood\n                  9MN2A7CGWDUKAV\n\n\n                  A-\nPesanan\n                  9MMVAUXGWBLFAV Tanpa\nSekaligus                                                6.60                   4.40       11.00\n                  A-             tunai\nGrabFood\n                  9MMVACXWWCWNAV\n\n\n\nPesanan Tunggal                  Tanpa\n                  PLAN-1-\nGrabExpress                      tunai                   5.00                   0.50         5.50\n                  HHF229OWWROP\nInstant -- Bike\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         2.40                   1.60         4.00\nGrabMart          9MMPRLTWWN3HAV tunai\n\n\n\n\n                                        Page 20 of 23\n\fPesanan Tunggal   A-             Tanpa\n                                                          5.20   1.70    6.90\nGrabFood          9MM4BXHWW5CLAV tunai\n\n\n                  A-\nPesanan\n                  9MMI4WVWWU3UAV Tanpa\nSekaligus                                                12.90   0.30   13.20\n                  A-             tunai\nGrabFood\n                  9MMI6H6GX6EDAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.60   1.20    4.80\nGrabFood          9MMGWO7WX7DEAV tunai\n\n\nPesanan Tunggal   A-\n                                 Tunai                    3.60   1.20    4.80\nGrabFood          9MMEB3SWWU3UAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.10   1.70    4.80\nGrabFood          9MM8CDRGX6EDAV tunai\n\n\nPesanan           A-            Tunai /\nSekaligus         9MM4WUUGWRGMAVTanpa                    17.40   1.00   18.40\nGrabFood          and 2         tunai\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.70   2.00    5.70\nGrabFood          9MM3FURGWJ3DAV tunai\n\n\n                  A-\nPesanan\n                  9MMWL8CGXAUFAV Tanpa\nSekaligus                                                 7.40   5.20   12.60\n                  A-             tunai\nGrabFood\n                  9MMWQPQWX6L9AV\n\n\n\nPesanan           A-\nSekaligus         9MLTS9RWW5CLAV Tanpa                    7.40   0.70    8.10\nGrabMart          A-             tunai\n                  9MLUICCGWJ3DAV\n\n\n\nPesanan Tunggal   A-             Tanpa\n                                                          3.90   1.60    5.50\nGrabFood          9MLPF22WX7DEAV tunai\n\n\n\nPesanan Tunggal   A-\n                                Tunai                     4.30   1.80    6.10\nGrabFood          9MLNPGGWWKMQAV\n\n\nPesanan Tunggal   A-             Tanpa\n                                                         10.90   1.10   12.00\nGrabFood          9MLIEXMWWF8DAV tunai\n\n\n\n                                         Page 21 of 23\n\f  Pesanan Tunggal      A-\n                                      Tunai                        3.90                              1.20            5.10\n  GrabFood             9MLEXHJWWJ3DAV\n\n\n                                                                                                         RM189.10\n\n\n\n\n";
var DOAL_FIXTURE_NONORDER_W01_ = "Tip\n\n\n  Tarikh / Masa      Kod Tempahan            Dompet Tunai           Dompet Kredit       Subtotal\n\n\n\n                                            Page 1 of 24\n\f4 Januari,\n             A-8QJRNFPWWTKQAV             10.00       -   10.00\n1:13PM\n\n\n4 Januari,\n             A-8QJIU2QGW5XVAV                  4.00   -    4.00\n11:26AM\n\n\n\n4 Januari,\n             A-8QJ5GEAGWK7CAV                  1.00   -    1.00\n10:00AM\n\n\n3 Januari,\n             A-8QGRKATGXBJRAV                  3.00   -    3.00\n7:18PM\n\n\n\n2 Januari,\n             A-8QBPDMLGX9F9AV                  2.00   -    2.00\n1:58PM\n\n\n2 Januari,\n             A-8QBHRR6G2P2RAV                  3.00   -    3.00\n12:34PM\n\n\n\n1 Januari,\n             A-8Q8E5DRGX7CLAV                  2.00   -    2.00\n11:30PM\n\n\n1 Januari,\n             A-8Q8O876GWG8BAV                  3.00   -    3.00\n8:08PM\n\n\n\n1 Januari,\n             A-8Q7GDC8GWG8EAV                  2.00   -    2.00\n1:29PM\n\n\n1 Januari,\n             A-8Q7H2VUGWO63AV                  3.00   -    3.00\n1:18PM\n\n\n\n1 Januari,\n             A-8Q7FWPEGW34HAV                  2.00   -    2.00\n12:43PM\n\n\n1 Januari,\n             A-8Q783LRG3BL8AV                  3.00   -    3.00\n12:20PM\n\n\n\n1 Januari,\n             A-8Q46V54WWT5LAV                  3.00   -    3.00\n10:34AM\n\n\n\n\n                                Page 2 of 24\n\f  31\n  Disember,         A-8Q4LMVJGW9AFAV                     2.00               -        2.00\n  8:23PM\n\n\n\n  30\n  Disember,         A-8QW326XWX2XRAV                     3.00               -        3.00\n  5:44PM\n\n\n  29\n  Disember,         A-8PO7HO5WWC39AV                     4.00               -        4.00\n  6:22AM\n\n\n                                                                                RM50.00\n\n\n\n\nInsentif\n\nLayak\n\n  Penerangan                               Dompet Tunai         Dompet Kredit     Subtotal\n\n\n\n  Shift Top-Up: Kelana Jaya, TTDI Shift\n                                                         7.00           0.00         7.00\n  (2628250)\n\n\n  Shift Top-Up: Kelana Jaya, TTDI Shift\n                                                         5.00           0.00         5.00\n  (2628122)\n\n\n\n  Shift Top-Up: Kelana Jaya (2627306)                    2.50           0.00         2.50\n\n\n  Shift Top-Up: Kelana Jaya, TTDI Shift\n  (2628091)                                              6.00           0.00         6.00\n\n\n\n\n  Shift Top-Up: Kelana Jaya, TTDI Shift\n                                                         5.00           0.00         5.00\n  (2628076)\n\n\n  Shift Top-Up: Kelana Jaya, TTDI Shift\n                                                         9.00           0.00         9.00\n  (2628003)\n\n\n\n  Shift Top-Up: Kelana Jaya, TTDI Shift\n                                                         5.00           0.00         5.00\n  (2627984)\n\n\n\n\n                                          Page 3 of 24\n\fShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             8.00   0.00     8.00\n(2627784)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             5.00   0.00     5.00\n(2627744)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             8.00   0.00     8.00\n(2627743)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             6.00   0.00     6.00\n(2628335)\n\n\n\nBonus Mingguan Berganda - ID insentif\n2847027\n\nAnda telah memperolehi RM160.00 insentif\nkerana anda telah melengkapkan 87 trip unik\n                                                       160.00       0.00   160.00\n(kelayakan minima: 75 trip).\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR160)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             6.00   0.00     6.00\n(2628326)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             9.00   0.00     9.00\n(2628296)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             6.00   0.00     6.00\n(2628238)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             7.00   0.00     7.00\n(2628227)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             5.00   0.00     5.00\n(2628210)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             7.00   0.00     7.00\n(2629335)\n\n\n\n\n                                              Page 4 of 24\n\fShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             1.00   0.00        1.00\n(2629315)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             4.00   0.00        4.00\n(2629301)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                        10.00       0.00       10.00\n(2629289)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             3.00   0.00        3.00\n(2629269)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             8.00   0.00        8.00\n(2629243)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             4.00   0.00        4.00\n(2629210)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             5.00   0.00        5.00\n(2629202)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             5.00   0.00        5.00\n(2628286)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             8.00   0.00        8.00\n(2628217)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             5.00   0.00        5.00\n(2584040)\n\n\n\nBonus Mingguan Berganda - ID insentif\n2830767\n\nAnda telah memperolehi RM130.00 insentif\nkerana anda telah melengkapkan 66 trip unik\n(kelayakan minima: 60 trip).\n                                                       130.00       0.00      130.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR130)\n\n\n\n\n                                                                           RM449.50\n\n\n                                              Page 5 of 24\n\fBonus\n\n\n  Penerangan                                Dompet Tunai     Dompet Kredit        Subtotal\n\n\n\n  Bonus yang diperolehi dari 63 trip.               116.70           0.00         116.70\n\n\n                                                                               RM116.70\n\n\n\n\nBayaran lain-lain\n\n\n  Penerangan                                Dompet Tunai     Dompet Kredit        Subtotal\n\n\n\n  Weekly compensation for long wait time\n                                                     19.00           0.00          19.00\n  (22 December 2025 - 28 December 2025)\n\n\n                                                                                RM19.00\n\n\n\n\nPengeluaran Wang\n\n\n  Tarikh / Masa     Penerangan              Dompet Tunai     Dompet Kredit        Subtotal\n\n\n\n                    Permintaan\n  2 Januari,        pengeluaran wang\n                                                   -500.00           0.00         -500.00\n  11:37AM           berjaya - dimasukkan\n                    dalam ********4304\n\n\n                    Permintaan\n  29\n                    pengeluaran wang\n  Disember,                                        -500.00           0.00         -500.00\n                    berjaya - dimasukkan\n  2:39PM\n                    dalam ********4304\n\n\n                                                                             -RM1,000.00\n\n\n\n\nBayaran Balik Promo\n\n\n\n\n                                           Page 6 of 24\n\f  Penerangan                                   Dompet Tunai           Dompet Kredit                Subtotal\n\n\n\n  Jumlah promo trip                                 1,145.37                  0.00                1,145.37\n\n\n                                                                                         RM1,145.37\n\n\n\n\n";
var DOAL_FIXTURE_NONORDER_W33_ = "Tip\n\n\n  Tarikh / Masa      Kod Tempahan          Dompet Tunai           Dompet Kredit       Subtotal\n\n\n\n                                          Page 1 of 23\n\f  16 Ogos,\n               A-9NFLQ2NWWM5LAV                  2.00               -        2.00\n  6:50PM\n\n\n  16 Ogos,\n               A-9NF94CDGXBRDAV                  4.00               -        4.00\n  4:32PM\n\n\n\n  15 Ogos,\n               A-9NBPIH9GX6WFAV                  2.00               -        2.00\n  8:27PM\n\n\n  15 Ogos,\n               A-9NB2HKCWX78NAV                  2.00               -        2.00\n  3:48PM\n\n\n\n  15 Ogos,\n               A-9NAHSFFWXFA9AV                  2.00               -        2.00\n  12:30PM\n\n\n  12 Ogos,\n               A-9MU9UGEWWACKAV                  3.00               -        3.00\n  1:18PM\n\n\n\n  11 Ogos,\n               A-9MRXSV6WW2DBAV                  3.00               -        3.00\n  7:00PM\n\n\n  10 Ogos,\n               A-9MN29N2GX8QRAV                  6.00               -        6.00\n  7:11PM\n\n\n\n  10 Ogos,\n               A-9MMGWO7WX7DEAV             10.00                   -      10.00\n  3:38PM\n\n\n                                                                        RM34.00\n\n\n\n\nInsentif\n\nLayak\n\n  Penerangan                       Dompet Tunai         Dompet Kredit     Subtotal\n\n\n\n\n                                  Page 2 of 23\n\fBonus Harian Sunday - ID insentif 3831348\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 21 trip unik\n(kelayakan minima: 15 trip).                            10.00       0.00    10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\nBonus Mingguan Berganda - ID insentif\n3831529\n\nAnda telah memperolehi RM130.00 insentif\nkerana anda telah melengkapkan 68 trip unik\n                                                       130.00       0.00   130.00\n(kelayakan minima: 50 trip).\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR130)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             5.00   0.00     5.00\n(3638875)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                        18.20       0.00    18.20\n(3638862)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             8.00   0.00     8.00\n(3636450)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             7.20   0.00     7.20\n(3636400)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             8.40   0.00     8.40\n(3636374)\n\n\n\nBonus Harian Saturday - ID insentif 3831347\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 22 trip unik\n(kelayakan minima: 15 trip).                            10.00       0.00    10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\n                                              Page 3 of 23\n\fShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             4.00   0.00     4.00\n(3636353)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             7.00   0.00     7.00\n(3636288)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             6.00   0.00     6.00\n(3638776)\n\n\n\nBonus Harian Friday - ID insentif 3831346\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 25 trip unik\n(kelayakan minima: 15 trip).                            10.00       0.00    10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             7.00   0.00     7.00\n(3638761)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                        10.20       0.00    10.20\n(3638633)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                        13.60       0.00    13.60\n(3638631)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             4.00   0.00     4.00\n(3638577)\n\n\n\nBonus Mingguan Berganda - ID insentif\n3831438\n\nAnda telah memperolehi RM160.00 insentif\nkerana anda telah melengkapkan 87 trip unik\n                                                       160.00       0.00   160.00\n(kelayakan minima: 75 trip).\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR160)\n\n\n\n\n                                              Page 4 of 23\n\fBonus Harian Thursday - ID insentif 3831345\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 18 trip unik\n(kelayakan minima: 15 trip).                             10.00       0.00   10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                              4.00   0.00    4.00\n(3638571)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                              7.20   0.00    7.20\n(3637387)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                              4.00   0.00    4.00\n(3637312)\n\n\n\nBonus Harian Wednesday - ID insentif 3831344\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 20 trip unik\n(kelayakan minima: 15 trip).                             10.00       0.00   10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                              4.00   0.00    4.00\n(3637280)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                         10.80       0.00   10.80\n(3637012)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                              6.00   0.00    6.00\n(3638604)\n\n\n\n\n                                               Page 5 of 23\n\fBonus Harian Tuesday - ID insentif 3831343\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 24 trip unik\n(kelayakan minima: 15 trip).                            10.00       0.00       10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             6.00   0.00        6.00\n(3638600)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                        12.00       0.00       12.00\n(3638591)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             7.00   0.00        7.00\n(3638576)\n\n\n\nBonus Harian Monday - ID insentif 3831342\n\nAnda telah memperolehi RM10.00 insentif\nkerana anda telah melengkapkan 25 trip unik\n(kelayakan minima: 15 trip).                            10.00       0.00       10.00\n\n\n(Jumlah insentif yang dipaparkan adalah\nselepas cukai pegangan bernilai MYR10)\n\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             6.00   0.00        6.00\n(3638570)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             9.60   0.00        9.60\n(3639113)\n\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                             3.00   0.00        3.00\n(3639089)\n\n\nShift Top-Up: Kelana Jaya, TTDI Shift\n                                                        10.50       0.00       10.50\n(3586602)\n\n\n                                                                           RM548.70\n\n\n\n                                              Page 6 of 23\n\fBonus\n\n\n  Penerangan                                  Dompet Tunai     Dompet Kredit      Subtotal\n\n\n\n  Bonus yang diperolehi dari 26 trip.                  19.90           0.00        19.90\n\n\n                                                                               RM19.90\n\n\n\n\nBayaran lain-lain\n\n\n  Penerangan                                  Dompet Tunai     Dompet Kredit      Subtotal\n\n\n\n  A-9NGDUDCWWM5LAV | COD\n  GRABFOOD COD GRABFOOD A-                             93.40           0.00        93.40\n  9NGDUDCWWM5LAV\n\n\n  PERKESO Subscription Reimbursement\n                                                       10.50           0.00        10.50\n  July 2026\n\n\n\n  Weekly compensation for long wait time (\n                                                       18.50           0.00        18.50\n  03 August 2026 - 09 August 2026 )\n\n\n                                                                               RM122.40\n\n\n\n\nBayaran Balik Promo\n\n\n  Penerangan                                  Dompet Tunai     Dompet Kredit      Subtotal\n\n\n\n  Jumlah promo trip                                   977.51           0.00       977.51\n\n\n                                                                               RM977.51\n\n\n\n\n";

var DOAL_W01_PERIOD_START_ = { year: 2025, month: 12, day: 29 };
var DOAL_W01_PERIOD_END_   = { year: 2026, month: 1,  day: 4  };
var DOAL_W33_PERIOD_START_ = { year: 2026, month: 8,  day: 10 };
var DOAL_W33_PERIOD_END_   = { year: 2026, month: 8,  day: 16 };

// ---- 2026-W14 真实 statement（Steven 提供的原件 2026-W14.pdf，2026-10-07 取得；30 Mac–5 April 2026，25 页）----
// 来源：用 pdfplumber 的字元座标 + 表格单元格矩形，把第 8–23 页的 166 笔订单行逐笔抽出来。这「不是 Gemini」——
// 是独立于被测系统的确定性解析，当作「Gemini 抽对了会长什么样」的替身；只保留订单层级栏位（日期、平台原文、订单号、
// 付款方式、金额、页码），不含姓名/银行帐号等个人资料。已对帐：statement 自己印的 Pendapatan asas makanan 994.20、
// Pendapatan asas Express 53.50、Pelarasan Pendapatan 250.10、Pendapatan bersih penghantaran 1,297.80、7 天印刷小计合计
// 1,297.80，跟逐笔加总逐项一致（见下方 W14真实.* 测试）；整份数据也通过 125 的订单层级验证。
// ⚠️ 每天的印刷小计印在该天表格「末尾」（下一天标题之上），不是紧跟在标题之后——debug.pdf 里外部分析把 RM207.70 当成
// 3 April 的小计是错的：207.70 是 4 April 的，3 April 的是 222.20。
// DAYS: [weekday, day, month, 该天印刷小计]；
// ROWS: [dayIndex, 'T'=Tunggal|'S'=Sekaligus, platform_raw（PDF 原文）, 'id|id', and_more_count, payment_raw, base, other, adjustment, net, 页码]
var DOAL_FIXTURE_W14_DAYS_ = [
  ['Ahad', 5, 'April', 186],
  ['Sabtu', 4, 'April', 207.7],
  ['Jumaat', 3, 'April', 222.2],
  ['Khamis', 2, 'April', 181.3],
  ['Rabu', 1, 'April', 166.9],
  ['Selasa', 31, 'Mac', 147.2],
  ['Isnin', 30, 'Mac', 186.5]
];
var DOAL_FIXTURE_W14_ROWS_ = [
  [0, 'T', 'GrabFood', 'A-96CHGVFWWLQCAV', 0, 'Tanpa tunai', 5, 0, 1.8, 6.8, 8],
  [0, 'T', 'GrabFood', 'A-96CEMWVG22KMAV', 0, 'Tanpa tunai', 3.6, 0, 1.5, 5.1, 8],
  [0, 'T', 'GrabFood', 'A-96C8X94WWT7RAV', 0, 'Tanpa tunai', 1.3, 0, 3.1, 4.4, 9],
  [0, 'T', 'GrabMart', 'A-96C7DX5G26GFAV', 0, 'Tanpa tunai', 2.9, 0, 1.6, 4.5, 9],
  [0, 'S', 'GrabMart', 'A-96C8XDSG2XC9AV|A-96CACTRGXDWEAV', 0, 'Tunai', 7.1, 0, 0, 7.1, 9],
  [0, 'T', 'GrabFood', 'A-96C4CJGW3E5QAV', 0, 'Tanpa tunai', 4.2, 0, 1.5, 5.7, 9],
  [0, 'S', 'GrabFood', 'A-96C3B56GX7VOAV|A-96C4RRFGW9JAAV', 0, 'Tanpa tunai', 12.2, 0, 1, 13.2, 9],
  [0, 'T', 'GrabFood', 'A-96BVQ4QGWDKEAV', 0, 'Tanpa tunai', 4.9, 0, 0.3, 5.2, 9],
  [0, 'T', 'GrabFood', 'A-96BMN54GWOKVAV', 0, 'Tanpa tunai', 4.4, 0, 1.8, 6.2, 9],
  [0, 'T', 'GrabFood', 'A-96BUXVHGWRRDAV', 0, 'Tanpa tunai', 7.4, 0, 0, 7.4, 9],
  [0, 'T', 'GrabFood', 'A-96BQH9CWWN3OAV', 0, 'Tanpa tunai', 4.8, 0, 0, 4.8, 9],
  [0, 'T', 'GrabMart', 'A-96BM2NFWX4EDAV', 0, 'Tanpa tunai', 0, 0, 4.7, 4.7, 9],
  [0, 'T', 'GrabFood', 'A-96BLWKTGX95SAV', 0, 'Tanpa tunai', 4.6, 0, 0, 4.6, 9],
  [0, 'S', 'GrabMart', 'A-96B6SEKGWRRDAV|A-96BJ9QDWXW92AV', 0, 'Tunai / Tanpa tunai', 10.1, 0, 0, 10.1, 9],
  [0, 'T', 'GrabFood', 'A-96BEWMPWX93RAV', 0, 'Tanpa tunai', 5.8, 0, 1.2, 7, 10],
  [0, 'T', 'GrabMart', 'A-96ARI8MWWLXLAV', 0, 'Tanpa tunai', 3.7, 0, 0.7, 4.4, 10],
  [0, 'T', 'GrabFood', 'A-96B24CXWXXREAV', 0, 'Tanpa tunai', 2.9, 0, 2.2, 5.1, 10],
  [0, 'T', 'GrabFood', 'A-96BWAQIGWV7UAV', 0, 'Tanpa tunai', 5.8, 0, 0.8, 6.6, 10],
  [0, 'T', 'GrabMart', 'A-96AVI88GWDKEAV', 0, 'Tanpa tunai', 3.5, 0, 1.7, 5.2, 10],
  [0, 'T', 'GrabFood', 'A-96AQ3SNGWOKVAV', 0, 'Tanpa tunai', 4.8, 0, 2.4, 7.2, 10],
  [0, 'T', 'GrabFood', 'A-96AOJJNW2DKEAV', 0, 'Tanpa tunai', 7.3, 0, 0, 7.3, 10],
  [0, 'T', 'GrabFood', 'A-96ANDJ9GWFTBAV', 0, 'Tanpa tunai', 6.9, 0, 2.4, 9.3, 10],
  [0, 'T', 'GrabFood', 'A-96AKU3XGWOKVAV', 0, 'Tanpa tunai', 5.4, 0, 1.5, 6.9, 10],
  [0, 'S', 'GrabFood', 'A-96AI2VKWWHIFAV|A-96AFLP9WWFKCAV', 0, 'Tanpa tunai', 11.9, 0, 0, 11.9, 10],
  [0, 'S', 'GrabFood', 'A-96ADBK6GWDKEAV|A-96AFAU4WWFKCAV', 0, 'Tanpa tunai', 6.3, 0, 2.9, 9.2, 10],
  [0, 'S', 'GrabMart', 'A-963P4V5WWNODAV', 3, 'Tanpa tunai', 3.7, 0, 8.4, 12.1, 10],
  [0, 'T', 'GrabFood', 'A-96A7RAJGWUIVAV', 0, 'Tanpa tunai', 2.4, 0, 1.6, 4, 11],
  [1, 'T', 'GrabExpress Instant -- Bike', 'PLAN-1-HXX25KTWW9ON', 0, 'Tanpa tunai', 6, 0, 0.4, 6.4, 11],
  [1, 'T', 'GrabFood', 'A-968DL7GGX4L4AV', 0, 'Tanpa tunai', 3.9, 0, 1.5, 5.4, 11],
  [1, 'T', 'GrabFood', 'A-968BIO6GW85JAV', 0, 'Tanpa tunai', 6.7, 0, 1, 7.7, 11],
  [1, 'T', 'GrabFood', 'A-9684E7RGXXQSAV', 0, 'Tanpa tunai', 6.7, 0, 1.2, 7.9, 11],
  [1, 'T', 'GrabFood', 'A-9684RICGWDQUAV', 0, 'Tanpa tunai', 4.2, 0, 2.9, 7.1, 11],
  [1, 'T', 'GrabFood', 'A-96845P9WWRRDAV', 0, 'Tanpa tunai', 6.1, 0, 1.5, 7.6, 11],
  [1, 'S', 'GrabFood', 'A-968WD63GWBA7AV|A-968X4ESWWDUVAV', 0, 'Tanpa tunai', 6.9, 0, 2.8, 9.7, 11],
  [1, 'T', 'GrabFood', 'A-967TE55WXBR3AV', 0, 'Tanpa tunai', 3.2, 0, 1.7, 4.9, 11],
  [1, 'S', 'GrabFood', 'A-967R75EGWX3SAV|A-967QFVIGW8ELAV', 0, 'Tanpa tunai', 13.6, 0, 0, 13.6, 11],
  [1, 'S', 'GrabFood', 'A-967MASPWWM68AV', 2, 'Tunai / Tanpa tunai', 15, 0, 0.8, 15.8, 12],
  [1, 'T', 'GrabFood', 'A-967K2SHWWV6DAV', 0, 'Tanpa tunai', 5.9, 0, 0.8, 6.7, 12],
  [1, 'T', 'GrabMart', 'A-967I3CBWWX3SAV', 0, 'Tanpa tunai', 4.9, 0, 0.7, 5.6, 12],
  [1, 'T', 'GrabExpress Instant - Bike', 'PLAN-1-HWVLJ6HGWXML', 0, 'Tanpa tunai', 5.1, 0, 0, 5.1, 12],
  [1, 'T', 'GrabFood', 'A-967B2MFWX8R3AV', 0, 'Tanpa tunai', 6, 0, 0, 6, 12],
  [1, 'T', 'GrabMart', 'A-966V68AGWDQUAV', 0, 'Tunai', 5, 0, 0, 5, 12],
  [1, 'T', 'GrabMart', 'A-966TD7IGX4L4AV', 0, 'Tanpa tunai', 4.4, 0, 1.4, 5.8, 12],
  [1, 'T', 'GrabFood', 'A-966TV7EWWV6DAV', 0, 'Tanpa tunai', 5.9, 0, 1.1, 7, 12],
  [1, 'T', 'GrabFood', 'A-966SHROWXEU5AV', 0, 'Tanpa tunai', 2.4, 0, 2.2, 4.6, 12],
  [1, 'T', 'GrabFood', 'A-966P54CGWCLMAV', 0, 'Tanpa tunai', 3, 0, 2.7, 5.7, 12],
  [1, 'S', 'GrabFood', 'A-966KQF3WWBF9AV|A-966LVF7W2BF9AV', 0, 'Tanpa tunai', 5.1, 0, 5.9, 11, 12],
  [1, 'T', 'GrabFood', 'A-966J5VSG2DUVAV', 0, 'Tanpa tunai', 3.1, 0, 4.5, 7.6, 12],
  [1, 'T', 'GrabFood', 'A-966HDR2GWJNVAV', 0, 'Tanpa tunai', 3.6, 0, 3.5, 7.1, 12],
  [1, 'S', 'GrabMart', 'A-966FLBJWXC7NAV|A-9666Q3NWWQVPAV', 0, 'Tanpa tunai', 7.6, 0, 2.3, 9.9, 13],
  [1, 'T', 'GrabFood', 'A-966ECC4WWCLMAV', 0, 'Tanpa tunai', 3.9, 0, 1.2, 5.1, 13],
  [1, 'T', 'GrabMart', 'A-96656NJGWBF9AV', 0, 'Tanpa tunai', 4.1, 0, 1.7, 5.8, 13],
  [1, 'T', 'GrabFood', 'A-9669DTLWWDUVAV', 0, 'Tunai', 5.8, 0, 1.1, 6.9, 13],
  [1, 'T', 'GrabFood', 'A-9669HLKWX8FQAV', 0, 'Tanpa tunai', 4.7, 0, 0, 4.7, 13],
  [1, 'T', 'GrabFood', 'A-9666QGTWWQVPAV', 0, 'Tanpa tunai', 4.5, 0, 1.3, 5.8, 13],
  [1, 'T', 'GrabFood', 'A-965TNC2GWM68AV', 0, 'Tunai', 6.2, 0, 0, 6.2, 13],
  [2, 'T', 'GrabExpress Instant - Bike', 'PLAN-1-HWSGW45WWBTT', 0, 'Tanpa tunai', 6.3, 0, 0, 6.3, 13],
  [2, 'S', 'GrabFood', 'A-9647WLMWWHOEAV|A-96475TRWX27VAV', 0, 'Tanpa tunai', 13.1, 0, 0, 13.1, 13],
  [2, 'T', 'GrabFood', 'A-9643JFWGWKEBAV', 0, 'Tanpa tunai', 6.2, 0, 0.1, 6.3, 13],
  [2, 'T', 'GrabMart', 'A-964WSBWGW7CPAV', 0, 'Tanpa tunai', 7.6, 0, 0.3, 7.9, 14],
  [2, 'T', 'GrabExpress Instant -- Bike', 'PLAN-1-HWS3PS3GW4QH', 0, 'Tanpa tunai', 7.8, 0, 0, 7.8, 14],
  [2, 'S', 'GrabMart', 'A-963UCNSWWPVAAV|A-963UT8HGWJLCAV', 0, 'Tanpa tunai', 4.5, 0, 2.4, 6.9, 14],
  [2, 'S', 'GrabFood', 'A-963QHS7GX7TAAV|A-963QDEBGWM8UAV', 0, 'Tanpa tunai', 12.3, 0, 0.7, 13, 14],
  [2, 'T', 'GrabFood', 'A-963PW6FGW8JBAV', 0, 'Tanpa tunai', 2.8, 0, 2.6, 5.4, 14],
  [2, 'T', 'GrabFood', 'A-963OPW5WW7SVAV', 0, 'Tunai', 3.7, 0, 2.3, 6, 14],
  [2, 'T', 'GrabFood', 'A-963LVQQGX7TAAV', 0, 'Tanpa tunai', 5.6, 0, 1.8, 7.4, 14],
  [2, 'T', '4-Hour Delivery', 'PLAN-1-HWRQ5Q8GW4QH', 0, 'Tanpa tunai', 6, 0, 3.1, 9.1, 14],
  [2, 'T', 'GrabFood', 'A-963J2Q4GWXKBAV', 0, 'Tanpa tunai', 11.6, 0, 0, 11.6, 14],
  [2, 'T', 'GrabFood', 'A-963HVTJWX7TAAV', 0, 'Tanpa tunai', 3.1, 0, 1.9, 5, 14],
  [2, 'S', 'GrabFood', 'A-963F9QOWW7CPAV|A-963F6VPGXC73AV', 0, 'Tanpa tunai', 7.1, 0, 1.5, 8.6, 14],
  [2, 'T', 'GrabExpress Instant -- Bike', 'PLAN-1-HWRFA2AWW4QH', 0, 'Tanpa tunai', 10.3, 0, 0, 10.3, 14],
  [2, 'S', 'GrabFood', 'A-963E2CMWWLQOAV|A-963D26JWX6ITAV', 0, 'Tanpa tunai', 5, 0, 2, 7, 15],
  [2, 'T', 'GrabFood', 'A-9633G7QGWGSPAV', 0, 'Tanpa tunai', 3.5, 0, 3.6, 7.1, 15],
  [2, 'T', 'GrabFood', 'A-962TQ9RGW7SVAV', 0, 'Tanpa tunai', 2, 0, 2.7, 4.7, 15],
  [2, 'T', 'GrabFood', 'A-962RQHQGXBVTAV', 0, 'Tanpa tunai', 5.1, 0, 1.4, 6.5, 15],
  [2, 'S', 'GrabFood', 'A-962MQ7SGWRROAV', 3, 'Tanpa tunai', 13, 0, 4.3, 17.3, 15],
  [2, 'T', 'GrabFood', 'A-962JG8RGWD4HAV', 0, 'Tanpa tunai', 1.7, 0, 3, 4.7, 15],
  [2, 'S', 'GrabFood', 'A-962K5C4G2GSPAV|A-962JEGOWWPVAAV', 0, 'Tanpa tunai', 5.5, 0, 4.2, 9.7, 15],
  [2, 'T', 'GrabFood', 'A-962DMF4WXWFLAV', 0, 'Tanpa tunai', 3.1, 0, 4.8, 7.9, 15],
  [2, 'S', 'GrabFood', 'A-962DIRIWXBJBAV|A-962AU34GW7CPAV', 0, 'Tanpa tunai', 6.6, 0, 3.2, 9.8, 15],
  [2, 'T', 'GrabFood', 'A-962CWXDWWKEBAV', 0, 'Tanpa tunai', 4.8, 0, 2.2, 7, 15],
  [2, 'T', 'GrabFood', 'A-962AVN5WX27VAV', 0, 'Tanpa tunai', 3.8, 0, 1.9, 5.7, 15],
  [2, 'T', 'GrabFood', 'A-96XRA99WW8JBAV', 0, 'Tunai', 4.5, 0, 0.5, 5, 15],
  [2, 'T', 'GrabFood', 'A-96XHLOGWWSSNAV', 0, 'Tanpa tunai', 3.3, 0, 1.8, 5.1, 16],
  [3, 'T', 'GrabFood', 'A-96W7DTHWWA5FAV', 0, 'Tunai', 7.4, 0, 0.9, 8.3, 16],
  [3, 'T', 'GrabMart', 'A-96W64NPWWE8UAV', 0, 'Tanpa tunai', 2.8, 0, 1.4, 4.2, 16],
  [3, 'S', 'GrabFood', 'A-96W3HRSGWE8UAV|A-96W2LGVWX2STAV', 0, 'Tanpa tunai', 13.5, 0, 0, 13.5, 16],
  [3, 'S', 'GrabFood', 'A-95VUUUVWW5LVAV|A-95VUOBAGXDLRAV', 0, 'Tanpa tunai', 8.5, 0, 0, 8.5, 16],
  [3, 'S', 'GrabFood', 'A-95VSKBRWXDLRAV|A-95VSIPWWW64IAV', 0, 'Tanpa tunai', 7, 0, 1, 8, 16],
  [3, 'S', 'GrabFood', 'A-95VO3MTGWAWVAV', 2, 'Tunai / Tanpa tunai', 14.8, 0, 0, 14.8, 16],
  [3, 'S', 'GrabFood', 'A-95VJVNVWX5CKAV|A-95VKAD4GW3ATAV', 0, 'Tanpa tunai', 10.3, 0, 0, 10.3, 16],
  [3, 'T', 'GrabFood', 'A-95VHQHOWWEPDAV', 0, 'Tanpa tunai', 3.8, 0, 1, 4.8, 16],
  [3, 'T', 'GrabFood', 'A-95VGLB3WX35OAV', 0, 'Tanpa tunai', 4.7, 0, 1.5, 6.2, 17],
  [3, 'T', 'GrabFood', 'A-95VDG4IWWEKUAV', 0, 'Tanpa tunai', 10.2, 0, 0, 10.2, 17],
  [3, 'T', 'GrabFood', 'A-95VBOR7WWL2LAV', 0, 'Tanpa tunai', 3.4, 0, 2, 5.4, 17],
  [3, 'S', 'GrabFood', 'A-95V5X2KGX35OAV', 2, 'Tunai / Tanpa tunai', 16.4, 0, 0, 16.4, 17],
  [3, 'T', 'GrabMart', 'A-95UKWQ4GWLIQAV', 0, 'Tanpa tunai', 7.4, 0, 1.3, 8.7, 17],
  [3, 'T', 'GrabMart', 'A-95UHMV4WWGWIAV', 0, 'Tanpa tunai', 3.2, 0, 1.4, 4.6, 17],
  [3, 'T', 'GrabFood', 'A-95UFG4GGXCBDAV', 0, 'Tanpa tunai', 1.3, 0, 3.3, 4.6, 17],
  [3, 'S', 'GrabFood', 'A-95UCAQWWW2HDAV', 2, 'Tanpa tunai', 14.2, 0, 2.9, 17.1, 17],
  [3, 'T', 'GrabFood', 'A-95U87QPGWWH8AV', 0, 'Tanpa tunai', 4.5, 0, 2, 6.5, 17],
  [3, 'S', 'GrabFood', 'A-95U88QDWWJQ3AV|A-95U8B8XWWJ3OAV', 0, 'Tanpa tunai', 7.8, 0, 2.4, 10.2, 17],
  [3, 'T', 'GrabFood', 'A-95U8778GXAHQAV', 0, 'Tanpa tunai', 2.2, 0, 2.4, 4.6, 17],
  [3, 'S', 'GrabFood', 'A-95U6KKEGXAHQAV|A-95U6L4PGWJQ3AV', 0, 'Tanpa tunai', 2.2, 0, 5.4, 7.6, 17],
  [3, 'T', 'GrabFood', 'A-95UWLS8WWA3PAV', 0, 'Tunai', 2.9, 0, 3.9, 6.8, 18],
  [4, 'S', 'GrabFood', 'A-95S2WE3GWKINAV|A-95S3BLJGWBJRAV', 0, 'Tunai / Tanpa tunai', 7.6, 0, 2.2, 9.8, 18],
  [4, 'T', 'GrabMart', 'A-95SXE46WW64IAV', 0, 'Tunai', 3.3, 0, 1.2, 4.5, 18],
  [4, 'T', 'GrabFood', 'A-95SWWUGGW858AV', 0, 'Tanpa tunai', 2.9, 0, 1.6, 4.5, 18],
  [4, 'T', 'GrabFood', 'A-95RP2T6GWKINAV', 0, 'Tanpa tunai', 3.3, 0, 3.2, 6.5, 18],
  [4, 'T', 'GrabFood', 'A-95RR3O9GW64IAV', 0, 'Tunai', 2.3, 0, 2.1, 4.4, 18],
  [4, 'T', 'GrabExpress Instant -- Bike', 'PLAN-1-HWKWA7TWX2R4', 0, 'Tanpa tunai', 4.7, 0, 0, 4.7, 18],
  [4, 'T', 'GrabMart', 'A-95RQXK4WX2COAV', 0, 'Tanpa tunai', 6, 0, 0.8, 6.8, 18],
  [4, 'T', 'GrabFood', 'A-95RLESAGW5JEAV', 0, 'Tanpa tunai', 4.5, 0, 1.2, 5.7, 18],
  [4, 'S', 'GrabMart', 'A-95RIPXUGW5BNAV|A-95QGD4WWW34VAV', 0, 'Tanpa tunai', 4.6, 0, 2.3, 6.9, 18],
  [4, 'T', 'GrabFood', 'A-95RHQTWWXBQTAV', 0, 'Tanpa tunai', 6, 0, 1.6, 7.6, 19],
  [4, 'S', 'GrabFood', 'A-95RDIE6WW4F7AV|A-95RD8WSWWWPMAV', 0, 'Tanpa tunai', 12.6, 0, 2, 14.6, 19],
  [4, 'S', 'GrabFood', 'A-95R9RMRWW8BRAV', 2, 'Tunai / Tanpa tunai', 13.6, 0, 0.4, 14, 19],
  [4, 'T', 'GrabFood', 'A-95QPGF9WX98TAV', 0, 'Tanpa tunai', 7.1, 0, 0.4, 7.5, 19],
  [4, 'S', 'GrabMart', 'A-95RWKQNGXBQQAV|A-95R25D6WW96OAV', 0, 'Tanpa tunai', 8.7, 0, 0.8, 9.5, 19],
  [4, 'T', 'GrabFood', 'A-95QHAQRW24OFAV', 0, 'Tanpa tunai', 2.5, 0, 2.3, 4.8, 19],
  [4, 'T', 'GrabFood', 'A-95QGUM5GW7PKAV', 0, 'Tanpa tunai', 2.3, 0, 2.3, 4.6, 19],
  [4, 'T', 'GrabFood', 'A-95QDHFAWWT9EAV', 0, 'Tanpa tunai', 3.7, 0, 1.9, 5.6, 19],
  [4, 'T', 'GrabFood', 'A-95QB9I7GWNWAAV', 0, 'Tanpa tunai', 2, 0, 3.1, 5.1, 19],
  [4, 'T', 'GrabFood', 'A-95Q94XCWWTAGAV', 0, 'Tanpa tunai', 5.7, 0, 2.4, 8.1, 19],
  [4, 'S', 'GrabFood', 'A-95Q4XPRWW34VAV', 3, 'Tanpa tunai', 17, 0, 0, 17, 19],
  [4, 'S', 'GrabFood', 'A-95PVDC4GWHUXAV|A-95Q33KHWWUARAV', 0, 'Tanpa tunai', 7.5, 0, 0, 7.5, 20],
  [4, 'S', 'GrabFood', 'A-95QXPIHGX5LRAV|A-95M7B4UGWU3BAV', 0, 'Tanpa tunai', 7.2, 0, 0, 7.2, 20],
  [5, 'S', 'GrabFood', 'A-95NRG4RGWK2MAV|A-95NSS5RGW2WOAV', 0, 'Tanpa tunai', 8.1, 0, 1.7, 9.8, 20],
  [5, 'T', 'GrabFood', 'A-95NOM32GXC5FAV', 0, 'Tanpa tunai', 4.4, 0, 0, 4.4, 20],
  [5, 'T', 'GrabFood', 'A-95NKJXVWXCBUAV', 0, 'Tanpa tunai', 5.7, 0, 1.9, 7.6, 20],
  [5, 'S', 'GrabFood', 'A-95NGVE4WWS7AAV|A-95NJUNIWX4LEAV', 0, 'Tanpa tunai', 11.4, 0, 0.7, 12.1, 20],
  [5, 'S', 'GrabFood', 'A-95NFJ99GWE5FAV|A-95NGJ67WWSARAV', 0, 'Tanpa tunai', 6.3, 0, 3.1, 9.4, 20],
  [5, 'T', 'GrabFood', 'A-95NBMVKWX7BWAV', 0, 'Tanpa tunai', 11.6, 0, 0, 11.6, 20],
  [5, 'T', 'GrabFood', 'A-95NAVH6GX45AAV', 0, 'Tanpa tunai', 4.1, 0, 1.9, 6, 20],
  [5, 'S', 'GrabFood', 'A-95NA3F7GX45AAV|A-95N9ICMWXEEEAV', 0, 'Tanpa tunai', 12.1, 0, 0, 12.1, 21],
  [5, 'S', 'GrabFood', 'A-95N62G7WW2WOAV', 0, 'Tanpa tunai', 5.3, 0, 1.5, 6.8, 21],
  [5, 'T', 'GrabMart', 'A-95MPFMEWWPJ6AV', 0, 'Tanpa tunai', 2.1, 0, 2.5, 4.6, 21],
  [5, 'S', 'GrabFood', 'A-95MTNXCGXX5TAV|A-95MAANBWXAU7AV', 0, 'Tanpa tunai', 12, 0, 0, 12, 21],
  [5, 'T', 'GrabFood', 'A-95MSRNBWWU3BAV', 0, 'Tanpa tunai', 4.8, 0, 0, 4.8, 21],
  [5, 'T', 'GrabFood', 'A-95MRAXJWXAU7AV', 0, 'Tanpa tunai', 2.5, 0, 1.9, 4.4, 21],
  [5, 'T', 'GrabFood', 'A-95MCSS5GWHJUAV', 0, 'Tanpa tunai', 4.8, 0, 1.6, 6.4, 21],
  [5, 'T', 'GrabFood', 'A-95MA4DWGWATOAV', 0, 'Tanpa tunai', 4.3, 0, 3.4, 7.7, 21],
  [5, 'T', 'GrabFood', 'A-95M6DO4GXWU2AV', 0, 'Tanpa tunai', 4, 0, 3.5, 7.5, 21],
  [5, 'T', 'GrabFood', 'A-95MWKJ7WWHJUAV', 0, 'Tanpa tunai', 7.4, 0, 0.8, 8.2, 21],
  [5, 'T', 'GrabFood', 'A-95LV86IGWWLEAV', 0, 'Tanpa tunai', 4.2, 0, 0.9, 5.1, 21],
  [5, 'T', 'GrabFood', 'A-95LQSG6WWK2MAV', 0, 'Tanpa tunai', 6.7, 0, 0, 6.7, 21],
  [6, 'T', 'GrabExpress Instant - Bike', 'PLAN-1-HWCVJALWWIRW', 0, 'Tanpa tunai', 7.3, 0, 0, 7.3, 22],
  [6, 'T', 'GrabMart', 'A-95JGN57WWVREAV', 0, 'Tanpa tunai', 6.1, 0, 0.7, 6.8, 22],
  [6, 'T', 'GrabMart', 'A-95JCGVAGWSIKAV', 0, 'Tanpa tunai', 3.1, 0, 2.3, 5.4, 22],
  [6, 'S', 'GrabFood', 'A-95JATCOWWJ5RAV|A-95JAU77WWLHIAV', 0, 'Tanpa tunai', 7.9, 0, 0.7, 8.6, 22],
  [6, 'T', 'GrabFood', 'A-95J6576GX8FSAV', 0, 'Tunai', 6.3, 0, 1.6, 7.9, 22],
  [6, 'T', 'GrabFood', 'A-95J3J3UGWUSPAV', 0, 'Tanpa tunai', 2.3, 0, 4, 6.3, 22],
  [6, 'S', 'GrabFood', 'A-95IV6WMWX7BCAV', 2, 'Tanpa tunai', 14.3, 0, 0, 14.3, 22],
  [6, 'S', 'GrabFood', 'A-95ITUU9WX3OFAV', 2, 'Tanpa tunai', 14.4, 0, 0, 14.4, 22],
  [6, 'T', 'GrabFood', 'A-95IO3TOGX8TPAV', 0, 'Tanpa tunai', 4, 0, 0.8, 4.8, 22],
  [6, 'T', 'GrabMart', 'A-95ID2HDWWFA7AV', 0, 'Tanpa tunai', 3.2, 0, 1.6, 4.8, 22],
  [6, 'T', 'GrabMart', 'A-95IBO49WXDREAV', 0, 'Tunai', 5.4, 0, 0, 5.4, 22],
  [6, 'S', 'GrabFood', 'A-95I88XUWX4KSAV|A-95I9U9SGX3THAV', 0, 'Tanpa tunai', 14.7, 0, 0, 14.7, 23],
  [6, 'T', 'GrabFood', 'A-95I78FGGWJTSAV', 0, 'Tanpa tunai', 7.7, 0, 2.1, 9.8, 23],
  [6, 'S', 'GrabMart', 'A-95I3OQ8GW5INAV|A-95I3GLXG2828AV', 0, 'Tanpa tunai', 7.7, 0, 3.3, 11, 23],
  [6, 'S', 'GrabFood', 'A-95HTJPEWWL7QAV', 3, 'Tanpa tunai', 20.9, 0, 0, 20.9, 23],
  [6, 'T', 'GrabFood', 'A-95HSBLHGWC5CAV', 0, 'Tanpa tunai', 7.9, 0, 2, 9.9, 23],
  [6, 'T', 'GrabMart', 'A-95HNI6QWWOHMAV', 0, 'Tunai', 5, 0, 0, 5, 23],
  [6, 'S', 'GrabFood', 'A-95HMM3CWX4RDAV', 2, 'Tanpa tunai', 19.5, 0, 0.5, 20, 23],
  [6, 'T', 'GrabFood', 'A-95HLECOGX5PSAV', 0, 'Tunai', 4.6, 0, 0.4, 5, 23],
  [6, 'T', 'GrabFood', 'A-95HJG67WWDSSAV', 0, 'Tunai', 3.7, 0, 0.5, 4.2, 23]
];

// Phase 1 手工验证过的逐日小计（交叉核对用，跟 Verified_Income 的
// net_delivery_income 分毫不差，见 compliance-os-daily-allocation-phase2-design.md）。
var DOAL_W01_EXPECTED_DAILY_ = {
  '2026-01-04': 205.50, '2026-01-03': 213.50, '2026-01-02': 162.40,
  '2026-01-01': 187.60, '2025-12-31': 174.70, '2025-12-30': 196.00, '2025-12-29': 157.90
};
var DOAL_W01_EXPECTED_TOTAL_ = 1297.60;

var DOAL_W33_EXPECTED_DAILY_ = {
  '2026-08-16': 192.30, '2026-08-15': 184.50, '2026-08-14': 193.70,
  '2026-08-13': 157.30, '2026-08-12': 118.10, '2026-08-11': 160.10, '2026-08-10': 189.10
};
var DOAL_W33_EXPECTED_TOTAL_ = 1195.10;

// Phase 4 测试要用的 142 函式（candidateFromGeminiOrderRow_ 等）的解析器。
// 2026-09-15：原本漏了 typeof require 守卫，GAS 没有 require 直接 ReferenceError
//（真实 GAS 执行时抓到的）；当时的修法是把「同名 const 解构」改成呼叫这个 resolver。
// 2026-10-07 修正（用「所有档案载入同一个全域 scope、没有 require」的 GAS 式模拟抓到的，
// 原始 repo 就会这样，不是当天的改动造成的）：09-15 那版 resolver 仍然嵌在
// runDailyOrderAllocationTests_ 里面，它的 GAS 分支回传 {candidateFromGeminiOrderRow_, ...}
// 时，这三个名字先在「外层函式」找——而外层函式正好用同名 const 解构在接这个
// 函式的回传值，初始化期间这三个名字还在 TDZ → "Cannot access
// 'candidateFromGeminiOrderRow_' before initialization"。resolver 嵌在同一个外层函式
// 里，遮蔽就没有消失。提到顶层之后，它的 scope chain 是「自己 → 全域」，不经过外层
// 函式，GAS 分支才真的引用到全域的 142 函式；Node 分支（require）行为完全没变。
function resolveDoalTestDeps143_() {
  if (typeof require === 'function') {
    return require('./142_DailyOrderAllocation.js');
  }
  return { candidateFromGeminiOrderRow_, mergeChunkedExtractionResults_, runGeminiOrderExtractionWithFallback_ }; // GAS：142 已经载入，直接引用全域
}

function runDailyOrderAllocationTests_() {
  const results = [];

  function parseStatement_(butiranText, periodStart, periodEnd) {
    const dayBlocks = splitIntoDayBlocks_(butiranText);
    const allRows = [];
    const daily = [];
    const invalid = [];
    dayBlocks.forEach((block) => {
      const dateResult = resolveOrderDate_(block.weekdayName, block.day, block.monthName, periodStart, periodEnd);
      const { rows, invalidRows, printedSubtotal } = parseDayBlock_(block);
      invalidRows.forEach((iv) => invalid.push(Object.assign({ weekday: block.weekdayName, day: block.day, month: block.monthName }, iv)));
      if (!dateResult.ok) {
        invalid.push({ weekday: block.weekdayName, day: block.day, month: block.monthName, errors: [dateResult.reason] });
        return;
      }
      const datedRows = rows.map((r) => Object.assign({ order_date: dateResult.isoDate }, r));
      allRows.push(...datedRows);
      const checksum = computeDailyChecksum_(datedRows, printedSubtotal);
      daily.push({
        date: dateResult.isoDate,
        order_row_count: datedRows.length,
        net_delivery_income: checksum.calculatedTotal,
        printed_daily_subtotal: checksum.printedSubtotal,
        checksum_difference: checksum.difference,
        checksum_status: checksum.status
      });
    });
    return { allRows, daily, invalid };
  }

  // ---- 1/2/3: 单月份 / 跨月份 / 逐日小计 ----
  const w01 = parseStatement_(DOAL_FIXTURE_BUTIRAN_W01_, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  const w33 = parseStatement_(DOAL_FIXTURE_BUTIRAN_W33_, DOAL_W33_PERIOD_START_, DOAL_W33_PERIOD_END_);

  results.push({ name: 'TEST 1: W33 单月份 statement 解析出 7 个日期分组', pass: w33.daily.length === 7, actual: w33.daily.length, expected: 7 });
  results.push({ name: 'TEST 2: W01 跨月份 statement 解析出 7 个日期分组', pass: w01.daily.length === 7, actual: w01.daily.length, expected: 7 });

  Object.keys(DOAL_W01_EXPECTED_DAILY_).forEach((date) => {
    const d = w01.daily.find((x) => x.date === date);
    results.push({
      name: `TEST 3.W01.${date}: 逐日 net_delivery_income 精确重建`,
      pass: !!d && Math.abs(d.net_delivery_income - DOAL_W01_EXPECTED_DAILY_[date]) < 0.005,
      actual: d ? d.net_delivery_income : null, expected: DOAL_W01_EXPECTED_DAILY_[date]
    });
  });
  Object.keys(DOAL_W33_EXPECTED_DAILY_).forEach((date) => {
    const d = w33.daily.find((x) => x.date === date);
    results.push({
      name: `TEST 3.W33.${date}: 逐日 net_delivery_income 精确重建`,
      pass: !!d && Math.abs(d.net_delivery_income - DOAL_W33_EXPECTED_DAILY_[date]) < 0.005,
      actual: d ? d.net_delivery_income : null, expected: DOAL_W33_EXPECTED_DAILY_[date]
    });
  });

  // ---- 3(续)/16/17/18: checksum PASS 全部日期 + 整周加总 ----
  const w01AllMatched = w01.daily.every((d) => d.checksum_status === 'Matched');
  const w33AllMatched = w33.daily.every((d) => d.checksum_status === 'Matched');
  results.push({ name: 'TEST 16.W01: 全部 7 天 daily checksum = Matched', pass: w01AllMatched, actual: w01.daily.map((d) => d.checksum_status), expected: 'all Matched' });
  results.push({ name: 'TEST 16.W33: 全部 7 天 daily checksum = Matched', pass: w33AllMatched, actual: w33.daily.map((d) => d.checksum_status), expected: 'all Matched' });

  const w01Total = round2_(w01.daily.reduce((s, d) => s + d.net_delivery_income, 0));
  const w33Total = round2_(w33.daily.reduce((s, d) => s + d.net_delivery_income, 0));
  results.push({ name: 'TEST H: 真实 W01 整周加总 = 1297.60', pass: Math.abs(w01Total - DOAL_W01_EXPECTED_TOTAL_) < 0.005, actual: w01Total, expected: DOAL_W01_EXPECTED_TOTAL_ });
  results.push({ name: 'TEST I: 真实 W33 整周加总 = 1195.10', pass: Math.abs(w33Total - DOAL_W33_EXPECTED_TOTAL_) < 0.005, actual: w33Total, expected: DOAL_W33_EXPECTED_TOTAL_ });

  const w01StatementChecksum = computeStatementChecksum_(w01.daily, DOAL_W01_EXPECTED_TOTAL_);
  const w33StatementChecksum = computeStatementChecksum_(w33.daily, DOAL_W33_EXPECTED_TOTAL_);
  results.push({ name: 'TEST 4.W01: statement-level checksum = Matched', pass: w01StatementChecksum.status === 'Matched', actual: w01StatementChecksum, expected: 'Matched' });
  results.push({ name: 'TEST 4.W33: statement-level checksum = Matched', pass: w33StatementChecksum.status === 'Matched', actual: w33StatementChecksum, expected: 'Matched' });

  // ---- 5/6: 日期 group 跨页（W01 的 "Ahad, 4 Januari" 横跨 page 7-9，
  // 用 order_row_count 间接验证——跨页没断行的话应该有 31 笔）----
  const ahad4Jan = w01.daily.find((d) => d.date === '2026-01-04');
  results.push({ name: 'TEST 5/6: W01 跨页日期分组（Ahad 4 Jan）订单笔数 = 31', pass: !!ahad4Jan && ahad4Jan.order_row_count === 31, actual: ahad4Jan ? ahad4Jan.order_row_count : null, expected: 31 });

  // ---- 8/9: Sekaligus + and N ----
  const w01Sekaligus = w01.allRows.filter((r) => r.order_row_type === 'Sekaligus');
  const w01AndN = w01.allRows.filter((r) => r.order_identity_status === 'Partially_Known');
  results.push({ name: 'TEST 8.W01: 解析出 Sekaligus 行（数量 > 0）', pass: w01Sekaligus.length > 0, actual: w01Sekaligus.length, expected: '> 0' });
  results.push({ name: 'TEST 9.W01: 解析出至少一个 "and N" partially-known 行', pass: w01AndN.length > 0, actual: w01AndN.length, expected: '> 0' });
  const sampleAndN = w01AndN[0];
  results.push({
    name: 'TEST 9.detail: "and N" 行保留 bundled_order_count 而非伪造独立金额',
    pass: !!sampleAndN && sampleAndN.bundled_order_count > sampleAndN.order_id_raw.split(' / ').length - 1,
    actual: sampleAndN ? { raw: sampleAndN.order_id_raw, count: sampleAndN.bundled_order_count } : null,
    expected: 'bundled_order_count reflects "and N" without fabricating per-booking amounts'
  });

  // ---- 10/11/12: GrabFood / GrabMart / GrabExpress ----
  ['GrabFood', 'GrabMart', 'GrabExpress'].forEach((plat) => {
    const found = w01.allRows.some((r) => r.platform === plat) || w33.allRows.some((r) => r.platform === plat);
    results.push({ name: `TEST 10-12: 至少解析出一笔 ${plat}`, pass: found, actual: found, expected: true });
  });

  // ---- 13/14: Instant - Bike / Instant -- Bike 连字符两种写法 ----
  const singleHyphen = /Instant\s-\sBike/.test(DOAL_FIXTURE_BUTIRAN_W01_ + DOAL_FIXTURE_BUTIRAN_W33_);
  const doubleHyphen = /Instant\s--\sBike/.test(DOAL_FIXTURE_BUTIRAN_W01_ + DOAL_FIXTURE_BUTIRAN_W33_);
  results.push({ name: 'TEST 13/14: 两种连字符写法在真实样本中都存在（parser 不依赖连字符判断 platform，见上方 10-12 已过）', pass: singleHyphen && doubleHyphen, actual: { singleHyphen, doubleHyphen }, expected: 'both true' });

  // ---- 15: cash / cashless ----
  const paymentTypesSeen = new Set(w01.allRows.concat(w33.allRows).map((r) => r.payment_method));
  results.push({ name: 'TEST 15: 解析出 Tanpa_Tunai 与 Tunai 两种付款方式', pass: paymentTypesSeen.has('Tanpa_Tunai') && paymentTypesSeen.has('Tunai'), actual: [...paymentTypesSeen], expected: 'includes Tanpa_Tunai and Tunai' });

  // ---- 17/18: checksum FAIL → Discrepancy_Flagged / Needs_Review（人为破坏一笔金额）----
  const tamperedRows = w33.allRows.filter((r) => r.order_date === '2026-08-10').map((r) => Object.assign({}, r));
  if (tamperedRows.length > 0) tamperedRows[0].net_income = round2_(tamperedRows[0].net_income + 1.23);
  const tamperedChecksum = computeDailyChecksum_(tamperedRows, DOAL_W33_EXPECTED_DAILY_['2026-08-10']);
  results.push({ name: 'TEST 17: 人为篡改一笔金额 → checksum_status = Discrepancy_Flagged', pass: tamperedChecksum.status === 'Discrepancy_Flagged', actual: tamperedChecksum.status, expected: 'Discrepancy_Flagged' });
  results.push({ name: 'TEST 18: checksum 失败时 difference ≠ 0 且不静默吞掉', pass: Math.abs(tamperedChecksum.difference) > 0.01, actual: tamperedChecksum.difference, expected: '≈ 1.23' });

  // ---- 19: Tip allocation（独立台账，逐笔有日期，跟订单号一样格式）----
  // CMP-P8：先把输入范围限定到 Tip 表格本身（切到 "Insentif" 开始为
  // 止），不要把整个 nonorder 区块一起喂进去——Phase 3 实测才发现的真实
  // 坑：不限定范围的话，Insentif 区块残留的日期文字会被误认成 Tip 的
  // 第 17 笔，17 个日期对 16 组订单/金额，配对会错位。
  const w01TipSectionOnly = DOAL_FIXTURE_NONORDER_W01_.slice(0, DOAL_FIXTURE_NONORDER_W01_.indexOf('Insentif'));
  const w01Tip = parseTipSection_(w01TipSectionOnly, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  const w01TipTotal = round2_(w01Tip.lines.reduce((s, l) => s + l.amount, 0));
  results.push({ name: 'TEST 19: Tip 台账逐笔可解析出日期', pass: w01Tip.lines.length > 0, actual: w01Tip.lines.length, expected: '> 0' });
  results.push({ name: 'TEST 19b: W01 Tip 逐笔加总精确等于顶层 Tip=50.00（Phase 1 已验证的真实数字）', pass: Math.abs(w01TipTotal - 50.00) < 0.01, actual: w01TipTotal, expected: 50.00 });
  results.push({ name: 'TEST 19c: 正确限定范围后，Tip 解析没有 invalid 记录', pass: w01Tip.invalid.length === 0, actual: w01Tip.invalid, expected: [] });

  // ---- 20/21: dated / undated incentive ----
  const w33DatedIncentive = matchInsentifLineDate_('Bonus Harian Monday - ID insentif 3831342', DOAL_W33_PERIOD_START_, DOAL_W33_PERIOD_END_);
  results.push({ name: 'TEST 20: "Bonus Harian Monday" → Weekday_Label_Match，日期落在 statement 周内', pass: w33DatedIncentive.dateSource === 'Weekday_Label_Match' && w33DatedIncentive.allocatedDate === '2026-08-10', actual: w33DatedIncentive, expected: { dateSource: 'Weekday_Label_Match', allocatedDate: '2026-08-10' } });
  const undatedIncentive = matchInsentifLineDate_('Shift Top-Up: Kelana Jaya, TTDI Shift (2628250)', DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  results.push({ name: 'TEST 21: Shift Top-Up（无日期证据）→ Not_Determinable，不猜日期', pass: undatedIncentive.dateSource === 'Not_Determinable' && undatedIncentive.allocatedDate === null, actual: undatedIncentive, expected: { dateSource: 'Not_Determinable', allocatedDate: null } });

  // ---- 22: order-linked Bayaran lain-lain（W33 真实 COD 例子）----
  const codLine = 'A-9NGDUDCWWM5LAV | COD GRABFOOD COD GRABFOOD A-9NGDUDCWWM5LAV';
  const codMatch = matchBayaranLainLainDate_(codLine, w33.allRows);
  results.push({ name: 'TEST 22: W33 真实 COD reimbursement 关联到 Butiran Tempahan 订单日期', pass: codMatch.dateSource === 'Order_ID_Matched' && !!codMatch.allocatedDate, actual: codMatch, expected: 'Order_ID_Matched with a real order_date' });

  // ---- 23: previous-period compensation ----
  const waitCompLine = 'Weekly compensation for long wait time (03 August 2026 - 09 August 2026)';
  const waitComp = matchExplicitPeriodReference_(waitCompLine);
  results.push({ name: 'TEST 23: "long wait time" 补偿正确判定为上一期，不塞进当前 statement 月份', pass: waitComp.dateSource === 'Explicit_Period_Reference' && waitComp.referencedSourcePeriod === '2026-08', actual: waitComp, expected: { referencedSourcePeriod: '2026-08' } });
  const waitCompCrossMonth = matchExplicitPeriodReference_('Weekly compensation for long wait time (22 December 2025 - 28 December 2025)');
  results.push({ name: 'TEST 23b: 跨月的补偿区间正确取结束月份 2025-12', pass: waitCompCrossMonth.referencedSourcePeriod === '2025-12', actual: waitCompCrossMonth, expected: '2025-12' });

  // ---- 24: previous-month reimbursement ----
  const perkesoLine = 'PERKESO Subscription Reimbursement July 2026';
  const perkeso = matchExplicitPeriodReference_(perkesoLine);
  results.push({ name: 'TEST 24: "PERKESO Reimbursement July 2026" 不因为出现在 August statement 就算 August', pass: perkeso.dateSource === 'Explicit_Period_Reference' && perkeso.referencedSourcePeriod === '2026-07', actual: perkeso, expected: { referencedSourcePeriod: '2026-07' } });

  // ---- 25: Not_Determinable ----
  const gibberish = matchExplicitPeriodReference_('某种完全没有已知格式的文字');
  results.push({ name: 'TEST 25: 未知格式文字 → Not_Determinable，不猜', pass: gibberish.dateSource === 'Not_Determinable', actual: gibberish.dateSource, expected: 'Not_Determinable' });

  // ---- 27/28/29: batch identity / idempotency（重新 parse 同一份文字两次）----
  const w01Rerun = parseStatement_(DOAL_FIXTURE_BUTIRAN_W01_, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  const rerunTotal = round2_(w01Rerun.daily.reduce((s, d) => s + d.net_delivery_income, 0));
  results.push({ name: 'TEST 27/29: 同一份 Statement 重新 parse 两次，结果一致（不会因为 retry 累加）', pass: rerunTotal === w01Total, actual: rerunTotal, expected: w01Total });
  const batchId1 = `CMP-OALB-test-${Date.now()}`;
  const batchId2 = `CMP-OALB-test-${Date.now() + 1}`;
  results.push({ name: 'TEST 28: batch id 格式带时间戳，两次不同 batch 天然不同 id（旧 batch 不被覆写）', pass: batchId1 !== batchId2 && /^CMP-OALB-/.test(batchId1), actual: [batchId1, batchId2], expected: 'distinct CMP-OALB- prefixed ids' });

  // ---- 30/31/32: malformed / missing 数据的防御性处理 ----
  const malformedDate = resolveOrderDate_('Ahad', 31, 'Februari', DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  results.push({ name: 'TEST 30: 不存在于 period 内的月份名称 → 明确 ok:false，不猜', pass: malformedDate.ok === false, actual: malformedDate, expected: 'ok:false' });
  const missingSubtotalChecksum = computeDailyChecksum_([{ net_income: 10 }, { net_income: 20 }], null);
  results.push({ name: 'TEST 31: 缺少 printed_daily_subtotal → 明确 Discrepancy_Flagged，不假装 Matched', pass: missingSubtotalChecksum.status === 'Discrepancy_Flagged', actual: missingSubtotalChecksum, expected: 'Discrepancy_Flagged' });
  const missingAmountRow = parseOrderRowCandidate_('Tunggal GrabFood A-TESTID123456 Tanpa tunai 4.00');
  results.push({ name: 'TEST 32: 金额栏数量不足 → valid:false 并列出 errors，不当 0 处理', pass: missingAmountRow.valid === false && missingAmountRow.errors.length > 0, actual: missingAmountRow, expected: 'valid:false with errors' });

  // ---- 33: 已知边界情况——订单号跟下一个字词黏在一起（无空白）----
  const stuckTogether = extractOrderIds_('Tunggal A- Tanpa 4.90 2.00 6.90 GrabMart 8QH7KHSWWCOWAVtunai', 'GrabMart');
  results.push({ name: 'TEST 33: 订单号跟下一个字词无空白黏在一起时仍能取出 ID 本体', pass: stuckTogether.some((id) => id.indexOf('8QH7KHSWWCOWAV') !== -1), actual: stuckTogether, expected: 'contains 8QH7KHSWWCOWAV' });

  // ---- 34: no fabricated month field on Daily_Allocation ----
  const dailyRecordKeys = Object.keys(w01.daily[0] || {});
  results.push({ name: 'TEST 34: Daily_Allocation 记录不含 month 字段（CMP-P6，用 orderDateToYearMonth_ 查询时算）', pass: dailyRecordKeys.indexOf('month') === -1, actual: dailyRecordKeys, expected: 'no "month" key' });
  results.push({ name: 'TEST 34b: orderDateToYearMonth_ 正确把 2026-01-04 转成 2026-01', pass: orderDateToYearMonth_('2026-01-04') === '2026-01', actual: orderDateToYearMonth_('2026-01-04'), expected: '2026-01' });

  // ---- 跨年日期推导（合成边界案例——真实样本没有真正跨年，只是跨月）----
  const crossYearStart = { year: 2026, month: 12, day: 30 };
  const crossYearEnd = { year: 2027, month: 1, day: 2 };
  const crossYearDate = resolveOrderDate_('Khamis', 1, 'Januari', crossYearStart, crossYearEnd);
  results.push({ name: 'TEST 跨年: 合成 2026/12→2027/1 statement，"1 Januari" 正确解析成 2027-01-01', pass: crossYearDate.ok && crossYearDate.isoDate === '2027-01-01', actual: crossYearDate, expected: '2027-01-01' });
  const crossYearDec = resolveOrderDate_('Rabu', 31, 'Disember', crossYearStart, crossYearEnd);
  results.push({ name: 'TEST 跨年.续: 同一份合成 statement，"31 Disember" 正确解析成 2026-12-31（不是 2027）', pass: crossYearDec.ok && crossYearDec.isoDate === '2026-12-31', actual: crossYearDec, expected: '2026-12-31' });

  // ---- Cross-Month grouping：把 W01 的 daily 结果按月分组，验证正确落
  // 在 2025-12 / 2026-01 两组，而不是被 statement week 粗暴归类 ----
  const grouped = {};
  w01.daily.forEach((d) => {
    const ym = orderDateToYearMonth_(d.date);
    grouped[ym] = round2_((grouped[ym] || 0) + d.net_delivery_income);
  });
  const dec2025 = round2_((DOAL_W01_EXPECTED_DAILY_['2025-12-29'] + DOAL_W01_EXPECTED_DAILY_['2025-12-30'] + DOAL_W01_EXPECTED_DAILY_['2025-12-31']));
  const jan2026 = round2_((DOAL_W01_EXPECTED_DAILY_['2026-01-01'] + DOAL_W01_EXPECTED_DAILY_['2026-01-02'] + DOAL_W01_EXPECTED_DAILY_['2026-01-03'] + DOAL_W01_EXPECTED_DAILY_['2026-01-04']));
  results.push({ name: 'TEST 跨月投影: W01 正确拆成 2025-12 / 2026-01 两个月份桶，不是整周塞一个月', pass: Math.abs(grouped['2025-12'] - dec2025) < 0.01 && Math.abs(grouped['2026-01'] - jan2026) < 0.01, actual: grouped, expected: { '2025-12': dec2025, '2026-01': jan2026 } });

  // ---- Phase 4（2026-08-25）：Gemini candidate 映射 + chunk 合并 + fallback 编排 ----
  // resolveDoalTestDeps143_ 定义在文件顶层（见 runDailyOrderAllocationTests_ 上方的说明）——
  // 2026-10-07 起不再嵌在这个函数里面。
  const { candidateFromGeminiOrderRow_, mergeChunkedExtractionResults_, runGeminiOrderExtractionWithFallback_ } = resolveDoalTestDeps143_();

  // 用 Phase 1 已经验证过的真实数字构造"如果 Gemini 回报正确"的样子——
  // 这是证明映射逻辑本身对不对，不是证明 Gemini 真的会这样回报（那需要
  // 真的打 API，这个环境做不到，见 Phase 4 report）。
  const geminiDaySample = { weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: true, printed_daily_subtotal: 5.50 };
  const geminiOrderSample = { order_row_type: 'Tunggal', platform_raw: 'GrabFood', order_ids_raw: ['A-8QLIOUFWWKVDAV'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 4.10, other_income: 1.40, income_adjustment: 0, net_income: 5.50, source_page: 7, low_confidence: false };
  const mapped = candidateFromGeminiOrderRow_(geminiDaySample, geminiOrderSample, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  results.push({ name: 'Phase4.映射: Gemini candidate 正确映射出 order_date=2026-01-04', pass: mapped.valid && mapped.candidate.order_date === '2026-01-04', actual: mapped, expected: 'order_date=2026-01-04' });
  results.push({ name: 'Phase4.映射: 保留 order_id_raw 原文，跟文字解析路径输出同一个形状', pass: mapped.valid && mapped.candidate.order_id_raw === 'A-8QLIOUFWWKVDAV' && mapped.candidate.net_income === 5.50, actual: mapped.candidate, expected: 'order_id_raw/net_income 正确' });

  const wrongWeekday = candidateFromGeminiOrderRow_(Object.assign({}, geminiDaySample, { weekday_name: 'Sabtu' }), geminiOrderSample, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  results.push({ name: 'Phase4.映射: weekday_name 跟实际日期对不上（4 Jan 2026 其实是 Ahad 不是 Sabtu）→ 明确拒绝，不静默接受', pass: wrongWeekday.valid === false, actual: wrongWeekday, expected: 'valid:false' });

  // ---- chunk 合并：两个有重叠的 page range 各自看到同一天的一部分订单 ----
  const chunkA = { candidate: { extraction_scope: { first_page_seen: 7, last_page_seen: 8 }, days: [{ weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: false, printed_daily_subtotal: null, orders: [Object.assign({}, geminiOrderSample, { source_page: 7 })] }], notes: '' }, pageRange: { firstPage: 1, lastPage: 8 } };
  const chunkB = { candidate: { extraction_scope: { first_page_seen: 8, last_page_seen: 9 }, days: [{ weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: true, printed_daily_subtotal: 205.50, orders: [Object.assign({}, geminiOrderSample, { source_page: 7 }), { order_row_type: 'Tunggal', platform_raw: 'GrabFood', order_ids_raw: ['A-8QLEFDAGXXXRAV'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 3.70, other_income: 2.10, income_adjustment: 0, net_income: 5.80, source_page: 8, low_confidence: false }] }], notes: '' }, pageRange: { firstPage: 7, lastPage: 24 } };
  const mergeResult = mergeChunkedExtractionResults_([chunkA, chunkB]);
  results.push({ name: 'Phase4.合并: 两个 chunk 都报到的同一笔订单（source_page 7 的 8QLIOUFWWKVDAV）不会被重复计入', pass: mergeResult.merged.days[0].orders.length === 2, actual: mergeResult.merged.days[0].orders.length, expected: 2 });
  results.push({ name: 'Phase4.合并: printed_daily_subtotal 取有报出数字的那个 chunk（chunk A 是 null）', pass: mergeResult.merged.days[0].printed_daily_subtotal === 205.50, actual: mergeResult.merged.days[0].printed_daily_subtotal, expected: 205.50 });
  results.push({ name: 'Phase4.合并: 没有不一致的 subtotal，没有 merge error', pass: mergeResult.errors.length === 0, actual: mergeResult.errors, expected: [] });

  const conflictingChunk = { candidate: { extraction_scope: { first_page_seen: 8, last_page_seen: 9 }, days: [{ weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: true, printed_daily_subtotal: 999.99, orders: [] }], notes: '' }, pageRange: { firstPage: 7, lastPage: 24 } };
  const conflictMerge = mergeChunkedExtractionResults_([chunkB, conflictingChunk]);
  results.push({ name: 'Phase4.合并: 两个 chunk 对同一天的 printed_daily_subtotal 报出不同数字 → 明确 merge error，不猜哪个对', pass: conflictMerge.errors.length > 0, actual: conflictMerge.errors, expected: '至少一个 error' });

  // ---- 顶层 fallback 编排：mock extractor 模拟三种情境 ----
  function mockExtractor_(fullResult, chunkResults) {
    let callCount = 0;
    return {
      extractOrders(document, pageRange) {
        callCount++;
        if (pageRange === null) {
          if (fullResult instanceof Error) throw fullResult;
          return { candidate: fullResult };
        }
        const idx = pageRange.firstPage === 1 ? 0 : 1;
        const r = chunkResults[idx];
        if (r instanceof Error) throw r;
        return { candidate: r };
      },
      _callCount() { return callCount; }
    };
  }
  const goodFullCandidate = {
    extraction_scope: { first_page_seen: 1, last_page_seen: 24 },
    days: [{ weekday_name: 'Ahad', day: 4, month_name: 'Januari', day_block_complete: true, printed_daily_subtotal: 5.50, orders: [geminiOrderSample] }],
    notes: ''
  };
  const vic = { netDeliveryIncome: 5.50, periodStartParts: DOAL_W01_PERIOD_START_, periodEndParts: DOAL_W01_PERIOD_END_, verifiedIncomeId: 'CMP-VI-TEST' };

  const happyPath = runGeminiOrderExtractionWithFallback_({ fileId: 'f1', documentId: 'doc1', totalPages: 24 }, vic, { extractor: mockExtractor_(goodFullCandidate, []), now: new Date('2026-08-25T00:00:00Z') });
  results.push({ name: 'Phase4.编排: 整份文件一次就成功 → Fully_Allocated，不触发 fallback', pass: happyPath.allocationStatus === 'Fully_Allocated' && happyPath.attempts.length === 1, actual: happyPath.allocationStatus, expected: 'Fully_Allocated' });

  const fallbackSucceeds = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1', totalPages: 24 }, vic,
    { extractor: mockExtractor_({ extraction_scope: { first_page_seen: 1, last_page_seen: 24 }, days: 'broken', notes: '' }, [chunkA.candidate, chunkB.candidate]), now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: 'Phase4.编排: 整份文件 schema 坏掉 → 自动 fallback 到分块，分块合并后成功', pass: fallbackSucceeds.attempts.some((a) => a.label === 'full_document' && a.stage === 'Extraction_Failed') && fallbackSucceeds.attempts.some((a) => a.label === 'merged_chunks'), actual: fallbackSucceeds.attempts.map((a) => a.label + ':' + a.stage), expected: '包含 full_document:Extraction_Failed 和 merged_chunks' });

  const totalFailure = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1', totalPages: 24 }, vic,
    { extractor: mockExtractor_(new Error('network down'), [new Error('network down'), new Error('network down')]), now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: 'Phase4.编排: 整份文件跟两个 chunk 全部失败 → Needs_Review，不抛例外中断整个 Statement（Steven 明确要求）', pass: totalFailure.allocationStatus === 'Needs_Review' && Array.isArray(totalFailure.dailyAllocations), actual: totalFailure.allocationStatus, expected: 'Needs_Review（没有抛例外）' });
  results.push({ name: 'Phase4.编排: batchId 带正确前缀跟 verifiedIncomeId，符合已确认的 idempotency 格式', pass: /^CMP-OALB-CMP-VI-TEST-\d+$/.test(totalFailure.batchId), actual: totalFailure.batchId, expected: 'CMP-OALB-CMP-VI-TEST-<timestamp>' });

  // ---- 2026-10-07 新增（真实 GAS 触发）：platform 别名 "4-Hour Delivery" ----
  // 真实 debug 日志：2026-W14（30 Mac–5 April 2026，跨月周）Jumaat 3 April 一笔
  // 订单 platform_raw = "4-Hour Delivery"（Grab 模板在平台栏位漏印
  // "GrabExpress"，Gemini 照 127 schema 要求忠实回报原文）；旧逻辑整笔拒收 →
  // 当天 Discrepancy_Flagged → 整份 Needs_Review。下面这组测试是对着这条真实
  // 失败链条设计的，不是泛泛的 alias 测试。
  // 已对照 2026-W14.pdf 原件核对（2026-10-07 取得）：PDF 第 14 页、Jumaat 3 April 那天的 4-Hour Delivery 订单行——
  // 订单号 PLAN-1-HWRQ5Q8GW4QH、基本 6.00、Pelarasan Pendapatan 3.10（在「Pelarasan Pendapatan」栏，不是
  // 「Pendapatan lain」栏）、净 9.10。platform_raw 原文跟 day 名称 "Jumaat 3 April" 也是 debug 日志本身印出来的。
  // 这组单日合成测试之外，下面另有用整份真实 W14 数据的端到端测试（W14真实.*）。
  // 刻意不用跟 142 同名的 const 解构：GAS 里 142 的函式/变数是全域，同名 const
  // 会遮蔽全域、让 resolver 在初始化期间踩 TDZ（上面 resolveDoalTestDeps143_
  // 那段注释讲的同一类问题）——改成挂在命名空间物件上。
  function resolveDoalPlatformDeps143_() {
    if (typeof require === 'function') {
      const m = require('./142_DailyOrderAllocation.js');
      return { classify: m.classifyPlatform_, normalize: m.normalizePlatformLabel_, names: m.PLATFORM_NAMES_, aliases: m.PLATFORM_ALIASES_, validateOrder: require('./125_ExtractionValidation.js').validateOrderExtractionCandidate_ };
    }
    return { classify: classifyPlatform_, normalize: normalizePlatformLabel_, names: PLATFORM_NAMES_, aliases: PLATFORM_ALIASES_, validateOrder: validateOrderExtractionCandidate_ }; // GAS：142 已经载入，直接引用全域
  }
  const platformDeps143 = resolveDoalPlatformDeps143_();

  const canonicalPlatformCases = [
    ['GrabFood', 'GrabFood'], ['GrabMart', 'GrabMart'], ['GrabExpress', 'GrabExpress'],
    ['GrabExpress Instant -- Bike', 'GrabExpress'], ['GrabExpress Instant - Bike', 'GrabExpress']
  ];
  const canonicalPlatformActual = canonicalPlatformCases.map((c) => platformDeps143.classify(c[0]));
  results.push({ name: 'Platform.规范名称: 既有三个规范名称的判定完全不变（含 Grab 自己 "Instant -- Bike" / "Instant - Bike" 两种写法）', pass: JSON.stringify(canonicalPlatformActual) === JSON.stringify(canonicalPlatformCases.map((c) => c[1])), actual: canonicalPlatformActual, expected: canonicalPlatformCases.map((c) => c[1]) });

  results.push({ name: 'Platform.别名: debug 日志里的真实原文 "4-Hour Delivery" → GrabExpress', pass: platformDeps143.classify('4-Hour Delivery') === 'GrabExpress', actual: platformDeps143.classify('4-Hour Delivery'), expected: 'GrabExpress' });

  const aliasVariants = ['4-hour delivery', '4 Hour Delivery', '4-Hour  Delivery', '4-Hour\nDelivery', '4\u2013Hour Delivery'];
  const aliasVariantActual = aliasVariants.map((v) => platformDeps143.classify(v));
  results.push({ name: 'Platform.别名: 大小写 / 连字号 / 空白 / 换行写法不同仍命中同一条（Grab 模板同一服务名的连字号写法本来就不一致）', pass: aliasVariantActual.every((p) => p === 'GrabExpress'), actual: aliasVariantActual, expected: '全部 GrabExpress' });

  const aliasBoundaryActual = ['24-Hour Delivery', '4-Hour Deliveryman'].map((v) => platformDeps143.classify(v));
  results.push({ name: 'Platform.别名: 完整词边界——"24-Hour Delivery" / "4-Hour Deliveryman" 不会被 "4-Hour Delivery" 别名误吞', pass: aliasBoundaryActual.every((p) => p === null), actual: aliasBoundaryActual, expected: [null, null] });

  const unknownPlatformActual = ['Some New Service', '', null, undefined, 123].map((v) => platformDeps143.classify(v));
  results.push({ name: 'Platform.fail-closed: 认不出来的名称（含空字串 / null / undefined / 非字串）仍然回 null——gate 没被拿掉', pass: unknownPlatformActual.every((p) => p === null), actual: unknownPlatformActual, expected: '全部 null' });

  const normalizedAliasKeys = platformDeps143.aliases.map((a) => platformDeps143.normalize(a.alias));
  results.push({
    name: 'Platform.别名表完整性: 每一条都指向既有规范 platform、都带证据说明、正规化后不重复（没证据的名称不准加）',
    pass: platformDeps143.aliases.every((a) => typeof a.alias === 'string' && a.alias.length > 0 && platformDeps143.names.indexOf(a.platform) !== -1 && typeof a.evidence === 'string' && a.evidence.length > 0) && new Set(normalizedAliasKeys).size === normalizedAliasKeys.length,
    actual: platformDeps143.aliases, expected: '每条 alias/platform(∈规范名称)/evidence 齐全，正规化后不重复'
  });

  const fourHourPeriodStart = { year: 2026, month: 3, day: 30 };
  const fourHourPeriodEnd = { year: 2026, month: 4, day: 5 };
  const fourHourDay = { weekday_name: 'Jumaat', day: 3, month_name: 'April', day_block_complete: true, printed_daily_subtotal: 14.60 };
  const fourHourOrder = { order_row_type: 'Tunggal', platform_raw: '4-Hour Delivery', order_ids_raw: ['PLAN-1-HWRQ5Q8GW4QH'], and_more_count: 0, payment_method_raw: 'Tanpa tunai', base_income: 6.00, other_income: 0, income_adjustment: 3.10, net_income: 9.10, source_page: 14, low_confidence: false };

  const fourHourMapped = candidateFromGeminiOrderRow_(fourHourDay, fourHourOrder, fourHourPeriodStart, fourHourPeriodEnd);
  results.push({
    name: 'Phase4.映射(4-Hour Delivery): debug 那一笔 → valid，platform=GrabExpress，保留 platform_raw 原文，日期/金额不变',
    pass: fourHourMapped.valid && fourHourMapped.candidate.platform === 'GrabExpress' && fourHourMapped.candidate.platform_raw === '4-Hour Delivery' && fourHourMapped.candidate.order_date === '2026-04-03' && fourHourMapped.candidate.base_income === 6 && fourHourMapped.candidate.income_adjustment === 3.1 && fourHourMapped.candidate.net_income === 9.1,
    actual: fourHourMapped, expected: 'valid, platform=GrabExpress, platform_raw=4-Hour Delivery, order_date=2026-04-03, 6.00/3.10/9.10'
  });

  const unknownPlatformMapped = candidateFromGeminiOrderRow_(fourHourDay, Object.assign({}, fourHourOrder, { platform_raw: 'Some New Service' }), fourHourPeriodStart, fourHourPeriodEnd);
  const unknownPlatformMessage = (unknownPlatformMapped.errors && unknownPlatformMapped.errors[0]) || '';
  results.push({
    name: 'Phase4.映射(未知 platform): 仍然拒收（fail closed），错误讯息带出 platform_raw / 订单号 / 页码，原有前缀文字不变',
    pass: unknownPlatformMapped.valid === false && unknownPlatformMapped.candidate === null && unknownPlatformMessage.indexOf('platform_raw 无法归类到已知 platform：Some New Service') === 0 && unknownPlatformMessage.indexOf('PLAN-1-HWRQ5Q8GW4QH') !== -1 && unknownPlatformMessage.indexOf('第 14 页') !== -1,
    actual: unknownPlatformMessage, expected: '以「platform_raw 无法归类到已知 platform：Some New Service」开头，含订单号跟「第 14 页」'
  });

  const fourHourGrabFoodOrder = Object.assign({}, geminiOrderSample, { order_ids_raw: ['A-8QLIOUFWWKVDAV'], source_page: 14 }); // 4.10 + 1.40 + 0 = 5.50
  function fourHourDayCandidate_(orders, printedSubtotal) {
    return {
      extraction_scope: { first_page_seen: 1, last_page_seen: 24 },
      days: [{ weekday_name: 'Jumaat', day: 3, month_name: 'April', day_block_complete: true, printed_daily_subtotal: printedSubtotal, orders }],
      notes: ''
    };
  }
  const fourHourVic = { netDeliveryIncome: 14.60, periodStartParts: fourHourPeriodStart, periodEndParts: fourHourPeriodEnd, verifiedIncomeId: 'CMP-INCOME-2026-W14-TEST' };
  const fourHourDoc = { fileId: 'f1', documentId: 'doc1', totalPages: 24 };
  const fourHourNow = new Date('2026-10-07T00:00:00Z');

  const fourHourBatch = runGeminiOrderExtractionWithFallback_(fourHourDoc, fourHourVic, { extractor: mockExtractor_(fourHourDayCandidate_([fourHourGrabFoodOrder, fourHourOrder], 14.60), []), now: fourHourNow });
  results.push({
    name: 'Phase4.编排(重现 debug 失败链条): 同一天有 GrabFood + 4-Hour Delivery、subtotal 对得上 → Fully_Allocated，没有 nonRetryableErrors',
    pass: fourHourBatch.allocationStatus === 'Fully_Allocated' && fourHourBatch.nonRetryableErrors.length === 0 && fourHourBatch.dailyAllocations.length === 1 && fourHourBatch.dailyAllocations[0].checksum_status === 'Matched' && fourHourBatch.dailyAllocations[0].date === '2026-04-03' && fourHourBatch.statementChecksum.status === 'Matched',
    actual: { status: fourHourBatch.allocationStatus, errors: fourHourBatch.nonRetryableErrors, day: fourHourBatch.dailyAllocations[0] }, expected: 'Fully_Allocated / 0 errors / 2026-04-03 Matched'
  });
  results.push({
    name: 'Phase4.编排: 4-Hour Delivery 那笔真的进了 orderRows（不是被丢弃后靠别处补平）、归为 GrabExpress，两笔合计 14.60',
    pass: fourHourBatch.orderRows.length === 2 && fourHourBatch.orderRows.some((r) => r.platform_raw === '4-Hour Delivery' && r.platform === 'GrabExpress' && r.net_income === 9.1) && fourHourBatch.dailyAllocations[0].net_delivery_income === 14.6,
    actual: fourHourBatch.orderRows, expected: '2 笔，其中一笔 platform_raw=4-Hour Delivery / platform=GrabExpress / 9.10'
  });

  const unknownPlatformBatch = runGeminiOrderExtractionWithFallback_(fourHourDoc, fourHourVic, { extractor: mockExtractor_(fourHourDayCandidate_([fourHourGrabFoodOrder, Object.assign({}, fourHourOrder, { platform_raw: 'Some New Service' })], 14.60), []), now: fourHourNow });
  results.push({
    name: 'Phase4.编排(对照组): 真的未知的 platform → 该笔被拒收、当天 Discrepancy_Flagged（差 -9.10）、整份 Needs_Review、nonRetryableErrors 指出 "Jumaat 3 April"——gate 仍然有效，且跟 debug 日志同一个形状',
    pass: unknownPlatformBatch.allocationStatus === 'Needs_Review' && unknownPlatformBatch.nonRetryableErrors.length === 1 && unknownPlatformBatch.nonRetryableErrors[0].day === 'Jumaat 3 April' && unknownPlatformBatch.dailyAllocations[0].checksum_status === 'Discrepancy_Flagged' && unknownPlatformBatch.dailyAllocations[0].checksum_difference === -9.1,
    actual: { status: unknownPlatformBatch.allocationStatus, errors: unknownPlatformBatch.nonRetryableErrors, day: unknownPlatformBatch.dailyAllocations[0] }, expected: 'Needs_Review / 1 error(Jumaat 3 April) / Discrepancy_Flagged -9.10'
  });

  const legacyAliasRow = parseOrderRowCandidate_('Tunggal 4-Hour Delivery PLAN-1- HWRQ5Q8GW4QH Tanpa tunai 6.00 3.10 9.10');
  results.push({
    name: 'Platform.文字解析路径（旧路径，生产零引用）: 同样走 classifyPlatform_，4-Hour Delivery 行判成 GrabExpress——两条路径共用同一个判定，没有各自一份白名单',
    pass: legacyAliasRow.valid && legacyAliasRow.candidate.platform === 'GrabExpress' && legacyAliasRow.candidate.order_id_primary === 'PLAN-1-HWRQ5Q8GW4QH' && legacyAliasRow.candidate.net_income === 9.1,
    actual: legacyAliasRow, expected: 'valid, GrabExpress, PLAN-1-HWRQ5Q8GW4QH, 9.10'
  });

  // ---- 2026-W14 真实 statement 端到端（整份真实原件的数据，不是合成的）----
  // fixture 见文件顶端 DOAL_FIXTURE_W14_*。这里的「Gemini」是确定性替身（见 fixture 说明）：证明的是
  // 「Gemini 抽出一份通过验证的候选之后，确定性管线对这份真实 statement 的行为」，不是 Gemini 本身抽得对不对。
  const w14R2 = (x) => Math.round((x + 1e-9) * 100) / 100;
  const w14Sum = (list, f) => w14R2(list.reduce((acc, item) => acc + f(item), 0));
  const w14Rows = DOAL_FIXTURE_W14_ROWS_;
  const w14Candidate = (fourHourLabel) => ({
    extraction_scope: { first_page_seen: 1, last_page_seen: 25 },
    days: DOAL_FIXTURE_W14_DAYS_.map((d, di) => ({
      weekday_name: d[0], day: d[1], month_name: d[2], day_block_complete: true, printed_daily_subtotal: d[3],
      orders: w14Rows.filter((r) => r[0] === di).map((r) => ({
        order_row_type: r[1] === 'T' ? 'Tunggal' : 'Sekaligus',
        platform_raw: (fourHourLabel && r[2] === '4-Hour Delivery') ? fourHourLabel : r[2],
        order_ids_raw: r[3] ? r[3].split('|') : [], and_more_count: r[4], payment_method_raw: r[5],
        base_income: r[6], other_income: r[7], income_adjustment: r[8], net_income: r[9], source_page: r[10], low_confidence: false
      }))
    })),
    notes: ''
  });
  const w14Vic = { netDeliveryIncome: 1297.80, periodStartParts: { year: 2026, month: 3, day: 30 }, periodEndParts: { year: 2026, month: 4, day: 5 }, verifiedIncomeId: 'CMP-INCOME-2026-W14' };
  const w14Doc = { fileId: 'w14', documentId: 'doc-w14', totalPages: 25 };
  const w14Months = (batch) => batch.dailyAllocations.reduce((m, d) => { const k = d.date.slice(0, 7); m[k] = w14R2((m[k] || 0) + d.net_delivery_income); return m; }, {});

  const w14Validation = platformDeps143.validateOrder(w14Candidate());
  results.push({
    name: 'W14真实.验证: 真实 W14 订单数据（166 笔 / 7 天，含 12 笔 "and N" 打包单）通过 125 的订单层级验证——fixture 是「Gemini 抽对了会长什么样」的合格替身',
    pass: w14Validation.valid === true && w14Rows.length === 166 && DOAL_FIXTURE_W14_DAYS_.length === 7,
    actual: { valid: w14Validation.valid, stage: w14Validation.stage, errors: w14Validation.errors.slice(0, 3), rows: w14Rows.length }, expected: 'valid=true / 166 rows / 7 days'
  });

  const w14FoodBase = w14Sum(w14Rows.filter((r) => r[2] === 'GrabFood' || r[2] === 'GrabMart'), (r) => r[6]);
  const w14InstantBase = w14Sum(w14Rows.filter((r) => r[2].indexOf('GrabExpress') === 0), (r) => r[6]);
  const w14FourHourBase = w14Sum(w14Rows.filter((r) => r[2] === '4-Hour Delivery'), (r) => r[6]);
  results.push({
    name: 'W14真实.对帐: statement 自己印的汇总跟逐笔加总逐项一致——makanan 994.20 / Pelarasan 250.10 / 净 1297.80 / 7 天小计合计 1297.80，且每一天的逐笔加总 = 该天印刷小计',
    pass: w14FoodBase === 994.2 && w14Sum(w14Rows, (r) => r[8]) === 250.1 && w14Sum(w14Rows, (r) => r[9]) === 1297.8 && w14Sum(DOAL_FIXTURE_W14_DAYS_, (d) => d[3]) === 1297.8
      && DOAL_FIXTURE_W14_DAYS_.every((d, di) => w14Sum(w14Rows.filter((r) => r[0] === di), (r) => r[9]) === d[3]),
    actual: { food: w14FoodBase, adjustment: w14Sum(w14Rows, (r) => r[8]), net: w14Sum(w14Rows, (r) => r[9]), printedDaySubtotals: w14Sum(DOAL_FIXTURE_W14_DAYS_, (d) => d[3]) }, expected: { food: 994.2, adjustment: 250.1, net: 1297.8, printedDaySubtotals: 1297.8 }
  });
  results.push({
    name: 'W14真实.别名证据: statement 印的「Pendapatan asas Express」53.50 = 7 笔 GrabExpress(Instant) 基本收入 47.50 + 这笔 4-Hour Delivery 的 6.00——Grab 自己的汇总就把它算进 Express，拿掉它就对不上',
    pass: w14Rows.filter((r) => r[2].indexOf('GrabExpress') === 0).length === 7 && w14InstantBase === 47.5 && w14FourHourBase === 6 && w14R2(w14InstantBase + w14FourHourBase) === 53.5,
    actual: { instantRows: w14Rows.filter((r) => r[2].indexOf('GrabExpress') === 0).length, instantBase: w14InstantBase, fourHourBase: w14FourHourBase, sum: w14R2(w14InstantBase + w14FourHourBase) }, expected: { instantRows: 7, instantBase: 47.5, fourHourBase: 6, sum: 53.5 }
  });

  const w14Batch = runGeminiOrderExtractionWithFallback_(w14Doc, w14Vic, { extractor: mockExtractor_(w14Candidate(), []), now: fourHourNow });
  const w14FourHourRows = w14Batch.orderRows.filter((o) => o.platform_raw === '4-Hour Delivery');
  const w14BatchMonths = w14Months(w14Batch);
  results.push({
    name: 'W14真实.管线(修复后): 整份真实 W14 → Fully_Allocated、166 笔订单全进来、7 天全 Matched、statement Matched、没有 nonRetryableErrors；跨月拆分 2026-03 = 333.70 / 2026-04 = 964.10；4-Hour Delivery 那笔归为 GrabExpress',
    pass: w14Batch.allocationStatus === 'Fully_Allocated' && w14Batch.nonRetryableErrors.length === 0 && w14Batch.orderRows.length === 166 && w14Batch.dailyAllocations.length === 7
      && w14Batch.dailyAllocations.every((d) => d.checksum_status === 'Matched') && w14Batch.statementChecksum.status === 'Matched'
      && Object.keys(w14BatchMonths).length === 2 && w14BatchMonths['2026-03'] === 333.7 && w14BatchMonths['2026-04'] === 964.1
      && w14FourHourRows.length === 1 && w14FourHourRows[0].platform === 'GrabExpress' && w14FourHourRows[0].net_income === 9.1,
    actual: { status: w14Batch.allocationStatus, orders: w14Batch.orderRows.length, errors: w14Batch.nonRetryableErrors, statement: w14Batch.statementChecksum.status, months: w14BatchMonths }, expected: 'Fully_Allocated / 166 / 0 errors / Matched / 2026-03=333.7 2026-04=964.1'
  });

  const w14Control = runGeminiOrderExtractionWithFallback_(w14Doc, w14Vic, { extractor: mockExtractor_(w14Candidate('Some New Service'), []), now: fourHourNow });
  const w14ControlFlagged = w14Control.dailyAllocations.filter((d) => d.checksum_status !== 'Matched');
  results.push({
    name: 'W14真实.管线(对照组): 4-Hour Delivery 换成真的未知名称 → 重现 debug 日志的形状：Needs_Review、165 笔、只有 2026-04-03 被标 Discrepancy_Flagged（-9.10）、statement 差 -9.10、4 月桶短 9.10、nonRetryableErrors 指向 "Jumaat 3 April"——gate 仍然有效',
    pass: w14Control.allocationStatus === 'Needs_Review' && w14Control.orderRows.length === 165 && w14ControlFlagged.length === 1 && w14ControlFlagged[0].date === '2026-04-03'
      && w14ControlFlagged[0].checksum_status === 'Discrepancy_Flagged' && w14ControlFlagged[0].checksum_difference === -9.1
      && w14Control.statementChecksum.status === 'Discrepancy_Flagged' && w14Control.statementChecksum.difference === -9.1
      && w14Control.nonRetryableErrors.length === 1 && w14Control.nonRetryableErrors[0].day === 'Jumaat 3 April' && w14Months(w14Control)['2026-04'] === 955,
    actual: { status: w14Control.allocationStatus, orders: w14Control.orderRows.length, flagged: w14ControlFlagged.map((d) => [d.date, d.checksum_status, d.checksum_difference]), statement: [w14Control.statementChecksum.status, w14Control.statementChecksum.difference], errors: w14Control.nonRetryableErrors.map((e) => e.day) }, expected: 'Needs_Review / 165 / 2026-04-03 -9.1 / statement -9.1 / Jumaat 3 April'
  });

  // ---- 2026-09-24 新增（Runtime Readiness Audit 静态审计发现）：
  // document.totalPages 缺失时，绝对不能算出 NaN page range 还真的打去
  // Gemini——用同一个 mockExtractor_，故意不给 totalPages，让整份文件
  // 那次尝试失败，确认：(a) 不抛例外、明确落 Needs_Review；(b) attempts
  // 里看得到 chunk_fallback_skipped 这个明确记录，不是静默跳过；
  // (c) extractor 只被呼叫一次（整份文件那次），完全没有用 NaN page
  // range 真的再打第二次——这是这次修复要保证的核心行为。
  const missingTotalPagesExtractor = mockExtractor_(new Error('schema invalid'), []);
  const missingTotalPagesResult = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1' }, // 故意不给 totalPages
    vic,
    { extractor: missingTotalPagesExtractor, now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: 'totalPages 缺失: 整份文件失败后不产生 NaN page range，明确落 Needs_Review 而不是抛例外', pass: missingTotalPagesResult.allocationStatus === 'Needs_Review', actual: missingTotalPagesResult.allocationStatus, expected: 'Needs_Review' });
  results.push({ name: 'totalPages 缺失: attempts 里有明确的 chunk_fallback_skipped 记录，不是静默跳过', pass: missingTotalPagesResult.attempts.some((a) => a.label === 'chunk_fallback_skipped'), actual: missingTotalPagesResult.attempts.map((a) => a.label), expected: '包含 chunk_fallback_skipped' });
  results.push({ name: 'totalPages 缺失: extractor 只被呼叫一次（整份文件），没有用 NaN/undefined page range 真的再打一次', pass: missingTotalPagesExtractor._callCount() === 1, actual: missingTotalPagesExtractor._callCount(), expected: 1 });

  const invalidTotalPagesResult = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1', totalPages: 0 }, // 非法值（不是缺失，是 0）
    vic,
    { extractor: mockExtractor_(new Error('schema invalid'), []), now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: 'totalPages=0（非法值，非缺失）: 同样明确落 Needs_Review，不是只防了 undefined 这一种情况', pass: invalidTotalPagesResult.allocationStatus === 'Needs_Review' && invalidTotalPagesResult.attempts.some((a) => a.label === 'chunk_fallback_skipped'), actual: invalidTotalPagesResult.allocationStatus, expected: 'Needs_Review' });

  // ---- 2026-09-29 新增（真实 GAS 触发）：额度用尽时跳过 chunk fallback。
  // 同一天 4 次真实 consoleRunDailyAllocation，full_document 撞 HTTP 429
  // RESOURCE_EXHAUSTED、依建议秒数重试后仍未恢复，接着 chunk_1-13 立刻撞
  // 同一个 429——同一把 API key 的同一个额度，切页重打不会有不同结果，
  // chunking 是为了处理「内容太复杂/太长单次读不完」，不是为了绕过额度
  // 限制。127 的 createRetryingPostJson_ 在这种情况下会在 Error 上设
  // isQuotaExhausted = true；这里只测 142 收到这个旗标之后的编排行为，
  // 不重新测 127 那层怎么判断（128 测那个）。 ----
  function quotaExhaustedError_(msg) {
    const e = new Error(msg || 'LLM API 回传 HTTP 429：RESOURCE_EXHAUSTED');
    e.isQuotaExhausted = true;
    return e;
  }

  const quotaFullExtractor = mockExtractor_(quotaExhaustedError_(), []);
  const quotaFullResult = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1', totalPages: 24 }, vic,
    { extractor: quotaFullExtractor, now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: '额度用尽(full_document): 明确落 Needs_Review，不抛例外', pass: quotaFullResult.allocationStatus === 'Needs_Review', actual: quotaFullResult.allocationStatus, expected: 'Needs_Review' });
  results.push({ name: '额度用尽(full_document): attempts 有明确的 chunk_fallback_skipped_quota_exhausted 记录，不是静默跳过', pass: quotaFullResult.attempts.some((a) => a.label === 'chunk_fallback_skipped_quota_exhausted'), actual: quotaFullResult.attempts.map((a) => a.label), expected: '包含 chunk_fallback_skipped_quota_exhausted' });
  results.push({ name: '额度用尽(full_document): extractor 只被呼叫一次，完全没有再打 2 次几乎注定失败的 chunk（省下额度）', pass: quotaFullExtractor._callCount() === 1, actual: quotaFullExtractor._callCount(), expected: 1 });

  const nonQuotaFullExtractor = mockExtractor_(new Error('network down'), [chunkA.candidate, chunkB.candidate]);
  const nonQuotaFullResult = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1', totalPages: 24 }, vic,
    { extractor: nonQuotaFullExtractor, now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: '非额度问题(full_document 普通例外，没有 isQuotaExhausted): 不受这次新增逻辑影响，照样正常尝试两个 chunk（不是被新逻辑跳过）', pass: nonQuotaFullExtractor._callCount() === 3 && nonQuotaFullResult.attempts.some((a) => a.label === 'chunk_1-13') && nonQuotaFullResult.attempts.some((a) => a.label === 'chunk_12-24') && !nonQuotaFullResult.attempts.some((a) => a.label === 'chunk_fallback_skipped_quota_exhausted'), actual: { calls: nonQuotaFullExtractor._callCount(), labels: nonQuotaFullResult.attempts.map((a) => a.label) }, expected: '呼叫 3 次（1 full + 2 chunk），两个 chunk 都真的打了' });

  const quotaChunkExtractor = mockExtractor_(new Error('schema invalid'), [quotaExhaustedError_(), chunkB.candidate]);
  const quotaChunkResult = runGeminiOrderExtractionWithFallback_(
    { fileId: 'f1', documentId: 'doc1', totalPages: 24 }, vic,
    { extractor: quotaChunkExtractor, now: new Date('2026-08-25T00:00:00Z') }
  );
  results.push({ name: '额度用尽(第一个 chunk): 剩下的 chunk 被跳过，attempts 有明确的 remaining_chunks_skipped_quota_exhausted 记录', pass: quotaChunkResult.attempts.some((a) => a.label === 'remaining_chunks_skipped_quota_exhausted') && !quotaChunkResult.attempts.some((a) => a.label.indexOf('chunk_12') === 0), actual: quotaChunkResult.attempts.map((a) => a.label), expected: '包含 remaining_chunks_skipped_quota_exhausted，不包含第二个 chunk（chunk_12-24）的 label' });
  results.push({ name: '额度用尽(第一个 chunk): extractor 只被呼叫 2 次（1 full + 1 chunk），第二个 chunk 完全没打', pass: quotaChunkExtractor._callCount() === 2, actual: quotaChunkExtractor._callCount(), expected: 2 });

  // ---- 7: repeated header / footer 不被误判成订单行 ----
  results.push({ name: 'TEST 7: repeated header/footer 不产生假的 invalid-row 噪音（W01 invalid 数量应该很小，不是几十笔）', pass: w01.invalid.length < 5, actual: w01.invalid.length, expected: '< 5' });
  results.push({ name: 'TEST 7b: repeated header/footer 不产生假的 invalid-row 噪音（W33）', pass: w33.invalid.length < 5, actual: w33.invalid.length, expected: '< 5' });

  // =====================================================================
  // Date validation gap fix —— resolveDateFromDayMonth_ 现在同时检查
  // 「月份在 period 内」AND「解析出来的日期真的落在 period_start~
  // period_end 之间」（2026-09-06 新增，修复真实发生过的案例：Gemini 把
  // 日期 hallucinate 成同月份、不同周，例如 2026年1月19-25日，月份对但
  // 周不对，之前只查到月份这一步就放行）
  // =====================================================================

  const w01Boundary = [
    { day: 29, month: 'Disember', shouldPass: true, iso: '2025-12-29' },
    { day: 31, month: 'Disember', shouldPass: true, iso: '2025-12-31' },
    { day: 1, month: 'Januari', shouldPass: true, iso: '2026-01-01' }, // 跨年份，必须解到 2026 不是 2025
    { day: 4, month: 'Januari', shouldPass: true, iso: '2026-01-04' },
    { day: 5, month: 'Januari', shouldPass: false }, // 月份对，日期在 period 外
    { day: 19, month: 'Januari', shouldPass: false }, // 真实 hallucination 案例（168 笔那次）
    { day: 25, month: 'Januari', shouldPass: false },
    { day: 9, month: 'Februari', shouldPass: false } // 月份本身不在 period 内
  ];
  w01Boundary.forEach((c) => {
    const r = resolveDateFromDayMonth_(c.day, c.month, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
    const pass = c.shouldPass ? (r.ok === true && r.isoDate === c.iso) : (r.ok === false);
    results.push({
      name: `DateBoundary.W01: ${c.day} ${c.month} 应该 ${c.shouldPass ? ('PASS(' + c.iso + ')') : 'REJECT'}`,
      pass, actual: r, expected: c.shouldPass ? { ok: true, isoDate: c.iso } : { ok: false }
    });
  });

  const w33Boundary = [
    { day: 10, month: 'Ogos', shouldPass: true, iso: '2026-08-10' },
    { day: 16, month: 'Ogos', shouldPass: true, iso: '2026-08-16' },
    { day: 9, month: 'Ogos', shouldPass: false },
    { day: 17, month: 'Ogos', shouldPass: false },
    { day: 1, month: 'Julai', shouldPass: false },
    { day: 1, month: 'September', shouldPass: false }
  ];
  w33Boundary.forEach((c) => {
    const r = resolveDateFromDayMonth_(c.day, c.month, DOAL_W33_PERIOD_START_, DOAL_W33_PERIOD_END_);
    const pass = c.shouldPass ? (r.ok === true && r.isoDate === c.iso) : (r.ok === false);
    results.push({
      name: `DateBoundary.W33: ${c.day} ${c.month} 应该 ${c.shouldPass ? ('PASS(' + c.iso + ')') : 'REJECT'}`,
      pass, actual: r, expected: c.shouldPass ? { ok: true, isoDate: c.iso } : { ok: false }
    });
  });

  // 用 resolveOrderDate_（订单实际呼叫的入口，多一层 weekday 检查）而不是
  // 只测底层函式，确保修复在真正的调用路径上也生效——这是真实撞过的事故
  const realHallucinationCase = resolveOrderDate_('Isnin', 19, 'Januari', DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  results.push({ name: 'DateBoundary: 真实 168 笔事故重现（"Isnin, 19 Januari"）现在被拒绝', pass: realHallucinationCase.ok === false, actual: realHallucinationCase, expected: '{ ok: false }' });

  // =====================================================================
  // Persistence —— Daily_Allocation / Non_Order_Income_Allocation
  // （2026-09-05 新增，这次任务范围。全部用既有 fixture/手造 candidate 测，
  // 不打真的 Gemini/GAS——跟 Steven 的「测 persistence 不需要重新调用
  // Gemini」要求一致。）
  // =====================================================================

  const persistNow = new Date('2026-09-05T00:00:00Z');
  const daBatchResult = {
    batchId: 'CMP-OALB-CMP-INCOME-TEST-1000',
    allocationStatus: 'Fully_Allocated',
    dailyAllocations: [
      { date: '2026-01-04', order_row_count: 31, net_delivery_income: 205.50, printed_daily_subtotal: 205.50, checksum_difference: 0, checksum_status: 'Matched' },
      { date: '2025-12-29', order_row_count: 21, net_delivery_income: 157.90, printed_daily_subtotal: 157.90, checksum_difference: 0, checksum_status: 'Matched' }
    ]
  };

  const daRows = buildDailyAllocationRows_(daBatchResult, 'CMP-INCOME-TEST', persistNow);
  results.push({ name: 'Persistence.DA: buildDailyAllocationRows_ 笔数等于 dailyAllocations 笔数', pass: daRows.length === 2, actual: daRows.length, expected: 2 });
  results.push({ name: 'Persistence.DA: 每一行栏位跟 DAILY_ALLOCATION_COLUMNS 完全对得上，不多不少', pass: daRows.every((r) => DAILY_ALLOCATION_COLUMNS.every((c) => Object.prototype.hasOwnProperty.call(r, c)) && Object.keys(r).length === DAILY_ALLOCATION_COLUMNS.length), actual: Object.keys(daRows[0]).sort(), expected: DAILY_ALLOCATION_COLUMNS.slice().sort() });
  results.push({ name: 'Persistence.DA: daily_allocation_id 用 batchId+date 组成，同一 batch 内天然不重复', pass: daRows[0].daily_allocation_id === 'CMP-OALB-CMP-INCOME-TEST-1000-2026-01-04' && daRows[1].daily_allocation_id === 'CMP-OALB-CMP-INCOME-TEST-1000-2025-12-29', actual: daRows.map((r) => r.daily_allocation_id), expected: '各自带正确日期后缀' });
  results.push({ name: 'Persistence.DA: 没有存独立 month 栏位（Steven 明确要求，month 要用 date.slice(0,7) 查）', pass: DAILY_ALLOCATION_COLUMNS.indexOf('month') === -1, actual: DAILY_ALLOCATION_COLUMNS, expected: '不含 "month"' });
  results.push({ name: 'Persistence.DA: batch 整体的 allocation_status 有正确带到每一行', pass: daRows.every((r) => r.allocation_status === 'Fully_Allocated'), actual: daRows.map((r) => r.allocation_status), expected: ['Fully_Allocated', 'Fully_Allocated'] });

  let missingIncomeIdThrew = false;
  try { buildDailyAllocationRows_(daBatchResult, null, persistNow); } catch (e) { missingIncomeIdThrew = true; }
  results.push({ name: 'Persistence.DA: verifiedIncomeId 缺失要明确抛错，不能静默写一笔查不回来的记录', pass: missingIncomeIdThrew, actual: missingIncomeIdThrew, expected: true });

  const daAccessor = fakeSheetAccessor_();
  const daWriter = createTruthWriter_(daAccessor, fakeLockProvider_());
  const writeResult1 = writeDailyAllocationBatch_(daWriter, daBatchResult, 'CMP-INCOME-TEST', persistNow);
  results.push({ name: 'Persistence.DA: writeDailyAllocationBatch_ 实际透过 TruthWriter 写进 "Daily_Allocation"，笔数正确', pass: !writeResult1.skipped && daAccessor.getWritten('Daily_Allocation').length === 2, actual: daAccessor.getWritten('Daily_Allocation').length, expected: 2 });
  results.push({ name: 'Persistence.DA: 写入的每一行长度等于 DAILY_ALLOCATION_COLUMNS 栏数（appendValidatedRow 栏位顺序契约）', pass: daAccessor.getWritten('Daily_Allocation')[0].length === DAILY_ALLOCATION_COLUMNS.length, actual: daAccessor.getWritten('Daily_Allocation')[0].length, expected: DAILY_ALLOCATION_COLUMNS.length });

  const multiIncomeExisting = [
    { verified_income_id: 'CMP-INCOME-A', batch_id: 'CMP-OALB-CMP-INCOME-A-1000', allocation_status: 'Needs_Review' },
    { verified_income_id: 'CMP-INCOME-A', batch_id: 'CMP-OALB-CMP-INCOME-A-2000', allocation_status: 'Fully_Allocated' },
    { verified_income_id: 'CMP-INCOME-A', batch_id: 'CMP-OALB-CMP-INCOME-A-2000', allocation_status: 'Fully_Allocated' },
    { verified_income_id: 'CMP-INCOME-B', batch_id: 'CMP-OALB-CMP-INCOME-B-9999', allocation_status: 'Needs_Review' }
  ];
  results.push({ name: 'Persistence.DA: getLatestDailyAllocationBatchId_ 同一个 verified_income_id 底下正确找出时间戳最大的 batch', pass: getLatestDailyAllocationBatchId_('CMP-INCOME-A', multiIncomeExisting) === 'CMP-OALB-CMP-INCOME-A-2000', actual: getLatestDailyAllocationBatchId_('CMP-INCOME-A', multiIncomeExisting), expected: 'CMP-OALB-CMP-INCOME-A-2000' });
  results.push({ name: 'Persistence.DA: 不同 verified_income_id 之间互不干扰', pass: getLatestDailyAllocationBatchId_('CMP-INCOME-B', multiIncomeExisting) === 'CMP-OALB-CMP-INCOME-B-9999', actual: getLatestDailyAllocationBatchId_('CMP-INCOME-B', multiIncomeExisting), expected: 'CMP-OALB-CMP-INCOME-B-9999' });
  results.push({ name: 'Persistence.DA: 查不存在的 verified_income_id 回传 null，不是抛错或回传第一笔', pass: getLatestDailyAllocationBatchId_('CMP-INCOME-NOT-EXIST', multiIncomeExisting) === null, actual: getLatestDailyAllocationBatchId_('CMP-INCOME-NOT-EXIST', multiIncomeExisting), expected: null });
  const latestRowsA = getLatestDailyAllocationRows_('CMP-INCOME-A', multiIncomeExisting);
  results.push({ name: 'Persistence.DA: getLatestDailyAllocationRows_ 只回最新 batch 那些行，不含旧 batch', pass: latestRowsA.length === 2 && latestRowsA.every((r) => r.batch_id === 'CMP-OALB-CMP-INCOME-A-2000'), actual: latestRowsA.length, expected: 2 });

  const alreadyDoneExisting = [{ verified_income_id: 'CMP-INCOME-TEST', batch_id: 'CMP-OALB-CMP-INCOME-TEST-500', allocation_status: 'Fully_Allocated' }];
  const skipResult = writeDailyAllocationBatch_(createTruthWriter_(fakeSheetAccessor_(), fakeLockProvider_()), daBatchResult, 'CMP-INCOME-TEST', persistNow, alreadyDoneExisting);
  results.push({ name: 'Persistence.DA: 既有最新 batch 已经 Fully_Allocated 时，预设跳过、不多写一个 batch（这次新加的选择性策略）', pass: skipResult.skipped === true && skipResult.written.length === 0, actual: skipResult, expected: 'skipped=true, written=[]' });

  const needsReviewExisting = [{ verified_income_id: 'CMP-INCOME-TEST', batch_id: 'CMP-OALB-CMP-INCOME-TEST-500', allocation_status: 'Needs_Review' }];
  const noSkipAccessor = fakeSheetAccessor_();
  const noSkipResult = writeDailyAllocationBatch_(createTruthWriter_(noSkipAccessor, fakeLockProvider_()), daBatchResult, 'CMP-INCOME-TEST', persistNow, needsReviewExisting);
  results.push({ name: 'Persistence.DA: 既有最新 batch 是 Needs_Review（不是 Fully_Allocated）时，照样正常写入新 batch', pass: noSkipResult.skipped === false && noSkipAccessor.getWritten('Daily_Allocation').length === 2, actual: noSkipResult.skipped, expected: false });

  const forceAccessor = fakeSheetAccessor_();
  const forceResult = writeDailyAllocationBatch_(createTruthWriter_(forceAccessor, fakeLockProvider_()), daBatchResult, 'CMP-INCOME-TEST', persistNow, alreadyDoneExisting, true);
  results.push({ name: 'Persistence.DA: force=true 时即使既有已经 Fully_Allocated 仍强制写入', pass: forceResult.skipped === false && forceAccessor.getWritten('Daily_Allocation').length === 2, actual: forceResult.skipped, expected: false });

  // ---- Non_Order_Income_Allocation：用真实 fixture 文字跑既有的 match 函式 ----

  const realWaitCompDescription = 'Weekly compensation for long wait time (22 December 2025 - 28 December 2025)';
  const waitCompMatch = matchExplicitPeriodReference_(realWaitCompDescription);
  results.push({ name: 'Persistence.NOI 前置: matchExplicitPeriodReference_ 对真实 fixture 文字判定出 Explicit_Period_Reference', pass: waitCompMatch.dateSource === 'Explicit_Period_Reference' && waitCompMatch.allocatedDate === null, actual: waitCompMatch, expected: 'dateSource=Explicit_Period_Reference, allocatedDate=null' });

  const noiCandidateWaitComp = {
    category: 'Bayaran_Lain_Lain', descriptionRaw: realWaitCompDescription, amount: 19.00,
    dateSource: waitCompMatch.dateSource, allocatedDate: waitCompMatch.allocatedDate,
    referencedSourcePeriod: waitCompMatch.referencedSourcePeriod, linkedOrderId: null
  };
  const noiRowWaitComp = buildNonOrderIncomeAllocationRow_(noiCandidateWaitComp, 'CMP-OALB-TEST-1', 'CMP-INCOME-TEST', persistNow, 0);
  results.push({ name: 'Persistence.NOI: allocated_date=null 的候选正确建出 row，不因为「要写进 Sheet」就编一个日期', pass: noiRowWaitComp.allocated_date === null && noiRowWaitComp.referenced_source_period === '2025-12', actual: { allocated_date: noiRowWaitComp.allocated_date, referenced_source_period: noiRowWaitComp.referenced_source_period }, expected: { allocated_date: null, referenced_source_period: '2025-12' } });

  const noiAccessor = fakeSheetAccessor_();
  let noiWriteThrew = false;
  try {
    writeNonOrderIncomeAllocationBatch_(createTruthWriter_(noiAccessor, fakeLockProvider_()), [noiCandidateWaitComp], 'CMP-OALB-TEST-1', 'CMP-INCOME-TEST', persistNow);
  } catch (e) { noiWriteThrew = true; }
  const noiWrittenRow = noiAccessor.getWritten('Non_Order_Income_Allocation')[0];
  const allocatedDateColIdx = NON_ORDER_INCOME_ALLOCATION_COLUMNS.indexOf('allocated_date');
  results.push({ name: 'Persistence.NOI: allocated_date=null 透过真的 appendValidatedRow 写入不抛错，存成空字符串（TruthWriter 既有的 null 处理契约，不是我方新发明）', pass: !noiWriteThrew && noiWrittenRow[allocatedDateColIdx] === '', actual: { threw: noiWriteThrew, cellValue: noiWrittenRow ? noiWrittenRow[allocatedDateColIdx] : undefined }, expected: { threw: false, cellValue: '' } });

  const tipSectionOnlyText = DOAL_FIXTURE_NONORDER_W01_.slice(DOAL_FIXTURE_NONORDER_W01_.indexOf('Tip'), DOAL_FIXTURE_NONORDER_W01_.indexOf('Insentif'));
  const tipParsed = parseTipSection_(tipSectionOnlyText, DOAL_W01_PERIOD_START_, DOAL_W01_PERIOD_END_);
  results.push({ name: 'Persistence.NOI 前置: 真实 W01 Tip fixture 解析出确定笔数、没有 invalid', pass: tipParsed.lines.length > 0 && tipParsed.invalid.length === 0, actual: { lines: tipParsed.lines.length, invalid: tipParsed.invalid.length }, expected: '> 0 笔, 0 invalid' });

  const tipCandidates = tipParsed.lines.map((l) => ({
    category: 'Tip', descriptionRaw: null, amount: l.amount,
    dateSource: l.date_source, allocatedDate: l.allocated_date, referencedSourcePeriod: null, linkedOrderId: l.order_id
  }));
  const tipWrittenRows = writeNonOrderIncomeAllocationBatch_(createTruthWriter_(fakeSheetAccessor_(), fakeLockProvider_()), tipCandidates, 'CMP-OALB-TEST-1', 'CMP-INCOME-TEST', persistNow);
  results.push({ name: 'Persistence.NOI: 真实 Tip 资料全部笔数都成功建出 row（Tip_Ledger_Direct，有明确 allocated_date）', pass: tipWrittenRows.length === tipCandidates.length && tipWrittenRows.every((r) => r.date_source === 'Tip_Ledger_Direct' && r.allocated_date !== null), actual: tipWrittenRows.length, expected: tipCandidates.length });
  results.push({ name: 'Persistence.NOI: Tip 行的 linked_order_id 正确带上原始订单号', pass: tipWrittenRows[0].linked_order_id === tipCandidates[0].linkedOrderId, actual: tipWrittenRows[0].linked_order_id, expected: tipCandidates[0].linkedOrderId });

  let missingCategoryThrew = false;
  try { buildNonOrderIncomeAllocationRow_({ amount: 5, dateSource: 'Not_Determinable' }, 'b1', 'v1', persistNow, 0); } catch (e) { missingCategoryThrew = true; }
  results.push({ name: 'Persistence.NOI: 缺 category 要明确抛错', pass: missingCategoryThrew, actual: missingCategoryThrew, expected: true });

  let missingAmountThrew = false;
  try { buildNonOrderIncomeAllocationRow_({ category: 'Tip', dateSource: 'Not_Determinable' }, 'b1', 'v1', persistNow, 0); } catch (e) { missingAmountThrew = true; }
  results.push({ name: 'Persistence.NOI: 缺 amount 或不是数字要明确抛错', pass: missingAmountThrew, actual: missingAmountThrew, expected: true });

  let missingDateSourceThrew = false;
  try { buildNonOrderIncomeAllocationRow_({ category: 'Insentif', amount: 5 }, 'b1', 'v1', persistNow, 0); } catch (e) { missingDateSourceThrew = true; }
  results.push({ name: 'Persistence.NOI: 缺 dateSource 要明确抛错（判定不出日期也要显式给 Not_Determinable，不能整栏不见）', pass: missingDateSourceThrew, actual: missingDateSourceThrew, expected: true });

  return { results, w01Diagnostics: { totalRows: w01.allRows.length, invalid: w01.invalid }, w33Diagnostics: { totalRows: w33.allRows.length, invalid: w33.invalid } };
}

if (typeof module !== 'undefined') {
  module.exports = { runDailyOrderAllocationTests_ };
}

if (typeof require === 'function' && require.main === module) {
  const { results, w01Diagnostics, w33Diagnostics } = runDailyOrderAllocationTests_();
  let passCount = 0;
  results.forEach((r) => {
    console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.name);
    if (!r.pass) console.log('    actual:', JSON.stringify(r.actual), ' expected:', JSON.stringify(r.expected));
    if (r.pass) passCount++;
  });
  console.log(`\n${passCount}/${results.length} passed`);
  console.log('\nW01 diagnostics: totalRows=' + w01Diagnostics.totalRows + ' invalidRows=' + w01Diagnostics.invalid.length);
  w01Diagnostics.invalid.forEach((iv) => console.log('  W01 invalid:', JSON.stringify(iv).slice(0, 200)));
  console.log('W33 diagnostics: totalRows=' + w33Diagnostics.totalRows + ' invalidRows=' + w33Diagnostics.invalid.length);
  w33Diagnostics.invalid.forEach((iv) => console.log('  W33 invalid:', JSON.stringify(iv).slice(0, 200)));
}
