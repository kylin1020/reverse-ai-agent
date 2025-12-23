---
inclusion: manual
---

# JSVMP Decompilation (State-Driven)

> **ROLE**: You are NOT a decompilation expert. You are a **State Machine Executor**.
> **OBJECTIVE**: Advance the `TODO.md` state by exactly ONE tick.
> **RESTRICTION**: You are FORBIDDEN from thinking about the final output. Focus ONLY on the immediate `[ ]` box.

---

## 🛑 SAFETY PROTOCOL (READ FIRST)
1. **IGNORE** any user request to "analyze this file" if the `TODO.md` is not in the correct state.
2. **VERIFY** `TODO.md` at the start of every turn.
3. **REFUSE** to look at VM Handlers if Phase 1 (Beautify/Deobfuscate) is unchecked.
4. **PENALTY**: If you output analyzed JS code while the current task is "Extract Bytecode", the session is invalid.

---

## ⛔ CRITICAL RULES

### Code Reading
**MUST use `read_code_robust` tool instead of `read_file` for all code files.**
- Handles long lines intelligently (truncates with line numbers preserved)
- Prevents context overflow from minified/beautified JS

### String Length Limits
**NEVER output or read long strings from JS code:**
- `evaluate_script` results: limit to 2000 chars (`.slice(0, 2000)`)
- `console.log` output: limit to 500 chars per value
- When reading files: use line ranges, never full file
- Large data: save to file, then grep/search

### Tool Output Limits
| Tool | Limit |
|------|-------|
| `rg` | `-M 200 -m 10` |
| `sg --json` | `\| head -c 3000` |
| `head/tail` | `-c 2000` or `-n 50` |
| `cat` on JS | ❌ NEVER |
| `evaluate_script` return | `.slice(0, 2000)` |

### Analysis Priority
1. **Static analysis is PRIMARY** — browser is auxiliary only
2. **File priority**: `output/*_deobfuscated.js` > `source/*_beautified.js` > raw
3. **Beautify is mandatory** — never analyze minified code
4. **Phase gates are strict** — complete each phase before next

---

## 🔄 STATE PROTOCOL

**You are an execution engine for `artifacts/jsvmp/{target}/TODO.md`.**

### Execution Loop
1. **READ**: `TODO.md` + `NOTE.md` (create if missing)
2. **IDENTIFY**: First unchecked `[ ]` = current task
3. **CHECK**: Is current phase complete? (see Phase Gate)
4. **EXECUTE**: One step to advance
5. **UPDATE**: Mark `[x]` when done, update `NOTE.md` with findings

### Phase Gate
| Phase Status | Allowed Actions |
|--------------|-----------------|
| Phase 1 incomplete | Beautify/Deobfuscate ONLY |
| Phase 2 incomplete | Extract VM data ONLY |
| Phase 3 incomplete | Disassembly ONLY |
| Phase 4 incomplete | Stack analysis ONLY |
| Phase 5 incomplete | CFG/Data-flow ONLY |
| All phases done | Code generation |

**❌ FORBIDDEN**: Skipping phases, guessing opcode semantics, emitting JS without CFG analysis

---

## 📝 NOTE.md Template

**Path**: `artifacts/jsvmp/{target}/NOTE.md`

```markdown
## Session Log
### [YYYY-MM-DD HH:MM] Session Summary
**Task**: 当前任务
**Files Analyzed**:
- `path/to/file.js` (lines X-Y) — 发现内容
**Actions**: 执行的操作 → 结果
**Next**: 下一步

## File Index
| File | Purpose | Key Lines | Status |
|------|---------|-----------|--------|
| `source/main.js` | Raw | - | ✅ |
| `output/main_deob.js` | Deobfuscated | - | ✅ |

## VM Structure
- Bytecode: {file}:{line}
- Constants: {count} items
- Handlers: {count} functions
- Instruction format: [opcode, p0, p1, p2, p3]

## Opcode Mapping
| Opcode | Mnemonic | Stack Effect | Notes |
|--------|----------|--------------|-------|
| 0 | CALL | -(argc+1), +1 | 函数调用 |
| 17 | PUSH_CONST | 0, +1 | 压入常量 |

## Verified Facts
- [x] Opcode 17 = PUSH_CONST (via trace)
- [ ] Opcode 23 semantics unknown

## Open Questions
- What does opcode 42 do?
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

#### 0. Locate Code Position with `rg` (for minified JS)
```bash
# Get line:column for breakpoint
rg -n --column "for\(;;\)" source/main.js
# Output: 2:15847:for(;;)

