## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## 🚀 RULE ZERO: SKILL LOADING (HIGHEST PRIORITY)

**MANDATORY**: Detect keywords in user request → Load skill IMMEDIATELY before any action.

| User Keywords | Skill to Load | Action |
|---------------|---------------|--------|
| 补环境, env patch, environment, Node.js运行, ReferenceError | `readFile("skills/js_env_patching.md")` | Load FIRST |
| 混淆, deobfuscate, _0x, 解混淆, obfuscation | `readFile("skills/js_deobfuscation.md")` | Load FIRST |
| JSVMP, VM, while(true){switch}, 虚拟机 | `readFile("skills/jsvmp_analysis.md")` | Load FIRST |
| 提取, extract, webpack, bundle | `readFile("skills/js_extraction.md")` | Load FIRST |

**Execution**: 
1. Scan user message for keywords above
2. If match → `readFile("skills/xxx.md")` IMMEDIATELY
3. Then proceed with session start

**VIOLATION = SESSION FAILURE.**

---

## 🚀 SESSION START (MANDATORY)

```bash
# Check if project exists first
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
# If not exists → create new project structure
```

---

## RULE ONE: READABILITY GATE

> Load `#[[file:skills/js_deobfuscation.md]]` when obfuscation detected!

1. P-1: Minification? → Beautify FIRST
2. P0: Obfuscation? → Deobfuscate FIRST
3. ONLY THEN: Search / Debug / Analyze

**VIOLATION = SESSION FAILURE.**

---

## P-1: Minification Gate

```bash
wc -l source/*.js 2>/dev/null | head -20
# lines < 10 AND size > 50KB = MINIFIED → beautify first
npx js-beautify -f in.js -o output/{name}_formatted.js
```

**FORBIDDEN on minified**: `rg "keyword" minified.js` (1 match = 500KB output!)

**SAFE**: `rg -M 200 -o ".{0,60}keyword.{0,60}" file.js | head -20`

---

## P0: Obfuscation Gate

```bash
rg -c "_0x[a-f0-9]|\\\\x[0-9a-f]{2}" source/*.js 2>/dev/null || echo "0"
# Count > 0 → Deobfuscate first (load skills/js_deobfuscation.md)
```

---

## P0.1: NO RETREAT - PERSISTENCE IS MANDATORY

**CRITICAL**: JS reverse engineering IS hard. Difficulty is EXPECTED, not a reason to pivot.

**FORBIDDEN retreat patterns:**
```
❌ "换个思路" / "try different approach" after 1-2 attempts
❌ "Let me hook XMLHttpRequest instead" (abandoning current trace)
❌ "SM3 might be compiled into JSVMP bytecode" (speculation without proof)
❌ Switching from code analysis to network interception when stuck
❌ Giving up on a function trace because "it's too complex"
```

**MANDATORY persistence:**
```
✅ Found n.apply(d,e) → Capture return value → Trace where it flows → Keep going
✅ Function returns undefined? → Check if it modifies arguments by reference
✅ Can't find function? → Search 5+ different patterns before concluding
✅ Complex nested calls? → Trace layer by layer, document each step
✅ JSVMP detected? → Load skill, instrument VM, analyze bytecode
```

