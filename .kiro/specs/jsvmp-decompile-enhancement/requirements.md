# Requirements Document

## Introduction

增强JSVMP反编译功能，通过改进vmasm文件头部的opcode_transform映射，使得在VSCode Extension中调试时能够动态求出变量值（如fn/args/a/b等）。核心改进：
1. 在vmasm文件头部定义完整的opcode语义映射（@opcode_transform）
2. 将栈指针修改操作（如`p--`/`p++`）转换为不影响VM状态的表达式形式（如`v[p-1]`）
3. 为每个opcode定义可调试的中间变量表达式，便于在断点处求值

**注意**：不需要为每条指令添加额外注释，只需在vmasm开头做好opcode映射的transform即可。

## Glossary

- **JSVMP**: JavaScript Virtual Machine Protection，一种JS代码保护技术
- **vmasm**: VM Assembly，JSVMP的低级中间表示格式
- **Opcode_Transform**: vmasm文件头部定义的opcode语义映射，描述每个opcode的操作语义
- **Stack_Expression**: 使用栈偏移表达式（如`v[p-1]`）而非栈指针修改（如`p--`），不影响VM状态
- **Debug_Variable**: opcode_transform中定义的中间变量（如fn/args/a/b/result），可在调试时求值
- **Extension**: jsvmp-ir-extension VSCode扩展

## Requirements

### Requirement 1: Opcode Transform 格式规范

**User Story:** As a reverse engineer, I want opcode transforms to define debug variables with non-mutating expressions, so that I can evaluate them during debugging without affecting VM state.

#### Acceptance Criteria

1. THE opcode_transform format SHALL be: `@opcode_transform {opcode} {NAME}: {statement1}; {statement2}; ...`
2. WHEN an opcode involves stack pointer modification, THE Transform SHALL use offset expressions instead:
   - `p--` → `v[p - 1]` (读取栈顶下一个元素)
   - `p++` → `v[p + 1]` (读取栈顶上一个位置)
   - `p = p - N` → `v[p - N]` (读取偏移N的位置)
3. THE Transform SHALL NOT contain any assignment that modifies VM state (no `p =`, `v[p] =`, `a =` 等)
4. THE Transform SHALL define named variables for key operands that can be evaluated at breakpoint

### Requirement 2: CALL/NEW Opcode Transform

**User Story:** As a reverse engineer, I want CALL and NEW opcodes to have transforms that expose fn/ctor/args/result variables, so that I can inspect function calls during debugging.

#### Acceptance Criteria

1. WHEN defining transform for CALL opcode (opcode 0), THE Transform SHALL define:
   - `argCount = o[a]` (参数数量，从字节码读取)
   - `fn = v[p - argCount]` (被调用函数)
   - `this_val = v[p - argCount - 1]` (this绑定)
   - `args = v.slice(p - argCount + 1, p + 1)` (参数数组)
   - `result` (调用结果，step over后可访问)
2. WHEN defining transform for NEW opcode (opcode 59), THE Transform SHALL define:
   - `argCount = o[a]` (参数数量)
   - `ctor = v[p - argCount]` (构造函数)
   - `args = v.slice(p - argCount + 1, p + 1)` (参数数组)
   - `result` (构造结果)

### Requirement 3: 运算符 Opcode Transform

**User Story:** As a reverse engineer, I want binary and comparison operators to expose a/b operands, so that I can understand what values are being operated on.

#### Acceptance Criteria

1. WHEN defining transform for binary operators (ADD, SUB, MUL, DIV, MOD, AND, OR, XOR, SHL, SHR, USHR), THE Transform SHALL define:
   - `a = v[p - 1]` (左操作数)
   - `b = v[p]` (右操作数)
   - `result = a {op} b` (运算结果表达式)
2. WHEN defining transform for comparison operators (EQ, NE, LT, GT, LE, GE, EQ_STRICT, NE_STRICT), THE Transform SHALL define:
   - `a = v[p - 1]` (左操作数)
   - `b = v[p]` (右操作数)
   - `result = a {op} b` (比较结果表达式)
3. WHEN defining transform for unary operators (NOT, NEG, TYPEOF, BITWISE_NOT), THE Transform SHALL define:
   - `operand = v[p]` (操作数)
   - `result = {op} operand` (运算结果表达式)

### Requirement 4: Extension Hover 增强

**User Story:** As a reverse engineer, I want to hover over instructions and see the opcode transform with substituted register names, so that I can copy expressions to the watch panel.

#### Acceptance Criteria

1. WHEN hovering over an instruction, THE Extension SHALL look up its opcode in the @opcode_transform section
2. THE Extension SHALL substitute register names from @reg directive (e.g., `v` → actual stack variable name)
3. THE hover content SHALL display each debug variable as a copyable expression
4. IF the opcode has no transform defined, THE Extension SHALL display the raw opcode name only

### Requirement 5: AI 提示词增强

**User Story:** As a developer using AI for reverse engineering, I want the AI prompts to guide generation of complete opcode_transform sections, so that the output vmasm is immediately usable for debugging.

#### Acceptance Criteria

1. THE jsvmp-ir-format.md skill file SHALL document the enhanced @opcode_transform format with debug variables
2. THE skill file SHALL explain the stack expression conversion rules using generic patterns (e.g., `sp--` → `stack[sp-1]`)
3. THE skill file SHALL provide generic opcode category templates (CALL, BINARY_OP, UNARY_OP, LOAD, STORE, JUMP) instead of specific opcode examples
4. THE skill file SHALL describe how to derive transforms from original VM dispatcher code analysis
5. THE skill file SHALL NOT include site-specific opcode numbers or variable names

### Requirement 6: Opcode Transform 解析器

**User Story:** As an extension developer, I want the vmasm parser to extract opcode_transform definitions, so that hover and other features can use them.

#### Acceptance Criteria

1. WHEN parsing a vmasm file with @opcode_transform directives, THE Parser SHALL extract: opcode number, opcode name, and variable definitions
2. THE Parser SHALL store transforms in a structure: `Map<number, { name: string, statements: string[] }>`
3. THE Parser SHALL handle multi-line transforms (if any) by continuing until next @opcode_transform or section
