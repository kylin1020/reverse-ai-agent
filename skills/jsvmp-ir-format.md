# JSVMP IR/ASM Output Format Specification (v1.1)

> Sub-Agent MUST read this file before generating disassembly output.
> **Version**: 1.1 - 自包含格式，内嵌常量池和寄存器映射

## 核心变更 (v1.1)

| 特性 | v1.0 | v1.1 |
|------|------|------|
| 文件后缀 | `.asm` | `.vmasm` |
| 常量池 | 外部 `constants.json` | 内嵌 `@section constants` |
| 寄存器映射 | 硬编码/外部 | `@reg` 头部声明 |
| 地址格式 | 十进制 (`0:`) | 十六进制 (`0x0000:`) |
| 文件结构 | 单一指令段 | Header + Constants + Code |

## Output Files
```
output/
├── {name}_disasm.vmasm      # IR assembly (v1.1 自包含)
└── {name}_disasm.vmasm.map  # Source Map (JSON)
```

---

## 文件结构 (三段式)

```vmasm
;; ==========================================
;; 1. HEADER SECTION (寄存器与元数据)
;; ==========================================
@format v1.1
@domain target-website.com
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=k

;; ==========================================
;; 2. CONSTANTS SECTION (常量池声明)
;; 格式: @const K[索引] = 类型(值)
;; ==========================================
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)
@const K[2] = String("user_agent")
@const K[3] = Boolean(true)
@const K[4] = Null
@const K[5] = Object({"key": "val"})

;; ==========================================
;; 3. CODE SECTION (反汇编指令)
;; ==========================================
@section code
@entry 0x00000000

0x0000: PUSH_CONST K[0]    ; "signature"    [sp:1 | K[0]]
0x0005: GET_GLOBAL         ; window         [sp:2 | K[0], <Global>]
0x000A: LOAD_VAR v[1]      ;                [sp:3 | K[0], <Global>, v[1]]
0x000F: CALL 2             ;                [sp:1 | <result>]
0x0014: RET                ;                [sp:0 |]
```

---

## 1. HEADER SECTION

### @format
```vmasm
@format v1.1
```
声明文件格式版本，用于解析器兼容性检查。

### @domain
```vmasm
@domain target-website.com
```
目标网站域名，用于调试和文档。

### @reg (寄存器映射)
```vmasm
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=k
```

| 角色 | 说明 | 示例变量名 |
|------|------|-----------|
| `ip` | Instruction Pointer | `a`, `pc`, `_0x1234` |
| `sp` | Stack Pointer | `p`, `sp`, `_0x5678` |
| `stack` | Virtual Stack | `v`, `stk`, `_0xabcd` |
| `bc` | Bytecode Array | `o`, `code`, `_0xef01` |
| `storage` | Local Storage | `l`, `mem`, `_0x2345` |
| `const` | Constants Pool | `k`, `K`, `_0x6789` |

---

## 2. CONSTANTS SECTION

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
  
  // 直接使用 typeof，不做任何额外检测
  switch (typeof value) {
    case 'string':  return 'String';   // "0", "1.0.1", "hello" 都是 String
    case 'number':  return 'Number';   // 0, 1.5, NaN 都是 Number
    case 'boolean': return 'Boolean';
    case 'object':  return 'Object';
    default:        return 'Unknown';
  }
}

// ❌ 错误: 尝试将字符串解析为数字
function getConstantType_WRONG(value) {
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) return 'Number';  // ❌ 这会把 "0" 错误识别为 Number!
  }
}
```

**常见错误示例:**
| JSON 值 | 正确类型 | 错误类型 | 原因 |
|---------|----------|----------|------|
| `"0"` | `String("0")` | `Number(0)` | JSON 中是字符串 |
| `"1.0.1.19-fix.01"` | `String("1.0.1.19-fix.01")` | `Number(...)` | 版本号是字符串 |
| `"true"` | `String("true")` | `Boolean(true)` | JSON 中是字符串 |
| `0` | `Number(0)` | - | JSON 中是数字 |
| `true` | `Boolean(true)` | - | JSON 中是布尔值 |

### 约束
1. **索引连续**: K[0], K[1], K[2]... 必须连续
2. **类型显式**: 必须标注类型，便于后续代码还原
3. **类型准确**: 类型必须与 `constants.json` 中 JSON.parse 后的原生类型一致
4. **引用一致**: 指令段中的 `K[n]` 必须与常量池中的索引对应
5. **长字符串**: 超过 50 字符的字符串建议截断显示，完整值在 Source Map 中

---

## 3. CODE SECTION

### 格式
```vmasm
@section code
@entry 0x{entry_address}

