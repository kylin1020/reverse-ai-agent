# JSVMP Sub-Agent Task Guide

> **Prerequisites**: Read `sub_agent.md` first for common rules.

## ⚠️ ABSOLUTE PATH RULE (CRITICAL)

**ALL file paths for Smart-FS tools MUST be ABSOLUTE (starting with `/`)!**

```javascript
// ✅ CORRECT - Absolute paths
read_code_smart({ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/source/main.js" })
search_code_smart({ file_path: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/source/main.js", query: "..." })
find_jsvmp_dispatcher({ filePath: "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/source/main.js" })

// ❌ WRONG - Relative paths WILL FAIL
read_code_smart({ file_path: "source/main.js" })  // ❌
search_code_smart({ file_path: "artifacts/jsvmp/example.com/source/main.js" })  // ❌
```

**Get workspace path from invokeSubAgent prompt, then construct absolute paths:**
```javascript
// From prompt: "Workspace: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/"
const WORKSPACE = "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com";
const SOURCE_FILE = `${WORKSPACE}/source/main.js`;
```

## 🎯 Task Execution Rules

1. **READ NOTE.md FIRST**: Use `readFile` to load previous findings before starting work
2. **SINGLE TASK ONLY**: Complete exactly ONE task, then STOP
3. **UPDATE NOTE.md**: Write discoveries with `[L:line] [Src L:col]` references
4. **NO NEXT STEPS**: Don't proceed to other work after completion

## ⚠️ ANALYZE CODE FIRST, NEVER GUESS! (CRITICAL)

**When extracting bytecode, constants, or opcodes:**

1. **READ the actual code** using `read_code_smart` to understand structure
2. **TRACE variables** using `find_usage_smart` to find definitions
3. **DOCUMENT findings** with exact variable names and line numbers
4. **THEN extract** based on actual code, not assumptions

**FORBIDDEN:**
- ❌ Assuming variable names like `_0xabc123` without reading code
- ❌ Guessing bytecode format without evidence from code
- ❌ Writing extraction scripts based on "common patterns"
- ❌ Assuming opcode meanings without reading handler code

**Example - WRONG vs RIGHT:**
```javascript
// ❌ WRONG: Guessing variable name
search_code_smart({ query: "_0x[a-f0-9]+" })  // Too generic!

// ✅ RIGHT: First read dispatcher, find actual variable names
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 100, end_line: 150 })
// Output shows: var bytecode = params.b;
// Now you know the actual variable name!
find_usage_smart({ file_path: "/abs/path/source/main.js", identifier: "params", line: 100 })
```

## 📖 Session Start (MANDATORY)

```javascript
// FIRST: Read NOTE.md for context (relative path OK for readFile)
readFile({ path: "artifacts/jsvmp/{domain}/NOTE.md" })

// For Smart-FS tools, use ABSOLUTE paths:
const WORKSPACE = "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/{domain}";
read_code_smart({ file_path: `${WORKSPACE}/source/main.js`, start_line: 1, end_line: 50 })
```

## 🚫 Large Data Handling

**NEVER write or output large constant arrays or strings directly!**

```javascript
// ❌ FORBIDDEN
const constants = ["str1", "str2", ... /* 1000+ items */];

// ✅ CORRECT: Save to file
evaluate_script(script="JSON.stringify(data)", savePath="raw/data.json")
```

## ⚠️ Constants Type Rules (CRITICAL)

**When generating LIR from constants.json, type must match JSON.parse result exactly!**

```javascript
// constants.json 内容:
["function", "0", "1.0.1.19-fix.01", 123, true, null]

// ✅ 正确的 LIR 输出:
@const K[0] = String("function")       // typeof === "string"
@const K[1] = String("0")              // typeof === "string" (不是 Number!)
@const K[2] = String("1.0.1.19-fix.01") // typeof === "string" (版本号是字符串!)
@const K[3] = Number(123)              // typeof === "number"
@const K[4] = Boolean(true)            // typeof === "boolean"
@const K[5] = Null                     // value === null

// ❌ 错误: 尝试将字符串解析为数字
@const K[1] = Number(0)                // 错! JSON 中是 "0" 字符串
@const K[2] = Number(1.0.1.19-fix.01)  // 错! 这是版本号字符串
```

**类型判断代码**:
```javascript
function getConstantType(value) {
  if (value === null) return 'Null';
  // 直接使用 typeof，禁止做任何额外的类型推断!
  switch (typeof value) {
    case 'string':  return 'String';
    case 'number':  return 'Number';
    case 'boolean': return 'Boolean';
    case 'object':  return 'Object';
    default:        return 'Unknown';
  }
}
```

