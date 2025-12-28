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
