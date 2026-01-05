# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## 注释格式规范 (Enhanced v1.3)

### 核心原则

**注释必须提供语义信息，但遵循保守推断原则！**

**⚠️ CONSERVATIVE INFERENCE (保守推断)**:
- **只在确定时推断**: 不跨多条指令追踪，不猜测未知内容
- **明确标记不确定**: 使用 `<unknown>`, `?`, `val` 等标记
- **简单追踪**: 只追踪 CREATE_FUNC → STORE_SCOPE 的直接映射
- **属性链**: 只在基础确定时构建，遇到不确定值立即标记 `?`

| 指令类型 | 注释格式 | 推断条件 |
|----------|----------|----------|
| CREATE_FUNC | `; func_N` | 总是显示 |
| STORE_SCOPE (after CREATE_FUNC) | `; scope[d][i] = func_N` | 仅当紧跟 CREATE_FUNC |
| STORE_SCOPE (other) | `; scope[d][i] = val` | 不推断内容 |
| LOAD_SCOPE (known) | `; scope[d][i] → func_N` | 仅当已追踪到内容 |
| LOAD_SCOPE (unknown) | `; scope[d][i]` | 不猜测内容 |
| CALL (certain target) | `; call: func_N(args)` | 仅当目标确定 |
| CALL (uncertain) | `; call: <unknown>(args)` | 无法确定时 |
| GET_PROP_CONST (certain base) | `; .propName` | 基础值确定 |
| GET_PROP_CONST (uncertain base) | `; .propName` | 基础值不确定也显示属性 |

### Scope 槽位注释 (保守推断)

**必须追踪 scope 槽位存储的内容，但只在确定时推断：**

| 模式 | 注释格式 | 推断条件 |
|------|----------|----------|
| `CREATE_FUNC N` → `STORE_SCOPE d i` | `; scope[d][i] = func_N` | ✅ 确定：紧跟关系 |
| `LOAD_SCOPE d i` (已知内容) | `; scope[d][i] → func_N` | ✅ 确定：已追踪映射 |
| `LOAD_SCOPE d i` (未知内容) | `; scope[d][i]` | ❌ 不推断 |
| `LOAD_SCOPE 0 0` | `; scope[0][0] → arguments` | ✅ 确定：约定槽位 |
| `LOAD_SCOPE 0 1` | `; scope[0][1] → this` | ✅ 确定：约定槽位 |
| `STORE_SCOPE d i` (非 CREATE_FUNC 后) | `; scope[d][i] = val` | ❌ 不推断 |

**追踪规则**:
- 只追踪 CREATE_FUNC 紧跟 STORE_SCOPE 的直接映射
- 不跨多条指令追踪符号栈
- 不从符号栈推断 STORE_SCOPE 的内容

### CALL 指令注释 (保守推断)

**必须推测调用目标，但只在确定时：**

| 前置模式 | 注释格式 | 推断条件 |
|----------|----------|----------|
| `CREATE_FUNC N` → `CALL` | `; call: func_N(args)` | ✅ 确定：func 类型 |
| `LOAD_SCOPE d i` (已知) → `CALL` | `; call: func_N(args)` | ✅ 确定：已知槽位 |
| `GET_GLOBAL` → `CALL` | `; call: {globalName}(args)` | ✅ 确定：全局变量 |
| `GET_GLOBAL` → `GET_PROP_CONST` → `CALL` | `; call: {obj}.{method}(args)` | ✅ 确定：简单属性链 |
| `LOAD_SCOPE d i` (未知) → `CALL` | `; call: fn(args)` | ❌ 不确定 |
| 复杂符号栈 → `CALL` | `; call: fn(args)` | ❌ 不确定 |

**推断规则**:
- 只从符号栈顶部推断（fn 位置 = stack.length - argCount - 1）
- 只接受确定类型：`func`, `scope` (已知内容), `global`, `prop` (无 `?`)
- 遇到 `<expr>`, `?`, 未知槽位时使用通用 `fn`

### K_Reference 指令注释 (简化)

**属性链使用点号前缀，更易阅读：**

| 指令 | 注释格式 | 示例 |
|------|----------|------|
| `GET_GLOBAL` | `; "{value}"` | `; "window"` |
| `GET_PROP_CONST` | `; .{value}` | `; .localStorage` |
| `SET_PROP_CONST` | `; .{value} =` | `; .prototype =` |
| `PUSH_STR` | `; "{value}"` | `; "xmst"` |
| `DEFINE_PROP` | `; .{value}:` | `; .bdmsVersion:` |