## ⚠️ Global Address Rules (CRITICAL)

**LIR 中必须使用全局地址，每条指令的地址必须唯一！**

```javascript
// 计算全局地址
let globalOffset = 0;
for (const func of bytecodeData) {
  func.globalStart = globalOffset;
  for (let i = 0; i < func.bytecode.length; ) {
    const addr = globalOffset + i;  // 全局地址
    // ... 反汇编指令
    i += instructionLength;
  }
  globalOffset += func.bytecode.length;
}
```

**示例**:
```vmasm
;; Function 0: Bytecode [0x0000, 0x0147]
0x0000: CREATE_FUNC 1
0x0147: RETURN

;; Function 1: Bytecode [0x0148, 0x016D]  ← 紧接函数0之后!
0x0148: PUSH_UNDEF                        ← 不是 0x0000!
0x016D: RETURN
```

## 📚 Skill Files Reference

**Read relevant files BEFORE starting work:**

| Task Type | Required Reading |
|-----------|------------------|
| Phase workflow | `skills/jsvmp-phase-guide.md` |
| IR generation | `skills/jsvmp-ir-format.md` |
| Source Map | `skills/jsvmp-ir-sourcemap.md` |
| Decompiler | `skills/jsvmp-decompiler.md` |

## 🗺️ Source Map Requirements (IR Tasks)

When generating IR/ASM output:

1. **Output files**: `output/{name}_disasm.asm` + `output/{name}_disasm.asm.map`
2. **IR format**: Clean `//` comments, function header has `Source: L{line}:{column}`
3. **Source Map**: One mapping entry per instruction

### ⚠️ CRITICAL: Original Source Coordinates

**`find_jsvmp_dispatcher` returns BEAUTIFIED line numbers. Use `read_code_smart` to get ORIGINAL coordinates!**

```javascript
// Step 1: find_jsvmp_dispatcher → beautified line (e.g., L:150)
// ABSOLUTE PATH REQUIRED!
find_jsvmp_dispatcher({ filePath: "/abs/path/to/workspace/source/main.js" })

// Step 2: read_code_smart → get [Src Lx:xxx] markers
// ABSOLUTE PATH REQUIRED!
read_code_smart({ file_path: "/abs/path/to/workspace/source/main.js", start_line: 148, end_line: 155 })

// Step 3: Extract ORIGINAL coordinates for Source Map
// Example output from read_code_smart:
// [L:150] [Src L1:28456]    for (;;) {
//         ^^^^^^^^^^^^
//         └── Use this for Source Map: line=1, column=28456
```

### Breakpoint Conditions

**MUST use actual variable names from `find_jsvmp_dispatcher`:**

```javascript
// ABSOLUTE PATH REQUIRED!
const info = find_jsvmp_dispatcher({ filePath: "/abs/path/to/workspace/source/main.js" });
// Use: info.instructionPointer, info.bytecodeArray, etc.
// Build: `${ip} === ${pc} && ${bytecode}[${ip}] === ${opcode}`
```

### Watch Expressions

Generate for each instruction:
- Standard: `$pc`, `$opcode`, `$stack[0..2]`, `$sp`
- Opcode-specific: `$scope[depth]`, `$fn`, `$this`, `$args`, `$const[x]`

## 📝 NOTE.md Output Format

```markdown
## Session Log
### [YYYY-MM-DD HH:MM] Summary
**Task**: {task description}
**Findings**: ...
**New TODOs**: 🆕 {description} @ [L:line] [Src L:col]

## Pending Discoveries
- [ ] 🆕 {description} @ [L:line] [Src L:col] (from: {task})
```

## ✅ Completion Checklist

- [ ] Read NOTE.md first (with `readFile`)?
- [ ] Read required skill files?
- [ ] **Used ABSOLUTE paths for all Smart-FS tools?**
- [ ] **Analyzed actual code before writing extraction scripts?**
- [ ] **Used real variable names from code, not guessed ones?**
- [ ] Used Smart-FS tools for code (not read_file/cat/grep)?
- [ ] Large data saved to file (not embedded)?
- [ ] All findings include `[L:line] [Src L:col]`?
- [ ] New discoveries in "Pending Discoveries"?
- [ ] Updated NOTE.md with findings?
- [ ] Stopped after single task?
