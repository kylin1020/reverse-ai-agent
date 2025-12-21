---
inclusion: manual
---

# ⛔ SUPREME DIRECTIVE: CALL STACK ANALYSIS FIRST

> **Call stack analysis is the ONLY correct starting point. Searching, guessing, or switching methods is WRONG.**
>
> If you catch yourself saying "let me try another approach" — STOP. You are violating the rules.

## jsrev

**Focus**: Reverse engineer JS encryption/signing algorithms → reproduce in Python.

**NOT**: Browser automation, environment patching, or running JS in Node.

**Goal**: `lib/*.py` contains pure algorithm implementation, `repro/*.py` makes valid API requests.

---

## 🚨 IRON LAW: CALL STACK ANALYSIS IS MANDATORY

### The Golden Rule

**Call stack = Ground truth. Everything else is auxiliary.**

Dynamic analysis via call stack reveals the ACTUAL execution path. Static analysis (searching, reading code) is ONLY for supplementing what you learn from the call stack.

### ❌ FORBIDDEN BEHAVIORS (IMMEDIATE VIOLATION)

1. **Switching methods** — Before call stack analysis is complete, NO other methods allowed
2. **Blind searching** — NO searching code without call stack context
3. **Skipping frames** — MUST analyze frame by frame, cannot skip any relevant frame
4. **Abandoning direction** — One failure is NOT a reason to give up

### ✅ MANDATORY WORKFLOW (Execute in strict order)

```
Phase 1: Locate Target Request
├── list_network_requests → Find request containing target parameter
├── Record: reqid, URL, target parameter name
└── Confirm: This is the request I need to analyze

Phase 2: Set Breakpoint and Wait
├── set_breakpoint(urlRegex=".*targetURL.*", lineNumber=1)
├── Tell user: "Breakpoint set, please refresh page/trigger request"
└── Wait for user confirmation before continuing

Phase 3: Deep Call Stack Analysis (CORE!)
├── get_debugger_status(maxCallStackFrames=30)
├── Starting from stack top, record each frame:
│   ├── Frame 0: filename, line number, function name, key variables
│   ├── Frame 1: ...
│   ├── Frame N: Find the source of parameter generation
│   └── Continue tracing upward until algorithm entry point found
├── get_scope_variables(frameIndex=N) to inspect variables at each key frame
└── Output: Complete call chain diagram

Phase 4: Deep Dive Along Call Chain
├── Starting from algorithm entry point, step_into/step_over
├── Record input/output changes at each step
├── Identify: encryption functions, encoding functions, hash functions
└── Continue tracing until complete algorithm understood

Phase 5: Code Extraction and Implementation
├── Save relevant source code to source/
├── Document algorithm logic in notes/
└── Implement Python version in lib/
```

### 🔒 PHASE LOCK: Cannot proceed to next phase without completing current phase

| Current Phase | Completion Criteria | Forbidden Actions |
|---------------|---------------------|-------------------|
| Phase 3 Call Stack Analysis | Complete call chain recorded | NO searching code, NO guessing |
| Phase 4 Deep Analysis | Algorithm flow understood | NO switching to other functions |

### 📊 Call Stack Analysis Output Template (MUST complete)

```markdown
## Call Stack Analysis Results

### Target Request
- URL: {url}
- Target Parameter: {param_name}
- Current Value: {param_value}

### Call Chain (from request initiation to parameter generation)
| Frame | File | Line | Function | Purpose |
|-------|------|------|----------|---------|
| 0 | xhr.js | 123 | send | Send request |
| 1 | api.js | 456 | request | Wrap request |
| 2 | sign.js | 789 | generateSign | ⭐ Signature generation |
| ... | ... | ... | ... | ... |

### Key Findings
- Signature function location: {file}:{line}
- Input parameters: {inputs}
- Output format: {output_format}
- Algorithm characteristics: {algorithm_hints}

### Next Steps
- [ ] Deep dive into Frame {N}'s {function_name}
```

