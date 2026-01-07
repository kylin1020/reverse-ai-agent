# JSVMP Code Generation (HIR → JavaScript)

## Core Problem

**Most common error**: Control flow code loss during HIR → JS conversion.

**Root cause**: Recursive block processing with shared visited set causes else branches and loop bodies to return empty arrays.

**Real case**: func_150 had 1022 HIR lines but only 274 JS lines (73% code loss).

## Critical Rules

### Never Do This

1. **Shared visited set** - Causes else branch loss when then branch visits else target first
2. **Loop header only** - Must process all loop nodes, not just header
3. **No merge point** - Without merge point, code duplicates or gets lost

### Always Do This

1. **Separate visited sets** - Clone visited for then/else branches independently
2. **Process all loop nodes** - Iterate through all nodes in loop.nodes array
3. **Find merge point** - Calculate IPDOM (immediate post-dominator) for if-else convergence
4. **Mark loop nodes visited** - Add all loop nodes to visited before processing body

## Algorithm Framework

### Region-based Generation

```
generateRegion(startBlockId, endBlockId, visited):
  while currentBlockId != endBlockId and not visited:
    if isLoopHeader(currentBlockId):
      generate loop
      currentBlockId = loopExit
    else:
      generate block instructions
      if conditional:
        thenVisited = clone(visited)
        elseVisited = clone(visited)
        mergePoint = findMergePoint(trueTarget, falseTarget, visited)
        thenStmts = generateRegion(trueTarget, mergePoint, thenVisited)
        elseStmts = generateRegion(falseTarget, mergePoint, elseVisited)
        merge visited sets
        currentBlockId = mergePoint
```

### Loop Generation

```
generateLoop(headerBlockId, visited):
  mark all loop nodes as visited
  for each node in loop.nodes (sorted by id):
    generate block instructions
    if conditional inside loop:
      check if branch exits loop
      if yes: add break statement
  return while statement
```

### Merge Point Calculation

```
findMergePoint(trueTarget, falseTarget, visited):
  trueReachable = getReachable(trueTarget, visited)
  falseReachable = getReachable(falseTarget, visited)
  return first common reachable block (IPDOM)
```

## HIR Format Requirements

### Function Header
```
// Function {id}
// Params: {n}, Strict: {bool}
// Entry: BB{id}
// Blocks: {count}
// Loops: {count}
//   {type} loop: header=BB{h}, latch=BB{l}, nodes=[BB{n1}, BB{n2}, ...]
// Conditionals: {count}
```

### Control Flow Types
- Conditional: `-> if (cond) goto BB{x} else goto BB{y}`
- Jump: `-> goto BB{x}`
- Fallthrough: `-> BB{x}`
- Return: (none)

## Verification

### Pre-generation Checks
- HIR contains complete loop info (header, latch, nodes)
- All conditional blocks have true/false targets
- Blocks sorted by address

### Post-generation Validation
- JS lines / HIR lines ratio: 0.5 - 1.5 (< 0.3 indicates code loss)
- while count ≈ HIR Loops count (> 20% difference needs check)
- if count ≈ HIR Conditionals count (> 30% difference needs check)

## Common Fixes

### Else Branch Loss
**Symptom**: if without else
**Fix**: Separate visited sets for then/else branches

### Incomplete Loop Body
**Symptom**: while with partial code
**Fix**: Process all nodes in loop.nodes array

### Flattened Nesting
**Symptom**: Nested if-else becomes sequential if
**Fix**: Correct merge point calculation using IPDOM

## Debugging

### Quick Checks
1. Compare line counts: `wc -l hir.txt js.js`
2. Locate problem function with large line difference
3. Extract HIR for that function
4. Add logging in generateRegion: log startBlockId, endBlockId, visited.size
5. Verify all conditional branches processed
6. Verify all loop nodes processed

### Expected Patterns
- Each conditional in HIR → one if statement in JS
- Each loop in HIR → one while statement in JS
- Block count should be similar (accounting for merge points)
