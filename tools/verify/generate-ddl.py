"""
把 prisma/schema.prisma 机械翻译成 PostgreSQL DDL。
用途：在没有 npm（无法 prisma migrate）的环境里，用真实 PostgreSQL 验证
数据模型能不能建起来 —— 类型、外键、唯一约束、索引全部真实校验一次。
不追求覆盖 Prisma 全部特性，只覆盖本项目实际用到的。
"""
import os, re, sys, json

src = open(os.environ.get('PROJECT_ROOT', os.getcwd()) + '/prisma/schema.prisma').read()
# 去掉 /// 文档注释与 // 注释
lines = []
for l in src.split('\n'):
    l = re.sub(r'///.*$', '', l)
    l = re.sub(r'(?<!:)//.*$', '', l)
    lines.append(l)
src = '\n'.join(lines)

enums = {}
for m in re.finditer(r'enum (\w+) \{(.*?)\n\}', src, re.S):
    vals = [v.strip() for v in m.group(2).split('\n') if re.fullmatch(r'[A-Z][A-Z0-9_]*', v.strip())]
    enums[m.group(1)] = vals

SCALAR = {
    'String': 'text', 'Int': 'integer', 'BigInt': 'bigint', 'Float': 'double precision',
    'Boolean': 'boolean', 'DateTime': 'timestamp(3)', 'Json': 'jsonb', 'Decimal': 'numeric(65,30)',
    'Bytes': 'bytea',
}

models = []
for m in re.finditer(r'model (\w+) \{(.*?)\n\}', src, re.S):
    name, body = m.group(1), m.group(2)
    fields, attrs = [], []
    for raw in body.split('\n'):
        line = raw.strip()
        if not line: continue
        if line.startswith('@@'):
            attrs.append(line); continue
        fm = re.match(r'(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$', line)
        if not fm: continue
        fields.append({
            'name': fm.group(1), 'type': fm.group(2),
            'list': bool(fm.group(3)), 'opt': bool(fm.group(4)),
            'attrs': fm.group(5) or '',
        })
    models.append({'name': name, 'fields': fields, 'attrs': attrs})

def table_of(mdl):
    for a in mdl['attrs']:
        mm = re.match(r'@@map\("([^"]+)"\)', a)
        if mm: return mm.group(1)
    return mdl['name']

model_by_name = {m['name']: m for m in models}
tables = {m['name']: table_of(m) for m in models}

def col_of(mdl, fieldname):
    for f in mdl['fields']:
        if f['name'] == fieldname:
            mm = re.search(r'@map\("([^"]+)"\)', f['attrs'])
            return mm.group(1) if mm else fieldname
    return fieldname

def default_sql(expr, ftype, is_list):
    expr = expr.strip()
    if expr in ('now()',): return 'CURRENT_TIMESTAMP'
    if expr in ('cuid()', 'uuid()', 'autoincrement()'): return None
    if expr == 'true' or expr == 'false': return expr
    if re.fullmatch(r'-?\d+(\.\d+)?', expr): return expr
    if expr.startswith('"'): return "'" + expr[1:-1].replace("'", "''") + "'"
    if expr.startswith('['):
        inner = expr[1:-1].strip()
        if not inner: return "'{}'"
        items = [i.strip() for i in inner.split(',')]
        return "'{" + ','.join(i.strip('"') for i in items) + "}'"
    if ftype in enums: return f'\'{expr}\'::"{ftype}"'
    return None

out = ['DROP SCHEMA IF EXISTS check_model CASCADE;', 'CREATE SCHEMA check_model;', 'SET search_path TO check_model;', '']
for en, vals in enums.items():
    out.append(f'CREATE TYPE "{en}" AS ENUM (' + ', '.join(f"'{v}'" for v in vals) + ');')
out.append('')

