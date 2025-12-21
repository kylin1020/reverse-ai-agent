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
| webpack, `__webpack_require__` | `skills/js_extraction.md` |

---

## 🚀 SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

If source/ has obfuscated JS but no output/*_deobfuscated.js → Deobfuscate first.

---

## 🎯 P0.8: CALL STACK FIRST (IRON LAW)

**CRITICAL**: When you have a target request, ALWAYS trace from call stack. NEVER search blindly.

### The Only Correct Flow

```
1. Identify target request (XHR/fetch with target param)
2. Set XHR/fetch breakpoint → trigger request → PAUSE
3. Read call stack → find param generation frame
4. Step through that frame → extract algorithm
```

### ❌ FORBIDDEN Approach (Wastes Hours)

```
❌ rg "paramName" *.js           # Blind search = noise
❌ rg "sign|encrypt|token" *.js  # Generic patterns = 100+ matches
❌ Guessing which function generates param
❌ Reading random code hoping to find logic
```

### ✅ REQUIRED Approach (5-10 min)

```javascript
// Step 1: Set breakpoint on XHR/fetch send
set_breakpoint(urlRegex=".*", lineNumber=1, 
    condition='console.log("XHR:", arguments), false')
// OR use Network panel → find request → right-click → "Break on..."

// Step 2: Human triggers request, debugger pauses

// Step 3: Read call stack - THIS IS THE GOLD
get_debugger_status(maxCallStackFrames=20)
// Call stack shows EXACT path: 
//   frame 0: fetch/XHR.send
//   frame 1: makeRequest(url, params)  ← params already built
//   frame 2: buildParams(data)         ← PARAM GENERATION HERE
//   frame 3: handleClick()

// Step 4: Jump to param generation frame
get_debugger_status(frameIndex=2)  // buildParams frame
get_scope_variables(frameIndex=2)  // See local vars

// Step 5: Now you know EXACT file + line + function
// Set breakpoint there, step through, extract algorithm
```

### Why Call Stack > Search

| Method | Time | Accuracy | Noise |
|--------|------|----------|-------|
| Call stack trace | 5 min | 100% | Zero |
| Keyword search | 30+ min | ~20% | Massive |
| Random code reading | Hours | ~5% | Infinite |

**The call stack is TRUTH. It shows the EXACT execution path. No guessing.**

### Quick Reference: Breakpoint Strategies

| Goal | Breakpoint |
|------|------------|
| Catch all XHR | `set_breakpoint` on `XMLHttpRequest.prototype.send` |
| Catch all fetch | `set_breakpoint` on `fetch` wrapper |
| Catch specific URL | `set_breakpoint(urlRegex=".*api/target.*", ...)` |
| Catch param assignment | After finding frame, breakpoint on that line |

### After Finding Generation Frame

1. Note file + line number from call stack
2. Save that JS file: `save_static_resource(reqid=X, filePath="...")`
3. Read the function in local file
4. Set precise breakpoint, step through
5. Extract algorithm → implement in Python

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

### "Exhausted" Means (IN ORDER)

| # | Action | Priority |
|---|--------|----------|
| 1 | Trace call stack from target request | **FIRST** |
| 2 | Step through 5+ stack frames | **FIRST** |
| 3 | Inspect scope variables at each frame | **FIRST** |
| 4 | Hook key APIs (XHR, fetch, crypto) | Backup |
| 5 | Search bitwise ops (`>>>`, `^`, `&`) | Last resort |
| 6 | Search encoding (`btoa`, `charCodeAt`) | Last resort |
| 7 | Document in `notes/` | Always |

**Call stack tracing is NOT optional. It's step 1.**

---

## P1.5: BROWSER IS TRUTH

```javascript
// Print function source (limited!)
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")

// Explore object keys
evaluate_script(function="() => JSON.stringify(Object.keys(obj)).slice(0,1000)")
```

### 🛡️ Infinite Debugger Bypass

**Flow**: Page triggers debugger → Read call stack → `replace_script` → Reload verify

```javascript
// 1. Already paused at debugger, check call stack
get_debugger_status(contextLines=5)
// 2. Find source from stack, replace anti-debug code
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
// 3. Reload with short timeout (will pause again if not bypassed)
navigate_page(type="reload", timeout=3000)
```

**❌ Forbidden**: Guessing location, searching "debugger" blindly, analyzing without stack
**✅ Required**: Call stack = truth, replace exact code from stack trace

**常见反调试模式**:
| 模式 | 替换策略 |
|------|----------|
| `debugger;` | 直接删除 |
| `setInterval(()=>{debugger},100)` | 删除整个 setInterval |
| `constructor("debugger")()` | 替换为空函数 |
| `Function("debugger")()` | 替换为空函数 |

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

### ❌ `evaluate_script` Cannot Survive Refresh
Runtime hooks live in page memory → refresh clears all → hook gone. **No workaround.**

⚠️ `persistent=true` does NOT help — it only auto-runs on NEW navigations, not refreshes of current page.

### ✅ Refresh-Safe Alternatives

**Option 1: Log breakpoint (best)**
```javascript
// CDP-level, survives refresh
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=123,
    condition='console.log("VAR:", someVar), false')
```

**Option 2: Script replacement (modify source)**
```javascript
// Intercepts script load, injects code into source itself
replace_script(urlPattern=".*target.js.*",
    oldCode="function sign(data)",
    newCode="function sign(data){console.log('SIGN:',data);")
// Refresh → modified script loads → hook active
```

**Rule**: Need hook after refresh? Use `set_breakpoint` or `replace_script`. Never `evaluate_script`.

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

## P6: ANALYSIS WORKFLOW

### 🎯 Primary Method: Call Stack Trace (ALWAYS FIRST)

```
1. INTERCEPT: Set breakpoint on target request
2. TRIGGER: Human triggers the action
3. TRACE: Read call stack → find param generation frame
4. LOCATE: Get exact file + line + function
5. ANALYZE: Step through, extract algorithm
6. IMPLEMENT: Reproduce in Python
```

### Backup Method: Local Code Analysis (Only After Call Stack)

1. READ LOCAL: `output/*_formatted.js` → understand logic
2. GET LINE FROM SOURCE: `rg -M 200 -n --column` in `source/*.js`
3. DEBUG BROWSER: `set_breakpoint` with SOURCE line:column
4. COMPARE: Local + Browser → confirm

⚠️ Formatted files have DIFFERENT line numbers than source!

**NEVER skip call stack tracing to jump directly to code search.**

---

## MCP TOOLS

### ⚠️ ABSOLUTE PATH REQUIRED

```javascript

// ✅ CORRECT
save_static_resource(reqid=23, filePath="artifacts/jsrev/example.com/source/main.js")
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

### Script Replacement (Modify JS Before Execution)

Intercept and modify scripts on page refresh. Changes persist until removed.

```javascript
// Replace code snippet in matching script (takes effect after refresh)
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")

// List active replacement rules
list_script_replacements()

// Remove specific rule
remove_script_replacement(ruleId="rule-123")

// Clear all rules
clear_script_replacements()
```

**Use cases**: Remove anti-debug, inject logging, bypass checks.

⚠️ **Requires page refresh** to take effect. Rule persists across refreshes.

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