---

## 🛑 SELF-CHECK: Method Switching Requires User Approval

### Trigger Word Detection (Saying these = IMMEDIATE STOP)

| Forbidden Phrases | Correct Action |
|-------------------|----------------|
| "Let me try another method" | STOP → Report current progress → Wait for user instruction |
| "Search didn't find it, let me try..." | STOP → You should be using call stack, not searching |
| "This direction isn't working" | STOP → List what you've tried → Ask user |
| "Let me directly analyze..." | STOP → You skipped call stack analysis |

### Correct Help Request Template

```
📊 Current Progress:
- Phase: {current phase}
- Completed: {specific content}
- Problem encountered: {specific problem}

❓ Need Confirmation:
- Continue current direction?
- Or would you like me to try: {alternative approach}
```

**Switching methods without user approval = SERIOUS VIOLATION**

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
| 200 + valid | ⏭️ "This parameter is not required, no need to reverse" |
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

## P1: CONTINUOUS DEEP ANALYSIS (NO RETREAT)

### 🎯 Core Principle: Follow the call stack continuously, no lateral jumping

```
Correct Path:
Frame 0 → Frame 1 → Frame 2 → ... → Algorithm Source
   ↓         ↓         ↓
 Check vars  Check vars  Check vars

Wrong Path:
Frame 0 → Search code → Switch function → Guess → Fail
```

### ✅ Correct Way to Continue Analysis

```javascript
// 1. Get complete call stack
get_debugger_status(maxCallStackFrames=30)

// 2. Analyze frame by frame (DO NOT skip!)
for (frameIndex = 0; frameIndex < stackDepth; frameIndex++) {
    get_scope_variables(frameIndex=frameIndex, pageSize=20)
    // Record: What is this frame doing? What's the input? What's the output?
}

// 3. After finding key frame, dive into that function
step_into()  // Enter function internals
// Continue step_over/step_into until algorithm understood
```

### ❌ Forbidden Analysis Patterns

| Wrong Pattern | Why It's Wrong | Correct Approach |
|---------------|----------------|------------------|
| Glance at call stack then search | No deep analysis | Check variables frame by frame |
| Search fails so switch methods | Search is only auxiliary | Return to call stack and continue |
| Jump between multiple functions | Loses analysis thread | Follow one path deep |
| Guess function behavior | Unreliable | step_into to actually execute |

### 📋 Analysis Checklist (MUST complete for each stack frame)

- [ ] Record function name and file location
- [ ] Check local variables `get_scope_variables(frameIndex=N)`
- [ ] Understand this frame's input and output
- [ ] Determine if this is algorithm core (encryption/signing/encoding)
- [ ] If it's core, step_into for deep analysis

### 🔄 Correct Flow When Encountering Difficulties

```
Difficulty → Check if call stack analysis complete → Not complete → Continue analysis
                                                          ↓
                                                       Complete
                                                          ↓
                                                  Report progress → Wait for user instruction
```

**Definition of "exhausted all options" (MUST follow order):**

1. ✅ Fully analyzed every frame in call stack
2. ✅ Checked variables at each key frame
3. ✅ step_into entered algorithm functions
4. ✅ Recorded algorithm input/output
5. ✅ Documented findings in notes/
6. ⏸️ Only after completing ALL above steps can you report "need help"

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

**Common Anti-Debug Patterns**:
| Pattern | Replacement Strategy |
|---------|---------------------|
| `debugger;` | Delete directly |
| `setInterval(()=>{debugger},100)` | Delete entire setInterval |
| `constructor("debugger")()` | Replace with empty function |
| `Function("debugger")()` | Replace with empty function |

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
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
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

```
1. Call stack trace → get file + line + function
2. Save source file, read locally
3. Search related code using names from stack (AUXILIARY only)
4. Set breakpoint, step through
5. Implement in Python
```

⚠️ Formatted files have DIFFERENT line numbers than source!

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
