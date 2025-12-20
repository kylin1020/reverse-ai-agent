## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## ⚠️ PRE-ACTION CHECKLIST (READ BEFORE EVERY ACTION) ⚠️

Before you do ANYTHING with JavaScript code, answer these questions:

```
□ Have I checked if this code is obfuscated?
  → If NO: Run obfuscation check FIRST
  → If YES and obfuscated: STOP. Load deobfuscation skill. Do NOT analyze.
  → If YES and clean: Proceed

□ Am I about to analyze/search/debug obfuscated code?
  → If YES: STOP IMMEDIATELY. This is FORBIDDEN.
```

**If you catch yourself saying "despite the obfuscation" or "I can see _0x variables" → YOU ARE VIOLATING THE RULES. STOP.**

---

## 🚨🚨🚨 RULE ZERO: DEOBFUSCATION GATE (ABSOLUTE BLOCKER) 🚨🚨🚨

### ⛔ THIS IS A HARD GATE - NO EXCEPTIONS ⛔

**WORKFLOW ENFORCED:**
```
[See JS Code] → [CHECK OBFUSCATION] → [BLOCKED until clean] → [Analysis]
                      ↓
              Obfuscated? ──YES──→ STOP. Load skill. Deobfuscate. DO NOT PROCEED.
                      ↓
                     NO ──→ Continue to analysis
```

### 🔴 IMMEDIATE ACTION REQUIRED

When you encounter ANY JavaScript file, you MUST:

**STEP 1: RUN THIS CHECK FIRST (NON-NEGOTIABLE)**
```bash
head -c 3000 {file} | rg -o "_0x[a-f0-9]{4,6}|\\\\x[0-9a-f]{2}|\\\\u00[0-9a-f]{2}|atob\\(" | head -5
```

**STEP 2: EVALUATE RESULT**
- **ANY match found** → Code is OBFUSCATED → **STOP HERE**
- **No match** → Code is clean → Proceed to analysis

### 🔴 IF OBFUSCATED: MANDATORY SEQUENCE (NO SKIPPING)

```
1. SAY: "检测到混淆代码，必须先去混淆才能分析。"
2. DO:  readFile("skills/js_deobfuscation.md")
3. DO:  Apply deobfuscation techniques from the skill
4. DO:  Save clean code to output/ directory
5. THEN: Analyze the CLEAN code only
```

### ❌ FORBIDDEN ACTIONS ON OBFUSCATED CODE

You are **PROHIBITED** from doing ANY of these on obfuscated code:
- ❌ Setting breakpoints
- ❌ Searching for patterns
- ❌ Analyzing control flow
- ❌ Tracing execution
- ❌ Reading function logic
- ❌ "Let me try to understand this..."
- ❌ "I can see that this function..."
- ❌ "Despite the obfuscation, I notice..."

### ✅ THE ONLY VALID RESPONSE TO OBFUSCATED CODE

```
"这段代码是混淆的（检测到 _0x/\x/atob 等特征）。
根据规则，我必须先去混淆才能继续分析。
正在加载去混淆技能..."

→ readFile("skills/js_deobfuscation.md")
```

### 🧠 WHY THIS MATTERS

Analyzing obfuscated code directly = **GUARANTEED FAILURE**:
- Variable names are meaningless (`_0x4a3b`)
- String literals are encoded
- Control flow is scrambled
- You WILL make wrong conclusions
- You WILL waste the entire session

**Deobfuscation is NOT optional. It is the PREREQUISITE.**

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

## 🚀 RULE TWO: SKILL LOADING (AUTO-TRIGGER)

**When you detect these patterns, IMMEDIATELY load the corresponding skill:**

| Pattern Detected | Action | Priority |
|------------------|--------|----------|
| `_0x`, `\x`, `atob(` | `readFile("skills/js_deobfuscation.md")` | 🔴 BLOCKING |
| 补环境, ReferenceError | `readFile("skills/js_env_patching.md")` | Normal |
| `while(1){switch`, VM | `readFile("skills/jsvmp_analysis.md")` | Normal |
| webpack, `__webpack_require__` | `readFile("skills/js_extraction.md")` | Normal |

**🔴 BLOCKING means: Do NOT proceed until skill is loaded and applied.**

---

## 🎯 CAPTCHA VERIFICATION WORKFLOW

**AI cannot solve visual CAPTCHAs** (click/slide/rotate). Use human-in-the-loop:

```
[Load CAPTCHA] → [Build Visual Tool] → [Human Interaction] → [Verify Params]
```

### Workflow
1. **Build interactive tool** (`tests/captcha_test.py`) using OpenCV
2. **Display**: CAPTCHA image + reference icons/slider
3. **Human**: clicks/slides/rotates in visual tool
4. **Capture**: convert to API coordinates
5. **Submit**: verify encryption algorithm is correct

### Response Interpretation
- `status: success` → Encryption algorithm correct (server decrypted w param)
- `result: fail` → Coordinates wrong (expected with test data)
- `result: success` → Full verification passed

**Key**: If `status: success`, encryption is correct. Coordinate issues are separate.

---

## 🚀 SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
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

**STOP and ask:**
- Slider/Click CAPTCHA → Build visual tool, human solves, verify params
- Login required → "Please login first"
- Pausing breakpoint + need trigger → "Breakpoint set. Please refresh/click to trigger, then tell me."

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
├── tests/           # Test cases + interactive tools
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
