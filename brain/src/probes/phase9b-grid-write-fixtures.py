"""Rebuild offline fixtures from E304. Never pass these IDs to a live command."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[3]
fields={'boolean_value_atom':[701,374,210,3615],'decimal_value_atom':[701,374,712,3615],'bipolar_toggleable_decimal_value_atom':[701,374,712,6406,3615],'integer_value_atom':[701,374,828,3615],'indexed_value_atom':[701,374,457,6928,3615],'data_array_component':[6614,6609,6613],'audio_destination_atom':[7123,7124,7125,7234],'audio_source_atom':[3639,3640],'modulation_source_atom':[3639,3640,3616,11497]}
def decode(v):
 if isinstance(v['data'],list):return [decode(x) for x in v['data']]
 if v['type'] in ['java.lang.Integer','java.lang.Long']:return int(v['data'])
 return v['data']
def fixture(folder,preset,indices):
 d=json.load(open(root/f'context/evidence/data/phase9b-focused/{folder}/preset-{preset}-focused-summary.json'))
 nodes={}
 for m in d['modules']:
  if m['index'] not in indices:continue
  for r in m.get('reads',[]):
   for n in r['nodes']:
    dst=nodes.setdefault(n['managedId'],{})
    for p in n['fields']:dst[str(p['id'])]=p.get('refs') if 'refs' in p else decode(p['value'])
 def select(id,ids):return {str(k):nodes[id][str(k)] for k in ids}
 modules=[];maps={}
 for m in d['modules']:
  out=dict(id=f'synthetic-module-{m["index"]}',uuid=m['uuid'],name=m['name'],type=m['typeUuid'],x=0,y=0)
  if m['index'] in indices:
   out['atoms']=[]
   for a in m['atoms']:
    aid=a['managedId']; cls=a['className']
    af=select(aid,fields.get(cls,[])); aa=dict(id=aid,runtimeClass=a['runtimeClass'],fields=af); aa['class']=cls
    if cls in ['audio_source_atom','modulation_source_atom']:
     sid=nodes[aid]['6194'][0]
     aa['input']=dict(id=sid,ports=[dict(id=pid,**select(pid,[248,249,250,6443])) for pid in nodes[sid]['614']])
    for f in ['3615','3616','11497']:
     for mid in af.get(f,[]):
      ref=nodes[mid]['3739'][0]
      maps[mid]=dict(source=nodes[mid]['3635'][0],reference=dict(id=ref,**select(ref,[65,4923,4922,4924,4913,4914])),**select(mid,[3611,11481,11338,3638,11509,11913,11503]))
    out['atoms'].append(aa)
  modules.append(out)
 return dict(fixture=dict(modules=modules,mappings=maps),witness=dict(editIdle=True,parentsVerified=True,engineActive=False,selection=dict(present=False)))
result={'note':'Offline fixtures use E304 selected atom fields. Module IDs, coordinates, and witness are synthetic. Do not use these identities in live commands.','boolean':fixture('live-v15-v6',0,[9]),'mapping':fixture('live-v15-v3',1,[13,24])}
(root/'extension/src/harnessTest/resources/grid-breadth-fixtures.json').write_text(json.dumps(result,indent=2)+'\n')
