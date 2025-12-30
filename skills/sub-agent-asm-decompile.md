# Sub-Agent: ASM IR Function Decompiler

> **ROLE**: 分析一批 ASM IR 函数，输出单个 md 文件包含分析和代码。
> **SCOPE**: 处理分配的函数范围，外部调用标记为 TODO。

---

## ⚠️ SUB-AGENT 核心要求

**一个 sub-agent 分析多个函数，输出一个 md 文件，包含所有分析和完整代码。**

Sub-agent 必须：
- 分析分配范围内的所有函数
- 每个函数输出完整代码和分析
- 中文注释标注 ASM 来源：`// [ASM:L{line}] fn{id}: {说明}`
- 所有内容写入单个 `analysis/batch_{n}.md` 文件

**读取规则**：
- 每次读取 100-200 行，最大 500 行
- 标记外部调用：`/* TODO: fn{x} - {猜测用途} */`

---

## INPUT CONTEXT (Provided by Coordinator)

```
- Batch Number: {n}
- Function Range: fn{start_id} to fn{end_id}
- Line Range: L{start}-L{end}
- Workspace: {absolute_path}
- Constants Path: raw/constants.json
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

### Step 7: Write Output File

**所有函数的分析和代码写入单个文件**: `analysis/batch_{n}.md`

```markdown
# Batch {n}: fn{start_id} - fn{end_id}

## 概览
- 函数数量: {count}
- ASM 行范围: L{start}-L{end}

---

## fn{id}: {inferred_name}

### 元信息
- ASM: L{start}-L{end}
- 参数: {n}

### Scope 分析
| 引用 | 解析名 | 说明 |
|------|--------|------|
| scope[0][2] | input | 第一个参数 |
| scope[1][14] | sliceToArray | 父级闭包函数 |

### 代码

```javascript
/**
 * {功能描述}
 * [ASM:L{start}-L{end}] fn{id}
 */
function {name}({params}) {
  // [ASM:L{x}] fn{id}: 初始化
  let result = null;
  
  // [ASM:L{y}] fn{id}: 类型检查
  if (Array.isArray(input)) {
    return /* TODO: fn14 */ (input, length);
  }
  return result;
}
` ` `

---

## fn{next_id}: {next_name}

...（继续下一个函数）
```

---

## OUTPUT REQUIREMENTS

1. 单个 md 文件包含所有函数的分析和代码
2. 每个函数的代码必须完整
3. 中文注释格式：`// [ASM:L{line}] fn{id}: {说明}`
4. 外部调用标记：`/* TODO: fn{id} - {猜测用途} */`
5. 变量名要有意义，基于用途推断命名

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

完成后报告：

```
STATUS: COMPLETED
BATCH: {n}
FUNCTIONS: fn{start_id} - fn{end_id}
OUTPUT: analysis/batch_{n}.md
CALLS: [fn{x}, fn{y}, ...] (跨批次调用)
NOTES: {问题或备注}
```
