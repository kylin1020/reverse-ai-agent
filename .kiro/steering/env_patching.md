---
inclusion: manual
---

# JS Environment Patching

Emulate browser APIs in Node.js to run extracted JS code.

**Core Principle**: NEVER blind-patch. Always trace first, patch only what's accessed.

## ⚠️ CRITICAL: Proxy-First Workflow

**禁止盲补环境！** 直接补大量环境属性是错误做法：
- 不知道原 JS 实际访问了哪些属性
- 无法针对性优化，浪费资源
- 可能引入不必要的检测点

**正确流程**：先用 Proxy 追踪 → 分析访问日志 → 只补缺失的

## When to Use

- Target algorithm requires browser globals (`window`, `document`, `navigator`)
- Pure Python reproduction is blocked by complex browser dependencies
- Code uses DOM APIs, Canvas, or Web Crypto

## Prerequisites

Before patching, verify:
1. Entry point located via stack trace (not grep)
2. Code deobfuscated if contains `_0x`, `\x` patterns
3. Dependencies identified via closure analysis
4. Extracted code runs but fails only on browser APIs (no ReferenceErrors)

## Pipeline

```
LOCATE → EXTRACT → TRACE → ANALYZE → PATCH → VERIFY
                    ↑
              Proxy追踪是核心！
```

## Phase 1: Locate Entry Point

Hook network calls to find param generation:

```javascript
// Inject via evaluate_script
(function() {
    const TARGET = 'signature';
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        if (body?.includes(TARGET)) {
            console.log("### TRAP ###");
            console.trace();
        }
        return _send.apply(this, arguments);
    };
})();
```

### evaluate_script Tips

`evaluate_script` works like DevTools Console. Just type a function name to see its declaration and source location:

```javascript
myFunction
// Response:
// function _0x1b01d3(){var _0xfd6122=_0x86a7ea,...}
// 📍 VM24:1:37477
```

Invaluable for locating function definitions without grepping minified code.

## Phase 2: Extract Code

1. Identify free variables (used but not defined locally)
2. Trace definitions in parent scopes
3. Extract with Babel Generator
4. Test: `node extracted.js` should fail only on browser APIs

## Phase 3: Proxy Tracing (核心步骤)

**这是最重要的步骤！** 用递归 Proxy 追踪所有属性访问：

### 3.1 完整的追踪 Proxy

```javascript
// env_tracer.js - 环境追踪器
const accessLog = [];
const callLog = [];

function createTracingProxy(name, realValue = undefined) {
    const handler = {
        get(target, prop, receiver) {
            const path = `${name}.${String(prop)}`;
            
            // 跳过内部符号
            if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
            if (prop === 'then') return undefined; // 避免 Promise 检测
            
            // 记录访问
            accessLog.push({ type: 'get', path, timestamp: Date.now() });
            
            // 如果有真实值，返回真实值的代理
            if (realValue !== undefined && prop in realValue) {
                const val = realValue[prop];
                if (typeof val === 'object' && val !== null) {
                    return createTracingProxy(path, val);
                }
                if (typeof val === 'function') {
                    return createTracingFunction(path, val);
                }
                return val;
            }
            
            // 返回新的代理继续追踪
            return createTracingProxy(path);
        },
        
        set(target, prop, value) {
            const path = `${name}.${String(prop)}`;
            accessLog.push({ type: 'set', path, value: typeof value, timestamp: Date.now() });
            return true;
        },
        
        has(target, prop) {
            const path = `${name}.${String(prop)}`;
            accessLog.push({ type: 'has', path, timestamp: Date.now() });
            return true; // 假装都有，继续追踪
        },
        
        apply(target, thisArg, args) {
            callLog.push({ path: name, args: args.map(a => typeof a), timestamp: Date.now() });
            return createTracingProxy(`${name}()`);
        },
        
        construct(target, args) {
            callLog.push({ path: `new ${name}`, args: args.map(a => typeof a), timestamp: Date.now() });
            return createTracingProxy(`new ${name}`);
        }
    };
    
    return new Proxy(function() {}, handler);
}

function createTracingFunction(name, realFn) {
    return new Proxy(realFn, {
        apply(target, thisArg, args) {
            callLog.push({ path: name, args: args.map(a => typeof a), timestamp: Date.now() });
            try {
                return Reflect.apply(target, thisArg, args);
            } catch (e) {
                accessLog.push({ type: 'error', path: name, error: e.message });
                return createTracingProxy(`${name}()`);
            }
        }
    });
}

// 设置全局追踪
global.window = createTracingProxy('window');
global.document = createTracingProxy('document');
global.navigator = createTracingProxy('navigator');
global.location = createTracingProxy('location');
global.screen = createTracingProxy('screen');
global.self = global.window;

// 退出时输出报告
process.on('exit', () => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ENVIRONMENT ACCESS REPORT');
    console.log('='.repeat(60));
    
    // 去重并分类
    const gets = [...new Set(accessLog.filter(l => l.type === 'get').map(l => l.path))].sort();
    const sets = [...new Set(accessLog.filter(l => l.type === 'set').map(l => l.path))].sort();
    const has = [...new Set(accessLog.filter(l => l.type === 'has').map(l => l.path))].sort();
    const calls = [...new Set(callLog.map(l => l.path))].sort();
    
    console.log(`\n📖 GET (${gets.length} unique):`);
    gets.forEach(p => console.log(`  ${p}`));
    
    console.log(`\n✏️ SET (${sets.length} unique):`);
    sets.forEach(p => console.log(`  ${p}`));
    
    console.log(`\n❓ HAS/IN (${has.length} unique):`);
    has.forEach(p => console.log(`  ${p}`));
    
    console.log(`\n📞 CALLS (${calls.length} unique):`);
    calls.forEach(p => console.log(`  ${p}`));
    
    // 输出可直接使用的补丁清单
    console.log('\n' + '='.repeat(60));
    console.log('📝 PATCH CHECKLIST (copy to env.js):');
    console.log('='.repeat(60));
    const allPaths = [...new Set([...gets, ...sets, ...has])];
    const grouped = {};
    allPaths.forEach(p => {
        const root = p.split('.')[0];
        if (!grouped[root]) grouped[root] = [];
        grouped[root].push(p);
    });
    Object.entries(grouped).forEach(([root, paths]) => {
        console.log(`\n// ${root}:`);
        paths.forEach(p => console.log(`// - ${p}`));
    });
});

