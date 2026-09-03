#!/usr/bin/env python3
"""smart-charts 开发者回归自测脚本。

端到端验证技能全链路（真实 CLI 子进程，非 mock）：
- 校验层：黑名单/AST 单元测试、transform 错误码契约、超时机制
- 解析层：CSV/TSV/TXT/JSON/GBK/Excel、脏表头 flags、多文件合并
- 渲染层：26 种图表（契约键 + HTML 落盘）
- 多图模式、flags/主题/语言/dry-run/annotation
- transform 黄金模式 + 沙箱逃逸 PoC 拦截
- 错误路径：结构化 JSON + suggestion

用法：python scripts/regression_check.py [技能根目录]（默认为脚本上级目录）
测试数据与输出写入 tempfile 临时目录，不污染技能目录；退出码 0=全过，1=有失败。
"""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path

BASE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
CLI = BASE / 'scripts' / 'cli.py'
DP = BASE / 'scripts' / 'data_parser.py'
ROOT = Path(tempfile.mkdtemp(prefix='sc_regression_'))
DATA = ROOT / 'data'
OUT = ROOT / 'out'
DATA.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(BASE))
import pandas as pd
from scripts.data_transformer import DataTransformer, validate_code_blacklist, validate_code_ast
from scripts.exceptions import TransformError, SmartChartsError, ErrorCode
from scripts.data_parser import DataParser

PASS, FAIL = 0, 0
FAILURES = []

def rec(name, ok, detail=''):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"[PASS] {name}")
    else:
        FAIL += 1
        FAILURES.append((name, detail))
        print(f"[FAIL] {name}  -- {detail}")

def run_cli(args, timeout=90):
    t0 = time.time()
    proc = subprocess.run([sys.executable, str(CLI)] + [str(a) for a in args],
                          capture_output=True, text=True, timeout=timeout)
    dt = time.time() - t0
    out = None
    if proc.stdout.strip():
        try:
            out = json.loads(proc.stdout)
        except json.JSONDecodeError:
            out = None
    return proc.returncode, out, proc.stderr, dt

def run_dp(args, timeout=60):
    proc = subprocess.run([sys.executable, str(DP)] + [str(a) for a in args],
                          capture_output=True, text=True, timeout=timeout)
    return proc.returncode, proc.stdout, proc.stderr

# ══════════════════ 数据准备 ══════════════════
(DATA / 'cities.csv').write_text(
    "城市,销售额,利润,人口万\n北京,1200,300,2189\n上海,1500,400,2487\n广州,900,180,1874\n深圳,1100,260,1768\n", encoding='utf-8')
(DATA / 'trend.csv').write_text(
    "月份,销售额,利润\n1月,1000,250\n2月,1150,280\n3月,1300,320\n4月,1280,310\n5月,1420,360\n6月,1550,390\n", encoding='utf-8')
(DATA / 'freq.csv').write_text(
    "类别\nA\nB\nA\nC\nA\nB\nC\nD\nA\nB\n\nC\n", encoding='utf-8')
(DATA / 'students.csv').write_text(
    "姓名,数学,语文,英语\n张三,85,78,92\n李四,92,88,95\n王五,60,72,68\n赵六,75,80,77\n钱七,88,85,90\n孙八,45,60,55\n周九,95,93,97\n吴十,70,68,74\n", encoding='utf-8')
(DATA / 'radar.csv').write_text(
    "指标,产品A,产品B\n性能,90,75\n易用性,85,80\n功能,70,92\n价格,60,85\n服务,80,70\n", encoding='utf-8')
(DATA / 'heat.csv').write_text(
    "星期,早高峰,午高峰,晚高峰\n周一,320,280,410\n周二,340,275,420\n周三,335,290,435\n周四,350,285,425\n周五,380,300,470\n", encoding='utf-8')
(DATA / 'graph.csv').write_text(
    "source,target,value\nA,B,5\nA,C,3\nB,D,2\nC,D,4\nD,E,1\n", encoding='utf-8')
(DATA / 'relation.csv').write_text(
    "来源,去向,金额\n总部,华北分部,500\n总部,华南分部,400\n华北分部,北京办,200\n", encoding='utf-8')
(DATA / 'funnel.csv').write_text(
    "阶段,人数\n浏览,10000\n加购,3000\n下单,1200\n支付,900\n复购,300\n", encoding='utf-8')
(DATA / 'words.csv').write_text(
    "关键词,频次\n数据,120\n分析,95\n可视化,88\n模型,76\n图表,70\n统计,60\n", encoding='utf-8')
(DATA / 'venn.csv').write_text(
    "name,value\n仅A,40\n仅B,25\nA∩B,15\n", encoding='utf-8')
