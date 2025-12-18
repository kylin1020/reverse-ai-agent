## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## 🚨 P-1: Minification Gate (MANDATORY BEFORE ANY SEARCH)

**BEFORE using rg/grep/search on ANY JS file, check if it's minified:**

```bash
# Check line count and file size
wc -l source/*.js 2>/dev/null | head -20
# If any file shows: "1 filename.js" or "2 filename.js" with size > 50KB → MINIFIED

# Quick minification detection (lines < 10 AND size > 50KB = minified)
for f in source/*.js; do
  [ -f "$f" ] && lines=$(wc -l < "$f") && size=$(wc -c < "$f") && \
  [ "$lines" -lt 10 ] && [ "$size" -gt 50000 ] && echo "MINIFIED: $f ($lines lines, $size bytes)"
done
```

| Result | Action |
|--------|--------|
| MINIFIED detected | **MANDATORY**: Beautify FIRST before any search/analysis |
| Normal multi-line | Proceed to P0 |

### P-1 Beautification Protocol (EXECUTE THIS)

**For minified files, beautify BEFORE any search operations:**

```bash
# Option 1: js-beautify (recommended)
npx js-beautify -f source/minified.js -o source/minified_formatted.js

# Option 2: prettier
npx prettier --write source/minified.js --parser babel

# Option 3: Quick inline (if tools unavailable)
# Use browser DevTools → Sources → Pretty Print → Copy
```

**After beautification:**
- All subsequent analysis uses `*_formatted.js` or the beautified version
- Original minified file kept for reference only
- Now safe to proceed to P0 Obfuscation Gate

### ⛔ FORBIDDEN (Context Overflow = Session Death)

```bash
# ❌ NEVER run these on minified files:
rg "keyword" minified.js           # 1 match = 500KB output!
rg -C2 "keyword" minified.js       # Context lines = 1.5MB!
grepSearch on minified files       # Same problem
search_script_content without beautifying first

# ❌ NEVER use line limits on minified files (USELESS):
rg "keyword" minified.js | head -5  # Still 500KB per line!
```

### ✅ SAFE Operations on Minified Files (If Beautification Not Possible)

```bash
# Character-limited extraction only:
rg -o ".{0,60}keyword.{0,60}" file.js | head -20
rg -n --column "keyword" file.js | cut -d: -f1-3 | head -20
sed -n '1p' file.min.js | cut -c1000-2000

# MCP tools with strict limits:
search_script_content(pattern="...", pageSize=3, maxTotalChars=300)
search_functions(namePattern="...", pageSize=5, maxCodeLines=10)
```

---

## 🚨 P0: Obfuscation Gate (MANDATORY - NO EXCEPTIONS)

**BEFORE any JS analysis, run this check:**

```bash
# Quick detection (run on beautified files if P-1 was triggered)
rg -c "_0x[a-f0-9]|\\\\x[0-9a-f]{2}" source/*.js 2>/dev/null || echo "0"
```

| Result | Action |
|--------|--------|
| Count > 0 | **MANDATORY**: Execute P0 Deobfuscation Protocol below |
| Count = 0 | Proceed to P1 |

### ⛔ FORBIDDEN EXCUSES (Will Be Rejected)

These are **NOT valid reasons** to skip deobfuscation:

| ❌ Invalid Excuse | ✅ Correct Action |
|-------------------|-------------------|
| "Code is too complex" | Use hybrid approach: browser + AST |
| "It's a core SDK, hard to deobfuscate" | SDKs are the PRIMARY target - deobfuscate them |
| "Let me use debugger directly instead" | Debugger on obfuscated code = wasted effort |
| "Deobfuscation might break the code" | That's why we verify after each transform |
| "I'll just trace the values" | Tracing `_0x4a2f['push'](_0x3b1c)` is useless |

### P0 Deobfuscation Protocol (EXECUTE THIS)

**Step 1: Load Skill**
```
Load #[[file:skills/js_deobfuscation.md]]
```

**Step 2: Choose Strategy Based on Complexity**