module.exports = { accessLog, callLog };
```

### 3.2 使用追踪器

```bash
# 运行追踪
node -r ./lib/env_tracer.js ./source/target.js

# 输出示例:
# 📊 ENVIRONMENT ACCESS REPORT
# ============================================================
# 📖 GET (23 unique):
#   navigator.userAgent
#   navigator.platform
#   document.createElement
#   window.innerWidth
#   ...
```

### 3.3 分析追踪结果

追踪完成后，你会得到：
1. **实际访问的属性列表** - 只补这些
2. **调用的函数列表** - 需要实现的方法
3. **属性检测 (has/in)** - 可能是反检测点

## Phase 4: Targeted Patching

**只补追踪到的属性！** 按优先级分层：

| Level | 触发条件 | 补丁策略 |
|-------|----------|----------|
| L0 | 追踪到 GET | 返回合理值 |
| L1 | 追踪到 CALL | 实现函数逻辑 |
| L2 | 追踪到 HAS | 确保属性存在 |
| L3 | 追踪到 SET | 允许写入 |

### L0: 简单属性 (从追踪结果生成)

```javascript
// 只补追踪到的属性！
// 来自追踪: navigator.userAgent, navigator.platform
global.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
    platform: 'Win32'
    // 不要补没追踪到的属性！
};
```

### L1: 函数调用

```javascript
// 来自追踪: document.createElement
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html>');
global.document = {
    createElement: dom.window.document.createElement.bind(dom.window.document)
    // 只暴露追踪到的方法
};
```

### L2: 属性检测 (反检测)

```javascript
// 来自追踪: 'webdriver' in navigator
Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
    configurable: true
});
```

### L3: Native 伪装 (仅在检测到时使用)

```javascript
// 只有追踪到 toString 调用时才需要
const makeNative = (fn, name) => {
    Object.defineProperty(fn, 'toString', {
        value: () => `function ${name}() { [native code] }`
    });
    return fn;
};
```

## Phase 5: Iterative Refinement

补丁是迭代过程：

```
追踪 → 补丁 → 再追踪 → 补漏 → 验证
  ↑__________________________|
```

每次补丁后重新追踪，直到：
1. 无新的未定义访问
2. 输出与浏览器一致

## Verification

Success criteria:
- Node output matches browser output byte-for-byte
- Works with fresh inputs, not just captured values
- No `undefined` or `NaN` in output
- **追踪报告显示所有访问都已处理**

## Status Report

When blocked:

```
📊 ENV PATCH STATUS:
- Phase: [Location|Extraction|Tracing|Patching|Verification]
- Traced APIs: [list from tracer]
- Patched: [x/y APIs]
- Missing: [unpatched APIs]
- Blocker: [specific issue]
- Options: A) ... B) ...
```

## File Structure

```
artifacts/jsrev/{domain}/
├── lib/
│   ├── env_tracer.js   # Proxy追踪器 (先用这个！)
│   ├── env.js          # 最终环境补丁 (基于追踪结果)
│   └── sign.js         # 提取的签名逻辑
├── tests/
│   ├── trace_test.js   # 追踪测试
│   └── env_test.js     # 补丁验证
├── logs/
│   └── access_log.json # 追踪日志
└── output/             # 提取/修改的代码
```

## Anti-Pattern: 盲补环境 ❌

```javascript
// ❌ 错误做法：不知道需要什么就全补
global.navigator = {
    userAgent: '...',
    platform: '...',
    language: '...',
    languages: [...],
    cookieEnabled: true,
    // ... 100+ 属性
};

// ✅ 正确做法：只补追踪到的
// 追踪结果: navigator.userAgent, navigator.platform
global.navigator = {
    userAgent: '...',
    platform: '...'
};
```