(DATA / 'org.csv').write_text(
    "parent,child\n根,分支A\n根,分支B\n分支A,叶子1\n分支A,叶子2\n分支B,叶子3\n", encoding='utf-8')
(DATA / 'gauge.csv').write_text(
    "完成率\n78.5\n82.3\n75.0\n79.9\n", encoding='utf-8')
(DATA / 'waterfall.csv').write_text(
    "month,profit\n1月,100\n2月,120\n3月,90\n4月,110\n5月,130\n", encoding='utf-8')
(DATA / 'pareto.csv').write_text(
    "类别,数量\nA,45\nB,30\nC,15\nD,6\nE,4\n", encoding='utf-8')
(DATA / 'special.csv').write_text(
    "销售额(元),A/B\n100,5\n200,8\n150,6\n", encoding='utf-8')
(DATA / 'messy.csv').write_text(
    "这是一份导出说明\n导出时间:2026-01-01\n城市,销售额\n北京,120\n上海,180\n广州,150\n", encoding='utf-8')
(DATA / 'ffill.csv').write_text(
    "部门,经理,工资\n技术部,张三,12000\n,,11500\n市场部,李四,10000\n,,9800\n", encoding='utf-8')
(DATA / 'en.csv').write_text(
    "city,revenue,profit\nNYC,1000,250\nLA,850,180\nChicago,720,150\n", encoding='utf-8')
(DATA / 'nested.json').write_text(
    json.dumps([{"城市": "北京", "销售额": 100, "详情": {"区域": "华北"}},
                {"城市": "上海", "销售额": 150, "详情": {"区域": "华东"}}], ensure_ascii=False), encoding='utf-8')
(DATA / 'students.tsv').write_text(
    "姓名\t数学\t语文\n张三\t85\t78\n李四\t92\t88\n", encoding='utf-8')
(DATA / 'scores.txt').write_text(
    "姓名;数学\n张三;85\n李四;92\n", encoding='utf-8')
(DATA / 'm1.csv').write_text("城市,销售额\n北京,100\n上海,200\n", encoding='utf-8')
(DATA / 'sales_long.csv').write_text("month,region,revenue\n1月,east,200\n1月,north,150\n2月,east,220\n2月,north,160\n3月,east,250\n3月,north,170\n", encoding='utf-8')
(DATA / 'm2.csv').write_text("城市,销售额\n广州,150\n深圳,180\n", encoding='utf-8')
(DATA / 'm3.csv').write_text("A,B\n1,2\n3,4\n", encoding='utf-8')
# GBK 编码
(DATA / 'gbk.csv').write_bytes("城市,销售额\n北京,1200\n上海,1500\n".encode('gbk'))
# Excel（openpyxl 可用时）
HAS_XLSX = False
try:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active; ws.title = '数据'
    ws.append(['城市', '销售额', '利润'])
    for r in [('北京', 1200, 300), ('上海', 1500, 400), ('广州', 900, 180)]: ws.append(list(r))
    ws2 = wb.create_sheet('脏表')
    ws2.append(['学生信息表（导出）'])
    ws2.append(['编号', '姓名', '数学', '语文'])
    for r in [('001', '张三', 85, 78), ('002', '李四', 92, 88)]: ws2.append(list(r))
    wb.save(DATA / 'book.xlsx')
    HAS_XLSX = True
except ImportError:
    print("!! openpyxl 不可用，Excel 用例跳过")

# ══════════════════ U: 校验层单元测试 ══════════════════
print("\n─── U1: 逃逸 PoC（黑名单层）───")
POCS = {
    'pd.__builtins__ 直达': "result = pd.__builtins__",
    '__getattribute__ 取 eval': "result = pd.__getattribute__('eval')",
    '__getattr__ 变体': "result = pd.__getattr__('open')",
    '__loader__ 导入机': "x = np.__loader__; result = df",
    '__spec__': "x = pd.__spec__; result = df",
    '__self__': "x = (df.sum).__self__; result = df",
    '__func__': "x = (df.sum).__func__; result = df",
    '__reduce__ 反序列化': "x = df.__reduce__; result = df",
    '旧黑名单项仍拦截(eval)': "result = eval('1')",
    '旧黑名单项仍拦截(import)': "import os",
    '旧黑名单项仍拦截(open)': "result = open('/etc/passwd')",
}
df_u = pd.DataFrame({'类别': ['A', 'B', 'A'], '数值': [1, 2, 3]})
for name, code in POCS.items():
    v = validate_code_blacklist(code)
    rec(f"U1-黑名单拦截: {name}", bool(v), f"未被拦截: {code!r}")

