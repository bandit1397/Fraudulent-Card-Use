# 판례 원문 받기: python tools/fetch_prec.py <저장폴더> 2003도3977 95도997 ...
import sys, urllib.request, urllib.parse, re, os, json, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
out=sys.argv[1]
def clean(s): return re.sub(r'<br\s*/?>','\n',re.sub(r'\s+',' ',s or '')).strip()
for nb in sys.argv[2:]:
    x=urllib.request.urlopen("https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=prec&type=XML&display=20&nb="+urllib.parse.quote(nb)).read()
    r=ET.fromstring(x); found=False
    for p in r.findall('prec'):
        if p.findtext('사건번호').strip()!=nb: continue
        found=True
        d=urllib.request.urlopen("https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=XML&ID="+p.findtext('판례일련번호')).read()
        open(os.path.join(out,nb+'.xml'),'wb').write(d)
        e=ET.fromstring(d)
        print("■",e.findtext('법원명'),e.findtext('선고일자'),nb,e.findtext('사건명'))
        print("[판시사항]",clean(e.findtext('판시사항'))[:900])
        print("[판결요지]",clean(e.findtext('판결요지'))[:1500])
        print()
    if not found: print("■ NOT FOUND",nb, r.findtext('totalCnt')); print()
