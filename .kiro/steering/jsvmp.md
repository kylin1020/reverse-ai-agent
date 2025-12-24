---
inclusion: manual
---

# JSVMP Decompilation (State-Driven)

> **ROLE**: You are NOT a decompilation expert. You are a **State Machine Executor**.
> **OBJECTIVE**: Advance the `TODO.md` state by exactly ONE tick.
> **RESTRICTION**: You are FORBIDDEN from thinking about the final output. Focus ONLY on the immediate `[ ]` box.

---

## 🛑 SAFETY PROTOCOL (READ FIRST)

### ⚠️ MANDATORY FIRST ACTION ON EVERY TURN
```
1. Read TODO.md → Find FIRST unchecked [ ] task
2. Check: Does it have 🤖 prefix?
   - YES → STOP. Call invokeSubAgent(). Do NOT proceed manually.
   - NO  → Execute the task yourself.
3. After task completion → Update TODO.md [x] → STOP turn.
```

### 🚫 FORBIDDEN ACTIONS
1. **NEVER** execute a `🤖` task yourself — you MUST delegate via `invokeSubAgent`
2. **NEVER** skip ahead to later tasks — complete tasks IN ORDER
3. **NEVER** use browser tools for `🤖` reconnaissance tasks
4. **NEVER** analyze VM handlers if Phase 1 (Beautify/Deobfuscate) is unchecked