;; ==========================================
;; Function {id}
;; Params: {argCount}, Strict: {isStrict}
;; Bytecode: [0x{global_start}, 0x{global_end}]
;; ==========================================

{hex_addr}: {OPCODE} {operands}    ; {comment}    [sp:{depth} | {stack_state}]
```

### ⚠️ 函数地址规则 (CRITICAL)

**必须使用全局地址！每条指令的地址必须是唯一的，类似真实 CPU 的 PC/IP。**

```javascript
// 计算全局地址的方法
let globalOffset = 0;
for (const func of bytecodeData) {
  func.globalStart = globalOffset;
  func.globalEnd = globalOffset + func.bytecode.length - 1;
  globalOffset += func.bytecode.length;
}
```

**示例**:
```vmasm
;; ==========================================
;; Function 0
;; Params: 0, Strict: true
;; Bytecode: [0x0000, 0x0147]    ← 全局地址 0-327
;; ==========================================

0x0000: CREATE_FUNC        1               ; 全局地址 0x0000
0x0002: STORE_SCOPE        0 8             ; 全局地址 0x0002
...
0x0147: RETURN                             ; 全局地址 0x0147

;; ==========================================
;; Function 1
;; Params: 1, Strict: true
;; Bytecode: [0x0148, 0x016D]    ← 全局地址 328-365 (紧接函数0之后!)
;; ==========================================

0x0148: PUSH_UNDEF                         ; 全局地址 0x0148 (不是 0x0000!)
0x0149: GET_GLOBAL         K[12]           ; 全局地址 0x0149
...
```

**地址计算规则**:
| 函数 ID | 本地范围 | 全局范围 | 长度 |
|---------|----------|----------|------|
| 0 | [0, 327] | [0x0000, 0x0147] | 328 |
| 1 | [0, 37] | [0x0148, 0x016D] | 38 |
| 2 | [0, 4] | [0x016E, 0x0172] | 5 |
| ... | ... | ... | ... |

**为什么使用全局地址**:
1. 每条指令有唯一标识，便于调试和断点设置
2. 跨函数引用更清晰（如 `CREATE_FUNC` 引用的函数地址）
3. 与真实 CPU 的 PC/IP 概念一致
4. Source Map 映射更准确

### 指令格式

```
0x{ADDR}: {OPCODE:<18} {operands:<15} ; {semantic:<20} [sp:{n} | {stack}]
```

| 字段 | 格式 | 说明 |
|------|------|------|
| `ADDR` | 4-8 位十六进制 | 字节码物理地址 |
| `OPCODE` | 左对齐 18 字符 | 大写助记符 |
| `operands` | 左对齐 15 字符 | 空格分隔的操作数 |
| `semantic` | 可变长度 | 人类可读的语义描述 |
| `sp:n` | 数字 | 执行后的栈深度 |
| `stack` | 逗号分隔 | 栈顶元素 (从左到右为栈底到栈顶) |

### 操作数类型

| 类型 | 格式 | 示例 |
|------|------|------|
| 常量引用 | `K[n]` | `K[0]`, `K[15]` |
| 变量引用 | `v[n]` | `v[0]`, `v[3]` |
| 立即数 | 十进制 | `2`, `100` |
| 跳转目标 | `0x{addr}` | `0x0050` |

---

## Opcode Categories

| Category | Examples |
|----------|----------|
| Stack | `PUSH_CONST`, `PUSH_BYTE`, `PUSH_TRUE`, `PUSH_FALSE`, `PUSH_NULL`, `PUSH_UNDEFINED`, `POP`, `DUP` |
| Load/Store | `LOAD_CLOSURE`, `LOAD_SCOPE`, `GET_SCOPE`, `SET_SCOPE`, `GET_GLOBAL`, `GET_PROP`, `SET_PROP`, `LOAD_VAR`, `STORE_VAR` |
| Control Flow | `JMP`, `JMPIF`, `JMPIFNOT`, `JMPIF_POP`, `JMPIF_KEEP` |
| Arithmetic | `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `NEG`, `POST_INC`, `POST_DEC` |
| Comparison | `EQ`, `NE`, `EQ_STRICT`, `NE_STRICT`, `LT`, `GT`, `LE`, `GE` |
| Logical | `NOT`, `AND`, `OR` |
| Type | `TYPEOF`, `TYPEOF_GLOBAL`, `INSTANCEOF` |
| Call | `CALL`, `NEW`, `RET`, `THROW` |
| Object | `NEW_OBJ`, `DEF_PROP`, `TO_ARRAY` |

