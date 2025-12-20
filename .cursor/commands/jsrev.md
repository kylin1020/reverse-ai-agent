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

## P0.6: No Inline Python Scripts

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

## P0.7: Python Environment (uv preferred)

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
1. READ LOCAL: output/*_deob.js → Understand algorithm logic (readable)
2. DEBUG BROWSER: set_breakpoint → Verify runtime values (accurate)
3. COMPARE: Local understanding + Browser values → Confirm correctness
```

**Why**: Deobfuscated code is readable but may have transform errors. Browser code is accurate but unreadable. Combine both.

**Pattern**:
```javascript
// Step 1: Read local deobfuscated code to understand structure
readFile("output/core_deob.js")  // Find: sign = md5(ts + key + params)

// Step 2: Set breakpoint in browser to capture actual values
// ⚠️ Use SINGLE backslash in urlRegex
set_breakpoint(urlRegex=".*core\.js.*", lineNumber=XXX,
    condition='console.log("ts:", ts, "key:", key), false')

// Step 3: Compare browser values with local logic understanding
```

**FORBIDDEN**: Analyzing minified/obfuscated browser code directly without local reference.

---

## Execution Flow

1. **Capture**: `list_network_requests(resourceTypes=["xhr","fetch"])` → `save_static_resource`
2. **P-1 Gate**: Minified? → beautify to `output/`
3. **P0 Gate**: Obfuscated? → deobfuscate to `output/`
4. **Identify**: Find `sign|token|nonce|ts|enc` params
5. **Locate** (clean code only): stack trace / local `rg` search
6. **Analyze**: Read LOCAL deobfuscated JS → Debug BROWSER for values
7. **Verify**: Browser value == Python output

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
// ⚠️ urlRegex: Use SINGLE backslash (MCP handles JSON escaping)
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=123,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target\.js.*", lineNumber=123)

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

## Reference Skills

- `#[[file:skills/js_deobfuscation.md]]` - AST transforms, anti-debug, string decode
- `#[[file:skills/jsvmp_analysis.md]]` - VM analysis, breakpoint instrumentation
- `#[[file:skills/js_env_patching.md]]` - Happy-DOM, Proxy detection
- `#[[file:skills/js_extraction.md]]` - Safe slicing, Webpack extraction

---

## Entry Point Location Techniques

**Priority order:**

1. **Call Stack Tracing** (most reliable) - `get_network_request(reqid)` → check initiator
2. **Local Search** (fast) - `rg "sign|encrypt" output/*_deob.js` on deobfuscated files
3. **XHR Breakpoints** - DevTools Sources → XHR breakpoints → add keyword

**AVOID**: `search_functions` - slow and inefficient, prefer local rg search.

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
