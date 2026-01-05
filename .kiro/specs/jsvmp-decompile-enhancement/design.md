# Design Document: JSVMP Decompile Enhancement

## Overview

本设计文档描述如何增强JSVMP反编译功能，通过改进vmasm文件头部的opcode_transform映射，使得在VSCode Extension中调试时能够动态求出变量值。

核心设计目标：
1. 定义增强的@opcode_transform格式，支持调试变量定义
2. 实现transform解析器，提取opcode语义信息
3. 增强Extension的hover功能，显示可复制的调试表达式
4. 更新AI提示词，指导生成符合规范的vmasm文件

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        vmasm File                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ @opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp  ││
│  │   - argCount]; this_val = stack[sp - argCount - 1]; args =  ││
│  │   stack.slice(sp - argCount + 1, sp + 1)                    ││
│  │ @opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; ││
│  │   result = a + b                                             ││
│  │ ...                                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ @section code                                                ││
│  │ 0x0000: CALL 2                                               ││
│  │ 0x0002: ADD                                                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Transform Parser                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ parseOpcodeTransforms(content: string)                       ││
│  │   → Map<number, OpcodeTransform>                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VSCode Extension                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ VmasmHoverProvider│  │ TransformStore   │  │ RegisterMapper │ │
│  │ - provideHover()  │  │ - transforms Map │  │ - substitute() │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. OpcodeTransform 数据结构

```typescript
/**
 * 表示单个opcode的语义转换定义
 */
interface OpcodeTransform {
  /** opcode编号 (0-255) */
  opcode: number;
  
  /** opcode名称 (如 CALL, ADD, LOAD_SCOPE) */
  name: string;
  
  /** 语义语句列表，每个语句定义一个调试变量 */
  statements: string[];
}

/**
 * 解析后的调试变量
 */
interface DebugVariable {
  /** 变量名 (如 fn, args, a, b, result) */
  name: string;
  
  /** 表达式 (如 stack[sp - argCount]) */
  expression: string;
}
```

### 2. TransformParser 组件

```typescript
/**
 * 解析vmasm文件中的@opcode_transform指令
 */
class TransformParser {
  /**
   * 从vmasm内容中提取所有opcode transforms
   * @param content vmasm文件内容
   * @returns opcode到transform的映射
   */
  parseTransforms(content: string): Map<number, OpcodeTransform>;
  
  /**
   * 解析单个transform语句，提取变量定义
   * @param statements transform语句数组
   * @returns 调试变量数组
   */
  parseStatements(statements: string[]): DebugVariable[];
}
```

### 3. RegisterMapper 组件

```typescript
/**
 * 将通用寄存器名替换为实际变量名
 */
class RegisterMapper {
  /**
   * 根据@reg指令替换表达式中的寄存器名
   * @param expression 原始表达式 (如 stack[sp - 1])
   * @param registers 寄存器映射 (如 {stack: 'v', sp: 'p'})
   * @returns 替换后的表达式 (如 v[p - 1])
   */
  substitute(expression: string, registers: RegisterMapping): string;
}
```

### 4. VmasmHoverProvider 增强

```typescript
/**
 * 增强的hover provider，显示opcode transform信息
 */
class EnhancedVmasmHoverProvider {
  /**
   * 提供hover信息
   * @param document 文档
   * @param position 光标位置
   * @returns hover内容，包含transform信息和可复制的调试表达式
   */
  provideHover(document: TextDocument, position: Position): Hover | null;
  
  /**
   * 格式化transform为hover内容
   * @param transform opcode transform
   * @param registers 寄存器映射
   * @returns markdown格式的hover内容
   */
  formatTransformHover(transform: OpcodeTransform, registers: RegisterMapping): string;
}
```

## Data Models

### @opcode_transform 格式规范

```
@opcode_transform {opcode} {NAME}: {statement1}; {statement2}; ...
```

其中：
- `{opcode}`: 数字，opcode编号
- `{NAME}`: 大写字母和下划线，opcode名称
- `{statement}`: 变量定义语句，格式为 `varName = expression`

### Opcode 类别模板

#### CALL 类 (函数调用)
```
@opcode_transform N CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
```