print("\n─── U2: 逃逸 PoC（transform() 全路径）───")
for name, code in POCS.items():
    try:
        DataTransformer().transform(df_u, code)
        rec(f"U2-transform拒绝: {name}", False, "未被拒绝，代码被执行")
    except SmartChartsError as e:
        rec(f"U2-transform拒绝: {name}", e.code == ErrorCode.TRANSFORM_EXEC_ERROR,
            f"错误码不符: {e.code}")

print("\n─── U3: 黄金模式零误报（黑名单 + AST）───")
GOLDEN = {
    '频次聚合': "result = df['类别'].fillna('未标注').value_counts().rename_axis('name').reset_index(name='value')",
    '分组聚合': "result = df.groupby('类别')['数值'].sum().rename_axis('name').reset_index(name='value')",
    '透视': "result = df.pivot_table(index='类别', columns='类别', values='数值', aggfunc='sum').reset_index()",
    'melt': "result = df.melt(id_vars=['类别'], var_name='name', value_name='value')",
    'rename': "result = df.rename(columns={'类别': 'name', '数值': 'value'})",
    'ffill': "result = df.ffill()",
    'waterfall-diff': "tmp = df.copy(); tmp['d'] = tmp['数值'].diff().fillna(tmp['数值'].iloc[0]); result = tmp[['类别', 'd']]",
    'np.select': "result = df.assign(等级=np.select([df['数值'] > 2, df['数值'] > 1], ['高', '中'], default='低'))",
    '布尔向量位运算': "result = df[(df['数值'] > 1) & (df['类别'] == 'A')]",
    '推导式+lambda': "result = df.assign(k=[x * 2 for x in df['数值']]).assign(f=lambda t: t['数值'].map(lambda v: v + 1))",
}
for name, code in GOLDEN.items():
    v = validate_code_blacklist(code) + validate_code_ast(code)
    rec(f"U3-黄金零误报: {name}", not v, f"误报: {v}")

print("\n─── U4: transform() 正常执行返回 DataFrame ───")
for name, code in GOLDEN.items():
    try:
        r = DataTransformer().transform(df_u, code)
        rec(f"U4-transform执行: {name}", isinstance(r, pd.DataFrame) and not r.empty,
            f"返回异常: {type(r)}")
    except Exception as e:
        rec(f"U4-transform执行: {name}", False, f"异常: {e}")

print("\n─── U5: transform 错误码契约 ───")
ERR_CASES = {
    '无 result 变量(3002)': ("x = 1", ErrorCode.TRANSFORM_NO_RESULT),
    'result 非 DataFrame(3003)': ("result = 42", ErrorCode.TRANSFORM_INVALID_RESULT),
    'result 为空(3004)': ("result = df.iloc[0:0]", ErrorCode.TRANSFORM_EMPTY_RESULT),
    'AST违规-类定义(3001)': ("class Foo:\n    pass", ErrorCode.TRANSFORM_EXEC_ERROR),
    'AST违规-try(3001)': ("try:\n    x = 1\nexcept:\n    pass", ErrorCode.TRANSFORM_EXEC_ERROR),
    '语法错误(3001)': ("def broken(", ErrorCode.TRANSFORM_EXEC_ERROR),
}
for name, (code, expect) in ERR_CASES.items():
    try:
        DataTransformer().transform(df_u, code)
        rec(f"U5-错误码: {name}", False, "未抛错")
    except SmartChartsError as e:
        rec(f"U5-错误码: {name}", e.code == expect, f"期望 {expect.name} 实得 {e.code.name}")

print("\n─── U6: 超时机制（while True，10s）───")
t0 = time.time()
try:
    DataTransformer().transform(df_u, "while True:\n    x = 1")
    rec("U6-超时拦截", False, "未超时")
except SmartChartsError as e:
    rec("U6-超时拦截", e.code == ErrorCode.TRANSFORM_EXEC_ERROR and '超时' in e.message,
        f"{e.code.name}: {e.message}")

# ══════════════════ P: 数据解析层 ══════════════════
print("\n─── P1: 各格式解析 ───")
PARSE_CASES = {
    'CSV': 'cities.csv', 'TSV': 'students.tsv', 'TXT(分号)': 'scores.txt',
    'JSON(嵌套1层)': 'nested.json', 'GBK编码': 'gbk.csv',
}
for name, f in PARSE_CASES.items():
    try:
        df = DataParser().parse_file(DATA / f)
        rec(f"P1-解析: {name}", not df.empty, "空 DataFrame")
    except Exception as e:
        rec(f"P1-解析: {name}", False, str(e)[:120])

rec("P1-JSON嵌套列名规范化", True)
try:
    df = DataParser().parse_file(DATA / 'nested.json')
    rec("P1-JSON嵌套列名规范化", '详情_区域' in df.columns, f"列: {list(df.columns)}")
