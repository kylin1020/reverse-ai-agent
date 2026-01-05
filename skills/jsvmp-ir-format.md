# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## Comment Format (v1.4)

### Core Principle

**Comments provide basic semantic info. NO static scope inference — use dynamic debugging instead!**

| Instruction Type | Comment Format | Notes |
|------------------|----------------|-------|
| CREATE_FUNC | `; func_N` | Always show function ID |
| STORE_SCOPE | `; scope[d][i]` | Show slot location only |
| LOAD_SCOPE | `; scope[d][i]` | Show slot location only |
| CALL | `; fn()` or `; fn(...args)` | 0 args → `fn()`, N args → `fn(...args)` |
| NEW | `; new class()` or `; new class(...args)` | 0 args → `new class()`, N args → `new class(...args)` |
| GET_GLOBAL | `; "globalName"` | Show constant value |
| GET_PROP_CONST | `; .propName` | Show property name |

**⚠️ String Escaping in Comments (CRITICAL)**:
- Newline `\n` → display as `\n` (escaped), NOT actual newline
- Carriage return `\r` → display as `\r`
- Tab `\t` → display as `\t`
- Example: `; "\n"` ✅ correct, `; "` + actual newline + `"` ❌ wrong
- Reason: Lexer cannot parse comments that span multiple lines

**Dynamic Debugging**: Use `@opcode_transform` + breakpoint to inspect actual runtime values (fn, args, this_val, etc.)

---

## Output Files

```
output/
└── {name}_disasm.vmasm      # IR assembly (v1.4 self-contained)
```

---

## File Structure (5 Sections)

```vmasm
;; 1. HEADER SECTION
@format v1.4
@domain target-website.com
@source main.js
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s

;; 2. OPCODE TRANSFORM SECTION (用于动态调试)
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)
@opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b

;; 3. INJECTION POINTS
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"

;; 4. CONSTANTS SECTION
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)

;; 5. CODE SECTION
@section code
@entry 0x00000000

0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8]
```

---

## 1. HEADER SECTION

### @reg (Register Mapping)

```vmasm
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=Z, scope=s
```

| Role | Description | Debug Usage |
|------|-------------|-------------|
| `ip` | Instruction Pointer | Current instruction address |
| `sp` | Stack Pointer | Stack top index |
| `stack` | Virtual Stack | Operand stack |
| `bc` | Bytecode Array | Bytecode array |
| `const` | Constants Pool | Constants array |
| `scope` | Scope Chain | Scope chain |

---

## 2. OPCODE TRANSFORM SECTION (动态调试核心)

Defines semantic mapping for each opcode. **Used at breakpoints to inspect runtime values!**

### Purpose

When paused at a breakpoint, use these expressions to inspect:
- `fn` - the function being called
- `args` - the arguments array
- `this_val` - the `this` context
- `a`, `b` - operands for binary operations
- `result` - computed result

### Format

```
@opcode_transform {opcode} {NAME}: {expr1}; {expr2}; ...
```

### Stack Expression Conversion

| Original (modifies state) | Converted (read-only) |
|---------------------------|----------------------|
| `sp--` | `stack[sp - 1]` |
| `stack[sp--]` | `stack[sp]` |
| `stack[sp] = x` | ❌ Forbidden |

### Common Templates

```vmasm
;; CALL - 最重要的调试表达式
@opcode_transform 0 CALL: argCount = bc[ip]; fn = stack[sp - argCount]; this_val = stack[sp - argCount - 1]; args = stack.slice(sp - argCount + 1, sp + 1)

;; NEW - 构造函数调用
@opcode_transform 1 NEW: argCount = bc[ip]; constructor = stack[sp - argCount]; args = stack.slice(sp - argCount + 1, sp + 1)

;; BINARY_OP (ADD, SUB, MUL, DIV, MOD)
@opcode_transform 68 ADD: a = stack[sp - 1]; b = stack[sp]; result = a + b

;; UNARY_OP (NOT, NEG, TYPEOF)
@opcode_transform 77 NOT: operand = stack[sp]; result = !operand

;; LOAD/STORE SCOPE
@opcode_transform 82 LOAD_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = scope[depth][idx]
@opcode_transform 83 STORE_SCOPE: depth = bc[ip]; idx = bc[ip + 1]; value = stack[sp]

;; JUMP
@opcode_transform 80 JMP: offset = bc[ip]; target = ip + offset + 1
@opcode_transform 81 JF: offset = bc[ip]; condition = stack[sp]; target = ip + offset + 1
```

### VSCode Extension Integration

When hovering over an instruction, the extension shows:
- Debug expressions from `@opcode_transform`
- Actual variable names from `@reg` mapping

Example hover on `CALL 2`:
```
Debug Expressions:
  argCount = o[a]     → 2
  fn = v[p - 2]       → inspect at breakpoint
  this_val = v[p - 3] → inspect at breakpoint
  args = v.slice(p - 1, p + 1)
```