### 完整示例 (v1.3 保守推断)

```vmasm
;; 确定的闭包创建与存储
0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8] = func_1

;; 确定的属性链调用
0x00B3: GET_GLOBAL         K[132]          ; "window"
0x00B5: GET_PROP_CONST     K[133]          ; ._sdkGlueVersionMap
0x00B7: CALL               0               ; call: window._sdkGlueVersionMap(0 args)

;; 确定的闭包调用
0x0122: LOAD_SCOPE         0 8             ; scope[0][8] → func_1
0x0125: CALL               0               ; call: func_1(0 args)

;; 不确定的调用
0x0165: LOAD_SCOPE         1 8             ; scope[1][8]
0x0168: LOAD_SCOPE         0 2             ; scope[0][2]
0x016B: CALL               1               ; call: fn(1 args)

;; 不确定的存储
0x00B0: STORE_SCOPE        0 2             ; scope[0][2] = val
```

## Output Files
```
output/
└── {name}_disasm.vmasm      # IR assembly (v1.2 自包含)
```

---

## 文件结构 (六段式)

```vmasm
;; ==========================================
;; 1. HEADER SECTION (寄存器与元数据)
;; ==========================================
@format v1.2
@domain target-website.com
@source main.js
@url https://*.target-website.com/*/main.js
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s

;; ==========================================
;; 2. OPCODE TRANSFORM SECTION (调试变量映射)
;; ==========================================
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
@opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b
@opcode_transform 77 NOT: operand = stack[sp]; result = !operand

;; ==========================================
;; 3. INJECTION POINTS (断点注入元数据)
;; ==========================================
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"
@loop_entry line=2, column=131639
@breakpoint line=2, column=131639

;; ==========================================
;; 4. SCOPE SLOTS SECTION (可选，用于变量名推断)
;; ==========================================
@section scope_slots
@scope_slot depth=0, index=0, name="arguments"
@scope_slot depth=0, index=1, name="this"
@scope_slot depth=0, index=2, name="?", first_use="STORE_SCOPE at 0x0010"

;; ==========================================
;; 5. CONSTANTS SECTION (常量池声明)
;; ==========================================
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)

;; ==========================================
;; 6. CODE SECTION (反汇编指令)
;; ==========================================
@section code
@entry 0x00000000

0x0000: STORE_SCOPE        0 12            ; scope[0][12] = val
0x0003: GET_GLOBAL         K[132]          ; window
0x0005: GET_PROP_CONST     K[277]          ; .onwheelx
0x0008: CALL               2               ; fn(2 args)
```

---

## 1. HEADER SECTION

### @format
```vmasm
@format v1.2
```
声明文件格式版本，用于解析器兼容性检查。

### @domain
```vmasm
@domain target-website.com
```
目标网站域名，用于调试和文档。

### @source / @url
```vmasm
@source source/main.js
@url https://*.target-website.com/*/main.js
```
源文件路径和 URL 模式，用于断点设置。

### @reg (寄存器映射)
```vmasm
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s
```

| 角色 | 说明 | 示例变量名 | 调试用途 |
|------|------|-----------|----------|
| `ip` | Instruction Pointer | `a`, `pc` | 当前指令地址 |
| `sp` | Stack Pointer | `p`, `sp` | 栈顶索引 |
| `stack` | Virtual Stack | `v`, `stk` | 操作数栈 |
| `bc` | Bytecode Array | `o`, `code` | 字节码数组 |
| `storage` | Local Storage | `l`, `mem` | 局部存储 |
| `const` | Constants Pool | `Z`, `K` | 常量池数组 |
| `scope` | Scope Chain | `s`, `scope` | 作用域链 |

**调试表达式生成**:
- 作用域访问: `s[0][12]` (使用 `scope=s`)
- 常量访问: `Z[132]` (使用 `const=Z`)
- 栈顶: `v[p-1]` (使用 `stack=v`, `sp=p`)

---

## 2. OPCODE TRANSFORM SECTION (调试变量映射)

### 概述

`@opcode_transform` 指令定义每个 opcode 的语义映射，使得在调试时能够动态求出变量值（如 fn/args/a/b 等）。这些表达式是**只读的**，不会修改 VM 状态。

### 格式规范

```
@opcode_transform {opcode} {NAME}: {statement1}; {statement2}; ...
```

