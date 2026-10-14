# 판례 본문 검색: python tools/search_prec.py "검색어" ...
import sys, urllib.request, urllib.parse, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
for q in sys.argv[1:]:
    x=urllib.request.urlopen("https://www.law.go.kr/DRF/lawSearch.do?OC=test&target=prec&type=XML&search=2&display=40&query="+urllib.parse.quote(q)).read()
    r=ET.fromstring(x)
    print("##",q,"total",r.findtext('totalCnt'))
    for p in r.findall('prec'):
        if p.findtext('법원명')!='대법원': continue
        print(' ',p.findtext('사건번호'),p.findtext('선고일자'),(p.findtext('사건명') or '')[:70])