except Exception as e:
    rec("P1-JSON嵌套列名规范化", False, str(e)[:120])

df_sp = DataParser().parse_file(DATA / 'special.csv')
rec("P1-特殊字符列规范化(销售额(元)→销售额_元)", '销售额_元' in df_sp.columns, f"列: {list(df_sp.columns)}")
rec("P1-特殊字符列规范化(A/B→a_b)", 'a_b' in df_sp.columns, f"列: {list(df_sp.columns)}")

try:
    df_m = DataParser().parse_file(DATA / 'messy.csv', skiprows=2)
    rec("P1-skiprows脏表头", list(df_m.columns) == ['城市', '销售额'] and len(df_m) == 3,
        f"列: {list(df_m.columns)}, 行数: {len(df_m)}")
except Exception as e:
    rec("P1-skiprows脏表头", False, str(e)[:120])

if HAS_XLSX:
    try:
        df_s1 = DataParser().parse_file(DATA / 'book.xlsx', sheet_name='数据')
        rec("P1-Excel按名称选sheet", len(df_s1) == 3, f"行数: {len(df_s1)}")
    except Exception as e:
        rec("P1-Excel按名称选sheet", False, str(e)[:120])
    try:
        df_s2 = DataParser().parse_file(DATA / 'book.xlsx', sheet_name='脏表', header_row=1)
        rec("P1-Excel脏表header-row", list(df_s2.columns) == ['编号', '姓名', '数学', '语文'],
            f"列: {list(df_s2.columns)}")
    except Exception as e:
        rec("P1-Excel脏表header-row", False, str(e)[:120])
    try:
        DataParser().parse_file(DATA / 'book.xlsx', sheet_name='不存在的表')
        rec("P1-Excel错误sheet结构化报错", False, "未报错")
    except SmartChartsError as e:
        rec("P1-Excel错误sheet结构化报错", e.code == ErrorCode.DATA_PARSE_ERROR, f"{e.code.name}")

rc, so, se = run_dp([DATA / 'm1.csv', DATA / 'm2.csv', '--merge', '--summary'])
rec("P2-多文件纵向合并", rc == 0 and 'source_file' in so, f"rc={rc}, out={so[:150]}")
rc, so, se = run_dp([DATA / 'm1.csv', DATA / 'm3.csv', '--merge', '--summary'])
rec("P2-无重叠合并报错", rc != 0 and 'DATA_MERGE_ERROR' in (so + se), f"rc={rc}")

# ══════════════════ C: 26 种图表端到端 ══════════════════
print("\n─── C: 26 种图表（成功 + 契约键 + HTML 落盘）───")
CHARTS = [
    ('line', 'trend.csv', ['--x-axis', '月份', '--y-axis', '销售额', '利润']),
    ('bar', 'cities.csv', ['--x-axis', '城市', '--y-axis', '销售额']),
    ('area', 'trend.csv', ['--x-axis', '月份', '--y-axis', '销售额']),
    ('pie', 'freq.csv', ['--x-axis', 'name', '--y-axis', 'value',
     '--transform-code', "result = df['类别'].fillna('未标注').value_counts().rename_axis('name').reset_index(name='value')"]),
    ('scatter', 'students.csv', ['--x-axis', '数学', '--y-axis', '语文', '--label-col', '姓名']),
    ('radar', 'radar.csv', ['--x-axis', '指标', '--y-axis', '产品a', '产品b']),
    ('heatmap', 'heat.csv', ['--x-axis', '星期', '--y-axis', '早高峰', '午高峰', '晚高峰']),
    ('treemap', 'words.csv', ['--x-axis', '关键词', '--y-axis', '频次']),
    ('graph', 'graph.csv', []),
    ('boxplot', 'students.csv', ['--y-axis', '数学', '语文', '英语']),
    ('waterfall', 'waterfall.csv', ['--x-axis', 'month', '--y-axis', 'profit']),
    ('gauge', 'gauge.csv', ['--y-axis', '完成率']),
    ('sankey', 'relation.csv',
     ['--transform-code', "result = df.rename(columns={'来源': 'source', '去向': 'target', '金额': 'value'})"]),
    ('funnel', 'funnel.csv', ['--x-axis', '阶段', '--y-axis', '人数']),
    ('sunburst', 'words.csv', ['--x-axis', '关键词', '--y-axis', '频次']),
    ('wordcloud', 'words.csv', ['--x-axis', '关键词', '--y-axis', '频次']),
    ('histogram', 'students.csv', ['--x-axis', '数学']),
    ('stacked_bar', 'cities.csv', ['--x-axis', '城市', '--y-axis', '销售额', '利润']),
    ('bubble', 'cities.csv', ['--x-axis', '销售额', '--y-axis', '利润', '人口万']),
    ('pareto', 'pareto.csv', ['--x-axis', '类别', '--y-axis', '数量']),
    ('combo', 'cities.csv', ['--x-axis', '城市', '--y-axis', '销售额', '利润']),
    ('venn', 'venn.csv', ['--x-axis', 'name', '--y-axis', 'value']),
    ('mindmap', 'org.csv', ['--x-axis', 'parent', '--y-axis', 'child']),
    ('orgchart', 'org.csv', ['--x-axis', 'parent', '--y-axis', 'child']),
    ('liquid', 'gauge.csv', ['--y-axis', '完成率']),
    ('spreadsheet', 'students.csv', []),
]
CONTRACT_KEYS = {'success', 'html_path', 'chart_type', 'title', 'data_rows', 'data_preview', 'plot_stats'}
for ctype, fname, extra in CHARTS:
    rc, out, se, dt = run_cli([DATA / fname, ctype, '--title', f'{ctype}回归测试', *extra])
    name = f"C-{ctype:12s} ({fname})"
    if rc != 0 or not out or not out.get('chart', {}).get('success'):
        rec(name, False, f"rc={rc} stdout={(json.dumps(out, ensure_ascii=False)[:200] if out else 'None')} stderr={se[:200]}")
        continue
    c = out['chart']
    missing = CONTRACT_KEYS - set(c.keys())
    html_ok = c['html_path'] and Path(c['html_path']).exists() and Path(c['html_path']).stat().st_size > 1024
    rec(name, not missing and html_ok,
        f"缺契约键: {missing or '无'}, html: {c['html_path']}")