| 字段 | 说明 | 示例 |
|------|------|------|
| `{opcode}` | opcode 编号 (0-255) | `0`, `68` |
| `{NAME}` | opcode 名称 (大写+下划线) | `CALL`, `ADD`, `LOAD_SCOPE` |
| `{statement}` | 变量定义语句 | `fn = stack[sp - argCount]` |

### 栈表达式转换规则 (CRITICAL)

**Transform 中的表达式必须是只读的，不能修改 VM 状态！**

将栈指针修改操作转换为不影响 VM 状态的表达式形式：

| 原始形式 (修改状态) | 转换后形式 (只读) | 说明 |
|---------------------|-------------------|------|
| `sp--` | `stack[sp - 1]` | 读取栈顶下一个元素 |
| `sp++` | `stack[sp + 1]` | 读取栈顶上一个位置 |
| `sp = sp - N` | `stack[sp - N]` | 读取偏移 N 的位置 |
| `stack[sp--]` | `stack[sp]` | 先读取当前栈顶 |
| `stack[++sp] = x` | `stack[sp + 1]` | 读取下一个位置 |
| `stack[sp] = x` | ❌ 禁止 | 不能有赋值操作 |

### 通用 Opcode 类别模板

#### CALL 类 (函数调用)
```vmasm
@opcode_transform N CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
```

**必需变量**: `argCount`, `fn`, `this_val`, `args`

#### NEW 类 (构造函数)
```vmasm
@opcode_transform N NEW: argCount = bc[ip]; ctor = stack[sp - argCount]; args = stack.slice(sp - argCount + 1, sp + 1)
```

**必需变量**: `argCount`, `ctor`, `args`

#### BINARY_OP 类 (二元运算: ADD, SUB, MUL, DIV, MOD, AND, OR, XOR, SHL, SHR, USHR)
```vmasm
@opcode_transform N ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b
@opcode_transform N SUB: a = stack[sp - 1]; b = stack[sp]; result = a - b
@opcode_transform N MUL: a = stack[sp - 1]; b = stack[sp]; result = a * b
@opcode_transform N DIV: a = stack[sp - 1]; b = stack[sp]; result = a / b
@opcode_transform N MOD: a = stack[sp - 1]; b = stack[sp]; result = a % b
```

**必需变量**: `a`, `b`, `result`

#### COMPARISON 类 (比较运算: EQ, NE, LT, GT, LE, GE, EQ_STRICT, NE_STRICT)
```vmasm
@opcode_transform N EQ: a = stack[sp - 1]; b = stack[sp]; result = a == b
@opcode_transform N LT: a = stack[sp - 1]; b = stack[sp]; result = a < b
@opcode_transform N EQ_STRICT: a = stack[sp - 1]; b = stack[sp]; result = a === b
```

**必需变量**: `a`, `b`, `result`

#### UNARY_OP 类 (一元运算: NOT, NEG, TYPEOF, BITWISE_NOT)
```vmasm
@opcode_transform N NOT: operand = stack[sp]; result = !operand
@opcode_transform N NEG: operand = stack[sp]; result = -operand
@opcode_transform N TYPEOF: operand = stack[sp]; result = typeof operand
@opcode_transform N BITWISE_NOT: operand = stack[sp]; result = ~operand
```

**必需变量**: `operand`, `result`

#### LOAD 类 (加载变量)
```vmasm
@opcode_transform N LOAD_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = scope[depth][idx]
@opcode_transform N LOAD_CLOSURE: idx = bc[ip]; value = closure[idx]
@opcode_transform N GET_GLOBAL: name = const[bc[ip]]; value = globalThis[name]
@opcode_transform N GET_PROP_CONST: obj = stack[sp]; prop = const[bc[ip]]; value = obj[prop]
```

**必需变量**: 根据具体指令，通常包含 `value`

#### STORE 类 (存储变量)
```vmasm
@opcode_transform N STORE_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = stack[sp]; target = scope[depth][idx]
@opcode_transform N SET_PROP_CONST: obj = stack[sp - 1]; prop = const[bc[ip]]; value = stack[sp]
```

**必需变量**: `value`, `target` 或 `obj`, `prop`

#### JUMP 类 (跳转控制)
```vmasm
@opcode_transform N JMP: offset = bc[ip]; target = ip + offset + 1
@opcode_transform N JF: offset = bc[ip]; condition = stack[sp]; target = ip + offset + 1
@opcode_transform N JT: offset = bc[ip]; condition = stack[sp]; target = ip + offset + 1
```

**必需变量**: `offset`, `target`; 条件跳转还需 `condition`

### 从 VM 调度器代码推导 Transform

