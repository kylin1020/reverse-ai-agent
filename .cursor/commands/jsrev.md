## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

---

## 🚀 SESSION START (MANDATORY)

**On every session start, restore context first:**

```bash
readFile("artifacts/jsrev/{domain}/PROGRESS.md")  # Most important
readFile("artifacts/jsrev/{domain}/notes/*.md")   # If exists
```

If PROGRESS.md doesn't exist, create and initialize it.

---

## RULE ZERO: READABILITY GATE

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

**SAFE**: `rg -o ".{0,60}keyword.{0,60}" file.js | head -20`

---

## P0: Obfuscation Gate

```bash
rg -c "_0x[a-f0-9]|\\\\x[0-9a-f]{2}" source/*.js 2>/dev/null || echo "0"
# Count > 0 → Deobfuscate first (load skills/js_deobfuscation.md)
```

---

## P0.5: CLI Output Limits

**CRITICAL**: Single-line JS can overflow context. ALWAYS limit output.

```bash
rg -o ".{0,80}keyword.{0,80}" file.js | head -30  # Safe
rg -n "pattern" file.js | head -20                 # Line numbers only
sed -n '1,100p' file.js                            # Range only
head -c 10000 file.js                              # Bytes limit
# NEVER: cat file.js, rg without -o on minified
```

---

## Execution Flow

1. **Capture**: `list_network_requests(resourceTypes=["xhr","fetch"])` → `save_static_resource`
2. **P-1 Gate**: Minified? → beautify to `output/`
3. **P0 Gate**: Obfuscated? → deobfuscate to `output/`
4. **Identify**: Find `sign|token|nonce|ts|enc` params
5. **Locate** (clean code only): stack trace / `search_functions` / breakpoints
6. **Verify**: Browser value == Python output

---

## MCP Tools Quick Reference

**Network**
```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
get_network_request(reqid=15)  // Check initiator/stack trace
save_static_resource(reqid=23, filePath="source/main.js")
```

**Breakpoints**
```javascript
// Log breakpoint (no pause) - trailing ", false" is CRITICAL
set_breakpoint(urlRegex=".*target\\.js.*", lineNumber=123,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target\\.js.*", lineNumber=123)
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
```

**Script Search (browser-side, before saving locally)**
```javascript
search_script_content(pattern="sign|encrypt", pageSize=3, contextLength=300)
```

**⚠️ MANDATORY Cleanup after debug session:**
```javascript
clear_all_breakpoints()
resume_execution()
```

---

## Pattern Recognition

- Single-line 50KB+ → P-1: Beautify first
- `_0x` vars, hex strings → P0: Deobfuscate first → `#[[file:skills/js_deobfuscation.md]]`
- `while(true){switch}` + stack → JSVMP → `#[[file:skills/jsvmp_analysis.md]]`
- `ReferenceError: window` → Env patch → `#[[file:skills/js_env_patching.md]]`

---

## Human Interaction = STOP

- Slider/Click CAPTCHA → "请手动完成验证码" → STOP
- Login required → "请登录后告诉我" → STOP

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
python -m pytest tests/           # Run tests
python repro/get_token.py         # Reproduce request
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

## Reference Skills

- `#[[file:skills/js_deobfuscation.md]]` - AST transforms, anti-debug, string decode
- `#[[file:skills/jsvmp_analysis.md]]` - VM analysis, breakpoint instrumentation
- `#[[file:skills/js_env_patching.md]]` - Happy-DOM, Proxy detection
- `#[[file:skills/js_extraction.md]]` - Safe slicing, Webpack extraction

---

## Entry Point Location Techniques

**Priority order:**

1. **XHR/Fetch Breakpoints** (fastest) - DevTools Sources → XHR breakpoints → add keyword
2. **Call Stack Tracing** (most reliable) - `get_network_request(reqid)` → check initiator
3. **Global Search** - `search_functions(namePattern="sign|encrypt", pageSize=10)`
4. **DOM Event Breakpoints** - For button-triggered requests

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
- Complex (env checks) → `#[[file:skills/js_env_patching.md]]`

---

## ⚠️ Legal Disclaimer

For authorized security research, API compatibility, and educational purposes only.
