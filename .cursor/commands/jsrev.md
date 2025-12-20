---
inclusion: always
---

## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## 🚨🚨🚨 RULE ZERO: OUTPUT LIMITS (HIGHEST PRIORITY) 🚨🚨🚨

**ABSOLUTE LAW**: EVERY command MUST limit output. NO EXCEPTIONS. EVER.

This rule applies BEFORE all other rules. Violating this = context explosion = session death.

### The Problem

```bash
# Minified JS = 1 line = 500KB+
head -n 1 minified.js    # ❌ Returns 500KB (1 line!)
rg "keyword" file.js     # ❌ Returns entire matching lines (500KB each!)
cat file.js              # ❌ Returns entire file
```

### Mandatory Limits by Command

| Command | ✅ ALWAYS USE | ❌ NEVER USE |
|---------|---------------|--------------|
| `rg` | `rg -M 200 -o ".{0,80}pattern.{0,80}" \| head -20` | `rg "pattern" file.js` |
| `cat` | `head -c 10000 file.js` | `cat file.js` |
| `head` | `head -c 5000` (bytes!) | `head -n 50` on JS |
| `tail` | `tail -c 5000` | `tail -n 50` on JS |
| `sed` | `sed -n '1,100p'` (multi-line only) | Any on minified |
| `awk` | `awk '{print substr($0,1,200)}' \| head -50` | `awk '{print}'` |
| `jq` | `jq -c '.' \| head -c 5000` | `jq '.'` on large JSON |

### ⚠️ `head -n` After `rg` Does NOT Help!

```bash
rg "keyword" file.js | head -20  # ❌ STILL EXPLODES!
# Why: rg outputs full lines FIRST, then head truncates line COUNT (not bytes)
# Each line can be 500KB → 20 lines = 10MB

rg -M 200 -o ".{0,80}keyword.{0,80}" file.js | head -20  # ✅ Safe
# -M 200: max 200 chars per line
# -o: only matching part
# .{0,80}: 80 chars context each side
```

### Quick Reference

```bash
# ✅ SAFE PATTERNS
rg -M 200 -o ".{0,80}keyword.{0,80}" file.js | head -20
head -c 10000 file.js
awk '{print substr($0,1,300)}' file.js | head -50
cut -c1-300 file.js | head -50

# ❌ FORBIDDEN (will kill session)
cat file.js
rg "keyword" file.js
rg "keyword" file.js | head -20
head -n 50 minified.js
```

**VIOLATION = IMMEDIATE SESSION FAILURE. NO RECOVERY.**

---

## 🚨 P0: DEOBFUSCATION GATE (BLOCKS ANALYSIS) 🚨

**IRON LAW**: Analysis tasks REQUIRE clean code. No exceptions.

### When P0 Applies

User asks to: analyze, find, trace, debug, "how is X generated", "what encrypts X"
→ **ANALYSIS task** → P0 gate BLOCKS until code is clean.

User asks to: 补环境, run in Node, fix ReferenceError
→ **ENV PATCHING** → Can work on obfuscated code directly.

### Obfuscation Check (RUN FIRST)

```bash
head -c 3000 {file} | rg -o "_0x[a-f0-9]{4,6}|\\\\x[0-9a-f]{2}|atob\\(" | head -3
```

- **ANY match** → OBFUSCATED → For analysis: STOP, deobfuscate first
- **No match** → Clean → Proceed

### If Obfuscated + Analysis Task

```
1. SAY: "检测到混淆代码，必须先去混淆才能分析。"
2. readFile("skills/js_deobfuscation.md")
3. Apply deobfuscation, save to output/*_deobfuscated.js
4. Analyze ONLY the clean output/ files
```

### Forbidden on Obfuscated Code (Analysis Tasks)

- ❌ Setting breakpoints, searching patterns, tracing execution
- ❌ "Despite the obfuscation...", "I can see _0x..."

**Why**: Obfuscated analysis = 100% failure. Deobfuscation takes 5 min, failed analysis wastes hours.

---

## 🔍 P0.5: NECESSITY CHECK

