import os, re, sys, json
raw = open('prisma/schema.prisma', encoding='utf-8').read()
clean = '\n'.join(re.sub(r'//.*$','',re.sub(r'///.*$','',ln)) for ln in raw.split('\n'))
SCALARS = {'String','Int','Float','Boolean','DateTime','Json','Bytes','Decimal','BigInt'}
enums, models = {}, {}
for m in re.finditer(r'^enum\s+(\w+)\s*\{([^}]*)\}', clean, re.M|re.S):
    enums[m.group(1)] = [v.strip() for v in m.group(2).split('\n') if v.strip()]
for m in re.finditer(r'^model\s+(\w+)\s*\{([\s\S]*?)^\}', clean, re.M):
    name, body = m.group(1), m.group(2)
    fields, order, blocks = {}, [], []
    for ln in body.split('\n'):
        s = ln.strip()
        if not s: continue
        if s.startswith('@@'): blocks.append(s); continue
        fm = re.match(r'^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$', s)
        if fm:
            fields[fm.group(1)] = {'type':fm.group(2),'list':bool(fm.group(3)),'opt':bool(fm.group(4)),'rest':fm.group(5)}
            order.append(fm.group(1))
    models[name] = {'fields':fields,'order':order,'blocks':blocks}
E, W = [], []
for mn, m in models.items():
    F = m['fields']
    if len(F) != len(m['order']): E.append(f"{mn}: 重复字段名")
    if not (any('@id' in f['rest'] for f in F.values()) or any(b.startswith('@@id') for b in m['blocks'])):
        E.append(f"{mn}: 缺少 @id")
    for b in m['blocks']:
        bm = re.match(r'@@(unique|index|id)\(\s*(?:fields:\s*)?\[([^\]]*)\]', b)
        if bm:
            for fld in [x.strip().split('(')[0] for x in bm.group(2).split(',')]:
                if fld and fld not in F: E.append(f"{mn}: @@{bm.group(1)} 引用不存在字段 {fld}")
    for fn, f in F.items():
        t = f['type']
        if t not in SCALARS and t not in enums and t not in models:
            E.append(f"{mn}.{fn}: 未知类型 {t}"); continue
        if f['list'] and f['opt']: E.append(f"{mn}.{fn}: 列表不能同时可选")
        rel = re.search(r'@relation\(((?:[^()]|\([^()]*\))*)\)', f['rest'])
        if t in models:
            relname = None
            rn = re.search(r'@relation\(\s*"([^"]+)"', f['rest'])
            if rn: relname = rn.group(1)
            tgt = models[t]
            back = []
            for tfn, tf in tgt['fields'].items():
                if tf['type'] != mn: continue
                trn = re.search(r'@relation\(\s*"([^"]+)"', tf['rest'])
                if (trn.group(1) if trn else None) == relname: back.append((tfn, tf))
            if not back:
                E.append(f"{mn}.{fn} -> {t}" + (f' ("{relname}")' if relname else '') + ": 缺少反向关系")
            if rel:
                args = rel.group(1)
                fm2 = re.search(r'fields:\s*\[([^\]]*)\]', args)
                rm2 = re.search(r'references:\s*\[([^\]]*)\]', args)
                if (fm2 and not rm2) or (rm2 and not fm2): E.append(f"{mn}.{fn}: fields/references 必须同时出现")
                if fm2 and rm2:
                    fks = [x.strip() for x in fm2.group(1).split(',')]
                    refs = [x.strip() for x in rm2.group(1).split(',')]
                    if len(fks) != len(refs): E.append(f"{mn}.{fn}: fields/references 数量不一致")
                    for i, rf in enumerate(refs):
                        if fks[i] not in F: E.append(f"{mn}.{fn}: fields 引用不存在字段 {fks[i]}"); continue
                        if rf not in tgt['fields']: E.append(f"{mn}.{fn}: references 引用 {t} 不存在字段 {rf}"); continue
                        a, b2 = F[fks[i]]['type'], tgt['fields'][rf]['type']
                        if a != b2: E.append(f"{mn}.{fn}: FK 类型 {a} != {t}.{rf} {b2}")
                        rrest = tgt['fields'][rf]['rest']
                        ub = any(re.match(r'@@unique\(\s*(?:fields:\s*)?\[\s*'+re.escape(rf)+r'\s*\]', bb) for bb in tgt['blocks'])
                        if '@id' not in rrest and '@unique' not in rrest and not ub:
                            E.append(f"{mn}.{fn}: {t}.{rf} 非 @id/@unique")
                        if F[fks[i]]['opt'] != f['opt']:
                            W.append(f"{mn}.{fn}: 关系可选={f['opt']} 但 FK 可选={F[fks[i]]['opt']}")
                    if len(back) == 1 and not back[0][1]['list']:
                        fk = fks[0]; fkrest = F.get(fk,{}).get('rest','')
                        ub = any(re.match(r'@@unique\(\s*(?:fields:\s*)?\[\s*'+re.escape(fk)+r'\s*\]', bb) for bb in m['blocks'])
                        if '@unique' not in fkrest and '@id' not in fkrest and not ub:
                            E.append(f"{mn}.{fn} 与 {t}.{back[0][0]} 是一对一但 FK {fk} 缺 @unique")
print(f"模型 {len(models)} / 枚举 {len(enums)}")
print("错误：", "无" if not E else "")
for x in E: print("  ❌", x)
print("警告：", "无" if not W else "")
for x in W: print("  ⚠️ ", x)
json.dump({'enums':enums,'models':{k:list(v['fields'].keys()) for k,v in models.items()}}, open(os.environ.get('SCHEMA_JSON_OUT','/tmp/schema.json'),'w'))
sys.exit(1 if E else 0)
