---
inclusion: manual
---

## jsrev

**Focus**: Reverse engineer JS encryption/signing algorithms → reproduce in Python.

**NOT**: Browser automation, environment patching, or running JS in Node.

**Goal**: `lib/*.py` contains pure algorithm implementation, `repro/*.py` makes valid API requests.

---

## � SEbLF-CHECK: STOP ON THESE PHRASES

| Forbidden | Action |
|-----------|--------|
| "Let me try another approach" | STOP → Ask user permission |
| "Since X failed, let's try Y" | STOP → Report progress, wait for user |
| "Let me switch direction" | STOP → List attempts, ask user |

**Violation = Immediate failure.**

---

## P0: DEOBFUSCATION GATE

**IRON LAW**: Analysis REQUIRES clean code. No exceptions.

### Check First

```bash
head -c 3000 {file} | rg -o "_0x[a-f0-9]{4,6}|\\\\x[0-9a-f]{2}" | head -3
```

- **Match** → STOP, deobfuscate first via `skills/js_deobfuscation.md`
- **No match** → Proceed

### Forbidden on Obfuscated Code

- ❌ Setting breakpoints, searching patterns, tracing
- ❌ "Despite obfuscation, I can see..."

**Why**: Obfuscated analysis = 100% failure. Deobfuscation takes 5 min, failed analysis wastes hours.

---

## 🔍 P0.5: NECESSITY CHECK

Before analyzing cookie/param generation, verify it's actually required:

```bash
# Test request WITHOUT target param → compare response
curl -v 'URL' -H 'Cookie: other_only' 2>&1 | head -c 3000
```

| Response | Action |
|----------|--------|
| 200 + valid | ⏭️ "该参数非必需，无需逆向" |
| 403/401/blocked | ✅ Proceed with analysis |

---

## 🛡️ RULE ONE: OUTPUT LIMITS

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

## SKILL LOADING

| Pattern | Skill |
|---------|-------|
| `_0x`, `\x`, `atob(` | `skills/js_deobfuscation.md` |
| `while(1){switch`, VM | `skills/jsvmp_analysis.md` |
| webpack, `__webpack_require__` | `skills/js_extraction.md` |

---

## 🚀 SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

If source/ has obfuscated JS but no output/*_deobfuscated.js → Deobfuscate first.

---

## P1: NO RETREAT

**Strategy switch = MUST ask user first.**

```
Stuck → Exhaust all options → Report → Ask user → Wait → Execute
                                         ↑
                                   Never skip this
```

### Forbidden

- ❌ Switching approach without asking
- ❌ Abandoning direction after one failed search
- ❌ Changing strategy on first error

### Required Template

```
📊 Progress:
- Tried: [list attempts]
- Found: [findings]
- Blocked: [specific issue]

🔀 Options:
A) [continue current direction]
B) [alternative]

Which direction?
```

### "Exhausted" Means

| # | Action |
|---|--------|
| 1 | Search 5+ keyword patterns |
| 2 | Hook key APIs (XHR, fetch, crypto) |
| 3 | Trace 3+ stack frames |
| 4 | Search bitwise ops (`>>>`, `^`, `&`) |
| 5 | Search encoding (`btoa`, `charCodeAt`) |
| 6 | Document in `notes/` |

---

## P1.5: BROWSER IS TRUTH

```javascript
// Print function source (limited!)
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")

// Explore object keys
evaluate_script(function="() => JSON.stringify(Object.keys(obj)).slice(0,1000)")
```

### ⚠️ evaluate_script Truncation Workaround

`evaluate_script` return values get truncated. For large data, log to console then save:

```javascript
// Step 1: Log to console (no truncation)
evaluate_script(function="() => console.log(JSON.stringify(largeObject))")

// Step 2: Save console output to file
list_console_messages(savePath="/absolute/path/raw/data.txt")
```

---

## P2: HOOK STRATEGIES

`evaluate_script` hooks don't survive reload. Use these alternatives:

**Option 1: Log breakpoint (recommended)**
```javascript
// Logs value without pausing - ", false" is CRITICAL
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')
```

**Option 2: Re-inject after reload**
```javascript
// After navigate_page(type="reload"), re-run evaluate_script to set up hooks
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

### URL Regex: Keep It Simple

```javascript
// ❌ OVER-ESCAPED (hard to read, error-prone)
urlRegex=".*bdms_1\\.0\\.1\\.19_fix\\.js.*"
urlPattern=".*example\\.com/api/v1\\.0.*"

// ✅ SIMPLE (dots rarely cause false matches)
urlRegex=".*bdms_1.0.1.19_fix.js.*"
urlPattern=".*example.com/api/v1.0.*"
```

**Rule**: Only escape when ambiguity matters. `file.js` won't match `fileXjs`.

### Breakpoints

```javascript
// Log breakpoint (no pause) - ", false" is CRITICAL
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
```

### ⚠️ Pausing Breakpoint = Human Triggers

After setting a pausing breakpoint, **DO NOT** call `navigate_page`/`evaluate_script`/`click` to trigger it → MCP blocks waiting = DEADLOCK.

```
✅ set_breakpoint → ASK human to refresh/click → WAIT → get_debugger_status
❌ set_breakpoint → navigate_page(type="reload") → 💀 DEADLOCK
```

**Safe to execute**: Log breakpoints (`condition='..., false'`), already-paused stepping.

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
- Visual CAPTCHA → Build OpenCV tool (`tests/`), human solves, AI verifies params
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
├── tests/           # Test cases + interactive tools
├── notes/           # Analysis notes
└── raw/             # Raw samples
```

---

## 🎯 COMPLETION CRITERIA

**Goal**: `repro/*.py` makes valid API requests with dynamically generated params.

- ✅ Algorithm reproduced in pure Python (`lib/*.py`)
- ✅ Works with fresh inputs, not just captured values
- ❌ "Algorithm identified" without working code

---

## 🤝 HUMAN-IN-THE-LOOP

For visual tasks (CAPTCHA click/slide/rotate):

```python
# tests/captcha_tool.py - AI builds, human operates
import cv2
cv2.imshow("Task", image)
cv2.setMouseCallback("Task", on_mouse)  # Capture clicks/drags
```

**Flow**: AI builds tool → Human interacts → AI collects coords → AI tests API

**Response**: `status: success` = encryption correct (coords may still be wrong)

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