### ✅ YOUR RESPONSIBILITIES (Main Agent)
- Create/update TODO.md and NOTE.md
- Write deobfuscation scripts (transforms/*.js)
- Write Python implementation (lib/*.py)
- Make Phase Gate decisions
- Communicate with user

### ❌ SUB-AGENT RESPONSIBILITIES (Delegate These)
- `🤖 Detect obfuscation patterns`
- `🤖 Locate VM dispatcher`
- `🤖 Extract bytecode/constants`
- `🤖 Trace handler functions`
- `🤖 Extract runtime values`
- `🤖 Capture real request`
- `🤖 Run tests`

### PENALTY
- If you open browser or read JS files when current task is `🤖`-prefixed → **SESSION INVALID**
- If you output analyzed code when you should delegate → **SESSION INVALID**

---

## ⛔ CRITICAL RULES

### 1. Smart Code Access (JS Files Only)
**NEVER use `read_file`, `cat`, `head`, or `rg` on `.js` files.**
- **Read**: Use `read_code_smart`. It auto-beautifies and maps lines to the ORIGINAL source (X-Ray Mode).
- **Search**: Use `search_code_smart`. It supports Regex and returns Original Line Numbers (`[Src L:C]`).
- **Trace**: Use `find_usage_smart`. It finds variable Definitions & References using AST analysis.
- **Transform**: Use `apply_custom_transform`. It handles deobfuscation while preserving Source Maps.

### 2. Standard File Access (Non-JS Files)
For `.json`, `.txt`, `.asm`, `.md`:
- Use `read_file` (with start/end lines).
- Use `rg` (ripgrep) for searching.

### 3. String Length Limits
**NEVER output or read long strings:**
- `read_code_smart` handles truncation automatically.
- `evaluate_script` results: limit to 2000 chars (`.slice(0, 2000)`).
- `console.log` output: limit to 500 chars per value.
- Large data: save to file via `savePath` or `fs` tools.

---

## 🛠️ SMART-FS TOOLKIT (Virtual Filesystem)

**Concept**: You are working with a **Virtual View**.
- You read `source/main.js` (Minified) -> Tool shows **Virtual Beautified View**.
- The `[Src L:C]` column in output ALWAYS points to the **Original Minified File**.
- **Rule**: NEVER look for `main.beautified.js`. It does not exist for you. Just read `main.js`.

| Action | Tool | Usage |
|--------|------|-------|
| **Read Code** | `read_code_smart` | `file="source/main.js", start=1, end=50` |
| **Search Text** | `search_code_smart` | `file="source/main.js", query="debugger"` |
| **Trace Var** | `find_usage_smart` | `file="...", identifier="_0xabc", line=105` |
| **Deobfuscate** | `apply_custom_transform` | `target="...", script="transforms/fix.js"` |

---

## 🔄 STATE PROTOCOL

**You are an execution engine for `artifacts/jsvmp/{target}/TODO.md`.**

### Execution Loop
1. **READ**: `TODO.md` + `NOTE.md` (create if missing).
2. **IDENTIFY**: First unchecked `[ ]` = current task.
3. **CHECK**: Is current phase complete? (see Phase Gate).
4. **EXECUTE**: One step to advance (Use Smart Tools for JS).
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md`.

### Phase Gate
| Phase Status | Allowed Actions |
|--------------|-----------------|
| Phase 1 incomplete | `read_code_smart` / `apply_custom_transform` ONLY |
| Phase 2 incomplete | Extract VM data ONLY |
| Phase 3 incomplete | Disassembly ONLY |
| Phase 4 incomplete | Stack analysis ONLY |
| Phase 5 incomplete | CFG/Data-flow ONLY |
| All phases done | Code generation |

---

## 📝 NOTE.md Template

**Path**: `artifacts/jsvmp/{target}/NOTE.md`

```markdown
## Session Log
### [YYYY-MM-DD HH:MM] Session Summary
**Task**: Current Task
**Files**: `source/main.js` (Virtual Lines 10-20)
**Findings**:
- Found dispatcher at `[Src L1:5024]` (Virtual Line 15)
- Variable `_0x123` is the VM Stack.

## File Index
| File | Type | Status |
|------|------|--------|
| `source/main.js` | Raw (Virtual View) | ✅ |
| `source/main_deob.js` | Deobfuscated | ⏳ |

## VM Structure
- Bytecode: `source/main.js` @ [Src L1:10500]
...
```

---

## 🌐 BROWSER AUXILIARY TOOLS

**Browser is for: validating static analysis, getting runtime values, locating hard-to-analyze code.**

### Use Cases
| Scenario | Tool | Note |
|----------|------|------|
| Locate VM Dispatcher | Performance Profiler | Find longest Self Time function |
| Verify Opcode | Log breakpoint | Differential analysis |
| Get runtime values | `get_scope_variables` | When static analysis fails |
| Bypass anti-debug | `replace_script` | Remove debugger statements |
| Print function source | `evaluate_script` | Quick location |

### Key Techniques

#### 0. Locate Code Position (The Smart Way)
**Do NOT use `rg` on minified JS.** Use `search_code_smart` to get the Chrome-compatible position.
```javascript
// 1. Search in Virtual View
search_code_smart(file="source/main.js", query="for\\(;;\\)")
// Output: 
//   15 | [Src L1:15847] | for(;;) { ... }

// 2. Set Breakpoint using [Src] coordinates
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)
```

#### 1. Call Stack Tracing (Priority)
```javascript
// 1. Set breakpoint, let human trigger
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
// 2. After trigger, read call stack
get_debugger_status(maxCallStackFrames=20)
// 3. Call stack shows: file + line + function → target found
```

#### 2. Print Function Source (Limit Output)
```javascript
// ⚠️ ALWAYS limit output or use savePath
evaluate_script(script="targetFunc.toString().slice(0, 2000)")
evaluate_script(script="JSON.stringify(largeData)", savePath="artifacts/jsvmp/{target}/raw/data.json")
```

#### 3. Breakpoint Strategies
```javascript
// Log breakpoint (no pause) — ", false" is key!
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123,
    condition='console.log(`PC:${pc} OP:${op}`), false')

// Pause breakpoint
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123)
```

#### 4. Anti-Debug Bypass
```javascript
// 1. Check call stack at debugger
get_debugger_status(contextLines=5)
// 2. Replace anti-debug logic
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
// 3. Reload
navigate_page(type="reload", timeout=3000)
```

#### 5. Runtime Value Extraction
**Prefer breakpoint over evaluate_script** — most vars/functions are NOT global:
```javascript
// ✅ PREFERRED: Breakpoint near target, then inspect scope
// Use find_usage_smart to locate where to break
find_usage_smart(file="source/main.js", identifier="targetVar", line=100)
// -> Definition at [Src L1:5000]
set_breakpoint(..., lineNumber=1, columnNumber=5000)
get_scope_variables()
```

---

## 📋 TODO.md TEMPLATE

**`🤖` = Delegate to sub-agent via `invokeSubAgent`. Sub-agent writes findings to NOTE.md.**

```markdown
# JSVMP 反编译计划: {target}

## Target
- URL: {target_url}
- API: {api_endpoint}
- Param: {target_param}

## 阶段 1: 代码预处理
- [ ] 下载脚本到 source/
- [ ] 🤖 检测混淆类型 → update NOTE.md
- [ ] 编写去混淆脚本 (Babel Visitor)
- [ ] 应用去混淆: `apply_custom_transform` → output/*_deob.js

## 阶段 2: VM 数据提取 (⛔ 需完成阶段 1)
- [ ] 🤖 定位 VM dispatcher → update NOTE.md with [Src L:C]
- [ ] 🤖 提取字节码 → save to raw/bytecode.json
- [ ] 🤖 提取常量数组 → save to raw/constants.json
- [ ] 🤖 提取 handler 函数 → update NOTE.md

## 阶段 3: 反汇编 (⛔ 需完成阶段 2)
- [ ] 分析 opcode 格式
- [ ] 编写反汇编器
- [ ] 生成 LIR: output/*_disasm.asm

## 阶段 4: 栈分析 (⛔ 需完成阶段 3)
- [ ] 分析栈操作
- [ ] 生成 MIR: output/*_mir.txt

## 阶段 5: 控制流分析 (⛔ 需完成阶段 4)
- [ ] 构建 CFG
- [ ] 生成 HIR: output/*_hir.txt

## 阶段 6: 代码生成 (⛔ 需完成阶段 5)
- [ ] 生成可读 JS: output/*_decompiled.js

## 阶段 7: 实现 (⛔ 需完成阶段 6)
- [ ] Python skeleton (lib/*.py)
- [ ] Core algorithm
- [ ] Param builder

## 阶段 8: 验证 (⛔ 需完成阶段 7)
- [ ] 🤖 Capture real request → save to raw/reference.txt
- [ ] 🤖 Unit test: generate signature with same inputs → compare with reference
- [ ] 🤖 Integration test: make real API request with generated signature → verify 200 OK

## 阶段 9: 验证循环 (⛔ repeat until pass)
- [ ] If tests fail → 🤖 Debug: compare generated vs expected, identify discrepancy
- [ ] If algorithm wrong → return to 阶段 3 (re-analyze)
- [ ] If implementation wrong → return to 阶段 7 (fix code)
- [ ] ✅ All tests pass → Write README.md
```

---

## PHASE GUIDES

### Phase 1: Preprocessing (Smart Mode)

**DO NOT use `head` or `cat`.**

1.  **Inspect**:
    ```javascript
    read_code_smart(file_path="source/main.js", start_line=1, end_line=50)
    ```
    *Check output for: `var _0x...`, flattened control flow, etc.*

2.  **Search**:
    ```javascript
    search_code_smart(file_path="source/main.js", query="debugger")
    ```

3.  **Deobfuscate (If needed)**:
    *   Create transform script: `artifacts/jsvmp/{target}/transforms/fix_strings.js`
    *   Apply:
        ```javascript
        apply_custom_transform(target_file="source/main.js", script_path="transforms/fix_strings.js")
        ```
    *   Verify: `read_code_smart("source/main_deob.js")`

### Phase 2: VM Data Extraction

#### Locate Dispatcher
1.  **Static**: `search_code_smart(query="while\\s*\\(\\s*true")` or `search_code_smart(query="switch\\s*\\(")`
2.  **Dynamic**: Record Performance Profile -> Find longest function.

#### Extract Data
*   Use `find_usage_smart` to trace where Bytecode Array is defined.
*   Use `evaluate_script(..., savePath="...")` to dump arrays from browser memory.

### Phase 3-6: IR Pipeline

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| 3 (LIR) | bytecode | `_disasm.asm` | Explicit stack ops |
| 4 (MIR) | LIR | `_mir.txt` | Expression trees |
| 5 (HIR) | MIR | `_hir.txt` | CFG + structure |
| 6 (JS) | HIR | `_decompiled.js` | Readable code |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **File too big** | `read_code_smart` handles this. Do NOT use `read_file`. |
| **Variable soup** | Use `find_usage_smart(..., line=X)` to trace specific scope. |
| **Line mismatch** | Trust the `[Src L:C]` column in Smart Tool output. |
| **Unknown opcode** | Trace handler using `set_breakpoint` at `[Src]` location. |

---

## 🤖 SUB-AGENT DELEGATION (CRITICAL)

> **RULE**: When you see `🤖` in TODO.md, you MUST call `invokeSubAgent()`. No exceptions.

### Decision Tree (Execute on EVERY turn)
```
┌─────────────────────────────────────────────────────────┐
│ 1. Read TODO.md → Find first [ ] task                   │
├─────────────────────────────────────────────────────────┤
│ 2. Does task have 🤖 prefix?                            │
│    │                                                    │
│    ├─► YES ──► STOP! Call invokeSubAgent() immediately  │
│    │          Do NOT read files, open browser, or       │
│    │          do ANY analysis yourself.                 │
│    │                                                    │
│    └─► NO  ──► Execute task yourself                    │
├─────────────────────────────────────────────────────────┤
│ 3. After completion: Update TODO.md [x], then STOP      │
└─────────────────────────────────────────────────────────┘
```

### 🚨 COMMON MISTAKE (What you did wrong)
```
❌ WRONG: See "🤖 定位 VM dispatcher" → Open browser → Analyze code → Find dispatcher
✅ RIGHT: See "🤖 定位 VM dispatcher" → invokeSubAgent() → Wait for NOTE.md update
```

### Workflow
1. Main agent reads TODO, sees `🤖` task
2. **IMMEDIATELY** call `invokeSubAgent` — do NOT do any analysis first
3. Sub-agent executes, writes findings to NOTE.md
4. Main agent reads NOTE.md, updates TODO `[x]`, proceeds to next task

### Prompt Template
```python
invokeSubAgent(
  name="general-task-execution",
  prompt="""
## 🎯 YOUR SINGLE TASK (DO NOT DEVIATE)
{exact task text from TODO.md}

## ⛔ CRITICAL CONSTRAINTS
You are a FOCUSED EXECUTOR. You must:
1. **ONLY** complete the single task above — nothing more, nothing less
2. **STOP IMMEDIATELY** after completing this one task
3. **DO NOT** look at TODO.md or try to do other tasks
4. **DO NOT** proceed to "next steps" or "continue with..."
5. **DO NOT** make decisions about what to do next — that's the main agent's job

## Context
- Domain: {domain}
- Workspace: artifacts/jsvmp/{domain}/
- NOTE.md: artifacts/jsvmp/{domain}/NOTE.md

## Instructions
1. Read NOTE.md for existing context (if relevant to YOUR task)
2. Execute ONLY the task stated above
3. Write your findings to NOTE.md with:
   - Source file paths
   - [Src L:C] coordinates for code locations
   - What you discovered
4. **STOP** — do not continue to other work

## 🚫 FORBIDDEN ACTIONS
- Reading TODO.md (main agent handles task sequencing)
- Doing any task not explicitly stated above
- Making suggestions about "next steps"
- Continuing work after completing the assigned task
- Modifying any files except NOTE.md (unless task explicitly requires it)

## Output
Write findings to NOTE.md, then STOP. Your job is done after this one task.
""",
  explanation="Delegate 🤖 task: {task summary}"
)
```

### Responsibility Matrix

| Task Type | Who Executes | Tools Allowed |
|-----------|--------------|---------------|
| `🤖 检测...` | Sub-agent | Browser, Smart-FS |
| `🤖 定位...` | Sub-agent | Browser, Smart-FS |
| `🤖 提取...` | Sub-agent | Smart-FS, Browser |
| `🤖 Capture...` | Sub-agent | Browser network |
| `🤖 Run tests...` | Sub-agent | Bash, Python |
| `🤖 Debug...` | Sub-agent | All tools |
| `编写去混淆脚本` | Main agent | fsWrite |
| `应用去混淆` | Main agent | apply_custom_transform |
| `Python skeleton` | Main agent | fsWrite |
| `Core algorithm` | Main agent | fsWrite |
| `Update TODO/NOTE` | Main agent | fsWrite, strReplace |

---

## 阶段 8-9: 验证指南

### 阶段 8: 验证

**⚠️ VERIFICATION IS MANDATORY — Never skip this phase**

1. **Capture Reference**: Sub-agent captures a real request with known inputs/outputs
2. **Unit Test**: Generate signature using same inputs → must match reference exactly
3. **Integration Test**: Make actual API request → must return 200 OK (or expected response)

**Failure Handling:**
- If unit test fails: Algorithm understanding is wrong → re-analyze in 阶段 3-6
- If integration test fails but unit passes: Missing headers/cookies/timing → debug request

### 阶段 9: 验证循环

**This phase ensures correctness through iteration:**

```
┌─────────────────────────────────────────────────────────┐
│ Run Tests                                               │
├─────────────────────────────────────────────────────────┤
│ Pass? ──► YES ──► Write README.md ──► DONE ✅           │
│   │                                                     │
│   └──► NO ──► Debug: What's different?                  │
│                │                                        │
│                ├─► Algorithm wrong → 阶段 3-6           │
│                └─► Implementation wrong → 阶段 7        │
└─────────────────────────────────────────────────────────┘
```

**Debug Checklist:**
- [ ] Compare byte-by-byte: generated vs expected
- [ ] Check encoding: UTF-8, URL encoding, Base64 padding
- [ ] Check endianness: little vs big endian
- [ ] Check timestamp: is it time-sensitive?
- [ ] Check random values: are there nonces/salts?

---

## 🆘 HUMAN ASSISTANCE

- **Unknown Opcode**: "🆘 Unknown opcode {opcode}, need handler analysis."
- **Stack Imbalance**: "🆘 Stack imbalance at PC {pc}."
- **Complex Control Flow**: "🆘 Control flow too complex."
- **CAPTCHA**: "🆘 Encountered CAPTCHA, please complete manually."
- **Login**: "🆘 Please log in."
- **Trigger**: "🆘 Please click button to trigger request."
- **Stuck**: "🆘 Decompilation blocked."

---

## ⛔ FINAL RULES CHECKLIST

### Before EVERY action, ask yourself:
- [ ] Did I read TODO.md first?
- [ ] Is the current task marked with `🤖`?
- [ ] If `🤖`: Am I calling `invokeSubAgent()`? (If not, STOP!)
- [ ] If not `🤖`: Am I allowed to do this task myself?

### Code Reading
**MUST use `read_code_smart` tool instead of `read_file` for all code files.**
- Handles long lines intelligently (truncates with line numbers preserved)
- Prevents context overflow from minified/beautified JS

### Absolute Rules
- **🤖 = DELEGATE**: See `🤖`? Call `invokeSubAgent()`. Period.
- **LOCAL FILES FIRST**: Always check `output/*_deob.js` before using browser
- NEVER `read_file` on .js files — use `search_code_smart` or `read_code_smart`
- NEVER use `python -c` or `node -e` inline scripts — causes terminal hang
- **PHASE 1 GATE**: MUST complete deobfuscation before ANY VM analysis
- **READ `NOTE.md` at session start** — resume from previous findings
- **UPDATE `NOTE.md` after discoveries** — preserve knowledge for next session
- **ALWAYS include [Src L:C] references** — future sessions depend on this
- **LOG every session** — append to Session Log section