# JSVMP Sub-Agent Task Guide

> **Prerequisites**: Read `sub_agent.md` first for common rules.

## ⚠️ ABSOLUTE PATH RULE (CRITICAL)

```javascript
// From prompt: "Workspace: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/"
const WORKSPACE = "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com";

// ✅ CORRECT
read_code_smart({ file_path: `${WORKSPACE}/source/main.js` })
find_jsvmp_dispatcher({ filePath: `${WORKSPACE}/source/main.js` })

// ❌ WRONG
read_code_smart({ file_path: "source/main.js" })
```

---

## 🎯 Task Execution Rules

1. **READ NOTE.md FIRST**: Load previous findings before starting
2. **SINGLE TASK ONLY**: Complete ONE task, then STOP
3. **UPDATE NOTE.md**: Write discoveries with `[L:line] [Src L:col]`
4. **NO NEXT STEPS**: Don't proceed to other work

---

## ⚠️ ANALYZE CODE FIRST, NEVER GUESS!

1. READ actual code with `read_code_smart`
2. TRACE variables with `find_usage_smart`
3. DOCUMENT with exact variable names and line numbers
4. THEN extract based on actual code

**FORBIDDEN**: Assuming variable names, guessing bytecode format, writing scripts based on "common patterns"

---

## 📚 Skill Files Reference

| Task Type | Required Reading |
|-----------|------------------|
| IR generation | `skills/jsvmp-ir-format.md` |
| Decompiler | `skills/jsvmp-decompiler.md` |

---

## ⚠️ Constants Type Rules (CRITICAL)

**Type must match JSON.parse result exactly!**

```javascript
// constants.json: ["function", "0", "1.0.1.19", 123, true, null]

// ✅ CORRECT
@const K[0] = String("function")    // typeof === "string"
@const K[1] = String("0")           // typeof === "string" (NOT Number!)
@const K[3] = Number(123)           // typeof === "number"

// ❌ WRONG
@const K[1] = Number(0)             // "0" is a string in JSON!
```

---

## ⚠️ Global Address Rules (CRITICAL)

**LIR must use global addresses — each instruction address must be unique!**

```vmasm
;; Function 0: [0x0000, 0x0147]
0x0000: CREATE_FUNC 1
0x0147: RETURN

;; Function 1: [0x0148, 0x016D] ← continues after Function 0!
0x0148: PUSH_UNDEF           ← NOT 0x0000!
```

---

## 🗺️ Source Map Requirements

**`find_jsvmp_dispatcher` returns BEAUTIFIED line numbers. Use `read_code_smart` to get ORIGINAL coordinates!**

```javascript
// Step 1: find_jsvmp_dispatcher → beautified line (e.g., L:150)
find_jsvmp_dispatcher({ filePath: "/abs/path/source/main.js" })

// Step 2: read_code_smart → get [Src Lx:xxx] markers
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 148, end_line: 155 })
// Output: [L:150] [Src L1:28456] for (;;) {
//                 ^^^^^^^^^^^^^ Use for Source Map
```

---

## 🎯 Dynamic Debugging with @opcode_transform (CRITICAL)

**NO static scope inference! Use @opcode_transform for runtime inspection.**

### CALL Instruction Debugging

When you need to know what function is being called:
1. Set breakpoint at the CALL instruction
2. Use debug expressions from `@opcode_transform`:

```vmasm
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
```

At breakpoint, evaluate:
- `v[p - 2]` → the actual function being called
- `v.slice(p - 1, p + 1)` → the actual arguments

### Comment Format (Simplified)

```vmasm
;; ✅ CORRECT - Simple, no inference
0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8]
0x0122: LOAD_SCOPE         0 8             ; scope[0][8]
0x0125: CALL               2               ; call(2 args)

;; ❌ WRONG - Don't try to infer call targets statically
0x0125: CALL               2               ; call: func_1(2 args)  ← NO!
```

---

## 📝 NOTE.md Output Format

```markdown
## Session Log
### [YYYY-MM-DD HH:MM] Summary
**Task**: {description}
**Findings**: ...
**New TODOs**: 🆕 {description} @ [L:line] [Src L:col]

## Pending Discoveries
- [ ] 🆕 {description} @ [L:line] [Src L:col] (from: {task})
```

---

## ✅ Completion Checklist

- [ ] Read NOTE.md first?
- [ ] Read required skill files?
- [ ] Used ABSOLUTE paths for Smart-FS?
- [ ] Analyzed actual code before extraction?
- [ ] Used real variable names?
- [ ] All findings include `[L:line] [Src L:col]`?
- [ ] Large data saved to file?
- [ ] Updated NOTE.md?
- [ ] Stopped after single task?