fks, uniques, indexes = [], [], []
for mdl in models:
    tbl = table_of(mdl)
    cols, pk = [], []
    for f in mdl['fields']:
        # 关系字段（指向另一个 model）不建列，只在有 @relation(fields:) 时建外键
        if f['type'] in model_by_name:
            rm = re.search(r'@relation\((.*)\)', f['attrs'])
            if rm and 'fields:' in rm.group(1):
                inner = rm.group(1)
                flds = re.search(r'fields:\s*\[([^\]]+)\]', inner).group(1)
                refs = re.search(r'references:\s*\[([^\]]+)\]', inner).group(1)
                on_del = re.search(r'onDelete:\s*(\w+)', inner)
                target = model_by_name[f['type']]
                local = ', '.join(f'"{col_of(mdl, x.strip())}"' for x in flds.split(','))
                remote = ', '.join(f'"{col_of(target, x.strip())}"' for x in refs.split(','))
                action = {'Cascade': 'CASCADE', 'SetNull': 'SET NULL', 'Restrict': 'RESTRICT', 'NoAction': 'NO ACTION'}.get(
                    on_del.group(1) if on_del else '', 'NO ACTION')
                fks.append(f'ALTER TABLE "{tbl}" ADD CONSTRAINT "{tbl}_{flds.replace(", ", "_").replace(" ","")}_fkey" '
                           f'FOREIGN KEY ({local}) REFERENCES "{table_of(target)}"({remote}) ON DELETE {action} ON UPDATE CASCADE;')
            continue
        if f['type'] not in SCALAR and f['type'] not in enums:
            print(f'!! 未知类型 {mdl["name"]}.{f["name"]}: {f["type"]}', file=sys.stderr)
            continue
        base = SCALAR.get(f['type']) or f'"{f["type"]}"'
        col = col_of(mdl, f['name'])
        sqltype = base + ('[]' if f['list'] else '')
        parts = [f'  "{col}" {sqltype}']
        if not f['opt'] and not f['list']:
            parts.append('NOT NULL')
        if f['list']:
            parts.append('NOT NULL')
        dm = re.search(r'@default\(((?:[^()]|\([^()]*\))*)\)', f['attrs'])
        if dm:
            d = default_sql(dm.group(1), f['type'], f['list'])
            if d: parts.append(f'DEFAULT {d}')
        elif f['list']:
            parts.append("DEFAULT '{}'")
        cols.append(' '.join(parts))
        if '@id' in f['attrs']: pk.append(col)
        if '@unique' in f['attrs']:
            uniques.append(f'ALTER TABLE "{tbl}" ADD CONSTRAINT "{tbl}_{col}_key" UNIQUE ("{col}");')
    for a in mdl['attrs']:
        if a.startswith('@@id('):
            pk = [col_of(mdl, x.strip()) for x in re.search(r'\[([^\]]+)\]', a).group(1).split(',')]
        elif a.startswith('@@unique('):
            fl = [col_of(mdl, x.strip()) for x in re.search(r'\[([^\]]+)\]', a).group(1).split(',')]
            uniques.append(f'ALTER TABLE "{tbl}" ADD CONSTRAINT "{tbl}_{"_".join(fl)}_key" UNIQUE (' +
                           ', '.join(f'"{c}"' for c in fl) + ');')
        elif a.startswith('@@index('):
            fl = [col_of(mdl, re.sub(r'\(.*\)', '', x.strip())) for x in re.search(r'\[([^\]]+)\]', a).group(1).split(',')]
            indexes.append(f'CREATE INDEX "{tbl}_{"_".join(fl)}_idx" ON "{tbl}" (' +
                           ', '.join(f'"{c}"' for c in fl) + ');')
    if pk:
        cols.append(f'  PRIMARY KEY (' + ', '.join(f'"{c}"' for c in pk) + ')')
    out.append(f'CREATE TABLE "{tbl}" (\n' + ',\n'.join(cols) + '\n);')

out.append('')
out += uniques + [''] + indexes + [''] + fks
open(os.environ.get('DDL_OUT', '/tmp/schema.sql'), 'w').write('\n'.join(out) + '\n')
print(f'模型 {len(models)}  枚举 {len(enums)}  外键 {len(fks)}  唯一 {len(uniques)}  索引 {len(indexes)}')