#### NEW 类 (构造函数)
```
@opcode_transform N NEW: argCount = bc[ip]; ctor = stack[sp - argCount]; args = stack.slice(sp - argCount + 1, sp + 1)
```

#### BINARY_OP 类 (二元运算)
```
@opcode_transform N {OP_NAME}: a = stack[sp - 1]; b = stack[sp]; result = a {op} b
```

#### UNARY_OP 类 (一元运算)
```
@opcode_transform N {OP_NAME}: operand = stack[sp]; result = {op} operand
```

#### LOAD 类 (加载)
```
@opcode_transform N LOAD_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = scope; for (let i = 0; i < depth; i++) value = value[0]; value = value[idx]
```

#### STORE 类 (存储)
```
@opcode_transform N STORE_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = stack[sp]; target_scope = scope; for (let i = 0; i < depth; i++) target_scope = target_scope[0]
```

#### JUMP 类 (跳转)
```
@opcode_transform N JF: offset = bc[ip]; condition = stack[sp]; target = ip + offset + 1
```

### 栈表达式转换规则

| 原始形式 | 转换后形式 | 说明 |
|----------|------------|------|
| `sp--` | `stack[sp - 1]` | 读取栈顶下一个元素 |
| `sp++` | `stack[sp + 1]` | 读取栈顶上一个位置 |
| `sp = sp - N` | `stack[sp - N]` | 读取偏移N的位置 |
| `stack[sp--]` | `stack[sp]; /* then sp - 1 */` | 先读取再偏移 |
| `stack[++sp]` | `stack[sp + 1]; /* then sp + 1 */` | 先偏移再读取 |

**关键原则**：Transform中的表达式必须是只读的，不能修改VM状态。

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transform Format Validation

*For any* valid @opcode_transform directive, parsing then formatting should produce an equivalent string that matches the format specification.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: CALL/NEW Transform Completeness

*For any* CALL opcode transform, it must define variables: argCount, fn, this_val, args. *For any* NEW opcode transform, it must define variables: argCount, ctor, args.

**Validates: Requirements 2.1, 2.2**

### Property 3: Operator Transform Completeness

*For any* binary operator transform, it must define variables: a, b, result. *For any* unary operator transform, it must define variables: operand, result.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Register Substitution Correctness

*For any* expression and register mapping, substituting register names should produce a valid JavaScript expression where all generic names are replaced with actual variable names.

**Validates: Requirements 4.2**

### Property 5: Transform Parsing Round-Trip

*For any* valid @opcode_transform section, parsing then serializing should produce an equivalent section (modulo whitespace).

**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

| 错误场景 | 处理方式 |
|----------|----------|
| 无效的opcode编号 | 记录警告，跳过该transform |
| 格式错误的transform | 记录错误，显示原始文本 |
| 缺少@reg指令 | 使用默认寄存器名 (ip, sp, stack, bc, scope) |
| 未知opcode的hover | 仅显示opcode名称，不显示transform |
| 多行transform解析失败 | 尝试单行解析，记录警告 |

## Testing Strategy

### 单元测试

1. **TransformParser 测试**
   - 解析单行transform
   - 解析多行transform
   - 处理格式错误
   - 提取变量定义

2. **RegisterMapper 测试**
   - 简单替换 (stack → v)
   - 复合表达式替换
   - 嵌套表达式替换
   - 无需替换的情况

3. **VmasmHoverProvider 测试**
   - CALL指令hover
   - 二元运算hover
   - 未知opcode hover
   - 无transform的hover

### 属性测试

使用 fast-check 进行属性测试：

1. **Transform格式验证** (Property 1)
   - 生成随机有效transform
   - 验证解析后格式正确
   - 验证不包含状态修改语句

2. **Transform完整性** (Property 2, 3)
   - 生成CALL/NEW/BINARY/UNARY transforms
   - 验证必需变量存在

3. **寄存器替换** (Property 4)
   - 生成随机表达式和寄存器映射
   - 验证替换后表达式有效

4. **解析往返** (Property 5)
   - 生成随机transform section
   - 验证 parse → serialize → parse 等价

### 测试配置

- 属性测试最少100次迭代
- 每个属性测试标注对应的设计属性编号
- 标签格式: **Feature: jsvmp-decompile-enhancement, Property N: {property_text}**
