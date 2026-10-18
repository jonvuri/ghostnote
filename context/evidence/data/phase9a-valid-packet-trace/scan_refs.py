import json, struct, zipfile
from pathlib import Path
jar=Path('/Applications/Bitwig Studio.app/Contents/Java/bitwig.jar')
# Read class-file metadata only. Do not load vendor classes.
def pool(data):
    n=struct.unpack_from('>H',data,8)[0]; cp=[None]*n; p=10; i=1
    while i<n:
        tag=data[p]; p+=1
        if tag==1:
            size=struct.unpack_from('>H',data,p)[0]; p+=2; cp[i]=(tag,data[p:p+size].decode('utf-8','replace')); p+=size
        elif tag in (3,4): cp[i]=(tag,); p+=4
        elif tag in (5,6): cp[i]=(tag,); p+=8; i+=1
        elif tag in (7,8,16,19,20): cp[i]=(tag,struct.unpack_from('>H',data,p)[0]); p+=2
        elif tag in (9,10,11,12,17,18): cp[i]=(tag,*struct.unpack_from('>HH',data,p)); p+=4
        elif tag==15: cp[i]=(tag,data[p],struct.unpack_from('>H',data,p+1)[0]); p+=3
        else: raise ValueError(tag)
        i+=1
    return cp
owners={'DxI','Lck','com/bitwig/flt/document/core/master/gJd','com/bitwig/base/platform/iIS','com/bitwig/base/platform/uqc'}
rows=[]; count=0
with zipfile.ZipFile(jar) as z:
    for name in z.namelist():
        if not name.endswith('.class'): continue
        count+=1; cp=pool(z.read(name))
        for c in cp:
            if c and c[0] in (9,10,11):
                owner=cp[cp[c[1]][1]][1]
                if owner not in owners: continue
                nt=cp[c[2]]; member=cp[nt[1]][1]; desc=cp[nt[2]][1]
                keep=(owner=='DxI' and member=='EbT' or owner=='Lck' and member=='ffA' and desc=='(Lcom/bitwig/base/platform/hwy;)V' or owner.endswith('/gJd') and member in ('kyi','wi2','ffA') or owner.endswith('/iIS') and member in ('cG3','Uhv','ffA') or owner.endswith('/uqc') and member=='ffA' and desc=='(Lcom/bitwig/base/platform/hwy;)V')
                if keep: rows.append({'class':name[:-6].replace('/','.'),'kind':c[0],'owner':owner.replace('/','.'),'name':member,'descriptor':desc})
result={'scope':'Constant-pool member references, not an invocation or writer proof. Javap confirms use sites. Native and reflective references are outside this scan.','classCount':count,'rows':sorted(rows,key=lambda r:(r['owner'],r['name'],r['class']))}
Path('/tmp/gn9a-valid-packet-trace').mkdir(parents=True, exist_ok=True)
Path('/tmp/gn9a-valid-packet-trace/member-references.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
