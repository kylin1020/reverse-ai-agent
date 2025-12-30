# Sub-Agent: ASM IR Function Decompiler

> **ROLE**: Analyze assigned ASM IR function(s) and produce equivalent JavaScript.
> **SCOPE**: Focus ONLY on assigned line range. Mark external calls as TODO.

---

## ⚠️ SUB-AGENT RULES

1. **NEVER read outside assigned line range** (except constants.json)
2. **Read in chunks**: 100-200 lines per read, max 500 for single function
3. **Chinese comments REQUIRED**: `// [ASM:L{line}] fn{id}: {说明}`
4. **NO simplification**: Every instruction must be represented
5. **Mark unknowns**: `/* TODO: fn{x} */` for unanalyzed calls

---

## INPUT CONTEXT (Provided by Coordinator)

```
- Function ID: {id}
- Line Range: L{start}-L{end}
- Workspace: {absolute_path}
- Constants Path: raw/constants.json
- Parent Scope Info: {scope_chain_description}
```

---

## EXECUTION STEPS

### Step 1: Load Constants (if not cached)

Read `raw/constants.json` - this is the K[x] lookup table.

### Step 2: Read ASM Chunk

- Read lines {start} to {end} from ASM file
- If range > 200 lines, read in 150-line chunks with 10-line overlap
- Max single read: 500 lines (only for continuous function body)

### Step 3: Parse Function Header

Extract from `// ========== Function {id}` block:
- Params count
- Strict mode
- Bytecode range
- Source reference

### Step 4: Analyze Instructions

For each instruction, track:

```
| PC | Opcode | Operands | Stack Before | Stack After | Notes |
```

Key analysis points:
- **LOAD_SCOPE d i**: Resolve to concrete name
  - d=0: current function scope (params start at i=2)
  - d=1: parent closure scope
  - d=2+: outer closure scopes
- **CREATE_FUNC id**: Note child function reference
- **CALL n**: Identify callee (from stack state)
- **Control flow**: Map JF/JZ/JNZ/JMP to if/else/while/for

### Step 5: Infer Function Purpose

Based on:
- Constants used (K[x] values)
- Operations performed
- Return value pattern
- Calling context (if known)

Name should be descriptive: `validateArrayInput`, `createIteratorWrapper`, etc.

### Step 6: Resolve Scope Variables

| Scope Ref | Resolved Name | Evidence |
|-----------|---------------|----------|
| scope[0][2] | inputArray | First param, used with .length |
| scope[0][3] | maxLength | Second param, compared with length |
| scope[1][14] | sliceToArray | Called as function, from parent |

### Step 7: Write Analysis Notes

Output to: `analysis/fn_{id}_{name}.md`

```markdown
# Function {id}: {name}

## 元信息
- ASM 行号: L{start}-L{end}
- 参数数量: {n}
- 严格模式: {yes/no}

## 作用域分析
{scope_table}

## 控制流
{control_flow_description}

## 调用的函数
- fn{x}: {用途} (L{line})

## 关键栈状态
{stack_trace_table}

## 分析备注
{any_uncertainties_or_observations}
```

### Step 8: Write Decompiled JS

Output to: `analysis/fn_{id}_{name}.js`

```javascript
/**
 * {功能描述 - 中文}
 * [ASM:L{start}-L{end}] fn{id}
 */
function {name}({params}) {
  // [ASM:L{x}-L{y}] fn{id}: {这段代码的作用}
  {decompiled_code}
}
```

---

## OUTPUT REQUIREMENTS

1. **Comments MUST be Chinese**
2. **Every ASM line must be represented** - no simplification
3. **Source reference format**: `// [ASM:L{line}] fn{id}: {说明}`
4. **Unresolved calls**: `/* TODO: fn{id} - {猜测的用途} */`
5. **Uncertain scope**: `/* scope[{d}][{i}] - 可能是{guess} */`

---

## SCOPE RESOLUTION GUIDE

### Parameter Mapping (scope[0][i])
- i=0: `this` binding
- i=1: `arguments` object
- i=2: first declared param
- i=3: second declared param
- i=2+n: local variables (after params)

### Closure Capture (scope[d][i] where d>0)
- Trace back to parent function's scope
- Look for CREATE_FUNC that creates current function
- Parent's scope[0][i] becomes child's scope[1][i]

---

## CONTROL FLOW PATTERNS

### If-Else
```asm
   10: {condition}
   11: JF 5           // -> 18 (else branch)
   13: {then_block}
   16: JMP 3          // -> 21 (end)
   18: {else_block}
   21: {continue}
```

### While Loop
```asm
   10: {condition}      // loop start
   12: JF 10            // -> 24 (exit)
   14: {body}
   20: JMP -12          // -> 10 (back to condition)
   24: {after_loop}
```

### Ternary
```asm
   10: {condition}
   11: JF 3             // -> 16
   13: {true_value}
   14: JMP 2            // -> 18
   16: {false_value}
   18: {use_result}
```

---

## COMMON PATTERNS

### Array.isArray check
```asm
GET_GLOBAL 16        // Array
GET_PROP_CONST 24    // isArray
LOAD_SCOPE 0 2       // input
CALL 1
```
→ `Array.isArray(input)`

### Property access chain
```asm
LOAD_SCOPE 0 2       // obj
GET_PROP_CONST 133   // K[133]="foo"
GET_PROP_CONST 134   // K[134]="bar"
```
→ `obj.foo.bar`

### Method call
```asm
LOAD_SCOPE 0 2       // obj
DUP
GET_PROP_CONST 10    // K[10]="method"
PUSH_IMM 42          // arg
CALL 1
```
→ `obj.method(42)`

---

## REPORT FORMAT TO COORDINATOR

**MUST report back with this exact format:**

```
STATUS: COMPLETED
FUNCTION_ID: {id}
INFERRED_NAME: {name}
OUTPUT_FILES:
  - analysis/fn_{id}_{name}.md
  - analysis/fn_{id}_{name}.js
CALLS: [fn{x}, fn{y}, ...]
SCOPE_REFS:
  - scope[1][14]: sliceToArray (resolved)
  - scope[2][3]: unknown (unresolved)
NOTES: {any issues or observations}
```

This report enables coordinator to:
- Update checklist
- Build call graph
- Pass scope context to dependent functions
