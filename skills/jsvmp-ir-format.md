# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## Output Files
```
output/
├── {name}_disasm.asm      # IR assembly
└── {name}_disasm.asm.map  # Source Map (JSON)
```

## File Structure
```javascript
// JSVMP Disassembly - {domain} {filename}
// Source Map: {name}_disasm.asm.map
// Total Functions: {count}
// Total Constants: {count}

// ========================================
// Function {id}
// Params: {n}, Strict: {true|false}
// Bytecode: [{start}, {end}]
// Source: L{line}:{column}
// ========================================

{instructions}
```

## Instruction Format
```
{addr:>5}: {OPCODE:<18} {operands:<10} // {semantic} // {constant_ref}
```

| Field | Width | Description |
|-------|-------|-------------|
| `addr` | 5 right-aligned | Bytecode address (0-based) |
| `OPCODE` | 18 left-aligned | Uppercase mnemonic |
| `operands` | 10 left-aligned | Space-separated operands |
| `semantic` | variable | Human-readable description |
| `constant_ref` | variable | `K[{idx}]="{value}"` |

> **Line Number = irLine**: Source Map `irLine` is the actual file line number.
> **Breakpoint Info**: Stored in `.asm.map` file. See `#[[file:skills/jsvmp-ir-sourcemap.md]]`

## Opcode Categories

| Category | Examples |
|----------|----------|
| Stack | `PUSH_CONST`, `PUSH_BYTE`, `PUSH_TRUE`, `PUSH_FALSE`, `PUSH_NULL`, `PUSH_UNDEFINED`, `POP`, `DUP` |
| Load/Store | `LOAD_CLOSURE`, `LOAD_SCOPE`, `GET_SCOPE`, `SET_SCOPE`, `GET_GLOBAL`, `GET_PROP`, `SET_PROP` |
| Control Flow | `JMP`, `JMPIF`, `JMPIFNOT`, `JMPIF_POP`, `JMPIF_KEEP` |
| Arithmetic | `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `NEG`, `POST_INC`, `POST_DEC` |
| Comparison | `EQ`, `NE`, `EQ_STRICT`, `NE_STRICT`, `LT`, `GT`, `LE`, `GE` |
| Logical | `NOT`, `AND`, `OR` |
| Type | `TYPEOF`, `TYPEOF_GLOBAL`, `INSTANCEOF` |
| Call | `CALL`, `NEW`, `RETURN`, `THROW` |
| Object | `NEW_OBJ`, `DEF_PROP`, `TO_ARRAY` |

## Semantic Comment Examples

```javascript
// Stack
PUSH_CONST         5          // Push K[x] // K[5]="hello"
PUSH_BYTE          0          // Push immediate byte // n=0
POP                           // Pop top
DUP                           // Duplicate top

// Scope
LOAD_CLOSURE       1          // Create closure // K[1]="fn"
SET_SCOPE          0   3      // scope[depth][x] = val // depth=0, K[3]="name"
GET_SCOPE          1   4      // scope[depth][x] // depth=1, K[4]="value"
GET_GLOBAL         2          // globalThis[K[x]] // K[2]="window"

// Property
GET_PROP_CONST     6          // obj[K[x]] // K[6]="length"
SET_PROP_CONST     7          // obj[K[x]] = val // K[7]="data"
GET_PROP                      // obj[key]
SET_PROP                      // obj[key] = val

// Control flow - jump target: "// -> {addr}"
JMP                8          // Unconditional jump // -> 50
JMPIF             11          // if (top) jmp // -> 42
JMPIFNOT          11          // if (!top) jmp // -> 42

// Calls
CALL               2          // fn.apply(this, args) // n=2
NEW                1          // new Fn(...args) // n=1
RETURN                        // Return top of stack
```

## Constant Pool Reference
```javascript
// Short strings (≤30 chars): show full
K[5]="hello world"

// Long strings (>30 chars): truncate
K[7]="This is a very long string th..."
```

## Complete Example
```javascript
// JSVMP Disassembly - example.com main.js
// Source Map: main_disasm.asm.map
// Total Functions: 3
// Total Constants: 50

// ========================================
// Function 0
// Params: 0, Strict: true
// Bytecode: [0, 100]
// Source: L1000:8
// ========================================

    0: LOAD_CLOSURE       1          // Create closure // K[1]="init"
    2: SET_SCOPE          0   3      // scope[depth][x] = val // depth=0, K[3]="fn"
   14: GET_GLOBAL         2          // globalThis[K[x]] // K[2]="window"
   19: JMPIFNOT          11          // if (!top) jmp // -> 32
   30: JMP                8          // Unconditional jump // -> 40
   40: PUSH_UNDEFINED                // Push undefined
   41: RETURN                        // Return top of stack
```

## Implementation Notes
1. **Address**: Track bytecode position, not instruction count
2. **Operands**: Parse based on opcode's operand count/types
3. **Constants**: Use `K[]` array from extracted constants
4. **Jumps**: target = current_addr + offset + instruction_size
5. **Source Map**: Generate `.asm.map` alongside IR output