```
Obfuscation Level?
├─ Light (just hex vars, no string array)
│     └─ AST-only: §3 transforms → save *_clean.js
│
├─ Medium (string array + decoder function)
│     └─ Hybrid: Browser capture (§2.2) → AST replace (§3.3) → save *_clean.js
│
└─ Heavy (RC4/XOR decoder, shuffler, anti-debug)
      └─ Full Hybrid Protocol (see below)
```

**Step 3: Full Hybrid Protocol (For Heavy Obfuscation)**

```javascript
// 1. Bypass anti-debug FIRST (if present)
//    - Check for `debugger` statements, timing checks
//    - Apply §1 bypasses before any breakpoints

// 2. Capture string array AFTER init (in browser)
set_breakpoint(
    breakpointId="capture_strings",
    urlRegex=".*target\\.js.*",
    lineNumber=XX,  // AFTER shuffler IIFE completes
    condition='console.log("STRINGS:", JSON.stringify(window._0xabc || _0xabc)), false'
)

// 3. Capture decoder function behavior (sample 5-10 indices)
set_breakpoint(
    breakpointId="sample_decoder",
    urlRegex=".*target\\.js.*",
    lineNumber=YY,
    condition='console.log("DECODE:", JSON.stringify({idx: arguments[0], result: _0xdef(arguments[0])})), false'
)

// 4. Trigger page load/action → collect console logs
list_console_messages(types=["log"])

// 5. Build decoder map from browser output
// 6. Apply AST transforms with captured data
// 7. Save to source/<name>_clean.js
// 8. Verify: key values in clean code == browser values
```

**Step 4: Verification (MANDATORY)**

After deobfuscation, verify the clean code is equivalent:
```javascript
// Set breakpoint in ORIGINAL obfuscated code
set_breakpoint(breakpointId="verify_orig", urlRegex=".*orig\\.js.*", lineNumber=XX,
    condition='console.log("ORIG:", someValue), false')

// Compare with manual evaluation of clean code
// Values MUST match before proceeding
```

**Step 5: Continue Analysis on Clean Code**

Only after `*_clean.js` exists and is verified, proceed to P1.

### Why This Matters

| Analyzing Obfuscated Code | Analyzing Clean Code |
|---------------------------|----------------------|
| `_0x4a2f['push'](_0x3b1c[_0x2d8e(0x1a3)])` | `stack.push(config['key'])` |
| Breakpoint shows: `_0x2d8e(0x1a3)` = ??? | Breakpoint shows: `config['key']` = "secret" |
| Call graph: `_0x1234` → `_0x5678` → ??? | Call graph: `encrypt` → `hmac` → `base64` |
| 10x more breakpoints, 10x more confusion | Direct path to algorithm |

**NEVER**: Grep/debug/analyze obfuscated code directly. Deobfuscate FIRST.

---

## 🚨 P1: Output Limits (Context Overflow = Session Death)

**Minified JS = 1 line can be 500KB+. LINE LIMITS ARE USELESS!**

```bash
# ✅ SAFE: Character-limited
rg -o ".{0,60}keyword.{0,60}" file.js | head -20
rg -n --column "keyword" file.js | cut -d: -f1-3 | head -20
sed -n '1p' file.min.js | cut -c1000-2000

# ❌ FATAL: Full line output
rg "keyword" bundle.min.js        # 1 match = 500KB!
rg -C2 "keyword" bundle.min.js    # 3 lines = 1.5MB!
```

| MCP Tool | Required Limits |
|----------|-----------------|
| `search_script_content` | `pageSize≤10`, `maxTotalChars≤500` |
| `search_functions` | `pageSize≤10`, `maxCodeLines≤15` |
| `get_scope_variables` | `pageSize≤15`, `maxDepth≤3` |

---

## Execution Flow

**Loop**: Capture → Minification Check → Obfuscation Check → Identify → Locate → Verify → Reproduce

1. **Capture**: `list_network_requests(resourceTypes=["xhr","fetch"])` → `save_static_resource` to `source/`

2. **🚨 Minification Gate (P-1)**: Check line count. If minified → beautify → continue with formatted code.

3. **🚨 Obfuscation Gate (P0)**: Run obfuscation check. If obfuscated → deobfuscate → continue with clean code.