Example hover on `NEW 2`:
```
Debug Expressions:
  argCount = o[a]     → 2
  constructor = v[p - 2] → inspect at breakpoint
  args = v.slice(p - 1, p + 1)
```

---

## 3. INJECTION POINTS SECTION

Metadata for VSCode Extension auto-breakpoints:

```vmasm
@dispatcher line=2, column=131618
@global_bytecode var=z, line=2, column=91578, pattern="2d_array", transform="z.map(x=>x[0])"
@loop_entry line=2, column=131639
```

| Directive | Purpose |
|-----------|---------|
| `@dispatcher` | VM dispatcher loop location |
| `@global_bytecode` | Bytecode variable definition |
| `@loop_entry` | Loop body first line |

### @global_bytecode pattern

| Value | Structure | Offset Calculation |
|-------|-----------|-------------------|
| `2d_array` | `[[opcode, ...], ...]` | `bytecode[ip][0]` |
| `1d_slice` | `[opcode, ...]` | `bytecode[ip]` |

---

## 4. CONSTANTS SECTION

### Supported Types

| Type | Format | Example |
|------|--------|---------|
| `String` | `String("...")` | `@const K[0] = String("hello")` |
| `Number` | `Number(n)` | `@const K[1] = Number(1024)` |
| `Boolean` | `Boolean(true\|false)` | `@const K[2] = Boolean(true)` |
| `Null` | `Null` | `@const K[3] = Null` |
| `Object` | `Object({...})` | `@const K[4] = Object({"key":"val"})` |

**Type must be determined by JavaScript native typeof after JSON.parse!**

---

## 5. CODE SECTION

### Format

```vmasm
@section code
@entry 0x{entry_address}

0x{ADDR}: {OPCODE:<18} {operands:<15} ; {comment}
```

### Instruction Comment Examples

```vmasm
;; Scope instructions (no static inference)
0x0000: CREATE_FUNC        1               ; func_1
0x0002: STORE_SCOPE        0 8             ; scope[0][8]
0x0010: LOAD_SCOPE         0 8             ; scope[0][8]

;; CALL instructions (use @opcode_transform for runtime inspection)
0x0100: CALL               2               ; fn(...args)
0x0200: CALL               0               ; fn()

;; NEW instructions (use @opcode_transform for runtime inspection)
0x0300: NEW                2               ; new class(...args)
0x0400: NEW                0               ; new class()

;; K_Reference instructions
0x00B3: GET_GLOBAL         K[0]            ; "window"
0x00B5: GET_PROP_CONST     K[1]            ; .localStorage

;; Jump instructions
0x00B8: JF                 0x00C5          ; if false → 0x00C5
0x00C3: JMP                0x00D0          ; → 0x00D0
```

---

## Opcode Categories

| Category | Examples |
|----------|----------|
| Stack | `PUSH_CONST`, `PUSH_TRUE`, `PUSH_FALSE`, `PUSH_NULL`, `POP`, `DUP` |
| Load/Store | `LOAD_SCOPE`, `STORE_SCOPE`, `GET_GLOBAL`, `GET_PROP_CONST`, `SET_PROP_CONST` |
| Control Flow | `JMP`, `JZ`, `JNZ`, `JT`, `JF`, `RETURN`, `THROW` |
| Arithmetic | `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `NEG` |
| Comparison | `EQ`, `NE`, `EQ_STRICT`, `NE_STRICT`, `LT`, `GT`, `LE`, `GE` |
| Logical/Bitwise | `NOT`, `AND`, `OR`, `XOR`, `SHL`, `SHR` |
| Type | `TYPEOF`, `INSTANCEOF`, `IN` |
| Call | `CALL`, `NEW`, `RETURN` |
| Object | `GET_PROP`, `SET_PROP`, `DEFINE_PROP` |
| Function | `CREATE_FUNC`, `LOAD_FUNC` |

---

## File Extension Convention

| Level | Extension | Name | Description |
|-------|-----------|------|-------------|
| LIR | `.vmasm` | VM Assembly | Low-level: 1:1 bytecode, explicit stack ops |
| MIR | `.vmir` | VM Mid-level IR | Mid-level: stack eliminated, basic blocks |
| HIR | `.vmhir` | VM High-level IR | High-level: control flow recovered (if/while) |
| MAP | `.vmap` | VM Source Map | Maps IR address to original JS [line:col] |

---

## Implementation Notes

1. **Address**: Use hex bytecode physical address, not instruction count
2. **Operands**: Parse based on opcode operand type/count
3. **Constants**: Embedded in file header, no external JSON dependency
4. **Jumps**: Target = current address + offset + instruction length
5. **Debug expressions**: Use variable names from `@reg` + `@opcode_transform`
6. **No static scope inference**: Use `@opcode_transform` at breakpoints to inspect fn/args/this_val
