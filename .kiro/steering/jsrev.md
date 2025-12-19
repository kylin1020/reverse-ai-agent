---
inclusion: always
---

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

**Code Search Strategy**: Save JS to local file first → use `rg`/`grepSearch` for searching

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

---

## P0.5: CLI Output Limits

**CRITICAL**: Single-line JS files can exceed context window. ALWAYS limit output.

| Tool | Safe Pattern | Danger |
|------|--------------|--------|
| `rg` | `rg -o ".{0,80}pattern.{0,80}" \| head -30` | Full line = 500KB |
| `sed` | `sed -n '100,200p'` | Whole file dump |
| `cat` | **NEVER on JS** | Context overflow |
| `head` | `head -c 5000` (bytes) | Unlimited output |

**Mandatory flags:**
```bash
# rg: always use -o with context limit + head
rg -o ".{0,80}keyword.{0,80}" file.js | head -30

# For line numbers only
rg -n "pattern" file.js | head -20

# sed: always specify range
sed -n '1,100p' file.js

# head: limit bytes for unknown files
head -c 10000 file.js
```

**VIOLATION = Context overflow = Session failure**

---

### Deobfuscation Strategy

| Level | Approach |
|-------|----------|
| Light (`_0x` vars only) | AST transforms |
| Medium (string array + decoder) | Browser capture → AST replace |
| Heavy (RC4/shuffler/anti-debug) | Full hybrid protocol |

### Hybrid Protocol (Heavy)

```javascript
// 1. Capture string array AFTER init
set_breakpoint(urlRegex=".*target\\.js.*", lineNumber=XX,
    condition='console.log("STRINGS:", JSON.stringify(_0xabc)), false')

// 2. Sample decoder outputs
set_breakpoint(urlRegex=".*target\\.js.*", lineNumber=YY,
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
| `search_functions` | `pageSize≤10`, `maxCodeLines≤15` |
| `get_scope_variables` | `pageSize≤15`, `maxDepth≤3` |

**Code Search**: Save JS via `save_static_resource` → search locally with `rg` or `grepSearch`

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
set_breakpoint(urlRegex=".*target\\.js.*", lineNumber=123,
    condition='console.log("VAR:", someVar), false')

// Pausing breakpoint
set_breakpoint(urlRegex=".*target\\.js.*", lineNumber=123)
```

### ⚠️ MANDATORY: Breakpoint Cleanup

**After EACH debug analysis session, MUST cleanup before continuing:**

```javascript
// Remove specific breakpoint
remove_breakpoint(breakpointId="bp1")

// Or clear all breakpoints
clear_all_breakpoints()

// Then resume execution
resume_execution()
```

| Scenario | Action |
|----------|--------|
| Pausing breakpoint hit, analysis done | `remove_breakpoint()` → `resume_execution()` |
| Multiple breakpoints set | `clear_all_breakpoints()` → `resume_execution()` |
| Switching to new analysis target | `clear_all_breakpoints()` first |

**FAILURE TO CLEANUP = Page freeze / Infinite pause / MCP blocked**

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

### Script Content Search (Browser-Side)

```javascript
// Search for patterns in loaded JS files (useful when JS not saved locally)
search_script_content(pattern="sign|encrypt", pageSize=3, contextLength=300)

// Regex search
search_script_content(pattern="function\\s+\\w*[Ss]ign", isRegex=true, pageSize=5)

// Filter by URL
search_script_content(pattern="token", urlPattern=".*main\\.js.*", pageSize=5)
```

**When to use**: Quick search in browser-loaded scripts before saving locally. For heavy searching, prefer `save_static_resource` → local `rg`/`grepSearch`.

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

---

# 📍 Entry Location Techniques (The Critical Step)

Finding the encryption entry point is the most important step. Use these methods in order of effectiveness:

## 1. XHR/Fetch Breakpoints (FASTEST)

```javascript
// In DevTools Sources panel → XHR/fetch Breakpoints
// Add URL keyword: "sign", "encrypt", "token", "api/"
// Code pauses when matching request is sent → check Call Stack
```

**MCP Equivalent**:
```javascript
// Set breakpoint on network-related code
search_functions(namePattern="fetch|XMLHttpRequest|ajax", pageSize=10)
// Then set breakpoint at found locations
```

## 2. Call Stack Tracing (MOST RELIABLE)

```javascript
// In Network panel:
// 1. Select the request with encrypted params
// 2. Check "Initiator" column → shows call stack
// 3. Click each stack frame to trace back to encryption source

// MCP: Use get_network_request to see initiator
get_network_request(reqid=123)  // Check initiator/stack trace
```

## 3. Global Search (Ctrl+Shift+F)

