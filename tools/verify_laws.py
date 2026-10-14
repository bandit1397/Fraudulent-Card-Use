# 앱의 조문 데이터(data/laws.js)를 국가법령정보센터 원문과 자동 대조
# 사용법: python tools/fetch_law.py <폴더> "형법" ... 로 원문을 받은 뒤
#         python tools/verify_laws.py <폴더>
import sys, os, re, json, subprocess, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding="utf-8")
folder = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
laws = json.loads(subprocess.check_output(["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))", os.path.join(root, "data", "laws.js")]))

FILE = {"형법": "형법", "여신전문금융업법": "여신전문금융업법", "전자금융거래법": "전자금융거래법",
        "전기통신금융사기 피해 방지 및 피해자산 환급에 관한 특별법": "전기통신금융사기_피해_방지_및_피해자산_환급에_관한_특별법",
        "특정경제범죄 가중처벌 등에 관한 법률": "특정경제범죄_가중처벌_등에_관한_법률", "경범죄 처벌법": "경범죄_처벌법",
        "철도사업법": "철도사업법", "형사소송법": "형사소송법"}
cache = {}
def articles(law):
    if law not in cache:
        r = ET.parse(os.path.join(folder, FILE[law] + ".xml")).getroot()
        d = {}
        for u in r.iter("조문단위"):
            if u.findtext("조문여부") != "조문": continue
            no = u.findtext("조문번호"); br = u.findtext("조문가지번호") or ""
            d[no + ("의" + br if br else "")] = re.sub(r"\s+", "", "".join(u.itertext()))
        cache[law] = d
    return cache[law]

def clean(x):
    return re.sub(r"[\s·ㆍ・\"'“”‘’]", "", x)

bad = 0
for key, L in laws.items():
    if key == "meta" or L.get("law") not in FILE: continue
    # 인용한 모든 조문(예: 제49조 제4항 · 제6조 제3항)을 합쳐서 대조
    arts = [a + (b or "") for a, b in re.findall(r"제(\d+)조(의\d+)?", L["art"])]
    texts = [articles(L["law"]).get(a) for a in arts]
    if any(t is None for t in texts):
        print("✗", key, "조문 없음", L["art"]); bad += 1; continue
    text = clean("".join(texts))
    pen = L.get("penalty", "")
    nums = re.findall(r"\d+년|\d*천?\d*백?만원|\d+억원|\d+배", pen)
    miss = [n for n in nums if n not in text]
    note = ""
    if L.get("text"):
        if L.get("summary"):
            note = "| 인용문은 요약 (수동 확인)"
        else:
            frag = clean(L["text"])[:30]
            if frag not in text:
                note = "| 인용문 불일치"
    ok = not miss and note != "| 인용문 불일치"
    if not ok: bad += 1
    print("✓" if ok else "✗", key, L["art"], "| 법정형:", pen or "-", ("| 원문에 없는 숫자: " + ",".join(miss)) if miss else "", note)
print()
print("불일치", bad, "건")