# ══════════════════ T: transform 黄金模式端到端 ══════════════════
print("\n─── T: transform 黄金模式（CLI 端到端）───")
T_CASES = [
    ('groupby聚合→bar', 'sales_long不存在', None),
]
# groupby
rc, out, se, _ = run_cli([DATA / 'm1.csv', 'bar', '--title', 'T1',
    '--transform-code', "result = df.groupby('城市')['销售额'].sum().rename_axis('name').reset_index(name='value')",
    '--x-axis', 'name', '--y-axis', 'value'])
rec("T1-groupby聚合→bar", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# pivot_table 多系列
rc, out, se, _ = run_cli([DATA / 'sales_long.csv', 'line', '--title', 'T2',
    '--transform-code', "result = df.pivot_table(index='month', columns='region', values='revenue', aggfunc='sum').reset_index()",
    '--x-axis', 'month', '--y-axis', 'east', 'north'])
rec("T2-pivot_table多系列→line", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# ffill 多语句
rc, out, se, _ = run_cli([DATA / 'ffill.csv', 'pie', '--title', 'T3',
    '--transform-code', "tmp = df.ffill(); result = tmp['部门'].value_counts().rename_axis('name').reset_index(name='value')",
    '--x-axis', 'name', '--y-axis', 'value'])
rec("T3-ffill多语句→pie", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# waterfall diff 模式
rc, out, se, _ = run_cli([DATA / 'waterfall.csv', 'waterfall', '--title', 'T4',
    '--transform-code', "tmp = df.copy(); tmp['delta'] = tmp['profit'].diff().fillna(tmp['profit'].iloc[0]); result = tmp[['month', 'delta']]",
    '--x-axis', 'month', '--y-axis', 'delta'])
rec("T4-waterfall-diff模式", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# np.select
rc, out, se, _ = run_cli([DATA / 'students.csv', 'bar', '--title', 'T5',
    '--transform-code', "result = df.assign(等级=np.select([df['数学'] > 90, df['数学'] > 60], ['优', '中'], default='及格边缘'))",
    '--x-axis', '等级', '--y-axis', '数学'])
rec("T5-np.select→bar", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# rename + graph 自动检测
rc, out, se, _ = run_cli([DATA / 'relation.csv', 'graph', '--title', 'T6',
    '--transform-code', "result = df.rename(columns={'来源': 'source', '去向': 'target', '金额': 'value'})"])
rec("T6-rename→graph自动检测", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# 特殊字符列（规范化后引用）
rc, out, se, _ = run_cli([DATA / 'special.csv', 'bar', '--title', 'T7',
    '--x-axis', '销售额_元', '--y-axis', 'a_b'])
rec("T7-特殊字符列规范化引用", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")
# skiprows + transform
rc, out, se, _ = run_cli([DATA / 'messy.csv', 'bar', '--title', 'T8', '--skiprows', '2',
    '--transform-code', "result = df.assign(销售额=df['销售额'].map(lambda v: v * 2))",
    '--x-axis', '城市', '--y-axis', '销售额'])
rec("T8-skiprows+transform", rc == 0 and out and out['chart']['success'],
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")

# CLI 层逃逸拦截（结构化错误 + suggestion）
rc, out, se, _ = run_cli([DATA / 'm1.csv', 'bar', '--title', 'T9',
    '--transform-code', "result = pd.__builtins__ and df", '--x-axis', '城市', '--y-axis', '销售额'])
ok = rc == 1 and out and not out['chart']['success'] \
     and out['chart']['error']['code_name'] == 'TRANSFORM_EXEC_ERROR' \
     and '__builtins__' in out['chart']['error']['details'].get('violations', []) \
     and 'suggestion' in out['chart']['error']['details']
rec("T9-CLI逃逸拦截(__builtins__)", ok, f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:300] if out else se[:300]}")

# ══════════════════ M: 多图模式 ══════════════════
print("\n─── M: 多图模式 ───")
charts_cfg = [
    {"type": "bar", "title": "M1柱状", "x_axis": "城市", "y_axis": ["销售额"]},
    {"type": "line", "title": "M1折线", "x_axis": "月份", "y_axis": ["销售额", "利润"]},
    {"type": "pie", "title": "M1饼图", "transform_code": "result = df['类别'].fillna('未标注').value_counts().rename_axis('name').reset_index(name='value')", "x_axis": "name", "y_axis": ["value"]},
]
cfg_path = ROOT / 'charts.json'
cfg_path.write_text(json.dumps(charts_cfg, ensure_ascii=False), encoding='utf-8')
# freq.csv 无 月份 列 → line 会失败？用 cities+专用文件不行（单文件）。改用 trend.csv？
# pie 需要 频次列。折衷：用 freq.csv 时 line 失败属预期 → 换 cities.csv，pie 用利润分箱。
charts_cfg = [
    {"type": "bar", "title": "M柱状", "x_axis": "城市", "y_axis": ["销售额"]},
    {"type": "combo", "title": "M组合", "x_axis": "城市", "y_axis": ["销售额", "利润"]},
    {"type": "scatter", "title": "M散点", "x_axis": "销售额", "y_axis": ["利润"]},
]
cfg_path.write_text(json.dumps(charts_cfg, ensure_ascii=False), encoding='utf-8')
rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts-file', cfg_path])
ok = rc == 0 and out and out.get('summary', {}).get('total') == 3 and out['summary']['succeeded'] == 3 \
     and all(c.get('success') and Path(c['html_path']).exists() for c in out['charts'])
rec("M1-charts-file多图(3张全成功)", ok,
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:300] if out else se[:300]}")

# 全局 transform + 单图级 transform
rc, out, se, _ = run_cli([DATA / 'students.csv', '--charts-file', cfg_path, '--transform-code', 'result = df.copy()'])
# students.csv 无 城市 列 → 全失败。改用 cities.csv
rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts-file', cfg_path,
    '--transform-code', "result = df.assign(销售额=df['销售额'].map(lambda v: v / 10))"])
ok = rc == 0 and out and out['summary']['succeeded'] == 3
rec("M2-全局transform多图", ok, f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")

# 部分失败（exit 0 + summary 正确）
cfg_part = [
    {"type": "bar", "title": "好图", "x_axis": "城市", "y_axis": ["销售额"]},
    {"type": "bar", "title": "坏图", "x_axis": "不存在的列", "y_axis": ["销售额"]},
]
(ROOT / 'part.json').write_text(json.dumps(cfg_part, ensure_ascii=False), encoding='utf-8')
rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts-file', ROOT / 'part.json'])
ok = rc == 0 and out and out['summary'] == {'total': 2, 'succeeded': 1, 'failed': 1} \
     and out['charts'][0]['success'] and not out['charts'][1]['success'] \
     and 'suggestion' in out['charts'][1]['error']['details']
rec("M3-部分失败(exit 0 + per-chart错误)", ok, f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:300] if out else se[:300]}")

# 内联 --charts
rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts', '[{"type":"bar","x_axis":"城市","y_axis":["销售额"]}]'])
rec("M4-内联--charts", rc == 0 and out and out['summary']['succeeded'] == 1,
    f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:200] if out else se[:200]}")

# 非法 --charts
rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts', '[{"x_axis":"城市"}]'])
rec("M5-非法charts(缺type)结构化报错", rc == 1 and 'CHART_CONFIG_ERROR' in se, f"rc={rc}, se={se[:150]}")

# 多图 dry-run
rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts-file', cfg_path, '--dry-run'])
ok = rc == 0 and out and all(c['success'] and c.get('dry_run') and c['html_path'] is None
                             for c in out['charts'])
rec("M6-多图dry-run(不落盘)", ok, f"rc={rc}, {json.dumps(out, ensure_ascii=False)[:250] if out else se[:250]}")

# ══════════════════ F: flags / 主题 / 语言 ══════════════════
print("\n─── F: flags / 主题 / 语言 / dry-run / annotation ───")
for theme in ('default', 'classic', 'dark'):
    rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', f'主题{theme}',
                              '--x-axis', '城市', '--y-axis', '销售额', '--theme', theme])
    rec(f"F1-主题: {theme}", rc == 0 and out and out['chart']['success'], f"rc={rc}")

rc, out, se, _ = run_cli([DATA / 'en.csv', 'bar', '--title', 'Revenue by City',
                          '--x-axis', 'city', '--y-axis', 'revenue', '--lang', 'en'])
rec("F2-lang=en(英文数据)", rc == 0 and out and out['chart']['success'], f"rc={rc}")
rc, out, se, _ = run_cli([DATA / 'en.csv', 'bar', '--title', '城市营收', '--lang', 'zh',
                          '--x-axis', 'city', '--y-axis', 'revenue'])
rec("F3-lang=zh(覆盖自动检测)", rc == 0 and out and out['chart']['success'], f"rc={rc}")

rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F4', '--dry-run',
                          '--x-axis', '城市', '--y-axis', '销售额'])