```javascript
// Search for parameter names found in request:
// - "sign", "signature", "_signature"
// - "encrypt", "encode", "token"
// - Parameter names from the actual request

// MCP: Save JS first, then search locally
save_static_resource(reqid=XX, filePath="source/target.js")
// Then use rg or grepSearch:
// rg -o ".{0,60}sign.{0,60}" source/target.js | head -20
// grepSearch(query="sign\\s*[:=]", includePattern="source/**/*.js")

search_functions(namePattern="sign|encrypt|token", pageSize=10)
```

## 4. DOM Event Breakpoints

```javascript
// For button-triggered requests:
// 1. Right-click element → "Break on" → "attribute modifications"
// 2. Or: Elements panel → Event Listeners → find click handler

// MCP: Save JS first, then search locally
// rg "addEventListener.*click|onclick" source/*.js
// grepSearch(query="addEventListener.*click|onclick", includePattern="source/**/*.js")
```

## 5. Hook Techniques (Intercept at Source)

### Hook JSON.stringify (Catches Most Encryption)

```javascript
// Inject via DevTools Snippets BEFORE page load:
(function() {
    var _stringify = JSON.stringify;
    JSON.stringify = function(params) {
        // Filter for interesting params
        if (params && (params.sign || params.token || params.encrypt)) {
            debugger;  // Pause here
            console.log("JSON.stringify:", params);
        }
        return _stringify.apply(this, arguments);
    };
})();
```

### Hook Cookie Setter

```javascript
var cookie_cache = document.cookie;
Object.defineProperty(document, 'cookie', {
    get: function() { return cookie_cache; },
    set: function(val) {
        if (val.includes('token') || val.includes('sign')) {
            debugger;
            console.log('Setting cookie:', val);
        }
        cookie_cache = val;
        return val;
    }
});
```

### Hook XMLHttpRequest.send

```javascript
(function() {
    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        if (body && body.includes && body.includes('sign')) {
            debugger;
            console.log('XHR body:', body);
        }
        return _send.apply(this, arguments);
    };
})();
```

---

# 🔐 Algorithm Identification

## Standard Crypto Signatures

| Pattern | Algorithm | Verification |
|---------|-----------|--------------|
| 32-char hex output | MD5 | `hashlib.md5(data).hexdigest()` |
| 40-char hex output | SHA-1 | `hashlib.sha1(data).hexdigest()` |
| 64-char hex output | SHA-256 | `hashlib.sha256(data).hexdigest()` |
| Base64 + fixed block size | AES | Check for IV, key, padding mode |
| Large prime operations | RSA | Look for `n`, `e`, `d` params |
| `0x67452301` constant | MD5 IV | Standard MD5 |
| `0x6a09e667` constant | SHA-256 IV | Standard SHA-256 |

## Modified/Custom Algorithms

```javascript
// Signs of modified standard algorithms:
// 1. Standard IV but different round constants
// 2. Extra XOR/shift operations before/after
// 3. Custom padding schemes
// 4. Salt/pepper additions

// Detection: Compare output with standard library
// If mismatch → trace step-by-step to find modification
```

## Common Encryption Patterns

```javascript
// Pattern 1: timestamp + params + secret → MD5
sign = md5(timestamp + JSON.stringify(params) + "secret_key")

// Pattern 2: HMAC-SHA256
sign = hmac_sha256(secret_key, message)

// Pattern 3: AES-CBC
encrypted = aes_cbc_encrypt(data, key, iv)
result = base64(encrypted)

// Pattern 4: RSA public key encryption
encrypted = rsa_encrypt(data, public_key)
```

---

# 📦 Webpack/Parcel Bundle Handling

## Identifying Webpack Bundles

```javascript
// Signatures:
// - `webpackJsonp` or `__webpack_require__`
// - Module calls like `n(123)`, `e(456)`, `__webpack_require__(789)`
// - IIFE wrapper: `(function(modules) { ... })([...])`
```

## Extracting Webpack Modules

```javascript
// Step 1: Save bundle, then find loader function
save_static_resource(reqid=XX, filePath="source/bundle.js")
// rg "__webpack_require__|webpackJsonp" source/bundle.js | head -5
// grepSearch(query="__webpack_require__|webpackJsonp", includePattern="source/**/*.js")

// Step 2: Locate target module by ID (if code calls n(123)):
// rg "123\\s*:\\s*function" source/bundle.js
// grepSearch(query="123\\s*:\\s*function", includePattern="source/**/*.js")

// Step 3: Export to global for debugging
evaluate_script(function="() => window.myModule = __webpack_require__(123)")
```

## Module Extraction Script

```javascript
// Node.js script to extract specific module
const fs = require('fs');
const code = fs.readFileSync('bundle.js', 'utf8');

// Find module boundaries using brace counting
function extractModule(code, moduleId) {
    const regex = new RegExp(`(?<!\\d)${moduleId}\\s*:\\s*function`);
    const match = code.match(regex);
    if (!match) return null;
    
    let start = match.index;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = start; i < code.length; i++) {
        const char = code[i];
        // Handle string detection...
        if (char === '{') braceCount++;
        if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                return code.substring(start, i + 1);
            }
        }
    }
    return null;
}
```

