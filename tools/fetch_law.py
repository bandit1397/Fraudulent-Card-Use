# 법령 원문 받기: python tools/fetch_law.py <저장폴더> "형법" "여신전문금융업법" ...
import sys, urllib.request, urllib.parse, re, os, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding="utf-8")
out = sys.argv[1]
names = sys.argv[2:]
for n in names:
    q = urllib.parse.quote(n)
    x = urllib.request.urlopen(f"https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=law&type=XML&query={q}").read()
    r = ET.fromstring(x)
    mst=None
    for law in r.findall('law'):
        if law.findtext('법령명한글').strip()==n and law.findtext('현행연혁코드')=='현행':
            mst=law.findtext('법령일련번호'); ef=law.findtext('시행일자'); break
    if not mst: print("NOTFOUND",n); continue
    d = urllib.request.urlopen(f"https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&MST={mst}&type=XML").read()
    open(os.path.join(out, n.replace(' ','_')+'.xml'),'wb').write(d)
    print(n, mst, ef, len(d))
