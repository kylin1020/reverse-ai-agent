## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

> **Multi-Step Awareness**: Trace full dependency chains (e.g., `init → deviceId → token → sign`).

## ⚠️ Obfuscation: Act Early, Not Late

**When you see `_0x` vars, hex strings, or large decoder arrays:**
1. **IMMEDIATELY** load `#[[file:skills/js_deobfuscation.md]]`
2. Apply AST deobfuscation techniques BEFORE attempting manual analysis
3. Save deobfuscated output to `source/` directory

**DO NOT**: Struggle with obfuscated code manually → try AST → fail → report "需要反混淆"  
**DO**: Detect obfuscation → load skill → deobfuscate → analyze clean code

| Pattern | Action |
|---------|--------|
| `_0x` prefixed vars, hex strings | Load deobfuscation skill → apply AST transforms |
| Large array + decoder function | Decode strings first via AST or breakpoint |
| **`ReferenceError: window/document`** | **Load env patching skill → Proxy detect → Patch** |
| Anti-debugging (debugger loops) | Load deobfuscation skill §1 → bypass first |
| `while(true) { switch(...) }` + stack | JSVMP → load `#[[file:skills/jsvmp_analysis.md]]` |

### JSVMP Quick Check

```
Is it JSVMP?
├─ while(true) + switch(opcode)?  → Maybe
├─ Stack operations (push/pop) inside cases?  → Likely JSVMP
└─ Bytecode array feeding the switch?  → Confirmed JSVMP
```

**If JSVMP confirmed**: Load `#[[file:skills/jsvmp_analysis.md]]` - use breakpoint instrumentation, NOT AST.

## Core Rules

1. **Log immediately**: Finding → update `analysis_notes.md`, then continue
2. **Chinese output**: Comments in Python files and `analysis_notes.md` in Chinese
3. **No meta talk**: Execute directly, don't announce intentions
4. **Evidence markers**: `[UNVERIFIED]` / `[VERIFIED]` / `[REPRODUCED]`
5. **Save → Grep → Slice**: Never read large JS. Grep `head_limit≤50`, Read `limit≤30`
6. **Truncate blobs**: Base64/hex → first 20 chars + `...` + last 10 chars (even in reasoning!)
7. **Test first**: Unclear param? Remove & replay. Works? Skip it.
8. **Pagination**: Always use `pageSize` and search params to limit output

## 🚨 Output Limits (CRITICAL - READ CAREFULLY)

**Context overflow = session death. Minified JS = 1 line can be 500KB+!**

### The Minified JS Problem

**LINE LIMITS ARE USELESS FOR MINIFIED CODE!** A single line in `bundle.min.js` can contain the ENTIRE application. You MUST limit by CHARACTERS, not lines.

### Mandatory Limits

| Tool/Command | REQUIRED Limit | Why |
|--------------|----------------|-----|
| `rg` on minified JS | `cut -c1-500` or `-o ".{0,50}..."` | 1 line = entire file |
| `rg` context `-C` | **MAX `-C2`**, prefer `-C0` | Each context line = huge |
| `grep` on minified | `cut -c1-500` | Same problem |
| `sed` range | Max 50 lines on normal, **5 lines on minified** | 5 minified lines = 50KB+ |
| `head`/`tail` | Useless alone on minified | Must combine with `cut` |

### Safe Patterns (MEMORIZE THESE)

```bash
# ✅ SAFE: Character-limited search on minified JS
rg -n -o ".{0,60}keyword.{0,60}" bundle.min.js | head -20

# ✅ SAFE: Get line:column only, no content
rg -n --column "keyword" bundle.min.js | cut -d: -f1-3 | head -20

# ✅ SAFE: Slice with character limit
sed -n '1p' bundle.min.js | cut -c1000-2000

# ✅ SAFE: Count matches first, then decide
rg -c "keyword" bundle.min.js  # Returns count only

# ✅ SAFE: Extract specific column range from minified line
sed -n '1p' file.min.js | cut -c${START}-${END}
```

### DANGEROUS Patterns (NEVER USE)