分析原始 VM 调度器代码时，按以下步骤推导 transform：

1. **识别 opcode 处理分支**: 找到 switch/case 或 if-else 链中的 opcode 处理代码
2. **提取栈操作**: 识别 `stack[sp]`, `sp--`, `sp++` 等操作
3. **转换为只读表达式**: 将修改操作转换为读取表达式
4. **命名关键变量**: 为操作数和结果命名（如 `a`, `b`, `fn`, `args`）

**示例：从调度器代码推导 ADD transform**

```javascript
// 原始调度器代码
case 68: // ADD
  var b = stack[sp--];
  var a = stack[sp];
  stack[sp] = a + b;
  break;
```

转换为：
```vmasm
@opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b
```

**示例：从调度器代码推导 CALL transform**

```javascript
// 原始调度器代码
case 0: // CALL
  var argCount = bytecode[ip++];
  var args = [];
  for (var i = 0; i < argCount; i++) {
    args.unshift(stack[sp--]);
  }
  var fn = stack[sp--];
  var thisVal = stack[sp--];
  stack[++sp] = fn.apply(thisVal, args);
  break;
```

转换为：
```vmasm
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
```

### 完整示例

```vmasm
;; ==========================================
;; OPCODE TRANSFORM SECTION
;; ==========================================
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
@opcode_transform 59 NEW: argCount = bc[ip]; ctor = stack[sp - argCount]; args = stack.slice(sp - argCount + 1, sp + 1)
@opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b
@opcode_transform 69 SUB: a = stack[sp - 1]; b = stack[sp]; result = a - b
@opcode_transform 70 MUL: a = stack[sp - 1]; b = stack[sp]; result = a * b
@opcode_transform 71 DIV: a = stack[sp - 1]; b = stack[sp]; result = a / b
@opcode_transform 72 MOD: a = stack[sp - 1]; b = stack[sp]; result = a % b
@opcode_transform 73 EQ: a = stack[sp - 1]; b = stack[sp]; result = a == b
@opcode_transform 74 NE: a = stack[sp - 1]; b = stack[sp]; result = a != b
@opcode_transform 75 LT: a = stack[sp - 1]; b = stack[sp]; result = a < b
@opcode_transform 76 GT: a = stack[sp - 1]; b = stack[sp]; result = a > b
@opcode_transform 77 NOT: operand = stack[sp]; result = !operand
@opcode_transform 78 NEG: operand = stack[sp]; result = -operand
@opcode_transform 79 TYPEOF: operand = stack[sp]; result = typeof operand
@opcode_transform 80 JMP: offset = bc[ip]; target = ip + offset + 1
@opcode_transform 81 JF: offset = bc[ip]; condition = stack[sp]; target = ip + offset + 1
@opcode_transform 82 LOAD_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = scope[depth][idx]
@opcode_transform 83 STORE_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = stack[sp]; target = scope[depth][idx]
```

---

## 3. INJECTION POINTS SECTION

注入点元数据用于 VSCode Extension 自动设置断点：

```vmasm
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"
@loop_entry line=2, column=131639
@breakpoint line=2, column=131639
```

| 指令 | 用途 |
|------|------|
| `@dispatcher` | VM 调度器循环位置，用于设置条件断点 |
| `@global_bytecode` | 字节码变量定义位置，包含 pattern 和 transform 信息 |
| `@loop_entry` | 循环体第一行，用于注入 offset 计算代码 |
| `@breakpoint` | 推荐的断点位置 (opcode 读取后) |

### @global_bytecode 详解

`@global_bytecode` 指令声明字节码变量的位置和结构信息：

| 字段 | 必需 | 说明 |
|------|------|------|
| `var` | ✓ | 字节码变量名 |
| `line` | ✓ | 源码行号 |
| `column` | ✓ | 源码列号 |
| `pattern` | ✓ | 字节码数组结构：`2d_array` 或 `1d_slice` |
| `transform` | | 从混合变量提取纯字节码的表达式 |

#### pattern 参数 (CRITICAL)

| 值 | 结构 | offset 计算 |
|-----|------|-------------|
| `2d_array` | 二维数组 `[[opcode, ...], ...]` | `bytecode[ip][0]` |
| `1d_slice` | 一维数组 `[opcode, ...]` | `bytecode[ip]` |

```vmasm
;; 二维数组
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"

;; 一维数组
@global_bytecode var=bytecode, line=2, column=12345, pattern="1d_slice"
```

---

## 4. SCOPE SLOTS SECTION (可选)