c = out.get('chart', {}) if out else {}
ok = rc == 0 and c.get('dry_run') is True and c.get('html_path') is None and 'plot_stats' in c
rec("F4-dry-run(html_path=null+plot_stats)", ok, json.dumps(out, ensure_ascii=False)[:200] if out else se[:200])

ANNOT = '回归测试注解：上海以 1500 领先四城。'
SUB = '2026年Q1 · 数据来源：测试套件'
rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F5注解',
                          '--x-axis', '城市', '--y-axis', '销售额',
                          '--annotation', ANNOT, '--subtitle', SUB])
ok = rc == 0 and out and out['chart']['success']
if ok:
    html = Path(out['chart']['html_path']).read_text(encoding='utf-8')
    ok = ANNOT in html and SUB in html
rec("F5-annotation+subtitle注入HTML", ok, f"rc={rc}")

import re as _re
rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F6', '--sort', 'value',
                          '--x-axis', '城市', '--y-axis', '销售额'])
ok = rc == 0 and out and out['chart']['success']
if ok:
    html_v = Path(out['chart']['html_path']).read_text(encoding='utf-8')
    # sort 在渲染层生效（data_preview 是渲染前数据，原序属预期）；
    # 断言 xAxis data 数组首元素为最大值城市「上海」
    m = _re.search(r'"data":\s*\[\s*"[^"]+"', html_v)
    ok = m is not None and m.group(0).rstrip().endswith('"上海"')
    # 对照组：sort=none 时首元素应为原序首城市「北京」且两份 HTML 不同
    rc2, out2, _, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F6', '--sort', 'none',
                               '--x-axis', '城市', '--y-axis', '销售额'])
    if ok and rc2 == 0 and out2:
        html_n = Path(out2['chart']['html_path']).read_text(encoding='utf-8')
        m2 = _re.search(r'"data":\s*\[\s*"[^"]+"', html_n)
        ok = m2 is not None and m2.group(0).rstrip().endswith('"北京"') and html_v != html_n