```bash
# ❌ FATAL: Full line output on minified
rg -n "keyword" bundle.min.js              # 1 match = 500KB output!

# ❌ FATAL: Context on minified
rg -C2 "keyword" bundle.min.js             # 3 lines = 1.5MB!

# ❌ FATAL: sed range without char limit
sed -n '1,5p' bundle.min.js                # 5 lines = 2.5MB!

# ❌ FATAL: head without cut
head -10 bundle.min.js                     # 10 lines = 5MB!

# ❌ DANGEROUS: Large context even on normal files
rg -C10 "keyword" source/                  # 10 lines × many matches = overflow
```

### MCP Tool Limits

| Tool | REQUIRED Parameters | Max Values |
|------|---------------------|------------|
| `search_script_content` | `pageSize`, `maxTotalChars` | pageSize≤10, maxTotalChars≤500 |
| `search_functions` | `pageSize`, `maxCodeLines` | pageSize≤10, maxCodeLines≤15 |
| `list_network_requests` | `pageSize` | pageSize≤30 |
| `get_scope_variables` | `pageSize`, `maxDepth` | pageSize≤15, maxDepth≤3 |
| `list_console_messages` | `pageSize` | pageSize≤20 |

### Recovery Protocol

If output is too long:
1. **STOP immediately** - don't try to process it
2. Add stricter limits: smaller `pageSize`, add `cut -c1-300`, use `-o` with shorter patterns
3. Use `rg -c` to count matches first
4. Consider: do you really need this data, or can debugger give it directly?

## 🛑 Human Interaction = STOP

| Scenario | Action |
|----------|--------|
| CAPTCHA, login, manual click needed | Describe what's needed → **END TURN** → wait for user |
| Need user to trigger initial action | Say "请触发xxx操作" → **END TURN** |

**NEVER** continue calling tools after asking for user help.

## Debugger Tools (PRIMARY)

**Debugging is PRIMARY. Use debugger tools, not evaluate_script for hooks/logging.**

### ⚠️ Breakpoint Blocking Risk

**Issue**: Pausing breakpoints block MCP calls and freeze agent conversation.

| Scenario | Risk | Correct Approach |
|----------|------|------------------|
| Execute JS with pausing breakpoint | ⚠️ High | `clear_all_breakpoints()` first |
| Log without pause | ✅ Safe | Use `condition='console.log(...), false'` |
| Initial trigger needed | ⚠️ Careful | Set BP → **END TURN** → user triggers → `get_debugger_status()` |

**Recovery**: If stuck, user must click Resume (F8) in DevTools.

### 🔄 Chained Breakpoint Workflow (While Paused)

**When already paused at a breakpoint and need to trace further:**

```
1. Analyze current state: get_debugger_status() / get_scope_variables()
2. Set next breakpoint: set_breakpoint(breakpointId="next_bp", ...)
3. Resume execution: resume_execution()
4. Check new state: get_debugger_status()  // Now paused at next_bp
5. Repeat as needed
```

**DO NOT**: Set breakpoint → ask user to trigger → wait  
**DO**: Set breakpoint → `resume_execution()` → `get_debugger_status()` → continue analysis

This allows autonomous multi-step debugging without user intervention.

### Breakpoint Types

```
// ✅ Log breakpoint (no pause, safe)
set_breakpoint(..., condition='console.log("x:", x), false')

// ⚠️ Pausing breakpoint (blocks subsequent JS)
set_breakpoint(..., condition=null)       // or no condition
set_breakpoint(..., condition='x > 10')   // pauses when true
```

### Breakpoint Activation Check

| Response Message | Meaning | Action |
|-----------------|---------|--------|
| "set successfully" + resolved locations | ✅ Active | Proceed |
| "no matching scripts loaded" | ❌ FAILED | Fix urlRegex! Check script URLs via `list_network_requests` |

### Debugger Commands