**Before ANY pivot, MUST prove ALL of these:**
1. ✅ Captured return value AND checked argument mutations
2. ✅ Traced data flow for 3+ levels deep
3. ✅ Tried 5+ different search patterns / breakpoint locations
4. ✅ Documented findings in notes/ (not just "didn't work")
5. ✅ Asked human if truly stuck (don't silently pivot)

**Pivot checklist (ALL must be YES):**
```
[ ] I captured and logged the actual runtime values
[ ] I traced the data flow until it disappeared or errored
[ ] I tried multiple breakpoint locations (not just one)
[ ] I searched for the target in 5+ different ways
[ ] I documented what I found (even partial findings)
[ ] Current approach is PROVEN impossible, not just difficult
```

**If ANY is NO → KEEP TRACING. Difficulty ≠ Dead end.**

**VIOLATION = SESSION FAILURE.**

---

## P0.2: BROWSER IS TRUTH

**When stuck → Print it in browser FIRST, then analyze code.**

```javascript
// Print function source
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")

// Explore object
evaluate_script(function="() => JSON.stringify(Object.keys(obj))")

// Log at breakpoint
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=XX,
    condition='console.log("val:", x), false')
```

**FORBIDDEN**: Guessing function behavior without browser verification.

---

## P0.3: NO evaluate_script + navigate_page LOOP

**FORBIDDEN**: `evaluate_script` hook → `navigate_page` → hook lost → repeat.

`evaluate_script` injects runtime hooks that **DO NOT survive page reload**.

```javascript
// ❌ USELESS PATTERN:
evaluate_script(function="() => { window.hook = ...; return 'hooked'; }")
navigate_page(type="reload")  // Hook is GONE!
// Agent tries evaluate_script again... infinite loop

// ✅ CORRECT: Use persistent breakpoints instead
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=1, columnNumber=XXX,
    condition='console.log("VAL:", someVar), false')
// Breakpoints survive reload!
```

**Rule**: For values needed AFTER navigation → use `set_breakpoint`, not `evaluate_script`.

---

## P0.4: DEEP FUNCTION TRACING

**When analyzing algorithm → Trace layer by layer, not surface level.**

```javascript
// Step 1: Hook function to get call stack + args
evaluate_script(function="() => {
    const orig = window.targetFunc;
    window.targetFunc = function(...args) {
        console.log('[HOOK] args:', JSON.stringify(args));
        console.log('[HOOK] stack:', new Error().stack);
        return orig.apply(this, args);
    };
    return 'hooked';
}")

// Step 2: Find inner function from stack trace → print its source
evaluate_script(function="() => innerFunc.toString().slice(0, 2000)")

// Step 3: Repeat for each layer until reaching core algorithm
```

**Pattern**: `outerFunc → innerFunc → coreAlgo` - trace ALL layers.

**FORBIDDEN**: Stopping at surface function without tracing inner calls.

---

## P0.5: CLI Output Limits (CONTEXT EXPLOSION PREVENTION)

**CRITICAL**: Single-line output can overflow context. This applies to:
- Minified JS files (1 line = 500KB)
- VM trace logs (JSON.stringify outputs massive single lines)
- Console logs from instrumentation breakpoints

**⚠️ MANDATORY: Always use `-M` to limit line length!**

`head -n` only limits LINE COUNT, not LINE LENGTH. One minified line = 500KB explosion!

```bash
# ✅ CORRECT: -M limits line length, -o extracts match with context
rg -M 200 -o ".{0,80}keyword.{0,80}" file.js      # 200 char limit + context extract
rg -M 300 -o ".{0,100}keyword.{0,100}" trace.txt  # Wider context for traces
rg -M 200 -n --column "keyword" source/file.js    # Get line:column for breakpoints

# ✅ SAFE: Other patterns with built-in limits
sed -n '1,100p' file.js                            # Range only (multi-line files)
head -c 10000 file.js                              # Bytes limit
awk -F'|' '{print $1,$2}' trace.txt | head -100   # Field extraction

# ❌ FORBIDDEN - context explosion
cat file.js                                        # Never on minified
rg "keyword" minified.js                           # Full line = disaster
rg "keyword" file.js | head -20                    # head limits lines, NOT chars!
rg -n "keyword" file.js | head -5                  # Still explodes on minified
```

**Rule**: EVERY `rg` command MUST include `-M <num>` to cap line length. Never rely on `head -n` alone.

---

## P0.6: JSVMP Instrumentation Log Safety

**CRITICAL**: VM trace breakpoints produce JSON.stringify output → single log line can be 10KB+.

```javascript
// ⚠️ Breakpoint condition outputs JSON → huge single lines
set_breakpoint(urlRegex=".*vm\.js.*", lineNumber=XX,
    condition='console.log(`[TRACE] PC:${pc} STACK:${JSON.stringify(stack)}`), false')
```

**When analyzing saved trace logs:**
```bash
# ✅ CORRECT: -M + -o together
rg -M 200 -o ".{0,80}\[TRACE\].{0,80}" vm_trace.txt | head -100
rg -M 200 -o ".{0,50}PC:42.{0,100}" vm_trace.txt | head -50

# ✅ SAFE: Extract specific fields only
awk -F'|' '{print $1,$2}' vm_trace.txt | head -100
cut -d'|' -f1-2 vm_trace.txt | head -100

# ❌ FORBIDDEN - context explosion
rg "\[TRACE\]" vm_trace.txt                        # Full line = disaster
rg "\[TRACE\]" vm_trace.txt | head -10             # head won't help, line too long!
rg -A 3 "pattern" vm_trace.txt                     # Context lines also huge
```

**Rule**: Trace logs = JSON = massive lines. MUST use `-M` + `-o` together.

---

## P0.7: No Inline Python Scripts

**FORBIDDEN**: `python -c "..."` for multi-line or complex logic (quoting/escaping breaks easily).

```bash
# ❌ BAD - will fail on special chars, quotes, newlines
python -c "import json; data='%7B%22d...'; print(json.loads(urllib.parse.unquote(data)))"

# ✅ GOOD - write to tests/, run manually
fsWrite("tests/decode_sample.py", script_content)
# Then: uv run python tests/decode_sample.py
```

**Rule**: If script > 1 line or contains quotes/special chars → write to `tests/` dir.

---

## P0.8: Python Environment (uv preferred)

```bash
# uv available → use uv (with Aliyun mirror in pyproject.toml)
uv add requests pycryptodome
uv run python tests/test_algo.py

# uv not found → fallback to venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
```

**pyproject.toml** (uv mirror):
```toml
[tool.uv]
index-url = "https://mirrors.aliyun.com/pypi/simple/"
```

**Rule**: Use `uv run python` when uv available, never bare `python`.

---

## P1: Analysis Strategy (Local-First)

**CRITICAL**: When analyzing parameter logic, prioritize LOCAL deobfuscated JS for understanding, then use BROWSER for verification.

```
Analysis Workflow:
1. READ LOCAL: output/*_formatted.js → Understand algorithm logic (readable)
2. GET LINE FROM SOURCE: rg in source/*.js → Get REAL line:column from ORIGINAL script
3. DEBUG BROWSER: set_breakpoint with SOURCE line → Verify runtime values
4. COMPARE: Local understanding + Browser values → Confirm correctness
```

**Why**: Deobfuscated code is readable but may have transform errors. Browser code is accurate but unreadable. Combine both.

⚠️ **LINE NUMBER WARNING**: Formatted/deobfuscated files have DIFFERENT line numbers than original source!

```bash
# Step 1: Read local formatted code to understand structure
readFile("output/core_formatted.js")  # Find function "encrypt" logic

# Step 2: Get REAL line:column from ORIGINAL source file (NOT formatted!)
rg -n --column "encrypt" source/core.js | head -5
# → Returns: 1:12345 (line 1, column 12345 in minified source)

# Step 3: Set breakpoint using SOURCE line:column
set_breakpoint(urlRegex=".*core\.js.*", lineNumber=1, columnNumber=12345)
```

**FORBIDDEN**: 
- Analyzing minified/obfuscated browser code directly without local reference
- Using line numbers from output/*_formatted.js for browser breakpoints

---

## Execution Flow

1. **Capture**: `list_network_requests(resourceTypes=["xhr","fetch"])` → `save_static_resource` (⚠️ absolute path!)
2. **P-1 Gate**: Minified? → beautify to `output/`
3. **P0 Gate**: Obfuscated? → deobfuscate to `output/`
4. **Identify**: Find `sign|token|nonce|ts|enc` params
5. **Locate** (clean code only): stack trace / local `rg` search
6. **Analyze**: Read LOCAL deobfuscated JS → Debug BROWSER for values
7. **Verify**: Browser value == Python output

---

## MCP Tools Quick Reference

### ⚠️ CRITICAL: ABSOLUTE PATH REQUIRED

**ALL MCP tools that save files MUST use ABSOLUTE paths!**

MCP server runs in different working directory than workspace. Relative paths will fail with `ENOENT: no such file or directory`.

```javascript
// ❌ WRONG - relative path fails
save_static_resource(reqid=23, filePath="source/main.js")
list_console_messages(savePath="raw/vm_trace.txt")
take_screenshot(filePath="debug/screenshot.png")

// ✅ CORRECT - absolute path works
save_static_resource(reqid=23, filePath="/Users/kylin/project/artifacts/jsrev/example.com/source/main.js")
list_console_messages(savePath="/Users/kylin/project/artifacts/jsrev/example.com/raw/vm_trace.txt")
take_screenshot(filePath="/Users/kylin/project/artifacts/jsrev/example.com/debug/screenshot.png")
```

**Affected MCP tools:**
- `save_static_resource(filePath=...)` - Save JS/CSS from network
- `save_network_request(filePath=...)` - Save HTTP request/response
- `list_console_messages(savePath=...)` - Save console logs
- `take_screenshot(filePath=...)` - Save screenshot
- `take_snapshot(filePath=...)` - Save page snapshot
- `save_scope_variables(filePath=...)` - Save debugger variables

**Pattern**: Always construct absolute path:
```
{workspace_root}/artifacts/jsrev/{domain}/{subdir}/{filename}
```

---

**Network**
```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
get_network_request(reqid=15)  // Check initiator/stack trace
// ⚠️ Use absolute path!
save_static_resource(reqid=23, filePath="/absolute/path/to/source/main.js")
```

**Breakpoints**

⚠️ **CRITICAL: Line Number Mismatch**

Formatted/deobfuscated files (output/) have DIFFERENT line numbers than original source (source/)!

```
output/core_formatted.js line 6526  ≠  source/core.js line 1, column 12345
```

**MANDATORY**: Get breakpoint coordinates from ORIGINAL source file, not formatted files.

```bash
# ✅ CORRECT: Search in ORIGINAL source file to get real line:column
rg -M 200 -n --column "functionName" source/core.js | head -5
# → 1:12345:functionName  (line 1, column 12345)

# Then set breakpoint with columnNumber for minified code:
set_breakpoint(urlRegex=".*core\.js.*", lineNumber=1, columnNumber=12345)

# ❌ WRONG: Using line number from formatted file
# rg found "sum" at line 6526 in output/core_formatted.js
# set_breakpoint(lineNumber=6526)  ← WILL FAIL - wrong line!
```

**Workflow for setting breakpoints:**
1. READ output/*_formatted.js → understand logic, find function/variable NAME
2. SEARCH source/*.js → `rg -M 200 -n --column "name" source/file.js` → get REAL line:column
3. SET breakpoint → use source line + columnNumber (for minified single-line files)

```javascript
// Log breakpoint (no pause) - trailing ", false" is CRITICAL
// ⚠️ urlRegex: Use SINGLE backslash (MCP handles JSON escaping)
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=1, columnNumber=12345)

// Common patterns:
// ".*5703\.app.*\.js"     ✅ Correct - matches 5703.app.xxx.js
// ".*5703\\.app.*\\.js"   ❌ Wrong - double escape, won't match
```

**When Paused**
```javascript
get_debugger_status(frameIndex=0)
get_scope_variables(frameIndex=0, searchTerm="key", pageSize=10)
evaluate_on_call_frame(expression="x", frameIndex=0)
step_over() | step_into() | step_out()
resume_execution()
```

**Console**
```javascript
list_console_messages(types=["log", "error"], pageSize=50)
// ⚠️ Save to file requires absolute path!
list_console_messages(types=["log"], savePath="/absolute/path/to/raw/console.txt")
```

**Screenshot & Snapshot**
```javascript
// ⚠️ All file paths must be absolute!
take_screenshot(filePath="/absolute/path/to/debug/screenshot.png")
take_snapshot(filePath="/absolute/path/to/debug/snapshot.txt")
save_scope_variables(filePath="/absolute/path/to/debug/variables.json")
```

**⚠️ MANDATORY Cleanup after debug session:**
```javascript
clear_all_breakpoints()
resume_execution()
```

---

## Pattern Recognition (Runtime Detection)

**When analyzing code, detect these patterns → Load skill:**

| Pattern Detected | Skill | Command |
|------------------|-------|---------|
| Single-line 50KB+ | Beautify first | `npx js-beautify` |
| `_0x` vars, hex strings | `readFile("skills/js_deobfuscation.md")` | Load then deobfuscate |
| `while(true){switch}` + stack | `readFile("skills/jsvmp_analysis.md")` | Load then trace |
| `ReferenceError: window` | `readFile("skills/js_env_patching.md")` | Load then patch |

**CRITICAL**: When pattern detected mid-session → STOP → Load skill → Continue with skill guidance.

---

## Human Interaction = ASK FOR HELP

**When to STOP and ask human:**
- Slider/Click CAPTCHA → "请手动完成验证码" → STOP
- Login required → "请登录后告诉我" → STOP

**When to REQUEST CONFIRMATION:**
- Visual verification (image match, puzzle alignment) → Generate debug image → Ask: "请确认识别是否准确"
- Coordinate/position accuracy uncertain → Save visual proof → Ask human to verify
- Algorithm output mismatch but unsure which side is wrong → Show both values → Ask human to compare
- Multiple possible interpretations of obfuscated logic → List options → Ask human to choose

**Pattern**: When AI confidence is low on visual/spatial tasks:
```
1. Generate debug output (screenshot, annotated image, coordinate overlay)
2. Save to artifacts/jsrev/{domain}/debug/
3. Ask: "请确认 [具体问题]，图片已保存到 [path]"
4. WAIT for human response before proceeding
```

**FORBIDDEN**: `evaluate_script` for drag/click simulation, `drag()` on CAPTCHAs.

---

## Output Structure

```
artifacts/jsrev/{domain}/
├── PROGRESS.md              # Current progress (REQUIRED)
├── README.md                # Project overview (REQUIRED)
├── source/                  # Original JS files (untouched)
│   └── {name}.js
├── output/                  # Processed files (beautified, deobfuscated)
│   ├── {name}_formatted.js  # After beautify
│   └── {name}_deob.js       # After deobfuscation
├── scripts/                 # Deobfuscation/transform scripts
│   └── deob_{name}.js       # AST transform scripts
├── lib/                     # Algorithm implementations (reusable)
│   ├── __init__.py
│   ├── encrypt.py
│   └── fingerprint.py
├── repro/                   # Request reproduction
│   └── {api_name}.py
├── tests/                   # Test cases
│   ├── test_algo.py
│   └── fixtures/
│       └── captured_data.json
├── notes/                   # Analysis notes
│   └── {topic}_analysis.md
└── raw/                     # Raw samples (optional)
    └── {api_name}.http
```

**Directory Responsibilities:**
- `source/` - Original JS only, never modify
- `output/` - All processed/intermediate JS files
- `scripts/` - AST transform scripts, deobfuscation tools
- `lib/` - Pure algorithm modules, no network requests, reusable
- `repro/` - Request reproduction scripts using lib/
- `tests/` - Unit tests, integration tests, test fixtures
- `notes/` - Analysis documentation

---

## PROGRESS.md Template (REQUIRED)

```markdown
# {domain} Reverse Engineering Progress

## Target
- URL: https://example.com/api/xxx
- Goal: Reproduce sign parameter generation

## Status: 🔴 In Progress | 🟡 Partial | 🟢 Complete

## Current Step
> Step 4: Analyzing encrypt function at core.js:1234
> Next: Set breakpoint to capture key generation

## Completed Steps
- [x] Step 1: Captured target request, identified sign param
- [x] Step 2: Saved core.js to source/, beautified to output/
- [x] Step 3: Deobfuscated string array, saved to output/core_deob.js
- [ ] Step 4: Locate sign generation entry point
- [ ] Step 5: Trace algorithm, identify crypto method
- [ ] Step 6: Implement in Python (lib/encrypt.py)
- [ ] Step 7: Verify browser == Python output
- [ ] Step 8: Integration test with live request

## Key Findings
- sign = MD5(timestamp + secret + params)
- Custom Base64 charset: "ABCxyz..."
- String decoder at line 45, key="xxx"

## Files
- source/core.js - Original (minified)
- output/core_formatted.js - Beautified
- output/core_deob.js - Deobfuscated (working version)
- scripts/deob_core.js - AST transform script
- lib/encrypt.py - Sign generation (WIP)

## Blockers
- None currently
```

---

## README.md Template

```markdown
# {Target Name} Reverse Engineering

## Target
- URL: https://example.com/path
- Goal: {Brief description}

## Status: 🔴 In Progress | 🟡 Partial | 🟢 Complete

## Quick Start
\`\`\`bash
uv run pytest tests/              # Run tests
uv run python repro/get_token.py  # Reproduce request
\`\`\`

## Key Findings
- sign = MD5(timestamp + secret)
- Custom Base64 charset: "ABC..."

## Files
| File | Description |
|------|-------------|
| output/core_deob.js | Deobfuscated core JS |
| lib/encrypt.py | Sign generation |
| repro/get_token.py | Token request reproduction |
```

---

## Reference Skills (Load on Demand)

| Skill | When to Load | Command |
|-------|--------------|---------|
| `skills/js_deobfuscation.md` | AST transforms, anti-debug, string decode | `readFile("skills/js_deobfuscation.md")` |
| `skills/jsvmp_analysis.md` | VM analysis, breakpoint instrumentation | `readFile("skills/jsvmp_analysis.md")` |
| `skills/js_env_patching.md` | Node.js env, Proxy detection, mock objects | `readFile("skills/js_env_patching.md")` |
| `skills/js_extraction.md` | Safe slicing, Webpack extraction | `readFile("skills/js_extraction.md")` |

**Rule**: When user mentions skill-related keywords or pattern detected → Load skill BEFORE proceeding.

---

## Entry Point Location Techniques

1. **Call Stack** - `get_network_request(reqid)` → check initiator
2. **Local Search** - `rg "sign|encrypt" output/*_deob.js`
3. **Browser Print** - `evaluate_script` to print function source directly

---

## Algorithm Identification

**Standard signatures:**
- 32-char hex → MD5
- 40-char hex → SHA-1
- 64-char hex → SHA-256
- `0x67452301` constant → MD5 IV
- `0x6a09e667` constant → SHA-256 IV

**Porting strategy:**
- Simple (MD5/SHA/Base64) → Python direct
- Medium (AES/RSA) → Python + pycryptodome
- Complex (env checks) → `readFile("skills/js_env_patching.md")` then follow guide

---

## ⚠️ Legal Disclaimer

For authorized security research, API compatibility, and educational purposes only.