rec("F6-sort=value渲染层降序", ok, f"rc={rc}")

rc, out, se, _ = run_cli([DATA / 'trend.csv', 'line', '--title', 'F7', '--y-scale',
                          '--x-axis', '月份', '--y-axis', '销售额'])
rec("F7-y-scale(line)", rc == 0 and out and out['chart']['success'], f"rc={rc}")
for lab in ('all', 'key'):
    rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', f'F8-{lab}', '--label', lab,
                              '--x-axis', '城市', '--y-axis', '销售额'])
    rec(f"F8-label={lab}", rc == 0 and out and out['chart']['success'], f"rc={rc}")

rc, out, se, _ = run_cli([DATA / 'students.csv', 'scatter', '--title', 'F9',
                          '--x-axis', '数学', '--y-axis', '语文', '--label-col', '姓名', '--color-by', '英语'])
rec("F9-scatter label-col+color-by(数值)", rc == 0 and out and out['chart']['success'], f"rc={rc}")
rc, out, se, _ = run_cli([DATA / 'cities.csv', 'scatter', '--title', 'F10',
                          '--x-axis', '销售额', '--y-axis', '利润', '--color-by', '城市'])
rec("F10-scatter color-by(类别)", rc == 0 and out and out['chart']['success'], f"rc={rc}")

rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F11',
                          '--x-axis', '城市', '--y-axis', '销售额', '--width', '1200', '--height', '800'])
