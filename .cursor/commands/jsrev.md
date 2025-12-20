---
inclusion: always
---

## jsrev

JS Reverse Engineering: browser request → JS code → algorithm → Python reproduction.

## 🚨 P0: DEOBFUSCATION GATE (BLOCKS ANALYSIS) 🚨

**IRON LAW**: Analysis tasks REQUIRE clean code. No exceptions.

### When P0 Applies

User asks to: analyze, find, trace, debug, "how is X generated", "what encrypts X"
→ **ANALYSIS task** → P0 gate BLOCKS until code is clean.

User asks to: 补环境, run in Node, fix ReferenceError
→ **ENV PATCHING** → Can work on obfuscated code directly.

## 🚨🚨🚨 RULE ZERO: OUTPUT LIMITS (HIGHEST PRIORITY) 🚨🚨🚨

**ABSOLUTE LAW**: EVERY command MUST limit output. NO EXCEPTIONS. EVER.

This rule applies BEFORE all other rules. Violating this = context explosion = session death.

### The Problem

```bash
# Minified JS = 1 line = 500KB+
head -n 1 minified.js    # ❌ Returns 500KB (1 line!)
rg "keyword" file.js     # ❌ Returns entire matching lines (500KB each!)
cat file.js              # ❌ Returns entire file
```

### Mandatory Limits by Command

| Command | ✅ ALWAYS USE | ❌ NEVER USE |
|---------|---------------|--------------|
| `rg` | `rg -M 200 -o ".{0,80}pattern.{0,80}" \| head -20` | `rg "pattern" file.js` |
| `cat` | `head -c 10000 file.js` | `cat file.js` |
| `head` | `head -c 5000` (bytes!) | `head -n 50` on JS |
| `tail` | `tail -c 5000` | `tail -n 50` on JS |
| `sed` | `sed -n '1,100p'` (multi-line only) | Any on minified |
| `awk` | `awk '{print substr($0,1,200)}' \| head -50` | `awk '{print}'` |
| `jq` | `jq -c '.' \| head -c 5000` | `jq '.'` on large JSON |

### ⚠️ `head -n` After `rg` Does NOT Help!

```bash
rg "keyword" file.js | head -20  # ❌ STILL EXPLODES!
# Why: rg outputs full lines FIRST, then head truncates line COUNT (not bytes)
# Each line can be 500KB → 20 lines = 10MB

rg -M 200 -o ".{0,80}keyword.{0,80}" file.js | head -20  # ✅ Safe
# -M 200: max 200 chars per line
# -o: only matching part
# .{0,80}: 80 chars context each side
```

### Quick Reference

```bash
# ✅ SAFE PATTERNS
rg -M 200 -o ".{0,80}keyword.{0,80}" file.js | head -20
head -c 10000 file.js
awk '{print substr($0,1,300)}' file.js | head -50
cut -c1-300 file.js | head -50

# ❌ FORBIDDEN (will kill session)
cat file.js
rg "keyword" file.js
rg "keyword" file.js | head -20
head -n 50 minified.js
```

**VIOLATION = IMMEDIATE SESSION FAILURE. NO RECOVERY.**

### Obfuscation Check (RUN FIRST)

```bash
head -c 3000 {file} | rg -o "_0x[a-f0-9]{4,6}|\\\\x[0-9a-f]{2}|atob\\(" | head -3
```

- **ANY match** → OBFUSCATED → For analysis: STOP, deobfuscate first
- **No match** → Clean → Proceed

### If Obfuscated + Analysis Task

```
1. SAY: "检测到混淆代码，必须先去混淆才能分析。"
2. readFile("skills/js_deobfuscation.md")
3. Apply deobfuscation, save to output/*_deobfuscated.js
4. Analyze ONLY the clean output/ files
```

### Forbidden on Obfuscated Code (Analysis Tasks)

- ❌ Setting breakpoints, searching patterns, tracing execution
- ❌ "Despite the obfuscation...", "I can see _0x..."

**Why**: Obfuscated analysis = 100% failure. Deobfuscation takes 5 min, failed analysis wastes hours.

---

## 🔍 P0.5: NECESSITY CHECK

Before analyzing cookie/param generation, verify it's actually required:

```bash
curl -v 'URL' -H 'Cookie: other_only' 2>&1 | head -c 3000
```

| Response | Action |
|----------|--------|
| 200 + valid | ⏭️ "该参数非必需，无需逆向" |
| 403/401/blocked | ✅ Proceed with analysis |

---

## P1: SKILL LOADING

| Pattern | Skill | Blocks Analysis? |
|---------|-------|------------------|
| `_0x`, `\x`, `atob(` | `skills/js_deobfuscation.md` | 🔴 YES |
| 补环境, ReferenceError | `skills/js_env_patching.md` | No |
| `while(1){switch`, VM | `skills/jsvmp_analysis.md` | No |
| webpack, `__webpack_require__` | `skills/js_extraction.md` | No |

---

## P1: SESSION START

```bash
ls artifacts/jsrev/{domain}/ 2>/dev/null && readFile("artifacts/jsrev/{domain}/PROGRESS.md")
```