4. **Identify Params**: Find `sign|token|nonce|ts|enc|deviceId` in request
   - Test necessity: remove param → replay → works? skip it
   - Trace chains: `init→deviceId→token→sign`

5. **Locate JS** (on clean/formatted code only):
   - A) `get_network_request(reqid)` → stack trace → file:line
   - B) `search_functions(namePattern="sign", pageSize=10)` → `analyze_call_graph()`
   - C) `set_breakpoint` → `step_over/into` → `get_scope_variables`
   - D) `search_script_content(pattern="encrypt", pageSize=10, maxTotalChars=500)`

6. **Verify**: Browser value == Python output → live test

---

## Debugger Tools (PRIMARY)

### Breakpoint Types

```javascript
// ✅ Log breakpoint (safe, no pause)
set_breakpoint(breakpointId="log1", urlRegex=".*target\\.js.*", lineNumber=123,
    condition='console.log("VAR:", someVar), false')

// ⚠️ Pausing breakpoint (blocks MCP until resumed)
set_breakpoint(breakpointId="bp1", urlRegex=".*target\\.js.*", lineNumber=123)
```

### Chained Debugging (While Paused)

```
set_breakpoint(...) → resume_execution() → get_debugger_status() → repeat
```

**DO NOT** ask user to trigger after each breakpoint. Chain them autonomously.

### When Paused

```javascript
get_debugger_status(frameIndex=0)
get_scope_variables(frameIndex=0, searchTerm="key", pageSize=10)
evaluate_on_call_frame(expression="x", frameIndex=0)
step_over() | step_into() | step_out()
resume_execution()
```

### evaluate_script: Globals Only

✅ `() => window.globalVar` | ❌ Never for hooks/logging → use `set_breakpoint`

---

## Pattern Recognition

| Pattern | Action |
|---------|--------|
| Single-line 50KB+ files | **P-1 MANDATORY**: Beautify first (NO EXCEPTIONS) |
| `_0x` vars, hex strings, decoder arrays | **P0 MANDATORY**: Deobfuscate first (NO EXCEPTIONS) |
| `while(true){switch}` + stack ops | JSVMP → `#[[file:skills/jsvmp_analysis.md]]` (still deobfuscate surrounding code) |
| `ReferenceError: window/document` | Env patch → `#[[file:skills/js_env_patching.md]]` |
| Anti-debug (`debugger` loops) | Deobfuscation skill §1 → then continue deobfuscation |
| "SDK code", "core library", "complex" | **NOT an excuse** → These are PRIMARY targets, deobfuscate them |

### Obfuscation Complexity Indicators

| Indicator | Level | Approach |
|-----------|-------|----------|
| Only `_0x` variable names | Light | AST rename only |
| `_0x` + hex literals (`0x1a2b`) | Light | AST: hex restore + rename |
| String array + simple accessor | Medium | Browser capture → AST replace |
| String array + shuffler IIFE | Medium-Heavy | Browser capture AFTER init → AST |
| RC4/XOR decoder function | Heavy | Analyze decoder → replicate → AST |
| Multiple decoder functions | Heavy | Map each decoder → AST |
| Anti-debug + all above | Heavy | §1 bypass → then full protocol |

---

## Hybrid Deobfuscation Workflow (Browser + AST)

**This is the EXPECTED approach for any non-trivial obfuscation.**

### Phase 1: Browser Intelligence Gathering

```javascript
// 1. Identify string array and decoder function names
search_script_content(pattern="_0x[a-f0-9]+\\s*=\\s*\\[", pageSize=5, maxTotalChars=300)

// 2. Find where array is initialized (look for shuffler IIFE)
search_script_content(pattern="while.*--.*push.*shift", pageSize=3, maxTotalChars=300)

// 3. Set logging breakpoint AFTER initialization
set_breakpoint(
    breakpointId="array_state",
    urlRegex=".*target\\.js.*",
    lineNumber=XX,  // Line AFTER shuffler
    condition='console.log("ARRAY_STATE:", JSON.stringify({
        name: "_0xabc",
        length: _0xabc.length,
        sample: _0xabc.slice(0, 10)
    })), false'
)

// 4. Sample decoder outputs (pick 5-10 random indices)
set_breakpoint(
    breakpointId="decoder_sample",
    urlRegex=".*target\\.js.*",
    lineNumber=YY,
    condition='console.log("DECODER:", JSON.stringify({
        "0x100": _0xdef(0x100),
        "0x150": _0xdef(0x150),
        "0x200": _0xdef(0x200)
    })), false'
)

// 5. Trigger and collect
// → User action or page reload
list_console_messages(types=["log"])
```

