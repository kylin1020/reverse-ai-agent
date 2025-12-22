---
inclusion: manual
---

# jsrev

## ⛔ STOP: READ THIS FIRST

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  DEOBFUSCATION BEFORE RUNTIME ANALYSIS — NO EXCEPTIONS                       ║
║                                                                              ║
║  When you see obfuscated code, you MUST deobfuscate FIRST.                   ║
║  DO NOT use breakpoints, call stacks, or runtime analysis on obfuscated JS.  ║
║                                                                              ║
║  "Obfuscation is complex, let me try runtime analysis" = FORBIDDEN           ║
║  "Let me set a breakpoint to capture params" = FORBIDDEN                     ║
║  "Despite obfuscation, I can trace..." = FORBIDDEN                           ║
║                                                                              ║
║  CORRECT: Deobfuscate strings/functions → THEN analyze with breakpoints      ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### What "Deobfuscation" Means Here

You do NOT need to fully reverse ALL obfuscation, but **string deobfuscation is CRITICAL** — it enables keyword search to locate core code quickly.

| MUST Deobfuscate | Can Skip |
|------------------|----------|
| String decryption (XOR, base64, string array) | Variable renaming |
| String array rotation/shuffling | Dead code removal |
| Encoded function calls | Comment injection |

```javascript
// ❌ BEFORE: Cannot understand what this does
_0x4a3b(_0x5c2d[0x1f], _0x5c2d[0x23])

// ✅ AFTER: Strings decoded, logic visible
_0x4a3b("sign", "md5")  // Now I can analyze!
```

### Why Runtime Analysis on Obfuscated Code FAILS

| You Try | What Happens |
|---------|--------------|
| Set breakpoint, inspect variables | See `_0x4a3b2c = "encrypted_garbage"` — meaningless |
| Trace call stack | Function names are `_0x1234`, `_0x5678` — can't follow |
| Search for parameter name | Strings are encoded, search finds nothing |
| "Capture the value at runtime" | You get the value but can't reproduce the algorithm |

**Runtime analysis is ONLY useful AFTER strings are decoded.**

---

## Focus

Reverse engineer JS encryption/signing algorithms → reproduce in Python.

**NOT**: Browser automation, environment patching, or running JS in Node.

**Goal**: `lib/*.py` contains pure algorithm implementation, `repro/*.py` makes valid API requests.

---

## 🚀 SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

If source/ has obfuscated JS but no output/*_deobfuscated.js → Deobfuscate first.

---

## P0: DEOBFUSCATION GATE

### Step 1: Beautify

```bash
npx js-beautify -f {file} -o {output_file}
```

### Step 2: Detect Obfuscation

```bash
head -c 3000 {file}
```

| Pattern | Example | Type |
|---------|---------|------|
| Hex variable names | `_0x4a3b`, `_0xabc123` | obfuscator-io |
| Hex/Unicode escapes | `\x48\x65`, `\u0048` | String encoding |
| Large string array | `var a=["str1","str2",...]` | String table |
| Control flow flattening | `while(true){switch(x){...}}` | CFG obfuscation |

### Step 3: Decision

| Assessment | Action |
|------------|--------|
| Has encoded strings/string arrays | 🛑 STOP → `skills/js_deobfuscation.md` → decode strings → return |
| Clean/minified only | ✅ Proceed to P1 |

### ⛔ FORBIDDEN Until Strings Are Decoded

- `set_breakpoint()` on obfuscated code
- `search_script_content()` for encoded strings
- `get_scope_variables()` expecting readable values
- "Let me trace the call stack to understand"
- "Runtime analysis will be faster"

---

## P0.5: NECESSITY CHECK

Before analyzing cookie/param generation, verify it's required:

```bash
curl -v 'URL' -H 'Cookie: other_only' 2>&1 | head -c 3000
```

| Response | Action |
|----------|--------|
| 200 + valid | Skip — param not required |
| 403/blocked | Proceed with analysis |

---

## P1: LOCATE ALGORITHM (After P0)

### Approach A: Keyword Search

```bash
rg -M 200 -o ".{0,60}(md5|sha1|sha256|hmac|sign|encrypt).{0,60}" output/*.js | head -30
```

### Approach B: Call Stack Tracing

```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
set_breakpoint(urlRegex=".*api/endpoint.*", lineNumber=1)
// Tell user to trigger request
get_debugger_status(maxCallStackFrames=30)
```

---

## P2: BREAKPOINT VERIFICATION

```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1234)
// Tell user: "Please refresh/trigger request"
get_debugger_status(contextLines=5)
get_scope_variables(frameIndex=0, pageSize=20)
```

---

## 🛡️ OUTPUT LIMITS

| Command | Safe | Forbidden |
|---------|------|-----------|
| `rg` | `rg -M 200 -o ".{0,80}pattern.{0,80}"` | `rg "pattern" file.js` |
| `cat` | `head -c 10000 file.js` | `cat file.js` |
| `head` | `head -c 5000` | `head -n 50` on minified |

---

## SKILL LOADING

| Pattern | Skill |
|---------|-------|
| String encoding detected | `skills/js_deobfuscation.md` |
| webpack bundle | `skills/js_extraction.md` |
| `while(true){switch}` VM | `skills/jsvmp_analysis.md` |

---

## P4: BROWSER RUNTIME

```javascript
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")
```

### Infinite Debugger Bypass

```javascript
get_debugger_status(contextLines=5)
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
navigate_page(type="reload", timeout=3000)
```

---

## P5: HOOK STRATEGIES

```javascript
// Log breakpoint (no pause)
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')

// Script replacement
replace_script(urlPattern=".*target.js.*",
    oldCode="function sign(data)",
    newCode="function sign(data){console.log('SIGN:',data);")
```

---

## P6: PYTHON IMPLEMENTATION

```bash
cd artifacts/jsrev/{domain}/repro && uv init && uv add requests
uv run python repro.py
```

---

## MCP TOOLS QUICK REF

### Network
```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
save_static_resource(reqid=23, filePath="/absolute/path/source/main.js")
```

### Breakpoints
```javascript
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1234)
// ⚠️ After setting pausing breakpoint, ASK human to trigger — don't navigate yourself
```

### When Paused
```javascript
get_debugger_status(frameIndex=0)
get_scope_variables(frameIndex=0, pageSize=20)
step_over() | step_into() | step_out()
resume_execution()
```

### Cleanup
```javascript
clear_all_breakpoints()
resume_execution()
```

---

## OUTPUT STRUCTURE

```
artifacts/jsrev/{domain}/
├── PROGRESS.md
├── source/          # Original JS
├── output/          # Deobfuscated
├── lib/             # Python algorithms
├── repro/           # Request reproduction
└── raw/             # Samples
```

---

## ALGORITHM SIGNATURES

| Output | Algorithm |
|--------|-----------|
| 32-char hex | MD5 |
| 64-char hex | SHA-256 |
| `0x67452301` | MD5 IV |
| `0x6a09e667` | SHA-256 IV |

---

## ⚠️ Legal Disclaimer

For authorized security research, API compatibility, and educational purposes only.
