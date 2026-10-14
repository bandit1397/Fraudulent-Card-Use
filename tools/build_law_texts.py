# 앱이 인용하는 조문의 전문을 국가법령정보센터 원문(XML)에서 뽑아 data/law_texts.js 로 만든다.
# 사용법: python tools/fetch_law.py <폴더> "형법" "여신전문금융업법" ... 로 원문을 받은 뒤
#         python tools/build_law_texts.py <폴더>
import sys, os, re, json, subprocess, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding="utf-8")
folder = sys.argv[1]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
laws = json.loads(subprocess.check_output(["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))", os.path.join(root, "data", "laws.js")]))

FILE = {"형법": "형법", "여신전문금융업법": "여신전문금융업법", "전자금융거래법": "전자금융거래법",
        "전기통신금융사기 피해 방지 및 피해자산 환급에 관한 특별법": "전기통신금융사기_피해_방지_및_피해자산_환급에_관한_특별법",
        "특정경제범죄 가중처벌 등에 관한 법률": "특정경제범죄_가중처벌_등에_관한_법률", "경범죄 처벌법": "경범죄_처벌법",
        "철도사업법": "철도사업법", "형사소송법": "형사소송법"}

def t(e):
    return re.sub(r"\s+", " ", "".join(e.itertext())).strip() if e is not None else ""

def load(law):
    r = ET.parse(os.path.join(folder, FILE[law] + ".xml")).getroot()
    ef = r.findtext(".//시행일자")
    arts = {}
    for u in r.iter("조문단위"):
        if u.findtext("조문여부") != "조문": continue
        no = u.findtext("조문번호"); br = u.findtext("조문가지번호") or ""
        key = no + ("의" + br if br else "")
        lines = [t(u.find("조문내용"))]
        for h in u.findall("항"):
            hl = (h.findtext("항내용") or "").strip()
            if hl: lines.append(re.sub(r"\s+", " ", hl))
            for ho in h.findall("호"):
                lines.append("  " + re.sub(r"\s+", " ", (ho.findtext("호내용") or "").strip()))
                for m in ho.findall("목"):
                    mt = t(m)
                    mt = re.sub(r"^(\S+\.)\s*\1\s*", r"\1 ", mt)  # "가. 가. …" 중복 제거
                    lines.append("    " + mt)
        arts[key] = "\n".join(x for x in lines if x.strip())
    return ef, arts

cache, out, missing = {}, {}, []
for key, L in laws.items():
    if key == "meta" or L.get("law") not in FILE: continue
    if L["law"] not in cache: cache[L["law"]] = load(L["law"])
    ef, arts = cache[L["law"]]
    nums = [a + (b or "") for a, b in re.findall(r"제(\d+)조(의\d+)?", L["art"])]
    for n in nums:
        k = L["law"] + "|" + n
        if n in arts: out[k] = {"text": arts[n], "ef": ef}
        else: missing.append(k)

js = "/*\n * 조문 전문 — tools/build_law_texts.py 가 국가법령정보센터 원문(XML)에서 자동 생성 (직접 고치지 말 것)\n */\nvar LAW_TEXTS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n\nif (typeof module !== \"undefined\") module.exports = LAW_TEXTS;\n"
open(os.path.join(root, "data", "law_texts.js"), "w", encoding="utf-8").write(js)
print("조문", len(out), "개 저장", "/ 없음:", missing if missing else "없음")
