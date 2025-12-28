# JSVMP Sub-Agent Task Guide

> **Prerequisites**: Read `sub_agent.md` first for common rules.

## 🎯 Task Execution Rules

1. **SINGLE TASK ONLY**: Complete exactly ONE task, then STOP
2. **NO TODO.md**: Don't read or modify TODO.md
3. **NO NEXT STEPS**: Don't proceed to other work after completion

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
// Step 2: read_code_smart → get [Src Lx:xxx] markers
// Step 3: Extract ORIGINAL coordinates for Source Map

// Example output from read_code_smart:
// [L:150] [Src L1:28456]    for (;;) {
//         ^^^^^^^^^^^^
//         └── Use this for Source Map: line=1, column=28456
```

### Breakpoint Conditions

**MUST use actual variable names from `find_jsvmp_dispatcher`:**

```javascript
const info = find_jsvmp_dispatcher({ filePath: "main.js" });
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

- [ ] Read required skill files first?
- [ ] Used Smart-FS tools (not read_file/cat/grep)?
- [ ] Large data saved to file (not embedded)?
- [ ] All findings include `[L:line] [Src L:col]`?
- [ ] New discoveries in "Pending Discoveries"?
- [ ] Stopped after single task?