```
// Set breakpoint with logging (no pause)
set_breakpoint(breakpointId="log1", urlRegex=".*target\\.js.*", lineNumber=123, 
               condition='console.log("VAR:", someVar), false')

// Set breakpoint with column snapping (for minified code)
set_breakpoint(breakpointId="bp1", urlRegex=".*target\\.js.*", lineNumber=123, 
               columnNumber=500, snapRange=100)

// Set pausing breakpoint
set_breakpoint(breakpointId="bp1", urlRegex=".*target\\.js.*", lineNumber=123)

// Find valid breakpoint positions (before setting)
get_possible_breakpoints(urlRegex=".*target\\.js.*", lineNumber=123, 
                         startColumn=0, endColumn=1000, maxCount=20)

// Manage breakpoints
list_breakpoints(searchTerm="target", pageSize=10)
remove_breakpoint(breakpointId="bp1") | clear_all_breakpoints()

// When paused
get_debugger_status(frameIndex=0)                    // See call stack + local vars (frame 0 = current)
get_scope_variables(frameIndex=0, searchTerm="user", pageSize=10, 
                    scopeType="local", maxDepth=3, saveToFile="vars.txt")  // Filter/paginate variables
evaluate_on_call_frame(expression="x", frameIndex=0)  // Evaluate in specific frame
step_over() | step_into() | step_out()                // Navigate code
resume_execution()                                    // Continue to next breakpoint or end

// Chained debugging (while paused, set next BP then resume)
set_breakpoint(...) → resume_execution() → get_debugger_status()  // Auto-stops at next BP

// Save scope variables to file
save_scope_variables(filePath="scope.json", frameIndex=0, maxDepth=5, includeGlobal=false)

disable_debugger()  // Cleanup
```

### JSVMP Breakpoint Instrumentation

```
// Step 1: Find dispatcher line (e.g., line 1234 in ds.js)
// Step 2: Set logging breakpoint
set_breakpoint(
    breakpointId="vm_log",
    urlRegex=".*ds\\.js.*",
    lineNumber=1234,
    condition='console.log("PC:", pc, "OP:", op, "Stack:", JSON.stringify(stack.slice(-3))), false'
)
// Step 3: Trigger function, then check logs
list_console_messages(types=["log"])
```

### evaluate_script: Globals Only

✅ **ONLY for**: `() => window.globalVar`, `() => typeof window.encrypt`  
❌ **NEVER for**: hooks, overrides, logging, intercepting → use `set_breakpoint()` instead  
❌ **When paused**: use `evaluate_on_call_frame()` instead

## Network Tools

```
search_network_requests(urlPattern="api", resourceTypes=["xhr","fetch"], pageSize=20)
search_network_requests(searchContent="sign", method="POST", pageSize=20,
                         statusCodeMin=200, statusCodeMax=299, 
                         includePreservedRequests=true)

list_network_requests(pageSize=30, pageIdx=0, resourceTypes=["xhr","fetch"],
                       includePreservedRequests=true)

get_network_request(reqid=123)  // includes call stack!
save_network_request(reqid=123, filePath="raw/req.http", 
                      saveRequestBody=true, requestBodyFilePath="raw/req.body",
                      responseBodyFilePath="raw/req.response")
save_static_resource(reqid=45, filePath="source/")
```

## JS Analysis Tools

```
// Analyze function call graph (upstream callers and downstream callees)
analyze_call_graph(functionName="genSign", upstreamDepth=3, downstreamDepth=3,
                   urlPattern=".*core\\.js.*")

// Search for code patterns in scripts - ALWAYS set limits!
search_script_content(pattern="addEventListener", isRegex=false, 
                      urlPattern=".*app\\.js.*", pageSize=10, maxTotalChars=500)

// Search for function definitions - ALWAYS set limits!
search_functions(namePattern="handleClick", urlPattern=".*main\\.js.*",
                fuzzy=true, pageSize=10, maxCodeLines=15)
```

## Page & Console Tools

```
list_pages() | select_page(pageIdx=0) | navigate_page(type="url"|"reload", url="...")

list_console_messages(types=["log"], pageSize=20)
get_console_message(msgid=123)
```

## Execution Flow

**Loop**: capture → identify params → locate JS → analyze → repro.py

