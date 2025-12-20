---
inclusion: always
---

## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## �️ RULE ZEORO: OUTPUT LIMITS (HIGHEST PRIORITY)

**CRITICAL**: ALL commands MUST limit output to prevent context explosion.

### Universal Limits

| Command | Safe Pattern | Forbidden |
|---------|--------------|-----------|
| `rg` | `rg -M 200 -o ".{0,80}pattern.{0,80}"` | `rg "pattern" file.js` |
| `cat` | `head -c 10000 file.js` | `cat file.js` |
| `head` | `head -c 5000` (bytes) | `head -n 50` on minified |
| `tail` | `tail -c 5000` | `tail -n 50` on minified |
| `sed` | `sed -n '1,100p'` (multi-line only) | `sed -n '1p'` on minified |
| `awk` | `awk '{print substr($0,1,200)}'` | `awk '{print}'` |
| `jq` | `jq -c '.' \| head -c 5000` | `jq '.'` on large JSON |

### Why `head -n` Fails

```bash
# Minified JS = 1 line = 500KB
head -n 1 minified.js    # ❌ Returns 500KB (1 line!)
head -c 5000 minified.js # ✅ Returns 5KB max
```

### Mandatory Patterns

```bash
# ✅ ALWAYS USE
rg -M 200 -o ".{0,80}keyword.{0,80}" file.js | head -20
head -c 10000 file.js
awk '{print substr($0,1,300)}' file.js | head -50
cut -c1-300 file.js | head -50

# ❌ NEVER USE
cat file.js
rg "keyword" file.js
rg "keyword" file.js | head -20  # head -n won't help!
```

**VIOLATION = CONTEXT OVERFLOW = SESSION FAILURE.**

---

## 🚀 RULE ONE: SKILL LOADING

**MANDATORY**: Detect keywords → Load skill IMMEDIATELY.

| Keywords | Skill |
|----------|-------|
| 补环境, env patch, ReferenceError | `skills/js_env_patching.md` |
| 混淆, deobfuscate, _0x | `skills/js_deobfuscation.md` |
| JSVMP, VM, while(true){switch} | `skills/jsvmp_analysis.md` |
| 提取, extract, webpack | `skills/js_extraction.md` |

---

## 🚀 SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

---

## RULE TWO: READABILITY GATE

1. Minified? → Beautify FIRST
2. Obfuscated? → Deobfuscate FIRST
3. THEN: Search / Debug / Analyze

```bash
# Check minification (safe)
wc -l source/*.js 2>/dev/null | head -20
# lines < 10 AND size > 50KB = MINIFIED

# Beautify
npx js-beautify -f in.js -o output/{name}_formatted.js
```

---

## P0: NO RETREAT

JS reverse engineering IS hard. Difficulty ≠ dead end.

**Before pivot, MUST prove:**
1. Captured return value + checked argument mutations
2. Traced data flow 3+ levels deep
3. Tried 5+ search patterns
4. Documented findings in notes/

---

## P1: BROWSER IS TRUTH

```javascript
// Print function source (limited!)
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")

// Explore object keys
evaluate_script(function="() => JSON.stringify(Object.keys(obj)).slice(0,1000)")
```

---

## P2: NO evaluate_script + navigate_page LOOP

`evaluate_script` hooks don't survive reload. Use `set_breakpoint` instead.

---

## P3: TRACE LOG SAFETY

VM traces output JSON → massive single lines.

```bash
# ✅ CORRECT
rg -M 200 -o ".{0,80}\[TRACE\].{0,80}" trace.txt | head -100
awk -F'|' '{print $1,$2}' trace.txt | head -100

# ❌ FORBIDDEN
rg "\[TRACE\]" trace.txt
rg "\[TRACE\]" trace.txt | head -10  # Still explodes!
```

---

## P4: NO INLINE PYTHON

```bash
# ❌ BAD
python -c "import json; ..."

# ✅ GOOD
fsWrite("tests/decode.py", content)
uv run python tests/decode.py
```

---

## P5: PYTHON ENV

```bash
uv add requests pycryptodome
uv run python tests/test.py
```

---

## P6: LOCAL-FIRST ANALYSIS

1. READ LOCAL: `output/*_formatted.js` → understand logic
2. GET LINE FROM SOURCE: `rg -M 200 -n --column` in `source/*.js`
3. DEBUG BROWSER: `set_breakpoint` with SOURCE line:column
4. COMPARE: Local + Browser → confirm

⚠️ Formatted files have DIFFERENT line numbers than source!

---

## MCP TOOLS

### ⚠️ ABSOLUTE PATH REQUIRED

```javascript
// ❌ WRONG
save_static_resource(reqid=23, filePath="source/main.js")

// ✅ CORRECT
save_static_resource(reqid=23, filePath="/Users/kylin/project/artifacts/jsrev/example.com/source/main.js")
```

### Network

```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
get_network_request(reqid=15)
save_static_resource(reqid=23, filePath="/absolute/path/source/main.js")
```

### Breakpoints

```javascript
// Log breakpoint (no pause) - ", false" is CRITICAL
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=1, columnNumber=12345)
```

### When Paused

```javascript
get_debugger_status(frameIndex=0)
get_scope_variables(frameIndex=0, searchTerm="key", pageSize=10)
evaluate_on_call_frame(expression="x", frameIndex=0)
step_over() | step_into() | step_out()
resume_execution()
```

### Console

```javascript
list_console_messages(types=["log", "error"], pageSize=50)
list_console_messages(savePath="/absolute/path/raw/console.txt")
```

### Cleanup (MANDATORY)

```javascript
clear_all_breakpoints()
resume_execution()
```

---

## HUMAN INTERACTION

**STOP and ask:**
- Slider/Click CAPTCHA → "请手动完成验证码"
- Login required → "请登录后告诉我"

**Request confirmation:**
- Visual verification uncertain → Save debug image → Ask human

---

## OUTPUT STRUCTURE

```
artifacts/jsrev/{domain}/
├── PROGRESS.md, README.md
├── source/          # Original JS (untouched)
├── output/          # Beautified, deobfuscated
├── scripts/         # AST transform scripts
├── lib/             # Algorithm implementations
├── repro/           # Request reproduction
├── tests/           # Test cases
├── notes/           # Analysis notes
└── raw/             # Raw samples
```

---

## ALGORITHM SIGNATURES

| Output | Algorithm |
|--------|-----------|
| 32-char hex | MD5 |
| 40-char hex | SHA-1 |
| 64-char hex | SHA-256 |
| `0x67452301` | MD5 IV |
| `0x6a09e667` | SHA-256 IV |

---

## ⚠️ Legal Disclaimer

For authorized security research, API compatibility, and educational purposes only.