If source/ has obfuscated JS but no output/*_deobfuscated.js → Deobfuscate first.

---

## 🚫 P2: NO RETREAT — 禁止中途换思路

JS reverse engineering IS hard. Difficulty ≠ dead end.

### 🔴 IRON LAW: 策略切换必须询问用户

**禁止行为：**
- ❌ "让我换个思路" → 然后自行切换方案
- ❌ "既然找不到，我们试试补环境"
- ❌ 分析任务中途转为 Node.js 补环境执行
- ❌ 一次搜索没结果就放弃当前方向

**强制行为：**
- ✅ 穷尽当前方向的所有手段后，才能考虑换方向
- ✅ 换方向前 **必须停下来询问用户**："当前方向已尝试 X/Y/Z，均未找到目标。是否切换到 [新方案]？"
- ✅ 用户明确同意后，才能执行新方案

### 穷尽手段的定义

在声称"找不到"之前，必须完成以下全部：

| # | 手段 | 示例 |
|---|------|------|
| 1 | 搜索 5+ 种关键词模式 | 函数名、参数名、返回值特征、魔法常量、位运算 |
| 2 | Hook 关键 API | `XMLHttpRequest`, `fetch`, `crypto`, `JSON.stringify` |
| 3 | 断点追踪 3+ 层调用栈 | 从请求发起点向上/向下追踪 |
| 4 | 检查参数变异 | 函数调用前后，参数是否被修改 |
| 5 | 搜索位运算特征 | `>>> 0`, `& 0xff`, `^ key`, `<< 8` |
| 6 | 搜索编码特征 | `btoa`, `atob`, `charCodeAt`, `fromCharCode` |
| 7 | 记录所有发现 | 写入 `notes/` 目录 |

### 空结果 ≠ 死路

- `cryptoFuncs: []` → 可能是自定义实现，继续追踪数据流
- 没找到标准 API → 搜索位运算、循环、数组操作
- 函数名混淆 → 通过调用关系和返回值类型定位

### 违规示例

```
❌ AI: "cryptoFuncs 为空，让我换个思路，直接补环境跑..."
   → 违规：未询问用户，未穷尽手段

✅ AI: "已尝试：1) 搜索 crypto API - 无结果 2) Hook fetch - 找到请求点 
        3) 追踪 3 层调用栈 - 数据在第 2 层被加密 4) 搜索位运算 - 
        找到 XOR 操作但未确认关联。
        
        当前卡在：无法确定 XOR 操作与目标参数的关系。
        建议：A) 继续深入 XOR 函数 B) 尝试补环境执行
        请问选择哪个方向？"
   → 正确：汇报进展，列出选项，等待用户决定
```

---

## P2: BROWSER IS TRUTH

```javascript
// Print function source (limited!)
evaluate_script(function="() => targetFunc.toString().slice(0, 2000)")

// Explore object keys
evaluate_script(function="() => JSON.stringify(Object.keys(obj)).slice(0,1000)")
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

## P3: HOOK STRATEGIES

`evaluate_script` hooks don't survive reload. Alternatives:

**Option 1: Log breakpoint (recommended)**
```javascript
// Logs value without pausing - ", false" is CRITICAL
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345,
    condition='console.log("VAR:", someVar), false')
```

**Option 2: Re-inject after reload**
```javascript
evaluate_script(function="() => { window.__hook = ...; }")
```

---

## P3: TRACE LOG SAFETY

VM traces output JSON → massive single lines.

```bash
# ✅ CORRECT
rg -M 200 -o ".{0,80}\[TRACE\].{0,80}" trace.txt | head -100
awk -F'|' '{print $1,$2}' trace.txt | head -100

# ❌ FORBIDDEN
rg "\[TRACE\]" trace.txt
rg "\[TRACE\]" trace.txt | head -10  # Still explodes!
```

---

## P4: LOCAL-FIRST ANALYSIS

1. READ LOCAL: `output/*_formatted.js` → understand logic
2. GET LINE FROM SOURCE: `rg -M 200 -n --column` in `source/*.js`
3. DEBUG BROWSER: `set_breakpoint` with SOURCE line:column
4. COMPARE: Local + Browser → confirm

⚠️ Formatted files have DIFFERENT line numbers than source!

---

## P5: PYTHON

```bash
# ❌ BAD
python -c "import json; ..."

# ✅ GOOD
fsWrite("tests/decode.py", content)
uv run python tests/test.py
uv add requests pycryptodome
```

---

## MCP TOOLS

### ⚠️ ABSOLUTE PATH REQUIRED

```javascript
// ❌ WRONG
save_static_resource(reqid=23, filePath="source/main.js")

// ✅ CORRECT
save_static_resource(reqid=23, filePath="/Users/kylin/project/artifacts/jsrev/example.com/source/main.js")
```

### Network

```javascript
list_network_requests(resourceTypes=["xhr", "fetch"], pageSize=50)
get_network_request(reqid=15)
save_static_resource(reqid=23, filePath="/absolute/path/source/main.js")
```

### URL Regex: Keep It Simple

```javascript
// ❌ OVER-ESCAPED
urlRegex=".*bdms_1\\.0\\.1\\.19_fix\\.js.*"

// ✅ SIMPLE (dots rarely cause false matches)
urlRegex=".*bdms_1.0.1.19_fix.js.*"
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

After setting a pausing breakpoint, **DO NOT** call `navigate_page`/`evaluate_script`/`click` → DEADLOCK.

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

### Cleanup (MANDATORY)

```javascript
clear_all_breakpoints()
resume_execution()
```

---

## HUMAN INTERACTION

**STOP and ask human:**
- Visual CAPTCHA → Build OpenCV tool (`tests/`), human solves
- Login required → "Please login first"
- Pausing breakpoint → "Breakpoint set. Please refresh/click, then tell me."

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

**Goal**: `repro/*.py` → server returns valid response.

- ✅ Encrypted params match browser values, dynamic generation works
- ❌ "Algorithm identified" without working code
- ❌ Works with captured values but not fresh ones

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
