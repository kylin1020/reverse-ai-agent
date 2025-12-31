# JSVMP IR Source Map Specification

> Maps IR instructions to original JS locations for browser breakpoint generation.

## ⚠️ CRITICAL: Use Compact Format (v2)

**Source Map 是连接静态分析（IR）与动态调试（浏览器运行时）的唯一桥梁。** 但必须使用紧凑格式以减少 90%+ 的体积。

---

## 1. File Structure

```
output/
├── {name}.vmasm      # IR assembly (contains @reg header)
└── {name}.vmap       # Compact Source Map (JSON)
```

---

## 2. Compact Source Map Format v2 (REQUIRED)

**⚠️ 必须使用此扁平化数组结构，禁止使用冗余的 v1 格式。**

```json
{
  "version": 2,
  "file": "main.vmasm",
  "sourceFile": "main.js",
  "sourceUrl": "http://example.com/js/main.js",
  "entry": [1, 28456],
  "dispatcher": [1, 28500],
  "mappings": [
    [10, 0, 1, 28456, 1],
    [11, 5, 1, 28460, 2],
    [12, 10, 1, 28465, 10]
  ]
}
```

### 2.1 Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Always `2` |
| `file` | string | Corresponding `.vmasm` filename |
| `sourceFile` | string | Original JS filename |
| `sourceUrl` | string | Full URL for browser debugging |
| `entry` | `[line, col]` | VM entry point in original JS |
| `dispatcher` | `[line, col]` | Dispatcher loop location |
| `mappings` | array | Instruction mappings (see below) |

### 2.2 Mappings Array Format

Each mapping is a 5-element array:

```
[irLine, addr, srcLine, srcCol, opcode]
  │       │      │        │       │
  │       │      │        │       └── Opcode value (for validation)
  │       │      │        └── Original JS column
  │       │      └── Original JS line
  │       └── Bytecode address (IP value)
  └── IR assembly line number (1-based)
```

**Example:**
```json
[10, 0, 1, 28456, 1]
// IR line 10, addr=0, original JS L1:28456, opcode=1
```

---

## 3. Why v2 Works

### 3.1 Dynamic Breakpoint Condition Generation

旧格式在每行存储 `"condition": "pc === 0"`。

**v2 做法：** 调试工具读取 `.vmasm` 头部的 `@reg ip=a`，结合 `mappings[1]`（addr），动态生成：

```javascript
// .vmasm header: @reg ip=a, bc=o
// mapping: [10, 0, 1, 28456, 1]
const condition = `a === 0 && o[a] === 1`;  // 自动生成
```

### 3.2 Dynamic Watch Expression Generation

旧格式在每行重复存储 `$stack[sp]`。

**v2 做法：** 调试工具读取 `.vmasm` 头部的 `@reg stack=v, sp=p`，统一应用监控模板：

```javascript
// 自动生成的 watch expressions
const watches = [`v[p]`, `v[p-1]`, `a`, `p`];
```

### 3.3 Semantic Info Already in .vmasm

`.vmasm` 文件本身包含指令名和注释，无需在 Map 中重复存储。

---

## 4. Generation Logic

### 4.1 Extracting Original Coordinates

**必须从 `read_code_smart` 输出的 `[Src Lx:xxx]` 提取原始坐标：**

```javascript
function createMapping(irLine, addr, opcode, readCodeSmartOutput) {
  // 从 [Src L1:28456] 提取坐标
  const match = readCodeSmartOutput.match(/\[Src L(\d+):(\d+)\]/);
  const srcLine = parseInt(match[1]);
  const srcCol = parseInt(match[2]);
  
  return [irLine, addr, srcLine, srcCol, opcode];
}
```

### 4.2 Complete Generation Example

```javascript
function generateVmap(vmInfo, instructions) {
  return {
    version: 2,
    file: `${vmInfo.name}.vmasm`,
    sourceFile: vmInfo.sourceFile,
    sourceUrl: vmInfo.sourceUrl,
    entry: [vmInfo.entry.line, vmInfo.entry.col],
    dispatcher: [vmInfo.dispatcher.line, vmInfo.dispatcher.col],
    mappings: instructions.map(inst => [
      inst.irLine,
      inst.addr,
      inst.srcLine,
      inst.srcCol,
      inst.opcode
    ])
  };
}
```

---

## 5. Debugger Usage

当在 `.vmasm` 第 10 行设置断点时，调试插件执行：

```javascript
// 1. 查表：找到 irLine === 10 的映射
const [irLine, addr, srcL, srcC, op] = vmap.mappings.find(m => m[0] === 10);

// 2. 读取 .vmasm 头部声明
// @reg ip=a, bc=o, stack=v, sp=p
const regs = parseVmasmHeader(vmasmContent);

// 3. 构造断点
const breakpoint = {
  url: vmap.sourceUrl,
  lineNumber: srcL - 1,  // CDP uses 0-based
  columnNumber: srcC,
  condition: `${regs.ip} === ${addr} && ${regs.bc}[${regs.ip}] === ${op}`
};

// 4. 构造 watch expressions
const watches = [
  `${regs.ip}`,           // IP
  `${regs.sp}`,           // SP
  `${regs.stack}[${regs.sp}]`,     // TOS
  `${regs.stack}[${regs.sp}-1]`    // TOS-1
];
```

---

## 6. Validation Constraints

生成 `.vmap` 时必须满足：

1. **Filename**: 必须是 `{name}.vmap`
2. **Format**: 使用 `mappings` 数组 `[irLine, addr, srcL, srcC, op]`
3. **Source Coordinates**: 必须从 `read_code_smart` 的 `[Src Lx:xxx]` 提取，禁止使用美化后的行号
4. **Self-Reference**: `.vmap` 不存储寄存器名，依赖 `.vmasm` 的 `@reg` 头部
5. **Size**: `.vmap` 体积应 < `.vmasm` 的 50%

---

## 7. Checklist

- [ ] 使用 v2 格式（扁平化数组）
- [ ] `mappings` 每项为 5 元素数组
- [ ] 坐标从 `[Src Lx:xxx]` 提取（原始坐标）
- [ ] 不存储 `condition`、`watchExpressions`、`semantic`
- [ ] 对应的 `.vmasm` 包含 `@reg` 头部声明
- [ ] 文件后缀为 `.vmap`

---

## Appendix A: Legacy v1 Format (Deprecated)

<details>
<summary>点击展开 v1 格式（仅供参考，禁止使用）</summary>

v1 格式过于臃肿，每条指令重复存储大量字符串：

```json
{
  "version": 1,
  "mappings": [
    {
      "irLine": 1,
      "irAddr": 0,
      "opcode": 1,
      "opcodeName": "PUSH_CONST",
      "source": { "line": 5, "column": 12 },
      "breakpoint": {
        "condition": "pc === 0",
        "logMessage": "Pushing constant to stack",
        "watchExpressions": [
          { "name": "$pc", "expr": "pc" },
          { "name": "$sp", "expr": "sp" }
        ]
      },
      "semantic": "Push constant 42 onto stack"
    }
  ]
}
```

**问题：**
- 每行重复存储相同的 `watchExpressions`
- `condition` 字符串可动态生成
- `semantic` 已在 `.vmasm` 中存在
- 体积是 v2 的 20 倍以上

</details>