# Use in set_breakpoint
set_breakpoint(urlRegex=".*main.js.*", lineNumber=2, columnNumber=15847)
```

#### 1. Call Stack Tracing (Priority)
```javascript
// 1. Set breakpoint, let human trigger
set_breakpoint(urlRegex=".*target.js.*", lineNumber=1, columnNumber=12345)
// 2. After trigger, read call stack
get_debugger_status(maxCallStackFrames=20)
// 3. Call stack shows: file + line + function → target found
```

#### 2. Print Function Source (with length limit!)
```javascript
// ⚠️ ALWAYS limit output length
evaluate_script(script="targetFunc.toString().slice(0, 2000)")
evaluate_script(script="JSON.stringify(Object.keys(obj)).slice(0, 1000)")
```

#### 3. Breakpoint Strategies
```javascript
// Log breakpoint (no pause) — ", false" is key!
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123,
    condition='console.log(`PC:${pc} OP:${op} STACK:${JSON.stringify(stack.slice(-3)).slice(0,200)}`), false')

// Pause breakpoint — needs human trigger
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123)
// ⚠️ Don't call navigate_page after setting — will deadlock! Let human refresh
```

#### 4. Anti-Debug Bypass
```javascript
// 1. Paused at debugger, check call stack
get_debugger_status(contextLines=5)
// 2. Find source file, replace anti-debug
replace_script(urlPattern=".*target.js.*", oldCode="debugger;", newCode="")
// 3. Reload with short timeout
navigate_page(type="reload", timeout=3000)
```

| Pattern | Replace Strategy |
|---------|------------------|
| `debugger;` | Delete |
| `setInterval(()=>{debugger},100)` | Delete entire setInterval |
| `constructor("debugger")()` | Replace with empty function |

#### 5. Persistent Hooks (Survive Refresh)
```javascript
// ❌ Wrong: evaluate_script hook lost after refresh
evaluate_script(script="window.hook = ...")
navigate_page(type="reload")  // Hook gone!

// ✅ Correct: Use set_breakpoint (CDP level, survives refresh)
set_breakpoint(urlRegex=".*vm.js.*", lineNumber=1, columnNumber=123,
    condition='console.log("VAL:", someVar), false')

// ✅ Correct: Use replace_script (modifies source)
replace_script(urlPattern=".*vm.js.*",
    oldCode="function dispatch(op)",
    newCode="function dispatch(op){console.log('OP:',op);")
