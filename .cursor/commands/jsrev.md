## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## RULE ZERO: READABILITY GATE

> Load `#[[file:skills/js_deobfuscation.md]]` when obfuscation detected!

1. P-1: Minification? → Beautify FIRST
2. P0: Obfuscation? → Deobfuscate FIRST (browser debug + AST)
3. ONLY THEN: Search / Debug / Analyze

**VIOLATION = SESSION FAILURE.**

---

## P-1: Minification Gate

Check before any search:
```bash
wc -l source/*.js 2>/dev/null | head -20
# lines < 10 AND size > 50KB = MINIFIED
```

| Result | Action |
|--------|--------|
| MINIFIED | Beautify first: `npx js-beautify -f in.js -o out_formatted.js` |
| Normal | Proceed to P0 |

**FORBIDDEN on minified files:**
```bash
rg "keyword" minified.js      # 1 match = 500KB!
```

**SAFE alternatives:**
```bash
rg -o ".{0,60}keyword.{0,60}" file.js | head -20
```

MCP limits: `search_script_content(pageSize=3, maxTotalChars=300)`

---

## P0: Obfuscation Gate

```bash
rg -c "_0x[a-f0-9]|\\\\x[0-9a-f]{2}" source/*.js 2>/dev/null || echo "0"
```

| Result | Action |
|--------|--------|
| Count > 0 | Deobfuscate first |
| Count = 0 | Proceed |

**Invalid excuses**: "too complex", "SDK code", "might break" → Deobfuscate anyway.

### Deobfuscation Strategy

| Level | Approach |
|-------|----------|
| Light (`_0x` vars only) | AST transforms |
| Medium (string array + decoder) | Browser capture → AST replace |
| Heavy (RC4/shuffler/anti-debug) | Full hybrid protocol |

### Hybrid Protocol (Heavy)

```javascript
// 1. Capture string array AFTER init
set_breakpoint(breakpointId="strings", urlRegex=".*target\\.js.*", lineNumber=XX,
    condition='console.log("STRINGS:", JSON.stringify(_0xabc)), false')

// 2. Sample decoder outputs
set_breakpoint(breakpointId="decoder", urlRegex=".*target\\.js.*", lineNumber=YY,
    condition='console.log("DECODE:", JSON.stringify({idx: arguments[0], result: _0xdef(arguments[0])})), false')

// 3. Collect logs
list_console_messages(types=["log"])

// 4. Build decoder map → AST transform → save *_clean.js
// 5. Verify: browser values == clean code values
```

---

## P1: Output Limits

| MCP Tool | Limits |
|----------|--------|
| `search_script_content` | `pageSize≤10`, `maxTotalChars≤500` |
| `search_functions` | `pageSize≤10`, `maxCodeLines≤15` |
| `get_scope_variables` | `pageSize≤15`, `maxDepth≤3` |

---

## Execution Flow

1. **Capture**: `list_network_requests(resourceTypes=["xhr","fetch"])` → `save_static_resource`
2. **P-1 Gate**: Minified? → beautify
3. **P0 Gate**: Obfuscated? → deobfuscate
4. **Identify**: Find `sign|token|nonce|ts|enc` params
5. **Locate** (clean code only):
   - `get_network_request(reqid)` → stack trace
   - `search_functions(namePattern="sign", pageSize=10)`
   - `set_breakpoint` → `step_over/into` → `get_scope_variables`
6. **Verify**: Browser value == Python output

---

## Debugger Tools

### Breakpoints

```javascript
// Log breakpoint (no pause)
set_breakpoint(breakpointId="log1", urlRegex=".*target\\.js.*", lineNumber=123,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(breakpointId="bp1", urlRegex=".*target\\.js.*", lineNumber=123)
```

### When Paused

```javascript
get_debugger_status(frameIndex=0)
get_scope_variables(frameIndex=0, searchTerm="key", pageSize=10)
evaluate_on_call_frame(expression="x", frameIndex=0)
step_over() | step_into() | step_out()
resume_execution()
```

### Network

```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
search_network_requests(urlPattern="api/sign", method="POST")
get_network_request(reqid=15)
save_static_resource(reqid=23, filePath="source/main.js")
```

### Console

```javascript
list_console_messages(types=["log", "error"], pageSize=50)
get_console_message(msgid=42)
```

### evaluate_script (globals only)

```javascript
evaluate_script(function="() => window.globalVar")
// NEVER for hooks/logging → use set_breakpoint
```

---

## Pattern Recognition

| Pattern | Action |
|---------|--------|
| Single-line 50KB+ | P-1: Beautify first |
| `_0x` vars, hex strings | P0: Deobfuscate first |
| `while(true){switch}` + stack | JSVMP → `#[[file:skills/jsvmp_analysis.md]]` |
| `ReferenceError: window` | Env patch → `#[[file:skills/js_env_patching.md]]` |
| Anti-debug loops | Deobfuscation §1 bypass |

---

## Human Interaction = STOP

| Scenario | Action |
|----------|--------|
| Slider/Click CAPTCHA | "请手动完成验证码" → STOP |
| Login required | "请登录后告诉我" → STOP |

**FORBIDDEN**: `evaluate_script` for drag/click simulation, `drag()` on CAPTCHAs.

---

## Output Structure

```
saveDir/
├── analysis_notes.md
├── source/
│   ├── original.js
│   ├── original_formatted.js
│   └── original_clean.js
├── raw/
├── lib/crypto_utils.py
└── repro.py
```

---

## Reference Skills

- `#[[file:skills/js_deobfuscation.md]]`: AST transforms, anti-debug, string decode
- `#[[file:skills/jsvmp_analysis.md]]`: VM analysis, breakpoint instrumentation
- `#[[file:skills/js_env_patching.md]]`: Happy-DOM, Proxy detection
- `#[[file:skills/js_extraction.md]]`: Safe slicing, Webpack extraction
