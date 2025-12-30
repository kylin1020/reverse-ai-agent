# Sub-Agent: ASM IR Function Decompiler

> **ROLE**: 分析指定的 ASM IR 函数，输出完整可运行的 JavaScript 代码。
> **SCOPE**: 只处理分配的行范围，外部调用标记为 TODO。

---

## ⚠️ SUB-AGENT 核心要求

**输出完整的代码和分析，方便主 agent 整合。**

Sub-agent 必须：
- 输出完整的函数定义，包含所有逻辑
- 每条 ASM 指令都要体现在代码中，不能省略
- 中文注释标注 ASM 来源：`// [ASM:L{line}] fn{id}: {说明}`
- 分析笔记要详细，包含 scope 解析和控制流

**读取规则**：
- 每次读取 100-200 行，最大 500 行
- 只读取分配的行范围（常量表除外）
- 标记外部调用：`/* TODO: fn{x} - {猜测用途} */`

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

**代码必须完整可用，不是片段。主 agent 会直接合并这些文件，不会补充任何逻辑。**

```javascript
/**
 * {功能描述 - 中文}
 * [ASM:L{start}-L{end}] fn{id}
 * 
 * @param {type} param1 - 参数说明
 * @returns {type} 返回值说明
 */
function {name}({params}) {
  // [ASM:L{x}] fn{id}: 初始化局部变量
  let localVar = null;
  
  // [ASM:L{y}-L{z}] fn{id}: 类型检查
  if (typeof Symbol !== "undefined" && input[Symbol.iterator] != null) {
    // [ASM:L{a}] fn{id}: 使用迭代器转数组
    return Array.from(input);
  }
  
  // [ASM:L{b}] fn{id}: 调用切片函数
  return /* TODO: fn14 - sliceToArray */ (input, length);
}
```

**输出要求**：
- 函数定义完整，包含 function 关键字和花括号
- 所有分支、循环、返回语句都要有
- 每个逻辑块都有 ASM 行号注释
- 变量名要有意义，不要用 v0, v1
- scope 引用要解析为具体变量名并注释来源

---

## OUTPUT REQUIREMENTS

**代码和分析都要完整详细。**

1. 输出的 JS 代码必须是完整函数
2. 每条 ASM 指令都要在代码中体现，绝不省略
3. 中文注释格式：`// [ASM:L{line}] fn{id}: {说明}`
4. 外部调用标记：`/* TODO: fn{id} - {猜测用途} */`
5. 不确定的 scope：`/* scope[{d}][{i}] - 可能是{guess} */`
6. 变量名要有意义，基于用途推断命名

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