用于映射作用域槽位到原始 JS 变量名：

```vmasm
@section scope_slots
@scope_slot depth=0, index=0, name="arguments"
@scope_slot depth=0, index=1, name="this"
@scope_slot depth=0, index=2, name="?", first_use="STORE_SCOPE at 0x0010"
@scope_slot depth=0, index=3, name="result", source_line=2, source_column=12345
```

| 字段 | 必需 | 说明 |
|------|------|------|
| `depth` | ✓ | 作用域链深度 (0=当前函数, 1=父函数) |
| `index` | ✓ | 槽位索引 |
| `name` | ✓ | 变量名 (未知时用 `"?"`) |
| `first_use` | | 首次使用的指令 |
| `source_line` | | 原始 JS 源码行号 |
| `source_column` | | 原始 JS 源码列号 |

**VSCode Extension 支持**:
- 悬停 `LOAD_SCOPE 0 8` 时显示映射的变量名
- 生成正确的调试表达式 (如 `s[0][8]`)

---

## 5. CONSTANTS SECTION

### 格式
```vmasm
@section constants
@const K[索引] = 类型(值)
```

### 支持的类型

| 类型 | 格式 | 示例 |
|------|------|------|
| `String` | `String("...")` | `@const K[0] = String("hello")` |
| `Number` | `Number(n)` | `@const K[1] = Number(1024)` |
| `Boolean` | `Boolean(true\|false)` | `@const K[2] = Boolean(true)` |
| `Null` | `Null` | `@const K[3] = Null` |
| `Object` | `Object({...})` | `@const K[4] = Object({"key":"val"})` |

### ⚠️ 类型判断规则 (CRITICAL)

**常量池类型必须严格按照 JSON 解析后的 JavaScript 原生类型判断，禁止做任何额外的类型推断！**

```javascript
// ✅ 正确: 直接使用 typeof 判断 JSON.parse 后的值
function getConstantType(value) {
  if (value === null) return 'Null';
  if (value === undefined) return 'Undefined';
  
  switch (typeof value) {
    case 'string':  return 'String';
    case 'number':  return 'Number';
    case 'boolean': return 'Boolean';
    case 'object':  return 'Object';
    default:        return 'Unknown';
  }
}
```

---

## 6. CODE SECTION

### 格式
```vmasm
@section code
@entry 0x{entry_address}

0x{ADDR}: {OPCODE:<18} {operands:<15} ; {comment}
```

### 指令注释格式

#### Scope 指令

```vmasm
0x0000: CREATE_FUNC        N               ; func_N
0x0002: STORE_SCOPE        d i             ; scope[d][i] = func_N
0x0010: LOAD_SCOPE         d i             ; scope[d][i] → func_N
0x0020: LOAD_SCOPE         0 0             ; scope[0][0] → arguments
0x0023: LOAD_SCOPE         0 1             ; scope[0][1] → this
```

#### CALL 指令

```vmasm
0x0100: CALL               N               ; call: func_X(N args)
0x0200: CALL               N               ; call: {globalName}(N args)
0x0300: CALL               N               ; call: {obj}.{method}(N args)
0x0400: CALL               0               ; call: func_X(0 args) [IIFE]
0x0500: CALL               N               ; call: <unknown>(N args)
```

#### K_Reference 指令

```vmasm
0x00B3: GET_GLOBAL         K[x]            ; "{globalName}"
0x00B5: GET_PROP_CONST     K[y]            ; .{propName}
0x00B7: SET_PROP_CONST     K[z]            ; .{propName} =
0x00B9: PUSH_STR           K[w]            ; "{stringValue}"
0x00BF: DEFINE_PROP        K[v]            ; .{propName}:
```

#### 跳转指令

```vmasm
0x00B8: JF                 0x{TARGET}      ; if false → 0x{TARGET}
0x00C3: JMP                0x{TARGET}      ; → 0x{TARGET}
```

---

## Opcode Categories

