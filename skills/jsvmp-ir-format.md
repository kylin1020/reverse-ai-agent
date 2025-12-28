# JSVMP IR/ASM Output Format Specification

> Sub-Agent MUST read this file before generating disassembly output.

## Output File
`output/{name}_disasm.asm`

## File Structure
```asm
;; JSVMP Disassembly - {domain} {filename}
;; Total Functions: {count}
;; Total Constants: {count}

;; ========================================
;; Function {id}
;; Params: {n}, Strict: {true|false}
;; [Try-Catch Blocks: {n}]  ; optional
;; ========================================

{instructions}
```

## Instruction Format
```
{addr:>5}: {OPCODE:<18} {operands:<10} ; {semantic} ; {constant_ref}
```

| Field | Width | Description |
|-------|-------|-------------|
| `addr` | 5 chars right-aligned | Instruction address (0-based) |
| `OPCODE` | 18 chars left-aligned | Uppercase mnemonic |
| `operands` | 10 chars left-aligned | Operands (space-separated) |
| `semantic` | variable | Human-readable description |
| `constant_ref` | variable | `Z[{idx}]="{value}"` |

## Opcode Naming (UPPERCASE_SNAKE_CASE)

| Category | Examples |
|----------|----------|
| Stack | `PUSH_CONST`, `PUSH_BYTE`, `PUSH_TRUE`, `PUSH_FALSE`, `PUSH_NULL`, `PUSH_UNDEFINED`, `POP`, `DUP` |
| Load/Store | `LOAD_CLOSURE`, `LOAD_SCOPE`, `GET_SCOPE`, `SET_SCOPE`, `GET_GLOBAL`, `GET_PROP`, `SET_PROP`, `GET_PROP_CONST`, `SET_PROP_CONST` |
| Control Flow | `JMP`, `JMPIF`, `JMPIFNOT`, `JMPIF_POP`, `JMPIF_KEEP` |
| Arithmetic | `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, `NEG`, `POST_INC`, `POST_DEC` |
| Comparison | `EQ`, `NE`, `EQ_STRICT`, `NE_STRICT`, `LT`, `GT`, `LE`, `GE` |
| Logical | `NOT`, `AND`, `OR` |
| Type | `TYPEOF`, `TYPEOF_GLOBAL`, `INSTANCEOF` |
| Call | `CALL`, `NEW`, `RETURN`, `THROW` |
| Object | `NEW_OBJ`, `DEF_PROP`, `TO_ARRAY` |

## Semantic Comment Examples

```asm
; Stack operations
PUSH_CONST       134          ; Push Z[x] ; Z[134]="1.0.1.19"
PUSH_BYTE          0          ; Push immediate byte ; n=0
POP                           ; Pop top
DUP                           ; Duplicate top

; Scope operations
LOAD_CLOSURE       1          ; D(x, s2) - create closure ; Z[1]="Symbol"
SET_SCOPE          0   8      ; scope[depth][x] = val ; depth=0, Z[8]="string"
GET_SCOPE          1  13      ; scope[depth][x] ; depth=1, Z[13]="name"
GET_GLOBAL       132          ; globalThis[Z[x]] ; Z[132]="window"

; Property access
GET_PROP_CONST   133          ; obj[Z[x]] ; Z[133]="config"
SET_PROP_CONST   135          ; obj[Z[x]] = val ; Z[135]="version"
GET_PROP                      ; obj[key]
SET_PROP                      ; obj[key] = val

; Control flow - jump target uses "; -> {addr}"
JMP                8          ; Unconditional jump ; -> 205
JMPIF             11          ; if (top) jmp ; -> 197
JMPIFNOT          11          ; if (!top) jmp ; -> 197

; Calls
CALL               0          ; fn.apply(this, args) ; n=0
NEW                1          ; new Fn(...args) ; n=1
RETURN                        ; f2=2, l2=pop()
```

## Constant Pool Reference
```asm
; Short strings (≤30 chars): show full value
Z[134]="1.0.1.19-fix.01"

; Long strings (>30 chars): truncate
Z[7]="Invalid attempt to spread non-..."
```

## Complete Example
```asm
;; JSVMP Disassembly - example.com main.js
;; Total Functions: 42
;; Total Constants: 256

;; ========================================
;; Function 0
;; Params: 0, Strict: true
;; ========================================

    0: LOAD_CLOSURE       1          ; D(x, s2) - create closure ; Z[1]="Symbol"
    2: SET_SCOPE          0   8      ; scope[depth][x] = val ; depth=0, Z[8]="string"
   14: GET_GLOBAL        50          ; globalThis[Z[x]] ; Z[50]="window"
   19: JMPIFNOT          11          ; if (!top) jmp ; -> 32
   30: JMP                8          ; Unconditional jump ; -> 40
   40: PUSH_UNDEFINED                ; Push undefined
   41: RETURN                        ; f2=2, l2=pop()
```

## Implementation Notes
1. **Address calculation**: Track bytecode position, not instruction count
2. **Operand extraction**: Parse based on opcode's operand count/types
3. **Constant lookup**: Maintain `Z[]` array from extracted constants
4. **Jump resolution**: Calculate absolute target = current_addr + relative_offset + instruction_size