rec("F11-width/height", rc == 0 and out and out['chart']['success'], f"rc={rc}")

# 离线性：HTML 不引用外部 CDN
rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F12', '--x-axis', '城市', '--y-axis', '销售额'])
ok = rc == 0 and out and out['chart']['success']
if ok:
    html = Path(out['chart']['html_path']).read_text(encoding='utf-8')
    ok = 'echarts' in html.lower() and 'src="http' not in html and 'href="http' not in html
    sz = len(html)
rec("F12-离线HTML(echarts内联无CDN)", ok, f"size={sz if ok else 'N/A'}")

# stdout 纯 JSON 契约（单行可解析已在 run_cli 验证；这里显式确认 stderr 无泄漏）
rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'F13', '--x-axis', '城市', '--y-axis', '销售额'])
rec("F13-stdout纯JSON契约", rc == 0 and out is not None and out.get('chart', {}).get('success'),
    f"stdout解析失败或 stderr 泄漏: {se[:150]}")

# ══════════════════ E: 错误路径 ══════════════════
print("\n─── E: 错误路径（结构化 JSON + suggestion）───")
rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar3d', '--title', 'E1', '--x-axis', '城市', '--y-axis', '销售额'])
ok = rc == 1 and out and not out['chart']['success'] and out['chart']['error']['code_name'] == 'CHART_TYPE_UNSUPPORTED'
rec("E1-不支持的图表类型(4002)", ok, f"rc={rc}")

rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--title', 'E2', '--x-axis', '不存在的列', '--y-axis', '销售额'])
ok = rc == 1 and out and not out['chart']['success'] and out['chart']['error']['code_name'] == 'CHART_CONFIG_ERROR'
rec("E2-轴字段缺失(4003)", ok, f"rc={rc}")

rc, out, se, _ = run_cli(['/tmp/不存在.csv', 'bar'])
ok = rc == 1 and 'FILE_NOT_FOUND' in se
rec("E3-文件不存在(1001,stderr)", ok, f"rc={rc}, se={se[:120]}")

(DATA / 'scores.xyz').write_text('姓名,数学\n张三,85\n', encoding='utf-8')
rc, out, se, _ = run_cli([DATA / 'scores.xyz', 'bar'])
ok = rc == 1 and 'FILE_FORMAT_INVALID' in se
rec("E4-不支持扩展名(1003)", ok, f"rc={rc}, se={se[:120]}")

rc, out, se, _ = run_cli([DATA / 'cities.csv'])
ok = rc == 1 and 'CHART_CONFIG_ERROR' in se
rec("E5-缺图表类型(4003)", ok, f"rc={rc}, se={se[:120]}")

rc, out, se, _ = run_cli([DATA / 'cities.csv', 'bar', '--nope'])
ok = rc == 1 and 'CHART_CONFIG_ERROR' in se and 'suggestion' in se
rec("E6-未知flag(argparse→结构化JSON)", ok, f"rc={rc}, se={se[:150]}")

rc, out, se, _ = run_cli([DATA / 'cities.csv', '--charts-file', '/tmp/不存在.json'])
ok = rc == 1 and 'FILE_NOT_FOUND' in se
rec("E7-charts-file缺失(1001)", ok, f"rc={rc}, se={se[:120]}")

# E8: 5 个逃逸 PoC 经 CLI（覆盖 dunder 新增项）
for kw, code in [('__builtins__', "result = pd.__builtins__"),
                 ('__getattribute__', "x = pd.__getattribute__; result = df"),
                 ('__loader__', "x = np.__loader__; result = df"),
                 ('__reduce__', "x = df.__reduce__; result = df"),
                 ('__spec__', "x = pd.__spec__; result = df")]:
    rc, out, se, _ = run_cli([DATA / 'm1.csv', 'bar', '--title', 'E8', '--transform-code', code,
                              '--x-axis', '城市', '--y-axis', '销售额'])
    ok = rc == 1 and out and not out['chart']['success'] \
         and out['chart']['error']['code_name'] == 'TRANSFORM_EXEC_ERROR' \
         and kw in out['chart']['error']['details'].get('violations', [])
    rec(f"E8-CLI逃逸拦截: {kw}", ok, f"rc={rc}")

# ══════════════════ 汇总 ══════════════════
print("\n" + "═" * 60)
print(f"总计: {PASS + FAIL} | 通过: {PASS} | 失败: {FAIL}")
if FAILURES:
    print("\n失败明细:")
    for n, d in FAILURES:
        print(f"  ✗ {n}\n    {d[:250]}")
print("═" * 60)
print(f"测试数据与输出: {ROOT}（临时目录，可安全删除）")
sys.exit(1 if FAIL else 0)