| Category | Examples |
|----------|----------|
| Stack | `PUSH_CONST`, `PUSH_BYTE`, `PUSH_TRUE`, `PUSH_FALSE`, `PUSH_NULL`, `PUSH_UNDEFINED`, `POP`, `DUP` |
| Load/Store | `LOAD_CLOSURE`, `LOAD_SCOPE`, `STORE_SCOPE`, `LOAD_SCOPE_REF`, `GET_GLOBAL`, `GET_PROP`, `SET_PROP`, `GET_PROP_CONST`, `SET_PROP_CONST` |
| Control Flow | `JMP`, `JZ`, `JNZ`, `JT`, `JF`, `JEQ`, `BREAK` |
| Arithmetic | `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `NEG`, `PRE_INC`, `PRE_DEC`, `POST_INC`, `POST_DEC` |
| Comparison | `EQ`, `NE`, `EQ_STRICT`, `NE_STRICT`, `LT`, `GT`, `LE`, `GE` |
| Logical | `NOT`, `AND`, `OR`, `XOR` |
| Bitwise | `SHL`, `SHR`, `USHR`, `BITWISE_NOT` |
| Type | `TYPEOF`, `TYPEOF_GLOBAL`, `INSTANCEOF`, `IN` |
| Call | `CALL`, `NEW`, `RETURN`, `RETURN_CHECK`, `THROW` |
| Object | `PUSH_OBJ`, `GET_PROP`, `SET_PROP`, `DELETE_PROP`, `DEFINE_PROP`, `DEFINE_GETTER`, `DEFINE_SETTER` |
| Function | `CREATE_FUNC`, `LOAD_FUNC` |
| Loop | `INIT_FORIN`, `NEXT_FORIN` |

---

## 完整文件示例

```vmasm
@format v1.3
@domain {domain}
@source {source_path}
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s

;; Opcode Transform Section
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
@opcode_transform 59 NEW: argCount = bc[ip]; ctor = stack[sp - argCount]; args = stack.slice(sp - argCount + 1, sp + 1)
@opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b
@opcode_transform 77 NOT: operand = stack[sp]; result = !operand
@opcode_transform 80 JF: offset = bc[ip]; condition = stack[sp]; target = ip + offset + 1

@dispatcher line=N, column=M
@global_bytecode var=z, line=N, column=M, pattern="2d_array", transform="z.map(x=>x[0])"
@loop_entry line=N, column=M

@section scope_slots
@scope_slot depth=0, index=0, name="arguments"
@scope_slot depth=0, index=1, name="this"
@scope_slot depth=0, index=8, name="func_1"

@section constants
@const K[0] = String("{value}")
@const K[1] = Number({value})

@section code
@entry 0x00000000

;; Function 0: Entry Point
0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8] = func_1
0x0005: GET_GLOBAL         K[0]            ; "{globalName}"
0x0007: GET_PROP_CONST     K[1]            ; .{propName}
0x0009: CALL               0               ; call: {globalName}.{propName}(0 args)
0x000B: RETURN                             ; return
```

---

## LSP/VSCode Extension 功能

| 功能 | 实现方式 |
|------|----------|
| Jump to Definition | 点击 `K[x]` → 跳转到 `@const K[x]` 声明行 |
| Hover Preview | 悬停 `K[x]` → 显示类型、值、调试表达式 |
| Scope Hover | 悬停 `LOAD_SCOPE d i` → 显示变量名和调试表达式 |
| Watch Expression | 使用 `@reg` 中的变量名生成调试表达式 |

---

## 向后兼容性

v1.3 向后兼容 v1.1/v1.2，新增特性：

| 特性 | 描述 |
|------|------|
| Scope 槽位追踪 | 自动记录 `CREATE_FUNC` → `STORE_SCOPE` 映射 |
| CALL 目标推测 | 基于符号栈推测调用目标 |
| 简化属性注释 | 使用 `.propName` 代替冗长格式 |

---

## Implementation Notes

1. **地址**: 使用十六进制字节码物理地址，非指令计数
2. **操作数**: 根据 opcode 的操作数类型/数量解析
3. **常量**: 内嵌在文件头部，不再依赖外部 JSON
4. **跳转**: 目标地址 = 当前地址 + 偏移 + 指令长度
5. **解析器**: 使用 Chevrotain，参见 `skills/jsvmp-ir-parser.md`
6. **调试表达式**: 使用 `@reg` 中的变量名，而非硬编码的 `scope`/`K`

---

## 文件后缀规范

| 层级 | 后缀 | 名称 | 说明 |
|------|------|------|------|
| LIR | `.vmasm` | VM Assembly | 低级表示：1:1 还原字节码，保留显式栈操作与物理地址 |
| MIR | `.vmir` | VM Mid-level IR | 中级表示：栈消除（转化为临时变量），划分基本块 |
| HIR | `.vmhir` | VM High-level IR | 高级表示：控制流恢复 (If/While)，接近伪代码 |
| MAP | `.vmap` | VM Source Map | 映射文件：关联 IR 地址与原始 JS 混淆文件的 `[行:列]` |