---

# 🎭 Common Obfuscation Patterns

## Obfuscator.io (Large Array + Shift)

```javascript
// Signature: Large string array + rotation function + decoder
var _0xabc = ['str1', 'str2', ...];  // 100+ strings
(function(arr, num) {
    while (--num) { arr.push(arr.shift()); }
})(_0xabc, 0x1a3);
var _0xdef = function(idx) { return _0xabc[idx - 0x100]; };

// Solution: Capture array AFTER rotation, build decoder map
```

## AAEncode / JJEncode / JSFuck

```javascript
// AAEncode: ﾟωﾟﾉ= /｀ｍ´）ﾉ ~┻━┻   //*´∇｀*/
// JJEncode: $=~[];$={___:++$, ...
// JSFuck: [][(![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]...

// Solution: 
// 1. Copy code to console (remove final execution `()`)
// 2. Or replace `eval` with `console.log` to see decoded source
// 3. The decoded output is the actual logic
```

## Control Flow Flattening

```javascript
// Signature: State machine with switch
var state = 0;
while (true) {
    switch (state) {
        case 0: /* init */ state = 3; break;
        case 1: /* step2 */ state = 4; break;
        case 2: /* step3 */ return result;
        // ...
    }
}

// Solution: 
// - If NO stack operations → AST can restore (js_deobfuscation.md §3.6)
// - If HAS stack operations → JSVMP, use jsvmp_analysis.md
```

---

# 🛡️ Anti-Debugging Bypass (Extended)

## Infinite Debugger Loop

```javascript
// Pattern:
setInterval(() => { debugger; }, 100);
// Or:
(function x() { debugger; x(); })();

// Solutions:
// 1. DevTools: Right-click line → "Never pause here"
// 2. Ctrl+F8 to deactivate all breakpoints temporarily
// 3. Local Overrides: Edit file to remove debugger statements
```

## Console Detection

```javascript
// Pattern: Detect DevTools by console timing
var start = Date.now();
console.log('test');
console.clear();
if (Date.now() - start > 100) { /* DevTools detected */ }

// Solution: Hook console methods or Date.now
```

## Window Size Detection

```javascript
// Pattern:
if (window.outerWidth - window.innerWidth > 160) { /* DevTools open */ }

// Solution: 
// 1. Undock DevTools to separate window
// 2. Or hook window properties
Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
```

## Function.toString Detection

```javascript
// Pattern: Check if function is native
if (func.toString().indexOf('[native code]') === -1) { /* hooked */ }

// Solution: See js_env_patching.md §4.1 for toString hook
```

---

# 🔄 Porting Strategy

| Complexity | Approach |
|------------|----------|
| Simple (MD5/SHA/Base64) | Python direct |
| Medium (AES/RSA) | Python + pycryptodome |
| Complex (env checks) | → `#[[file:skills/js_env_patching.md]]` |

---

# 🧰 Tool Stack Reference

| Category | Tool | Use Case |
|----------|------|----------|
| **Browser** | Chrome DevTools | Primary debugging |
| **Proxy** | Charles/Fiddler/mitmproxy | Traffic capture, request replay |
| **Node.js** | node + babel | Run extracted JS, AST transforms |
| **Python** | requests + pycryptodome | Final reproduction |
| **Automation** | Playwright/Puppeteer | Complex fingerprint scenarios |
| **AST** | @babel/parser + traverse | Deobfuscation transforms |

## Quick Commands

```bash
# AST tools
npm i @babel/parser @babel/traverse @babel/types @babel/generator

# Python crypto
pip install pycryptodome requests

# Beautify
npx js-beautify -f input.js -o output.js
```

---

# 📋 Workflow Checklist

```
□ 1. Capture target request (Network panel / Charles)
□ 2. Identify encrypted params (sign, token, etc.)
□ 3. Test param necessity (remove → replay → still works?)
□ 4. P-1 Gate: Check minification → beautify if needed
□ 5. P0 Gate: Check obfuscation → deobfuscate if needed
□ 6. Locate encryption entry (XHR breakpoint / Call Stack / Search)
□ 7. Set breakpoints, trace data flow
□ 8. Identify algorithm (standard vs custom)
□ 9. Extract/port to Python or Node.js
□ 10. Verify: browser output == local output
□ 11. Live test with actual request
□ 12. Document in analysis_notes.md
```

---

# ⚠️ Legal Disclaimer

JS reverse engineering techniques are for:
- Security research and penetration testing (with authorization)
- API compatibility and interoperability
- Educational purposes

**DO NOT** use for:
- Scraping protected personal data
- Bypassing access controls without permission
- Any illegal activities