### Phase 2: Local AST Transformation

```javascript
// With browser-captured data, build AST transforms:

// 1. String replacement (using captured decoder map)
const decoderMap = { "0x100": "push", "0x150": "length", ... };  // From browser

CallExpression(path) {
    if (isDecoderCall(path, "_0xdef")) {
        const idx = getArgValue(path);
        if (decoderMap[idx]) {
            path.replaceWith(t.stringLiteral(decoderMap[idx]));
        }
    }
}

// 2. Apply standard transforms (hex restore, property cleanup, etc.)
// 3. Save to source/<name>_clean.js
```

### Phase 3: Verification

```javascript
// Compare key values between original and clean code
// MUST match before proceeding to algorithm analysis
```

---

## Core Rules

1. **P-1 Gate**: Always check minification before any search - beautify first
2. **P0 Gate**: Always check obfuscation before analysis - NO EXCEPTIONS
3. **Hybrid First**: For any non-trivial obfuscation, use browser+AST approach
4. **No Excuses**: "Complex", "SDK", "hard" are not valid reasons to skip deobfuscation
5. **Log findings**: Update `analysis_notes.md` immediately
6. **Evidence markers**: `[UNVERIFIED]` / `[VERIFIED]` / `[REPRODUCED]`
7. **Truncate blobs**: Base64/hex → first 20 chars + `...` + last 10
8. **Chinese output**: Comments in Python, notes in Chinese
9. **No meta talk**: Execute directly, don't announce

---

## 🛑 Human Interaction = STOP

| Scenario | Action |
|----------|--------|
| Slider CAPTCHA, drag verify | "请手动拖动滑块完成验证" → **STOP** |
| Click CAPTCHA, puzzle | "请手动完成验证码" → **STOP** |
| Login required | "请登录后告诉我" → **STOP** |
| Any user trigger needed | "请触发xxx后告诉我" → **STOP** |

### ❌ FORBIDDEN (Will Fail)

```javascript
// NEVER attempt these - detection will fail
evaluate_script({ function: "simulateDrag..." })
evaluate_script({ function: "element.dispatchEvent(mousedown/mousemove)..." })
drag(from_uid, to_uid)  // MCP drag tool also fails on CAPTCHAs
```

**Why**: CAPTCHA systems detect:
- Missing mouse trajectory randomness
- Instant/linear movement patterns  
- Absence of real input events
- Headless browser fingerprints

**STOP IMMEDIATELY** after asking for help. Do NOT:
- Try alternative drag methods
- Attempt JS simulation
- Call more tools

---

## Output Structure

```
saveDir/
├── analysis_notes.md     # Findings log
├── source/               # Saved/deobfuscated JS
│   ├── original.js
│   ├── original_formatted.js  # After beautification (P-1)
│   └── original_clean.js      # After deobfuscation (P0)
├── raw/                  # HTTP captures
├── lib/
│   └── crypto_utils.py   # Core algorithms
└── repro.py              # Main reproduction
```

---

## Inputs

- `url` (required): Target page
- `focus`: API keyword filter
- `saveDir`: Default `artifacts/jsrev/<domain>/`
- `goal`: `reverse` (full algo) | `env` (make JS runnable)

---

## Reference Skills

- `#[[file:skills/js_deobfuscation.md]]`: AST transforms, anti-debug, string decode
- `#[[file:skills/jsvmp_analysis.md]]`: VM analysis, breakpoint instrumentation
- `#[[file:skills/js_env_patching.md]]`: Happy-DOM, Proxy detection
- `#[[file:skills/js_extraction.md]]`: Safe slicing, Webpack extraction
