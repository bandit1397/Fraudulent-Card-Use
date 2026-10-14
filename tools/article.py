# 조문 출력: python tools/article.py <법령.xml> 70 347의2 ...
import sys, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
f=sys.argv[1]; arts=sys.argv[2:]
r=ET.parse(f).getroot()
print("== 시행", r.findtext('.//시행일자'))
for u in r.iter('조문단위'):
    no=u.findtext('조문번호'); br=u.findtext('조문가지번호') or ''
    key=no+('의'+br if br else '')
    if u.findtext('조문여부')!='조문': continue
    if key in arts:
        def txt(e): return ''.join(e.itertext()).strip()
        print(txt(u.find('조문내용')))
        for h in u.findall('항'):
            print(' ', (h.findtext('항내용') or '').strip())
            for ho in h.findall('호'):
                print('    ', (ho.findtext('호내용') or '').strip())
                for m in ho.findall('목'):
                    print('       ', ''.join(m.itertext()).strip())
        print()
