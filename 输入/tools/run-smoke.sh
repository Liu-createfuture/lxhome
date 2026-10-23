#!/bin/bash
cd "$(dirname "$0")/.."
"/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="C:/Users/56248/Desktop/输入/tools/cache/prof-s$RANDOM" \
  --virtual-time-budget=60000 --dump-dom \
  "file:///C:/Users/56248/Desktop/输入/tools/smoke-test.html" > tools/cache/smoke.txt 2>/dev/null
python - <<'PY'
import re
s=open('tools/cache/smoke.txt',encoding='utf-8',errors='ignore').read()
m=re.search(r'<pre id="out">(.*?)</pre>',s,re.S)
print(m.group(1) if m else 'NO PRE')
PY
