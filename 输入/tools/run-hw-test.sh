#!/bin/bash
# 用法: bash tools/run-hw-test.sh "dens=30&dir=26"  (可带 quick=1)
cd "$(dirname "$0")/.."
URL="file:///C:/Users/56248/Desktop/输入/tools/hw-test.html?$1"
"/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="C:/Users/56248/Desktop/输入/tools/cache/prof$RANDOM" \
  --virtual-time-budget=120000 --dump-dom "$URL" > tools/cache/dom.txt 2>/dev/null
python - <<'PY'
import re
s=open('tools/cache/dom.txt',encoding='utf-8',errors='ignore').read()
m=re.search(r'<pre id="out">(.*?)</pre>',s,re.S)
print(m.group(1) if m else 'NO PRE')
PY
