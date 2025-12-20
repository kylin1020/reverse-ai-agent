# JSVMP Analysis Skill

> **Trigger**: `while(true) { switch(op) {...} }` VM dispatcher with stack operations  
> **Goal**: Recover algorithm from VM bytecode via breakpoint instrumentation  
> **Related**: `skills/js_deobfuscation.md` (for non-VM obfuscation)  
> **Tools**: Use `set_breakpoint` for logging. `evaluate_script` ONLY for triggering globals.

## Phase 1: Locating the VM Heart & Golden Breakpoints

**Task**: Find the precise lines for instrumentation. Accuracy here prevents "Log Noise."

1.  **The Initialization Point**: 
    *   **Location**: Just before the `while(true)` loop.
    *   **Goal**: Capture the initial `Bytecode` array, `Keys`, and `Environment` variables.
2.  **The Fetch-Decode (The Golden Breakpoint)**:
    *   **Location**: The first line inside the loop, specifically where the opcode is extracted (e.g., `op = bytecode[pc++]`).
    *   **Goal**: This is the primary log entry. It must capture the state *before* the opcode executes.
3.  **The External Bridge**:
    *   **Location**: Inside the `switch` case that handles `apply`, `call`, or member access (e.g., `obj[member]`).
    *   **Goal**: Identify when the VM exits to native JavaScript (e.g., calling `btoa`, `Canvas`, or `Math`).
4.  **The Context/Memory Pool**:
    *   **Location**: Look for an array/object used for variable storage (not the stack).
    *   **Goal**: Track long-term data persistence.

---

## Phase 2: Strategic Instrumentation

**Task**: Use `set_breakpoint` to generate logs without pausing execution.

**Template for `set_breakpoint` Condition**:
```javascript
// Replace PC, OP, STACK, and POOL with actual minified names found in source
console.log(`[TRACE] PC:${PC} | OP:${OP} | STACK:${JSON.stringify(STACK.slice(-5))} | POOL:${JSON.stringify(POOL)}`), false
```

---

## Phase 3: Managing Log Explosion

**Task**: Use the MCP `list_console_messages` tool to offload massive logs to local storage for high-performance searching.

### ⚠️ CRITICAL: Single-Line Output Explosion

VM trace logs contain `JSON.stringify()` output → single lines can be 10KB+. **ALWAYS use `-M` flag** to cap line length.

1.  **Trigger Execution**: Perform the action in the browser (click, submit, etc.) or use `evaluate_script` to call the target global function.
2.  **Save to Disk**:
    ```javascript
    // Use the savePath parameter to avoid memory overflow in the chat interface
    list_console_messages(savePath="vm_trace_full.txt", types=["log"])
    ```
3.  **Local Data Mining** (MANDATORY `-M` flag):

    ```bash
    # ✅ SAFE - Always use -M to cap per-line output
    rg -M 200 "OP:42" vm_trace_full.txt | head -50
    rg -M 200 "your_input_string" vm_trace_full.txt
    rg -M 300 -A 2 "OP:(ADD|XOR|SUB)" vm_trace_full.txt | head -100
    
    # ✅ SAFE - awk/cut naturally handle line parsing
    awk -F'|' '{print $1}' vm_trace_full.txt | uniq -c | head -20
    cut -d'|' -f1,2 vm_trace_full.txt | head -50
    
    # ❌ FORBIDDEN - will explode context
    rg "OP:42" vm_trace_full.txt              # No -M = disaster
    cat vm_trace_full.txt                      # Never
    rg -A 5 "pattern" vm_trace_full.txt       # Context lines also huge
    ```

**Rule**: Trace logs have JSON → single line = massive. `-M 200` is mandatory.

---

## Phase 4: Pattern Recognition & Algorithm Mapping

**Task**: Analyze the filtered logs to reconstruct the algorithm.

1.  **Instruction Mapping**:
    *   `[10, 20] -> [30]` (Result 30) => Likely `ADD`.
    *   `[10, 20] -> [30]` (Result 30 is `10 ^ 20`) => Likely `XOR`.
2.  **Constant Identification**:
    *   `0x67452301`, `0xEFCDAB89`: MD5 / SHA-1.
    *   `0x6a09e667`, `0xbb67ae85`: SHA-256.
    *   Large 256-byte arrays: AES S-Box or Custom Mapping.
3.  **Differential Analysis**:
    *   Generate `trace_a.txt` (input: "AAAA") and `trace_b.txt` (input: "AAAB").
    *   Use `diff` or `code --diff` to find exactly where the logic branches based on input.

---

## Phase 5: Implementation (The Deliverable)

**The final output must include**:
1.  **Component Map**: Identification of PC, Stack, Bytecode, and Opcode variables.
2.  **Opcode Table**: A mapping of hex/integer opcodes to their logical functions (e.g., `0x01: PUSH`, `0x02: ADD`).
3.  **Pseudo-code**: A high-level reconstruction of the logic (e.g., "The VM takes the input, XORs it with a hardcoded key, then passes it to an MD5-like round").
4.  **Python Implementation**: A functional script that replicates the VM's output.

---

## Troubleshooting & Expert Tips

*   **Log is too noisy?** Add a condition to the breakpoint: `OP === 0x25 && console.log(...)`.
*   **Missing Data?** Check if the VM uses a "Secondary Stack" or "Accumulator" register.
*   **Variable Scope?** If the stack is `undefined`, you are likely logging in the wrong function scope. Use `get_scope_variables` at a manual breakpoint to verify.
*   **Anti-Debugging?** If the VM terminates when logs start, look for `Date.now()` or `performance.now()` checks within the `while` loop and patch them via `inject_console_log`.