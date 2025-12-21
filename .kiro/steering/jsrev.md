---
inclusion: manual
---

# jsrev

**Focus**: Reverse engineer JS encryption/signing algorithms → reproduce in Python.

**NOT**: Browser automation, environment patching, or running JS in Node.

**Goal**: `lib/*.py` contains pure algorithm implementation, `repro/*.py` makes valid API requests.

---

## ⚠️ DISCIPLINE RULES

**STAY FOCUSED**: Do NOT switch approaches frequently. Complexity is expected — commit to current approach until exhausted.

**DEOBFUSCATION IS MANDATORY**: Once started, MUST complete. No shortcuts, no "let me try another way".

```
❌ "Code is messy, let me try breakpoints instead" → WRONG
❌ "Too complex, switching to runtime analysis" → WRONG  
✅ Complete deobfuscation → THEN analyze clean code
```

**Why**: Partial deobfuscation = wasted effort. Clean code is prerequisite for ALL subsequent analysis.

---

## 🚀 SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

If source/ has obfuscated JS but no output/*_deobfuscated.js → Deobfuscate first.

---

## P0: DEOBFUSCATION GATE (MANDATORY FIRST STEP)

**IRON LAW**: Analysis REQUIRES clean code. No exceptions.

### Step 1: Beautify First

```bash
npx js-beautify -f {file} -o {output_file}
```

### Step 2: AI-Based Obfuscation Detection

Read the first 3000 characters and analyze for obfuscation patterns:

```bash
head -c 3000 {file}
```

**Obfuscation Indicators** (any match = obfuscated):

| Pattern | Example | Indicator |
|---------|---------|-----------|
| Hex variable names | `_0x4a3b`, `_0xabc123` | obfuscator-io style |
| Hex/Unicode escapes | `\x48\x65`, `\u0048` | String encoding |
| Large string array | `var a=["str1","str2",...]` | String table rotation |
| Control flow flattening | `while(true){switch(x){case...}}` | CFG obfuscation |
| Comma expression abuse | `(a=1,b=2,c=3,fn())` | Expression flattening |
| Anti-debug | `debugger`, `Function("debugger")` | Protection mechanism |
| Meaningless names | Single letters, random strings | Identifier mangling |
| Dead code injection | Unreachable branches, unused vars | Code bloating |

**Decision**:

| Assessment | Action |
|------------|--------|
| Obfuscated | STOP → `skills/js_deobfuscation.md` |
| Clean/Minified only | Proceed (beautify is sufficient) |

### Forbidden on Obfuscated Code

- ❌ Setting breakpoints, searching patterns, tracing call stacks
- ❌ "Despite obfuscation, I can see..."
- ❌ Analyzing variable names like `_0x4a3b2c`

**Why**: Obfuscated analysis = 100% failure rate.

---

## P0.5: NECESSITY CHECK

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

## P1: LOCATE ALGORITHM (Two Approaches)

**After deobfuscation**, use either or both approaches to find the algorithm:

### Approach A: Keyword Search (Fast, on clean code)

```bash
# Encryption/Hashing
rg -M 200 -o ".{0,60}(md5|sha1|sha256|hmac|encrypt|decrypt|hash).{0,60}" output/*.js | head -30

# Signing
rg -M 200 -o ".{0,60}(sign|signature|token|secret|key).{0,60}" output/*.js | head -30

# Encoding
rg -M 200 -o ".{0,60}(base64|btoa|atob|encode|decode).{0,60}" output/*.js | head -30

# Target parameter name
rg -M 200 -o ".{0,60}(targetParamName).{0,60}" output/*.js | head -30
```

| Pattern | Likely Algorithm |
|---------|------------------|
| `0x67452301`, `0x98badcfe` | MD5 constants |
| `0x6a09e667`, `0xbb67ae85` | SHA-256 constants |
| `charCodeAt`, XOR loops | Custom encoding |
| `CryptoJS`, `crypto` | Library usage |

### Approach B: Call Stack Tracing (Precise, ground truth)

Call stack reveals the ACTUAL execution path — this is the most reliable way to locate algorithm.

**Step 1: Locate Target Request**
```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
// Find request containing target parameter
```

**Step 2: Set XHR/Fetch Breakpoint**
```javascript
set_breakpoint(urlRegex=".*api/endpoint.*", lineNumber=1)
// Tell user: "Breakpoint set, please refresh/trigger request"
```

**Step 3: Analyze Call Stack**
```javascript
get_debugger_status(maxCallStackFrames=30)
```

Trace backwards through frames to find algorithm source:
| Frame | File | Function | Purpose |
|-------|------|----------|---------|
| 0 | xhr.js | send | Request sent |
| 1 | api.js | request | Wrapper |
| 2 | sign.js | generateSign | ⭐ Algorithm |
| ... | ... | ... | Continue tracing up |

**Step 4: Inspect Variables at Key Frame**
```javascript
get_scope_variables(frameIndex=2, pageSize=20)
```

### When to Use Which

| Situation | Recommended Approach |
|-----------|---------------------|
| Clean code with meaningful names | Keyword search first, verify with breakpoint |
| Complex/unfamiliar codebase | Call stack tracing |
| Keyword search yields too many results | Call stack to pinpoint exact location |
| Need to understand data flow | Call stack tracing |

**Best practice**: Use both — keyword search to get candidates, call stack to verify and trace data flow.

---

## P2: BREAKPOINT VERIFICATION

**After identifying candidate functions**, use breakpoints to verify:

### Set Breakpoint on Candidate

```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1234)
```

**Then tell user**: "Breakpoint set at `generateSign()`. Please refresh page/trigger request."

### Verify Parameters

When paused:
```javascript
get_debugger_status(contextLines=5)
get_scope_variables(frameIndex=0, pageSize=20)
```

Check:
- [ ] Input parameters match expected format
- [ ] Output matches target parameter value
- [ ] This is indeed the algorithm entry point

### Step Through Algorithm

```javascript
step_into()   // Enter function
step_over()   // Execute line by line
// Record transformations at each step
```

---

## 🛡️ OUTPUT LIMITS (CRITICAL)

**ALL commands MUST limit output to prevent context explosion.**

### Universal Limits

| Command | Safe Pattern | Forbidden |
|---------|--------------|-----------|
| `rg` | `rg -M 200 -o ".{0,80}pattern.{0,80}"` | `rg "pattern" file.js` |
| `cat` | `head -c 10000 file.js` | `cat file.js` |
| `head` | `head -c 5000` (bytes) | `head -n 50` on minified |
| `tail` | `tail -c 5000` | `tail -n 50` on minified |

### Why `head -n` Fails

```bash
# Minified JS = 1 line = 500KB
head -n 1 minified.js    # ❌ Returns 500KB!
head -c 5000 minified.js # ✅ Returns 5KB max
```

### read_file Tool Limits

```text
# ❌ NEVER read entire minified JS files
readFile("bundle.min.js")  # Could be 500KB+ single line!

# ✅ ALWAYS limit line range for JS files
readFile("file.js", start_line=1, end_line=100)
```

**VIOLATION = CONTEXT OVERFLOW = SESSION FAILURE.**

---

## SKILL LOADING

| Pattern | Skill |
|---------|-------|
| P0 detection match | `skills/js_deobfuscation.md` |
| webpack, `__webpack_require__` | `skills/js_extraction.md` |
| `while(true){switch}` + state machine | `skills/jsvmp_analysis.md` |

---

## P4: BROWSER RUNTIME

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
// 3. Reload
navigate_page(type="reload", timeout=3000)
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

## P5: HOOK STRATEGIES

### ❌ `evaluate_script` Cannot Survive Refresh

### ✅ Refresh-Safe Alternatives

**Option 1: Log breakpoint (best)**
```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')
```

**Option 2: Script replacement**
```javascript
replace_script(urlPattern=".*target.js.*",
    oldCode="function sign(data)",
    newCode="function sign(data){console.log('SIGN:',data);")
```

---

## P6: PYTHON IMPLEMENTATION

```bash
# ❌ BAD - inline python
python -c "import json; ..."

# ✅ GOOD - file-based
fsWrite("tests/decode.py", content)
uv run python tests/decode.py
```

### Environment

```bash
uv add requests pycryptodome
uv run python tests/test.py
```

---

## MCP TOOLS REFERENCE

### ⚠️ ABSOLUTE PATH REQUIRED

```javascript
save_static_resource(reqid=23, filePath="/project_dir/artifacts/jsrev/example.com/source/main.js")
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
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
```

### ⚠️ Pausing Breakpoint = Human Triggers

After setting a pausing breakpoint, **DO NOT** call `navigate_page`/`evaluate_script`/`click` to trigger it → DEADLOCK.

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

### Script Replacement

```javascript
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
list_script_replacements()
remove_script_replacement(ruleId="rule-123")
clear_script_replacements()
```

### Cleanup (MANDATORY)

```javascript
clear_all_breakpoints()
resume_execution()
```

---

## HUMAN INTERACTION

**Delegate to human when:**
- Pausing breakpoint set → "Breakpoint ready. Please refresh/click to trigger, then tell me."
- Slider/CAPTCHA interaction → Human performs, AI analyzes result
- Login/auth required → "Please login first"
- Complex UI interactions (drag, multi-step clicks)
- Operations causing repeated failures

**Focus on**: Analysis, pattern recognition, code understanding. Let human handle browser interactions.

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

**Goal**: `repro/*.py` makes valid API requests with dynamically generated params.

- ✅ Algorithm reproduced in pure Python (`lib/*.py`)
- ✅ Works with fresh inputs, not just captured values
- ❌ "Algorithm identified" without working code

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