Before analyzing cookie/param generation, verify it's actually required:

```bash
curl -v 'URL' -H 'Cookie: other_only' 2>&1 | head -c 3000
```

| Response | Action |
|----------|--------|
| 200 + valid | ⏭️ "该参数非必需，无需逆向" |
| 403/401/blocked | ✅ Proceed with analysis |

---

## P1: SKILL LOADING

| Pattern | Skill | Blocks Analysis? |
|---------|-------|------------------|
| `_0x`, `\x`, `atob(` | `skills/js_deobfuscation.md` | 🔴 YES |
| 补环境, ReferenceError | `skills/js_env_patching.md` | No |
| `while(1){switch`, VM | `skills/jsvmp_analysis.md` | No |
| webpack, `__webpack_require__` | `skills/js_extraction.md` | No |

---

## P1: SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

If source/ has obfuscated JS but no output/*_deobfuscated.js → Deobfuscate first.

---

## P2: NO RETREAT

JS reverse engineering IS hard. Difficulty ≠ dead end.

**Before pivot, MUST prove:**
1. Captured return value + checked argument mutations
2. Traced data flow 3+ levels deep
3. Tried 5+ search patterns
4. Documented findings in notes/

---

## P2: BROWSER IS TRUTH

```javascript
// Print function source (limited!)
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")

// Explore object keys
evaluate_script(function="() => JSON.stringify(Object.keys(obj)).slice(0,1000)")
```

### ⚠️ evaluate_script Truncation Workaround

For large data, log to console then save:

```javascript
// Step 1: Log to console (no truncation)
evaluate_script(function="() => console.log(JSON.stringify(largeObject))")

// Step 2: Save console output to file
list_console_messages(savePath="/absolute/path/raw/data.txt")
```

---

## P3: HOOK STRATEGIES

`evaluate_script` hooks don't survive reload. Alternatives:

**Option 1: Log breakpoint (recommended)**
```javascript
// Logs value without pausing - ", false" is CRITICAL
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')
```

**Option 2: Re-inject after reload**
```javascript
evaluate_script(function="() => { window.__hook = ...; }")
```

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

## P4: LOCAL-FIRST ANALYSIS

1. READ LOCAL: `output/*_formatted.js` → understand logic
2. GET LINE FROM SOURCE: `rg -M 200 -n --column` in `source/*.js`
3. DEBUG BROWSER: `set_breakpoint` with SOURCE line:column
4. COMPARE: Local + Browser → confirm

⚠️ Formatted files have DIFFERENT line numbers than source!

---

## P5: PYTHON

```bash
# ❌ BAD
python -c "import json; ..."

# ✅ GOOD
fsWrite("tests/decode.py", content)
uv run python tests/test.py
uv add requests pycryptodome
```

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

### URL Regex: Keep It Simple

```javascript
// ❌ OVER-ESCAPED
urlRegex=".*bdms_1\\.0\\.1\\.19_fix\\.js.*"

// ✅ SIMPLE (dots rarely cause false matches)
urlRegex=".*bdms_1.0.1.19_fix.js.*"
```

### Breakpoints

```javascript
// Log breakpoint (no pause) - ", false" is CRITICAL
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
```

### ⚠️ Pausing Breakpoint = Human Triggers

After setting a pausing breakpoint, **DO NOT** call `navigate_page`/`evaluate_script`/`click` → DEADLOCK.

```
✅ set_breakpoint → ASK human to refresh/click → WAIT → get_debugger_status
❌ set_breakpoint → navigate_page(type="reload") → 💀 DEADLOCK
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

**STOP and ask human:**
- Visual CAPTCHA → Build OpenCV tool (`tests/`), human solves
- Login required → "Please login first"
- Pausing breakpoint → "Breakpoint set. Please refresh/click, then tell me."

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

## 🎯 COMPLETION CRITERIA

**Goal**: `repro/*.py` → server returns valid response.

- ✅ Encrypted params match browser values, dynamic generation works
- ❌ "Algorithm identified" without working code
- ❌ Works with captured values but not fresh ones

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
