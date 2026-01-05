# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## Comment Format (v1.5)

### Core Principle

**Comments provide basic semantic info + stack effect. NO static scope inference — use dynamic debugging instead!**

### Stack Effect Notation

Use `→` to show data flow direction:
- `→ stack[sp]` = push result to stack top
- `stack[sp] →` = pop value from stack top
- `stack[sp-1], stack[sp] →` = pop two values

| Instruction Type | Comment Format | Stack Effect | Notes |
|------------------|----------------|--------------|-------|
| CREATE_FUNC | `; func_N → stack[sp]` | push | Result pushed to stack |
| STORE_SCOPE | `; stack[sp] → scope[d][i]` | pop | Value popped from stack |
| LOAD_SCOPE | `; scope[d][i] → stack[sp]` | push | Value pushed to stack |
| CALL | `; fn(N args) → stack[sp]` | pop N+2, push 1 | Pop fn+this+args, push result |
| NEW | `; new(N args) → stack[sp]` | pop N+1, push 1 | Pop ctor+args, push instance |
| GET_GLOBAL | `; "globalName" → stack[sp]` | push | Global value pushed |
| GET_PROP_CONST | `; .propName → stack[sp]` | push | Property value pushed |
| PUSH_* | `; value → stack[sp]` | push | Literal pushed |
| POP | `; stack[sp] → discard` | pop | Value discarded |
| DUP | `; stack[sp] → stack[sp], stack[sp+1]` | push | Duplicate top |
| Binary ops | `; stack[sp-1] OP stack[sp] → stack[sp-1]` | pop 1 | Two operands, one result |
| Unary ops | `; OP stack[sp] → stack[sp]` | none | In-place operation |

### Stack Position Inference Rules

When stack position can be **statically determined**, show it:

1. **After PUSH/CREATE_FUNC**: `sp` increases by 1
2. **After POP/STORE_SCOPE**: `sp` decreases by 1  
3. **After CALL N**: `sp` decreases by N+1 (pop fn+this+args, push result)
4. **After binary op**: `sp` decreases by 1

**Example with inferred positions:**
```vmasm
;; Assume sp=0 at function entry
0x0000: CREATE_FUNC        157             ; func_157 → stack[0]
0x0002: STORE_SCOPE        0 2             ; stack[0] → scope[0][2]; sp=0→-1
0x0005: CREATE_FUNC        160             ; func_160 → stack[0]
0x0007: STORE_SCOPE        0 3             ; stack[0] → scope[0][3]; sp=0→-1
```

### When NOT to Infer

- After conditional jumps (JZ/JNZ/JF/JT) - stack state depends on branch taken
- After CALL/NEW - stack effect depends on callee
- Inside loops - stack state may vary per iteration
- After exception handlers - stack may be unwound

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
@format v1.5
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

### Format (v1.4 - Quoted String Format)

```
@opcode_transform {opcode} {NAME}: "{pre:|post:}expr1"; "{pre:|post:}expr2"; ...
```

- `pre:` - Expression evaluated BEFORE instruction execution (default if omitted)
- `post:` - Expression evaluated AFTER instruction execution (e.g., CALL/NEW return value)

### Stack Expression Conversion

| Original (modifies state) | Converted (read-only) |
|---------------------------|----------------------|
| `sp--` | `stack[sp - 1]` |
| `stack[sp--]` | `stack[sp]` |
| `stack[sp] = x` | ❌ Forbidden |

### ⚠️ Verification Requirement (CRITICAL)

**Every @opcode_transform MUST be verified against original JS handler code!**

```javascript
// STEP 1: Search for handler
search_code_smart({ query: "{opcode} === t" })

// STEP 2: Read handler code, understand stack operations
// Example handler (opcode 32 = LT):
//   if (32 === t) {
//     v[p - 1] = v[p - 1] < v[p];  // compare top two values
//     p--;                          // pop one value
//   }

// STEP 3: Convert to pre/post expressions
@opcode_transform 32 LT: "pre:a = v[p - 1]"; "pre:b = v[p]"; "pre:result = a < b"
```

### Common Templates

```vmasm
;; CALL - 最重要的调试表达式 (有 post 返回值)
@opcode_transform 0 CALL: "pre:argCount = o[a]"; "pre:fn = v[p - argCount]"; "pre:this_val = v[p - argCount - 1]"; "pre:args = v.slice(p - argCount + 1, p + 1)"; "post:result = v[p]"

;; NEW - 构造函数调用 (有 post 返回值)
@opcode_transform 59 NEW: "pre:argCount = o[a]"; "pre:ctor = v[p - argCount]"; "pre:args = v.slice(p - argCount + 1, p + 1)"; "post:result = v[p]"

;; BINARY_OP (ADD, SUB, MUL, DIV, MOD)
@opcode_transform 68 ADD: "pre:a = v[p - 1]"; "pre:b = v[p]"; "pre:result = a + b"

;; UNARY_OP (NOT, NEG, TYPEOF)
@opcode_transform 29 NOT: "pre:operand = v[p]"; "pre:result = !operand"

;; LOAD/STORE SCOPE
@opcode_transform 74 LOAD_SCOPE: "pre:depth = o[a]"; "pre:idx = o[a + 1]"; "pre:value = s[depth][idx]"
@opcode_transform 54 STORE_SCOPE: "pre:depth = o[a]"; "pre:idx = o[a + 1]"; "pre:value = v[p]"

;; JUMP
@opcode_transform 53 JMP: "pre:offset = o[a]"; "pre:target = a + offset + 2"
@opcode_transform 41 JF: "pre:offset = o[a]"; "pre:condition = v[p]"; "pre:target = a + offset + 2"
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
;; Scope instructions with stack effect (v1.5)
0x0000: CREATE_FUNC        1               ; func_1 → stack[sp]
0x0002: STORE_SCOPE        0 8             ; stack[sp] → scope[0][8]
0x0010: LOAD_SCOPE         0 8             ; scope[0][8] → stack[sp]

;; CALL instructions (use @opcode_transform for runtime inspection)
0x0100: CALL               2               ; fn(2 args) → stack[sp]
0x0200: CALL               0               ; fn(0 args) → stack[sp]

;; NEW instructions (use @opcode_transform for runtime inspection)
0x0300: NEW                2               ; new(2 args) → stack[sp]
0x0400: NEW                0               ; new(0 args) → stack[sp]

;; K_Reference instructions
0x00B3: GET_GLOBAL         K[0]            ; "window" → stack[sp]
0x00B5: GET_PROP_CONST     K[1]            ; .propName → stack[sp]

;; Binary operations
0x00B7: ADD                                ; stack[sp-1] + stack[sp] → stack[sp-1]

;; Jump instructions
0x00B8: JF                 0x00C5          ; if !stack[sp] → 0x00C5
0x00C3: JMP                0x00D0          ; → 0x00D0

;; Sequence example with stack tracking
;; Entry: sp = base
0x0000: CREATE_FUNC        157             ; func_157 → stack[base]
0x0002: STORE_SCOPE        0 2             ; stack[base] → scope[0][2]
0x0005: CREATE_FUNC        160             ; func_160 → stack[base]
0x0007: STORE_SCOPE        0 3             ; stack[base] → scope[0][3]
0x000A: LOAD_SCOPE         0 2             ; scope[0][2] → stack[base]
0x000D: PUSH_IMM           42              ; 42 → stack[base+1]
0x000F: CALL               1               ; fn(1 arg) → stack[base]
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
