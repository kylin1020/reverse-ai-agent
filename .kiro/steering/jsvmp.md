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

## 📋 TODO.md Template

```markdown
# JSVMP 反编译计划: {target}

## 阶段 1: 代码预处理
- [ ] 下载脚本到 source/
- [ ] 智能阅读: `read_code_smart` 检查混淆类型 (Virtual View)
- [ ] 编写去混淆脚本 (Babel Visitor)
- [ ] 应用去混淆: `apply_custom_transform` → output/*_deob.js

## 阶段 2: VM 数据提取 (⛔ 需完成阶段 1)
- [ ] 定位 VM dispatcher (`search_code_smart` / Profiler)
- [ ] 提取字节码
- [ ] 提取常量数组
- [ ] 提取 handler 函数

... (后续阶段保持不变)
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

## 🆘 HUMAN ASSISTANCE

- **Unknown Opcode**: "🆘 Unknown opcode {opcode}, need handler analysis."
- **Stack Imbalance**: "🆘 Stack imbalance at PC {pc}."
- **Complex Control Flow**: "🆘 Control flow too complex."
- **Stuck**: "🆘 Decompilation blocked."