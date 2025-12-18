## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## 🚨 P0: Obfuscation Gate (MANDATORY FIRST STEP)

**BEFORE any JS analysis, run this check:**

```bash
# Quick detection
rg -c "_0x[a-f0-9]|\\\\x[0-9a-f]{2}" source/*.js 2>/dev/null || echo "0"
```

| Result | Action |
|--------|--------|
| Count > 0 | **STOP** → Load `#[[file:skills/js_deobfuscation.md]]` → AST transform → save `*_clean.js` → THEN continue |
| Count = 0 | Proceed to P1 |

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

**Loop**: Capture → Obfuscation Check → Identify → Locate → Verify → Reproduce

1. **Capture**: `list_network_requests(resourceTypes=["xhr","fetch"])` → `save_static_resource` to `source/`

2. **🚨 Obfuscation Gate**: Run P0 check. If obfuscated → deobfuscate → continue with clean code.

3. **Identify Params**: Find `sign|token|nonce|ts|enc|deviceId` in request
   - Test necessity: remove param → replay → works? skip it
   - Trace chains: `init→deviceId→token→sign`

4. **Locate JS** (on clean code only):
   - A) `get_network_request(reqid)` → stack trace → file:line
   - B) `search_functions(namePattern="sign", pageSize=10)` → `analyze_call_graph()`
   - C) `set_breakpoint` → `step_over/into` → `get_scope_variables`
   - D) `search_script_content(pattern="encrypt", pageSize=10, maxTotalChars=500)`

5. **Verify**: Browser value == Python output → live test

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
| `_0x` vars, hex strings, decoder arrays | **P0**: Deobfuscate first |
| `while(true){switch}` + stack ops | JSVMP → `#[[file:skills/jsvmp_analysis.md]]` |
| `ReferenceError: window/document` | Env patch → `#[[file:skills/js_env_patching.md]]` |
| Anti-debug (`debugger` loops) | Deobfuscation skill §1 |

---

## Core Rules

1. **P0 Gate**: Always check obfuscation before analysis
2. **Log findings**: Update `analysis_notes.md` immediately
3. **Evidence markers**: `[UNVERIFIED]` / `[VERIFIED]` / `[REPRODUCED]`
4. **Truncate blobs**: Base64/hex → first 20 chars + `...` + last 10
5. **Chinese output**: Comments in Python, notes in Chinese
6. **No meta talk**: Execute directly, don't announce

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
│   └── original_clean.js # After deobfuscation
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
