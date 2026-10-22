# ★建置腳本：把 build/ 內的資料與程式組成「單一 HTML 檔」。
#   資料：chars.json（千人名冊）、cities.json（百城）、officials.json（三院官制）、commodities.json（物品）、
#         commodity_info.json（物品說明）、street.jpg（轉場街景，以 base64 內嵌）。
#   程式：js/ 內檔案依檔名排序後串接（01_core→08_boot），順序即載入順序，後面的檔案可使用前面的全域名稱。
#   執行：python3 -I build.py  → 輸出專案根目錄的 index.html
import json,base64,re
from pathlib import Path
B=Path(__file__).resolve().parent
def jl(p): return json.dumps(json.load(open(B/p,encoding='utf-8')),ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
chars=jl('chars.json'); cities=jl('cities.json'); off=jl('officials.json'); comms=jl('commodities.json'); cinfo=jl('commodity_info.json')
img='data:image/jpeg;base64,'+base64.b64encode(open(B/'street.jpg','rb').read()).decode()
data=f'const CHARS={chars};\nconst CITIES={cities};\nconst OFFICIALS={off};\nconst COMMS={comms};\nconst COMM_INFO={cinfo};\nconst IMG_STREET="{img}";\n'
js=''.join(open(p,encoding='utf-8').read()+'\n' for p in sorted((B/'js').iterdir()))
css=open(B/'style.css',encoding='utf-8').read()
body=open(B/'body.html',encoding='utf-8').read()
html=f'''<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>問屋事情：關於我成了江戶中盤商這件事</title>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" referrerpolicy="no-referrer">
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{data}
</script>
<script>
{js}
</script>
</body>
</html>
'''
out=B.parent/'index.html'
open(out,'w',encoding='utf-8').write(html)
print(len(html))
