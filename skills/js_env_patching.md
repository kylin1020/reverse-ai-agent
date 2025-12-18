```markdown
# JavaScript Environment Patching Skill

> **Trigger**: `ReferenceError: document/window is not defined`, browser fingerprint checks, anti-bot detection loops.  
> **Goal**: Create a simulated browser environment in Node.js/Python to execute encrypted JS logic.  
> **Tools**: `Proxy` (Sniffing), `Happy-DOM` (Base Env), `Never-JScore` (High-Perf), `Pure JS` (Anti-Detect).

---

## 0. Strategy Selector

```
Which execution engine are you using?
  │
  ├─ Python (Never-JScore) ?
  │     └─ GOTO §3 (Native Polyfills)
  │
  └─ Node.js ?
        │
        ├─ Need complex DOM (canvas, forms, cookies)?
        │     └─ YES → GOTO §2 (Happy-DOM)
        │
        └─ High Security / Anti-Fingerprint / VM?
              └─ YES → GOTO §1 (Proxy Sniffing) → §4 (Pure JS Patching)
```

---

## 1. Proxy Sniffing (The "Detective")

**Goal**: Detect exactly what properties the obfuscated code is accessing, instead of guessing.

**Snippet (Inject at the top of the target script)**:
```javascript
const createProxy = (name, target = {}) => {
    return new Proxy(target, {
        get: (target, prop) => {
            if (prop === Symbol.toPrimitive) return undefined;
            // Return actual value if exists
            if (prop in target) return target[prop];
            
            console.log(`[MISSING] ${name}.${String(prop)}`);
            
            // Recursive proxy for nested objects (e.g., navigator.plugins[0])
            return createProxy(`${name}.${String(prop)}`);
        },
        set: (target, prop, value) => {
            console.log(`[SET] ${name}.${String(prop)} = ${value}`);
            target[prop] = value;
            return true;
        }
    });
};

// Mount detectives
global.window = createProxy('window', global);
global.document = createProxy('document');
global.navigator = createProxy('navigator');
global.location = createProxy('location');
global.localStorage = createProxy('localStorage');
```

**Action**: Run the script. If logs show `[MISSING] navigator.userAgent`, patch it specifically.

---

## 2. Lightweight Framework (Happy-DOM)

**Best for**: General purpose, fast, low memory. Better than JSDOM.

**Installation**: `npm install happy-dom`

**Template**:
```javascript
const { Window } = require('happy-dom');
const win = new Window({
    url: 'https://target-site.com',
    width: 1920, 
    height: 1080
});

// Sync globals
global.window = win;
global.document = win.document;
global.navigator = win.navigator;
global.location = win.location;
global.HTMLElement = win.HTMLElement;

// ⚠️ Overwrite dangerous defaults
Object.defineProperty(win.navigator, 'webdriver', { get: () => false });
```

---

## 3. Never-JScore Configuration

**Best for**: Python-native execution, high performance.

**Template**:
```python
import never_jscore

ctx = never_jscore.Context(enable_node_compat=True)

# Pre-inject environment before loading target code
ctx.evaluate("""
    // 1. Basic BOM
    var window = globalThis;
    var self = window;
    
    // 2. Navigator Patch
    var navigator = {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
        webdriver: false,
        platform: "Win32",
        language: "en-US",
        plugins: []
    };
    
    // 3. Location Patch
    var location = {
        href: "https://www.target.com/",
        origin: "https://www.target.com",
        protocol: "https:",
        host: "www.target.com"
    };
    
    // 4. Document Placeholder
    var document = {
        referrer: "",
        cookie: "",
        createElement: function(tag) { return { style: {} }; },
        getElementById: function(id) { return null; }
    };
""")
```

---

## 4. Pure JS & Anti-Detection (Advanced)

**Best for**: Bypassing sophisticated "bot" checks that detect JSDOM/Happy-DOM or verify `native code`.

### 4.1 The `toString` Hook (Native Emulation)
Obfuscated code checks if functions are native (return `[native code]`).

```javascript
(() => {
    const $toString = Function.prototype.toString;
    const _symbol = Symbol('native_guard');

    Function.prototype.toString = function() {
        // Return fake native string if marked
        if (this[_symbol]) {
            const name = this.name || 'anonymous';
            return `function ${name}() { [native code] }`;
        }
        // Prevent recursive detection of the hook itself
        if (this === Function.prototype.toString) {
            return 'function toString() { [native code] }';
        }
        return $toString.call(this);
    };

    // Helper to protect functions
    global.protect = (fn, name) => {
        Object.defineProperty(fn, 'name', { value: name });
        fn[_symbol] = true;
        return fn;
    };
})();

// Usage:
// window.alert = protect(() => {}, 'alert');
```

### 4.2 Prototype Chain Restoration
Checks like `div instanceof HTMLDivElement` fail on simple objects.

```javascript
class EventTarget {}
class Node extends EventTarget {}
class Element extends Node {}
class HTMLElement extends Element {}
class HTMLDivElement extends HTMLElement {}
class HTMLCanvasElement extends HTMLElement {}

global.HTMLDivElement = HTMLDivElement;
global.HTMLCanvasElement = HTMLCanvasElement;
```

---

## 5. Environment Cleanup (Node.js Hiding)

**Trigger**: Code checks `process.version` or `Buffer` to detect Node.js.

```javascript
const cleanEnv = () => {
    // Delete Node.js distinct markers
    delete global.process;
    delete global.Buffer;
    delete global.global;
    
    // Rename global to window completely
    global.window = global;
    
    // Mock requestAnimationFrame if missing
    if (!global.requestAnimationFrame) {
        global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
    }
};

// Execute immediately before target code
cleanEnv();
```

---

## 6. Troubleshooting

| Error | Fix |
|-------|-----|
| `TypeError: Cannot read property 'userAgent' of undefined` | `navigator` is missing. Add `global.navigator = {}`. |
| `SecurityError: localStorage access denied` | Use `Happy-DOM` or mock `localStorage` object with `getItem/setItem`. |
| `Proxy` logs show infinite recursion | Code is traversing the prototype chain. Return `null` for `Symbol` props in Proxy. |
| `ReferenceError: document` inside a function | Ensure `document` is attached to `global` (Node) or `globalThis` (Never-JScore). |
```