---

## 完整示例

```vmasm
;; ==========================================
;; JSVMP Disassembly - example.com main.js
;; Generated: 2024-01-15T10:30:00Z
;; ==========================================

@format v1.1
@domain example.com
@reg ip=pc, sp=sp, stack=stk, bc=code, storage=mem, const=K

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
;; Source: L1:15847
;; ==========================================
@section code
@entry 0x00000000

0x0000: LOAD_CLOSURE K[0]  ; Create closure      [sp:1 | <closure>]
0x0003: SET_SCOPE 0 K[0]   ; scope[0]["init"]=   [sp:0 |]
0x0008: GET_GLOBAL K[1]    ; window              [sp:1 | <Global>]
0x000D: GET_PROP K[2]      ; .document           [sp:1 | <document>]
0x0012: PUSH_CONST K[3]    ; 0                   [sp:2 | <document>, 0]
0x0017: JMPIFNOT 0x0025    ; if (!top) goto      [sp:1 | <document>]
0x001C: PUSH_CONST K[4]    ; true                [sp:2 | <document>, true]
0x0021: JMP 0x0028         ; goto                [sp:2 | <document>, true]
0x0025: PUSH_CONST K[5]    ; null                [sp:2 | <document>, null]
0x0028: RET                ; return              [sp:0 |]
```

---

## LSP/VSCode 插件增强

v1.1 格式为 IDE 插件提供以下能力：

| 功能 | 实现方式 |
|------|----------|
| **Jump to Definition** | 点击 `K[0]` → 跳转到 `@const K[0]` 声明行 |
| **Hover Preview** | 悬停 `K[0]` → 显示 `Type: String, Value: "init"` |
| **Rename Symbol** | 重命名常量 → 同步更新所有引用 |
| **In-place Editing** | 直接修改 `@const K[0]` 的值，下游自动更新 |
| **Breakpoint Mapping** | 通过 `.vmasm.map` 映射到原始 JS 位置 |

---

## Implementation Notes

1. **地址**: 使用十六进制字节码物理地址，非指令计数
2. **操作数**: 根据 opcode 的操作数类型/数量解析
3. **常量**: 内嵌在文件头部，不再依赖外部 JSON
4. **跳转**: 目标地址 = 当前地址 + 偏移 + 指令长度
5. **Source Map**: 生成 `.vmap` 用于断点映射
6. **解析器**: 使用 Chevrotain，参见 `#[[file:skills/jsvmp-ir-parser.md]]`

---

## 文件后缀规范

| 层级 | 后缀 | 名称 | 说明 |
|------|------|------|------|
| LIR | `.vmasm` | VM Assembly | 低级表示：1:1 还原字节码，保留显式栈操作与物理地址 |
| MIR | `.vmir` | VM Mid-level IR | 中级表示：栈消除（转化为临时变量），划分基本块 (Basic Blocks) |
| HIR | `.vmhir` | VM High-level IR | 高级表示：控制流恢复 (If/While)，接近伪代码 |
| MAP | `.vmap` | VM Source Map | 映射文件：关联 IR 地址与原始 JS 混淆文件的 `[行:列]` |

通过这种结构，`.vmasm` 文件成为一个**独立、可审计、可手动微调**的逆向工程中间产物，不再依赖碎片化的外部 JSON 文件。