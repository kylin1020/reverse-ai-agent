# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## 注释格式规范

| 指令类型 | 注释格式 | 示例 |
|----------|----------|------|
| 作用域指令 | `; scope[depth][index] = val` | `; scope[0][12] = val` |
| K_Reference | `; 语义; "值"` | `; global[K[x]]; "window"` |
| CALL | `; fn(N args)` | `; fn(2 args)` |
| 作用域映射 | `@scope_slot` 指令 | 可选，用于变量名推断 |

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

`@global_bytecode` 指令声明字节码变量的位置和结构信息，用于调试时正确计算 offset：

| 字段 | 必需 | 说明 |
|------|------|------|
| `var` | ✓ | 字节码变量名 |
| `line` | ✓ | 源码行号 |
| `column` | ✓ | 源码列号 |
| `pattern` | ✓ | 字节码数组结构：`2d_array` 或 `1d_slice` |
| `transform` | | 从混合变量提取纯字节码的表达式 |

#### pattern 参数 (CRITICAL)

`pattern` 参数指定字节码数组的结构，**必须正确设置**，否则调试时 offset 计算会出错：

| 值 | 结构 | 示例 | offset 计算 |
|-----|------|------|-------------|
| `2d_array` | 二维数组，每个元素是 `[opcode, ...]` | `[[1,2,3], [4,5], [6]]` | `bytecode[ip][0]` |
| `1d_slice` | 一维数组，直接存储 opcode | `[1, 2, 3, 4, 5, 6]` | `bytecode[ip]` |

```vmasm
;; 示例 1: 二维数组 (常见于抖音等)
;; 原始结构: z = [[opcode, arg1, arg2], [opcode, arg1], ...]
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"

;; 示例 2: 一维数组
;; 原始结构: bytecode = [op1, op2, op3, ...]
@global_bytecode var=bytecode, line=2, column=12345, pattern="1d_slice"

;; 示例 3: 对象属性中的字节码
@global_bytecode var=r, line=2, column=12345, pattern="1d_slice", transform="r.b"
```

#### transform 参数

`transform` 指定如何从原始变量提取纯字节码数组（仅 opcode）：

- 如果变量本身就是纯字节码数组，可省略或设为变量名本身
- 如果是二维数组需要提取第一列：`z.map(x=>x[0])`
- 如果是对象属性：`r.b`

**用途**:
- 静态分析时使用转换后的纯字节码数组进行反汇编
- 动态调试时计算全局 offset

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

#### 作用域指令

作用域指令必须使用具体的 depth 和 index 值：

```vmasm
0x2D31: STORE_SCOPE        0 12            ; scope[0][12] = val
0x2D57: LOAD_SCOPE         0 13            ; scope[0][13]
0x2D4F: LOAD_SCOPE_REF     0 13            ; &scope[0][13]
```

#### K_Reference 指令

K_Reference 指令必须同时显示语义描述和实际值，格式：`; 语义; "值"`

```vmasm
0x00B3: GET_GLOBAL         K[132]          ; global[K[x]]; "window"
0x00B5: GET_PROP_CONST     K[133]          ; obj[K[x]]; "_sdkGlueVersionMap"
0x00BD: PUSH_STR           K[134]          ; push K[x]; "1.0.1.19-fix.01"
0x00BF: DEFINE_PROP        K[135]          ; define prop; "bdmsVersion"
```

| 指令 | 注释格式 | 示例 |
|------|----------|------|
| `GET_GLOBAL` | `; global[K[x]]; "{value}"` | `; global[K[x]]; "window"` |
| `GET_PROP_CONST` | `; obj[K[x]]; "{value}"` | `; obj[K[x]]; "now"` |
| `SET_PROP_CONST` | `; obj[K[x]]; "{value}"` | `; obj[K[x]]; "prototype"` |
| `PUSH_STR` | `; push K[x]; "{value}"` | `; push K[x]; "hello"` |
| `DEFINE_PROP` | `; define prop; "{value}"` | `; define prop; "name"` |
| 其他 K_Reference | `; {semantic}; "{value}"` | `; load func; "config"` |

#### CALL 指令

CALL 指令使用简化格式，只显示参数数量，不猜测函数名：

```vmasm
0x2D4D: CALL               2               ; fn(2 args)
```

**原因**: 静态推断函数名容易出错，函数名可在动态调试时通过 hover/watch 获取。

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

## 完整示例

```vmasm
;; ==========================================
;; JSVMP Disassembly - example.com main.js
;; Generated: 2024-01-15T10:30:00Z
;; Format: LIR
;; ==========================================

@format v1.1
@domain example.com
@source source/main.js
@url https://*.example.com/*/main.js
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s

;; ==========================================
;; INJECTION POINTS
;; ==========================================
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"
@loop_entry line=2, column=131639
@breakpoint line=2, column=131639

;; ==========================================
;; SCOPE SLOTS (可选)
;; ==========================================
@section scope_slots
@scope_slot depth=0, index=0, name="arguments"
@scope_slot depth=0, index=1, name="this"
@scope_slot depth=0, index=8, name="result", first_use="STORE_SCOPE at 0x0010"

;; ==========================================
;; CONSTANTS (Total: 6)
;; ==========================================
@section constants
@const K[0] = String("init")
@const K[1] = String("window")
@const K[2] = String("document")
@const K[3] = Number(0)
@const K[4] = Boolean(true)
@const K[5] = Null

;; ==========================================
;; CODE
;; Function 0: Params=0, Strict=true
;; Bytecode: [0x0000, 0x0028]
;; ==========================================
@section code
@entry 0x00000000

0x0000: CREATE_FUNC        1               ; create closure; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8] = val
0x0005: GET_GLOBAL         K[1]            ; global[K[x]]; "window"
0x0008: GET_PROP_CONST     K[2]            ; obj[K[x]]; "document"
0x000B: LOAD_SCOPE         0 8             ; scope[0][8]
0x000E: CALL               2               ; fn(2 args)
0x0010: RETURN                             ; return val
```

---

## LSP/VSCode Extension 功能

| 功能 | 实现方式 |
|------|----------|
| **Jump to Definition** | 点击 `K[0]` → 跳转到 `@const K[0]` 声明行 |
| **Hover Preview** | 悬停 `K[0]` → 显示 `Type: String, Value: "init"`, 调试表达式: `Z[0]` |
| **Scope Hover** | 悬停 `LOAD_SCOPE 0 8` → 显示变量名 (如有), 调试表达式: `s[0][8]` |
| **Watch Expression** | 使用 `@reg` 中的变量名生成正确的调试表达式 |
| **Breakpoint Mapping** | 通过 `@reg` 和注入点元数据自动设置断点 |

### Hover Provider 详情

**作用域引用悬停** (LOAD_SCOPE, STORE_SCOPE, LOAD_SCOPE_REF):
```
Scope Reference: s[0][8]
  (where s is the scope variable from @reg)
  
Variable Name: result (if @scope_slot mapping exists)
First Use: STORE_SCOPE at 0x0010

Debug Expression: s[0][8]
```

**K_Reference 悬停** (K[n]):
```
Constant K[132]
Type: String
Value: "window"

Debug Expression: Z[132]
  (where Z is the const variable from @reg)
```

---

## 向后兼容性

v1.2 格式完全向后兼容 v1.1:
- 没有 `@scope_slot` 指令的文件正常解析
- 旧格式注释仍可解析 (但新生成的文件使用简化格式)
- `@reg` 中的 `scope` 字段可选

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