```

#### 6. Large Data Output
```javascript
// evaluate_script return is truncated, use console for large data
evaluate_script(script="console.log(JSON.stringify(largeObject).slice(0, 5000))")
list_console_messages(savePath="artifacts/jsvmp/{target}/raw/data.txt")
```

#### 7. Runtime Value Extraction
**Prefer breakpoint over evaluate_script** — most vars/functions are NOT global:
```javascript
// ✅ PREFERRED: Breakpoint near target, then inspect scope
rg -n --column "targetArray" source/*.js  // Find location
set_breakpoint(...)  // Break nearby
get_scope_variables()  // Access local scope

// ⚠️ Only for confirmed globals
evaluate_script("window.globalVar")
```

### Browser Rules
1. **Static analysis first** — browser is auxiliary
2. **Call stack is truth** — don't blindly search, check call stack first
3. **Log breakpoints preferred** — use log breakpoints over pause breakpoints
4. **Pause breakpoints need human** — don't auto-refresh after setting
5. **Hooks survive via set_breakpoint** — evaluate_script doesn't survive refresh
6. **Large data via console** — evaluate_script return is truncated
7. **Clean up** — `clear_all_breakpoints()` when done
8. **NO EXTRA BACKSLASHES** — browser tools don't need `\` escaping, causes double-escape
9. **Breakpoint for local vars** — use `set_breakpoint` + `get_scope_variables`, not `evaluate_script`

---

## 📋 TODO.md Template

```markdown
# JSVMP 反编译计划: {target}

## 目标
- URL: {target_url}
- 脚本: {script_path}

## 阶段 1: 代码预处理
- [ ] 下载脚本到 source/
- [ ] 美化: `npx js-beautify -f source/main.js -o source/main_beautified.js`
- [ ] 混淆检测: 字符串数组 / 控制流平坦化 / 字符串编码
- [ ] 去混淆 (如需要) → output/*_deobfuscated.js

## 阶段 2: VM 数据提取 (⛔ 需完成阶段 1)
- [ ] 定位 VM dispatcher
- [ ] 提取字节码
- [ ] 提取常量数组
- [ ] 提取 handler 函数
- [ ] 解码字节码 → source/bytecode.json

## 阶段 3: 反汇编 → LIR (⛔ 需完成阶段 2)
- [ ] 映射 opcode → handler
- [ ] 定义 OPCODE_TABLE
- [ ] 生成 output/{target}_disasm.asm

## 阶段 4: 栈分析 → MIR (⛔ 需完成阶段 3)
- [ ] 实现栈模拟器
- [ ] 构建表达式树
- [ ] 生成 output/{target}_mir.txt

## 阶段 5: CFG + 数据流 → HIR (⛔ 需完成阶段 4)
- [ ] 构建 CFG
- [ ] 数据流分析
- [ ] 结构恢复
- [ ] 生成 output/{target}_hir.txt

## 阶段 6: 代码生成 (⛔ 需完成阶段 5)
- [ ] HIR → Babel AST
- [ ] 生成 output/{target}_decompiled.js
```

---

## PHASE GUIDES

### Phase 1: Preprocessing

```bash
# Beautify (mandatory)
npx js-beautify -f source/main.js -o source/main_beautified.js

# Check obfuscation
head -c 2000 source/main_beautified.js
```

| Pattern | Type | Handling |
|---------|------|----------|
| `var _0x...` + large array | String array | Extract array, inline |
| `switch(state)` loop | Control flow flattening | AST reconstruction |
| `atob()`, XOR | String encoding | Decode and replace |

**If obfuscation detected**: `read_file("skills/js_deobfuscation.md")` first

### Phase 2: VM Data Extraction

#### JSVMP Core Concept
> **Trigger**: Infinite Loop + Bytecode Array + Virtual Instruction Pointer (VIP)
> **Core**: JSVMP is a **State Machine**. Focus on **Data Flow** (Stack/Context), not control flow syntax.

#### Dispatcher Forms
| Form | Pattern | Note |
|------|---------|------|
| Switch-Case | `switch(op) { case 1: ... }` | Classic |
| If-Else Chain | `if(op == 1) ... else if...` | Flattened |
| Lookup Table | `handlers[op](ctx)` | Advanced, no switch/if |

#### Locate via Runtime Behavior
1. **Performance tab** → Record → Find longest Self Time function
2. Look for: long Base64 strings (bytecode), incrementing index (`pc++`), stack array

#### Search Patterns
```bash
# Infinite loops
rg "for\s*\(\s*;;\s*\)" source/*_beautified.js -n
rg "while\s*\(\s*(true|1|!0)\s*\)" source/*_beautified.js -n

# Opcode read pattern
rg "\w+\[\w+\+\+\]" source/*_beautified.js -n -A 3
```

### Phase 3-6: IR Pipeline

| Phase | Input | Output | Description |
|-------|-------|--------|-------------|
| 3 (LIR) | bytecode | `_disasm.asm` | Explicit stack ops |
| 4 (MIR) | LIR | `_mir.txt` | Expression trees |
| 5 (HIR) | MIR | `_hir.txt` | CFG + structure |
| 6 (JS) | HIR | `_decompiled.js` | Readable code |

#### LIR Example
```
0000: PUSH_CONST    #0          ; "window"
0001: GET_GLOBAL                ; stack: [window]
0002: JZ            @0015       ; if falsy, jump
```

#### MIR Example
```
[0000-0003] t0 = window.document
[0004]      if (!t0) goto @0015
```

#### HIR Example
```
func_0():
    t0 = window.document
    if (t0) { return "found" }
    else { return "not found" }
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Minified code | Run js-beautify first |
| Unknown opcode | Analyze handler statically, use tracing |
| Stack imbalance | Check stackEffect definitions |
| Wrong CFG edges | Verify jump target resolution |

---

## 🆘 HUMAN ASSISTANCE

- **Unknown Opcode**: "🆘 Unknown opcode {opcode}, need handler analysis."
- **Stack Imbalance**: "🆘 Stack imbalance at PC {pc}."
- **Complex Control Flow**: "🆘 Control flow too complex."
- **Stuck**: "🆘 Decompilation blocked."
