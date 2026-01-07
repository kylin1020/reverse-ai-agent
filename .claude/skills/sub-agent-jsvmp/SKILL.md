# JSVMP Sub-Agent Task Guide

**Prerequisites**: Read `sub_agent.md` first for common rules.

## Absolute Path Rule

```javascript
// From prompt: "Workspace: /Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com/"
const WORKSPACE = "/Users/xxx/reverse-ai-agent/artifacts/jsvmp/example.com";

// ✅ CORRECT
read_code_smart({ file_path: `${WORKSPACE}/source/main.js` })
find_jsvmp_dispatcher({ filePath: `${WORKSPACE}/source/main.js` })

// ❌ WRONG
read_code_smart({ file_path: "source/main.js" })
```

## Task Execution Rules

1. **READ NOTE.md FIRST**: Load previous findings before starting
2. **SINGLE TASK ONLY**: Complete ONE task, then STOP
3. **UPDATE NOTE.md**: Write discoveries with `[L:line] [Src L:col]`
4. **NO NEXT STEPS**: Don't proceed to other work

## Analyze Code First, Never Guess

1. READ actual code with `read_code_smart`
2. TRACE variables with `find_usage_smart`
3. DOCUMENT with exact variable names and line numbers
4. THEN extract based on actual code

**FORBIDDEN**: Assuming variable names, guessing bytecode format, writing scripts based on "common patterns"

## Skill Files Reference

| Task Type | Required Reading |
|-----------|------------------|
| IR generation | `skills/jsvmp-ir-format.md` |
| Decompiler | `skills/jsvmp-decompiler.md` |

## Constants Type Rules

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

## Global Address Rules

**LIR must use global addresses — each instruction address must be unique!**

```vmasm
;; Function 0: [0x0000, 0x0147]
0x0000: CREATE_FUNC 1
0x0147: RETURN

;; Function 1: [0x0148, 0x016D] ← continues after Function 0!
0x0148: PUSH_UNDEF           ← NOT 0x0000!
```

## Source Map Requirements

**`find_jsvmp_dispatcher` returns BEAUTIFIED line numbers. Use `read_code_smart` to get ORIGINAL coordinates!**

```javascript
// Step 1: find_jsvmp_dispatcher → beautified line (e.g., L:150)
find_jsvmp_dispatcher({ filePath: "/abs/path/source/main.js" })

// Step 2: read_code_smart → get [Src Lx:xxx] markers
read_code_smart({ file_path: "/abs/path/source/main.js", start_line: 148, end_line: 155 })
// Output: [L:150] [Src L1:28456] for (;;) {
//                 ^^^^^^^^^^^^^ Use for Source Map
```

## Dynamic Debugging with @opcode_transform

**NO static scope inference! Use @opcode_transform for runtime inspection.**

### @opcode_transform Verification (MANDATORY)

**Every @opcode_transform MUST be verified against original JS handler code!**

```javascript
// STEP 1: Search for handler in deobfuscated JS
search_code_smart({
  file_path: "/abs/path/output/main_deob.js",
  query: "32 === t"  // Search for opcode 32 handler
})

// STEP 2: Read handler code, understand stack operations
// Example handler (opcode 32 = LT):
//   if (32 === t) {
//     v[p - 1] = v[p - 1] < v[p];  // compare top two values
//     p--;                          // pop one value
//   }

// STEP 3: Convert to pre/post expressions
// - pre: evaluated BEFORE instruction execution
// - post: evaluated AFTER instruction execution
@opcode_transform 32 LT: "pre:a = v[p - 1]"; "pre:b = v[p]"; "pre:result = a < b"

// STEP 4: Verify correctness
// - a = v[p - 1] ✅ left operand at sp-1
// - b = v[p]     ✅ right operand at sp
// - result = a < b ✅ less-than comparison
```

### CALL Instruction Debugging

When you need to know what function is being called:
1. Set breakpoint at the CALL instruction
2. Use debug expressions from `@opcode_transform`

```vmasm
@opcode_transform 0 CALL: "pre:argCount = o[a]"; "pre:fn = v[p - argCount]"; "pre:this_val = v[p - argCount - 1]"; "pre:args = v.slice(p - argCount + 1, p + 1)"; "post:result = v[p]"
```

At breakpoint, evaluate:
- `v[p - 2]` → the actual function being called
- `v.slice(p - 1, p + 1)` → the actual arguments

### Common Handler Patterns

| Handler Code Pattern | Operation Type | @opcode_transform Template |
|---------------------|----------------|---------------------------|
| `v[p-1] = v[p-1] OP v[p]; p--` | Binary Op | `"pre:a = v[p-1]"; "pre:b = v[p]"; "pre:result = a OP b"` |
| `v[p] = OP v[p]` | Unary Op | `"pre:operand = v[p]"; "pre:result = OP operand"` |
| `v[++p] = VALUE` | Push | `"pre:value = VALUE"` |
| `fn.apply(this, args)` | Call | `"pre:fn = ..."; "pre:args = ..."; "post:result = v[p]"` |

### Comment Format (v1.5 - Stack Effect)

```vmasm
;; ✅ CORRECT - Show stack effect with →
0x0000: CREATE_FUNC        1               ; func_1 → stack[sp]
0x0002: STORE_SCOPE        0 8             ; stack[sp] → scope[0][8]
0x0122: LOAD_SCOPE         0 8             ; scope[0][8] → stack[sp]
0x0125: CALL               2               ; fn(2 args) → stack[sp]

;; ❌ WRONG - Don't try to infer call targets statically
0x0125: CALL               2               ; call: func_1(2 args)  ← NO!
```

## NOTE.md Output Format

```markdown
## Session Log
### [YYYY-MM-DD HH:MM] Summary
**Task**: {description}
**Findings**: ...
**New TODOs**: 🆕 {description} @ [L:line] [Src L:col]

## Pending Discoveries
- [ ] 🆕 {description} @ [L:line] [Src L:col] (from: {task})
```

## Completion Checklist

- [ ] Read NOTE.md first?
- [ ] Read required skill files?
- [ ] Used ABSOLUTE paths for Smart-FS?
- [ ] Analyzed actual code before extraction?
- [ ] Used real variable names?
- [ ] All findings include `[L:line] [Src L:col]`?
- [ ] Large data saved to file?
- [ ] Updated NOTE.md?
- [ ] Stopped after single task?