1. **Capture**: Open URL, capture XHR/fetch, trigger interactions
2. **Pick API**: Rank by `focus` keyword, select primary, log to notes
3. **Identify params**: Find `sign|sig|nonce|ts|token|enc|deviceId` in query/body/headers/cookies
   - Test necessity: remove param → replay → works? skip
   - Trace chains: `/init→deviceId` → `/token→sessionToken` → `/api→sign`
4. **Locate JS**:
   - A) Stack trace: `get_network_request(reqid)` → file:line entry point
   - B) **JS Analysis**: `search_functions(namePattern="genSign", pageSize=10)` → `analyze_call_graph()` → locate entry point
   - C) **Debugger**: `set_breakpoint` → `step_over/into` → `get_scope_variables` (PRIMARY)
   - D) **Search scripts**: `search_script_content(pattern="sign", pageSize=10, maxTotalChars=500)` for code patterns
   - E) **Grep (char-limited!)**: `rg -o ".{0,50}keyword.{0,50}" file | head -20`
   - F) **Obfuscated?** → deobfuscate first → then debug
   - G) **Extract code**: Load `#[[file:skills/js_extraction.md]]` for safe slicing techniques
5. **Verify**: Browser value → Python same inputs → compare → live test

## Inputs

- `url` (required): Target page URL
- `focus`: API keyword filter (e.g., `/api/`, `graphql`)
- `saveDir`: Default `artifacts/jsrev/<domain>/`
- `goal`: `reverse` (full algo + Python) | `env` (make JS runnable only)

## Python Environment

```bash
cd $saveDir
if command -v uv &>/dev/null; then
  uv init && uv add requests pycryptodome && uv run repro.py
else
  python3 -m venv .venv && source .venv/bin/activate
  pip install requests pycryptodome && pip freeze > requirements.txt
  python repro.py
fi
```

## Output Structure

```
saveDir/
├── analysis_notes.md     # Findings log
├── lib/
│   ├── crypto_utils.py   # Core algorithms
│   └── api_client.py     # Request helpers
├── test_crypto.py        # Unit tests
├── repro.py              # Main script
├── source/               # Saved/deobfuscated JS
└── raw/                  # HTTP captures
```

## analysis_notes.md Template

```markdown
## Status: [EXPLORING|LOCATING|VERIFYING|BLOCKED]

## Target API
- Endpoint: `POST /api/check`
- Hard params: `sign` (query), `token` (header)
- Chain: init→deviceId→token→sign [UNVERIFIED]

## Findings Log
### [HH:MM] Title
- Source: `core.js:1234`
- Detail: what was found
- Marker: [UNVERIFIED] | [VERIFIED] | [REPRODUCED]

## Code Locations
| Param | File:Line | Function | Confidence |
|-------|-----------|----------|------------|
| sign  | core.js:456 | genSign() | [VERIFIED] |

## Blocked/Pending
- [ ] Issue description

## Artifacts
- raw/check.http, source/core.js, lib/crypto_utils.py
```

## Forbidden

- ❌ Read large JS in full
- ❌ `rg`/`grep` on minified JS without character limits
- ❌ `sed` ranges > 5 lines on minified files
- ❌ Omit `pageSize`/`maxTotalChars` on MCP search tools
- ❌ Claims without evidence markers
- ❌ Struggle with obfuscated code without trying AST deobfuscation
- ❌ Proceed with "no matching scripts loaded" breakpoints
- ❌ Use evaluate_script for hooks/logging/intercepting
- ❌ Output full long strings (truncate even in thinking!)

## Safety

- WASM/Worker signing: save assets, report paths
- Nested VMs: save trace logs, report partial findings

## Reference Skills

- **`#[[file:skills/js_deobfuscation.md]]`**: AST deobfuscation, anti-debug bypass, string decoding
- **`#[[file:skills/jsvmp_analysis.md]]`**: VM analysis, breakpoint instrumentation, opcode mapping
- **`#[[file:skills/js_env_patching.md]]`**: Environment patching (Happy-DOM, Proxy sniffing, anti-detection)
- **`#[[file:skills/js_extraction.md]]`**: **Locate & Extract** (rg/sed usage, Webpack slicing, handling minified code)
