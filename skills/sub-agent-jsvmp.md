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

## 🎯 Scope Slot Tracking (CRITICAL)

**Track `CREATE_FUNC → STORE_SCOPE` mappings for readable output:**

```vmasm
;; ❌ Hard to read
0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8] = val
0x0122: LOAD_SCOPE         0 8             ; scope[0][8]
0x0125: CALL               0               ; fn(0 args)

;; ✅ Clear and readable
0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8] = func_1
0x0122: LOAD_SCOPE         0 8             ; scope[0][8] → func_1
0x0125: CALL               0               ; call: func_1(0 args)
```

**Reserved slots**:
- `scope[0][0]` → `arguments`
- `scope[0][1]` → `this`

---

## 🎯 Call Target Inference (CRITICAL)

**CALL must infer target, not just `fn(N args)`!**

| Pattern | Comment Format |
|---------|----------------|
| `LOAD_SCOPE d i` → `CALL` | `call: func_N(args)` |
| `GET_GLOBAL K[n]` → `CALL` | `call: {globalName}(args)` |
| `GET_PROP_CONST K[n]` → `CALL` | `call: {obj}.{method}(args)` |
| `CREATE_FUNC N` → `CALL` | `call: func_N(args) [IIFE]` |

```vmasm
;; ✅ Enhanced output
0x00B3: GET_GLOBAL         K[132]          ; "window"
0x00B5: GET_PROP_CONST     K[151]          ; .localStorage
0x00B7: GET_PROP_CONST     K[152]          ; .getItem
0x00B9: PUSH_STR           K[153]          ; "xmst"
0x00BB: CALL               1               ; call: window.localStorage.getItem(1 args)
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
