# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## 注释格式规范 (Enhanced v1.3)

### 核心原则

**注释必须提供语义信息，而不仅仅是指令描述！**

| 指令类型 | 注释格式 |
|----------|----------|
| STORE_SCOPE | `scope[d][i] = func_N` (追踪存储内容) |
| LOAD_SCOPE | `scope[d][i] → func_N` (显示加载内容) |
| CALL | `call: {target}(N args)` (推测调用目标) |
| GET_PROP_CONST | `.{propName}` (点号前缀) |

### Scope 槽位注释

**必须追踪 scope 槽位存储的内容：**

| 模式 | 注释格式 |
|------|----------|
| `CREATE_FUNC N` → `STORE_SCOPE d i` | `; scope[d][i] = func_N` |
| `LOAD_SCOPE d i` (已知内容) | `; scope[d][i] → func_N` |
| `LOAD_SCOPE d i` (未知内容) | `; scope[d][i]` |
| `LOAD_SCOPE 0 0` | `; scope[0][0] → arguments` |
| `LOAD_SCOPE 0 1` | `; scope[0][1] → this` |

### CALL 指令注释

**必须推测调用目标：**

| 前置模式 | 注释格式 |
|----------|----------|
| `LOAD_SCOPE d i` → `CALL` | `; call: func_N(args)` 或 `; call: scope[d][i](args)` |
| `GET_GLOBAL` → `CALL` | `; call: {globalName}(args)` |
| `GET_PROP_CONST` → `CALL` | `; call: {obj}.{method}(args)` |
| `CREATE_FUNC` → `CALL` | `; call: func_N(args) [IIFE]` |
| 无法推测 | `; call: <unknown>(args)` |

### K_Reference 指令注释 (简化)

**属性链使用点号前缀，更易阅读：**

| 指令 | 注释格式 | 示例 |
|------|----------|------|
| `GET_GLOBAL` | `; "{value}"` | `; "window"` |
| `GET_PROP_CONST` | `; .{value}` | `; .localStorage` |
| `SET_PROP_CONST` | `; .{value} =` | `; .prototype =` |
| `PUSH_STR` | `; "{value}"` | `; "xmst"` |
| `DEFINE_PROP` | `; .{value}:` | `; .bdmsVersion:` |

### 完整示例

```vmasm
;; 闭包创建与存储
0x0000: CREATE_FUNC        N               ; func_N
0x0002: STORE_SCOPE        d i             ; scope[d][i] = func_N

;; 属性链调用: obj.prop1.prop2(arg)
0x00B3: GET_GLOBAL         K[x]            ; "{globalName}"
0x00B5: GET_PROP_CONST     K[y]            ; .{prop1}
0x00B7: GET_PROP_CONST     K[z]            ; .{prop2}
0x00B9: PUSH_STR           K[w]            ; "{argValue}"
0x00BB: CALL               1               ; call: {globalName}.{prop1}.{prop2}(1 args)

;; 闭包调用
0x0122: LOAD_SCOPE         d i             ; scope[d][i] → func_N
0x0125: CALL               0               ; call: func_N(0 args)
```

## Output Files
```
output/
└── {name}_disasm.vmasm      # IR assembly (v1.2 自包含)
```

---

## 文件结构 (四段式)

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
;; 2. INJECTION POINTS (断点注入元数据)
;; ==========================================
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"
@loop_entry line=2, column=131639
@breakpoint line=2, column=131639

;; ==========================================
;; 3. SCOPE SLOTS SECTION (可选，用于变量名推断)
;; ==========================================
@section scope_slots
@scope_slot depth=0, index=0, name="arguments"
@scope_slot depth=0, index=1, name="this"
@scope_slot depth=0, index=2, name="?", first_use="STORE_SCOPE at 0x0010"

;; ==========================================
;; 4. CONSTANTS SECTION (常量池声明)
;; ==========================================
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)

;; ==========================================
;; 5. CODE SECTION (反汇编指令)
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

## 2. INJECTION POINTS SECTION

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

## 3. SCOPE SLOTS SECTION (可选)

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

## 4. CONSTANTS SECTION

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

## 5. CODE SECTION

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
