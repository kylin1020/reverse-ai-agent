# Sub-Agent Guidelines

## ⛔ CRITICAL TOOL RULES

### 1. JavaScript File Access (MANDATORY)

**NEVER use these tools on `.js` files:**
- `read_file` / `readFile`
- `cat`, `head`, `tail`
- `grep`, `rg` (ripgrep)

**ALWAYS use Smart-FS tools instead:**

| Action | Tool | Example |
|--------|------|---------|
| Read code | `read_code_smart` | `file_path="source/main.js", start_line=1, end_line=50` |
| Search text | `search_code_smart` | `file_path="source/main.js", query="encrypt"` |
| Trace variable | `find_usage_smart` | `file_path="...", identifier="_0xabc", line=105` |

**Why**: Smart-FS tools auto-beautify minified code and provide `[Src L:C]` coordinates that map directly to Chrome DevTools breakpoints.

### 2. Non-JS File Access

For `.json`, `.txt`, `.py`, `.md`, `.asm` files:
- Use `read_file` (with start/end lines for large files)
- Use `rg` (ripgrep) for searching

### 3. Output Length Limits

**NEVER output or read long strings without truncation:**

| Tool | Limit | How |
|------|-------|-----|
| `read_code_smart` | Auto-handled | Built-in truncation |
| `evaluate_script` | 2000 chars | `.slice(0, 2000)` or use `savePath` |
| `console.log` | 500 chars | Limit per value |
| `rg` (non-JS) | `-M 200 -m 10` | Max line length + max matches |

**For large data**: Always use `savePath` parameter or save to file.

---

## 🌐 BROWSER RULES

### 1. DO NOT Close Main Agent's Browser Page

**The main agent may have initialized a browser session with:**
- Logged-in state
- Cookies/sessions
- Network request history
- Set breakpoints

**NEVER call:**
- `close_page` on the main page
- `navigate_page` to a completely different domain (unless task requires it)
- `clear_cookies` (unless explicitly needed)

**If you need a new page**: Use `new_page` instead of navigating away.

### 2. Breakpoint Coordinates

**Always use `[Src L:C]` coordinates from Smart-FS tools:**

```javascript
// 1. Get coordinates from Smart-FS
search_code_smart(file_path="source/main.js", query="targetFunc")
// Output: [Src L1:15847]

// 2. Set breakpoint using those coordinates
set_breakpoint(urlRegex=".*main.js.*", lineNumber=1, columnNumber=15847)
```

**DO NOT guess line/column numbers.**

### 3. URL Regex Patterns

**NO backslash escaping needed:**
```javascript
// ✅ CORRECT
urlRegex=".*main.js.*"
urlRegex=".*bundle.*js.*"

// ❌ WRONG
urlRegex=".*main\\.js.*"
```

### 4. Evaluate Script Best Practices

```javascript
// ✅ Limit output
evaluate_script(script="targetFunc.toString().slice(0, 2000)")

// ✅ Save large data to file
evaluate_script(script="JSON.stringify(largeArray)", savePath="raw/data.json")

// ❌ NEVER dump unlimited data
evaluate_script(script="JSON.stringify(window)")
```

### 5. Log Breakpoints (Non-Stopping)

Use `, false` at the end of condition to log without pausing:

```javascript
set_breakpoint(
    urlRegex=".*target.js.*", 
    lineNumber=1, 
    columnNumber=123,
    condition='console.log("value:", someVar), false'
)
```

---

## 📝 NOTE.md Writing Rules

### 1. Always Include Source References

Every finding MUST include:
- **File path**: Where you found it
- **Source coordinates**: `[Src L:C]` from Smart-FS tools
- **Timestamp**: When discovered

```markdown
## 关键函数
- `encryptFunc` — `source/main.js` @ `[Src L1:15000]` (2024-01-15 14:30)
```

### 2. Flag New Discoveries

Add to "待处理发现" section for main agent to process:

```markdown
## 待处理发现 (Pending Discoveries)
- [ ] 🆕 Found new param `nonce` in request @ [Src L1:8000] (来源: Browser Recon)
- [ ] 🆕 Decoder function `_0xabc` @ [Src L1:500] (来源: Detect Obfuscation)
```

### 3. Be Concise

- State facts, not process
- Include actionable coordinates
- Skip verbose explanations

---

## 🚫 FORBIDDEN ACTIONS

1. **DO NOT read TODO.md** — Main agent manages task flow
2. **DO NOT continue to "next steps"** — Stop after completing assigned task
3. **DO NOT make decisions about what to do next** — That's main agent's job
4. **DO NOT close or navigate away from main browser page**
5. **DO NOT use `read_file` on `.js` files**
6. **DO NOT output unlimited data** — Always truncate or save to file

---

## ✅ EXECUTION CHECKLIST

Before completing your task:

- [ ] Used Smart-FS tools for all `.js` file access?
- [ ] All findings include `[Src L:C]` coordinates?
- [ ] Output lengths are within limits?
- [ ] Browser page state preserved (not closed/navigated away)?
- [ ] New discoveries flagged in NOTE.md "待处理发现" section?
- [ ] Stopped after completing the single assigned task?

---

## 🔧 QUICK REFERENCE

### Smart-FS Tools
```
read_code_smart(file_path, start_line, end_line)
search_code_smart(file_path, query)
find_usage_smart(file_path, identifier, line)
apply_custom_transform(target_file, script_path)
```

### Browser Tools (Common)
```
set_breakpoint(urlRegex, lineNumber, columnNumber, condition)
get_scope_variables()
evaluate_script(script, savePath)
list_network_requests()
get_network_request(reqid)
take_snapshot()
```

### Coordinate Flow
```
Smart-FS [Src L:C] → set_breakpoint(lineNumber=L, columnNumber=C)
```
