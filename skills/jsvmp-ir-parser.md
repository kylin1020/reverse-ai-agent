# JSVMP IR Parser Specification (Chevrotain)

> **MANDATORY**: Use Chevrotain for ALL IR parsing. NEVER use regex.
> **Install**: `npm install chevrotain`

## LIR 文件格式 (`.vmasm`)

```vmasm
;; ==========================================
;; HEADER SECTION
;; ==========================================
@format v1.1
@domain target-website.com
@source source/main.js
@url https://example.com/api/*.js
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=k

;; ==========================================
;; INJECTION POINTS (用于 VSCode Extension 自动设置断点)
;; ==========================================
@dispatcher line=2, column=131618
@global_bytecode var=Z, line=2, column=91578
@loop_entry line=2, column=131029
@breakpoint line=2, column=131639

;; ==========================================
;; CONSTANTS SECTION
;; ==========================================
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)
@const K[2] = Boolean(true)
@const K[3] = Null

;; ==========================================
;; CODE SECTION
;; ==========================================
@section code
@entry 0x0000

0x0000: PUSH_CONST         K[0]            ; "signature"
0x0005: GET_GLOBAL                         ; window
0x000A: CALL               2               ; fn(arg1, arg2)
0x000F: RET                                ; return
```

### Header 指令

| 指令 | 必需 | 说明 |
|------|------|------|
| `@format` | 是 | 格式版本，当前 `v1.1` |
| `@domain` | 是 | 目标网站域名 |
| `@source` | 否 | 原始 JS 文件相对路径（用于调试） |
| `@url` | 否 | 浏览器拦截匹配的 URL 模式 |
| `@reg` | 是 | VM 寄存器映射 |

### 注入点指令 (Injection Points)

| 指令 | 必需 | 说明 |
|------|------|------|
| `@dispatcher` | 否 | VM 调度器循环位置，格式: `line=N, column=N` |
| `@global_bytecode` | 否 | 全局字节码数组定义，格式: `var=NAME, line=N, column=N` |
| `@loop_entry` | 否 | dispatcher 循环体的第一行，格式: `line=N, column=N` |
| `@breakpoint` | 否 | 推荐的断点位置 (opcode 读取后)，格式: `line=N, column=N` |

**注入点用途**:
- `@dispatcher`: 设置条件断点的位置
- `@global_bytecode`: 用于计算 bytecode offset
- `@loop_entry`: 注入 offset 计算代码的位置（在循环体内，确保 bytecode 已赋值）
- `@breakpoint`: 附加到 `@dispatcher`，表示循环内的最佳断点位置
- `line`/`column`: 原始压缩 JS 的源码位置 (用于 CDP 断点)

### 地址映射

**不需要外部 `.vmap` 文件**。地址直接内嵌在每行开头 `0xHHHH:`，解析时构建双向映射：
- 行号 → 地址
- 地址 → 行号

---

## Token 定义

```javascript
const { createToken, Lexer } = require("chevrotain");

// 基础
const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /[ \t]+/, group: Lexer.SKIPPED });
const NewLine = createToken({ name: "NewLine", pattern: /\r?\n/ });
const LineComment = createToken({ name: "LineComment", pattern: /;[^\n]*/, group: Lexer.SKIPPED });

// 指令
const FormatDirective = createToken({ name: "FormatDirective", pattern: /@format/ });
const DomainDirective = createToken({ name: "DomainDirective", pattern: /@domain/ });
const SourceDirective = createToken({ name: "SourceDirective", pattern: /@source/ });
const UrlDirective = createToken({ name: "UrlDirective", pattern: /@url/ });
const RegDirective = createToken({ name: "RegDirective", pattern: /@reg/ });
const SectionDirective = createToken({ name: "SectionDirective", pattern: /@section/ });
const ConstDirective = createToken({ name: "ConstDirective", pattern: /@const/ });
const EntryDirective = createToken({ name: "EntryDirective", pattern: /@entry/ });

// 注入点指令
const DispatcherDirective = createToken({ name: "DispatcherDirective", pattern: /@dispatcher/ });
const GlobalBytecodeDirective = createToken({ name: "GlobalBytecodeDirective", pattern: /@global_bytecode/ });
const LoopEntryDirective = createToken({ name: "LoopEntryDirective", pattern: /@loop_entry/ });
const BreakpointDirective = createToken({ name: "BreakpointDirective", pattern: /@breakpoint/ });

// 类型
const TypeString = createToken({ name: "TypeString", pattern: /String/ });
const TypeNumber = createToken({ name: "TypeNumber", pattern: /Number/ });
const TypeBoolean = createToken({ name: "TypeBoolean", pattern: /Boolean/ });
const TypeNull = createToken({ name: "TypeNull", pattern: /Null/ });
const TypeObject = createToken({ name: "TypeObject", pattern: /Object/ });

// 地址与引用
const HexAddress = createToken({ name: "HexAddress", pattern: /0x[0-9A-Fa-f]+:?/ });
const KRef = createToken({ name: "KRef", pattern: /K\[\d+\]/ });
const VRef = createToken({ name: "VRef", pattern: /v\[\d+\]/ });

// 字面量
const QuotedString = createToken({ name: "QuotedString", pattern: /"(?:[^\\"]|\\.)*"/ });
const NumericLiteral = createToken({ name: "NumericLiteral", pattern: /-?\d+(?:\.\d+)?/ });
const BooleanLiteral = createToken({ name: "BooleanLiteral", pattern: /true|false/ });

// 操作符
const Equals = createToken({ name: "Equals", pattern: /=/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const LBracket = createToken({ name: "LBracket", pattern: /\[/ });
const RBracket = createToken({ name: "RBracket", pattern: /\]/ });

// 标识符（最后匹配）
const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z_$][a-zA-Z0-9_$\-\.\/\*:]+/ });

const lirTokens = [
    WhiteSpace, NewLine, LineComment,
    // 注入点指令（长的优先）
    GlobalBytecodeDirective, LoopEntryDirective, BreakpointDirective, DispatcherDirective,
    // Header 指令
    FormatDirective, DomainDirective, SourceDirective, UrlDirective,
    RegDirective, SectionDirective, ConstDirective, EntryDirective,
    // 类型
    TypeString, TypeNumber, TypeBoolean, TypeNull, TypeObject,
    // 地址与引用
    HexAddress, KRef, VRef,
    // 字面量
    QuotedString, BooleanLiteral, NumericLiteral,
    // 操作符
    Equals, Comma, LParen, RParen, LBracket, RBracket,
    // 标识符（最后）
    Identifier
];

module.exports = { lirTokens, tokens: { /* all tokens */ } };
```

---

## LIR Parser

```javascript
const { CstParser, Lexer } = require("chevrotain");
const { lirTokens, tokens } = require("./tokens");

class LirParser extends CstParser {
    constructor() {
        super(lirTokens);
        const $ = this;

        // 顶层: Header + Constants + Code
        $.RULE("program", () => {
            $.SUBRULE($.headerSection);
            $.SUBRULE($.constantsSection);
            $.SUBRULE($.codeSection);
        });

        // Header
        $.RULE("headerSection", () => {
            $.OPTION(() => $.SUBRULE($.formatDecl));
            $.OPTION2(() => $.SUBRULE($.domainDecl));
            $.OPTION3(() => $.SUBRULE($.sourceDecl));
            $.OPTION4(() => $.SUBRULE($.urlDecl));
            $.SUBRULE($.regDecl);
        });

        $.RULE("formatDecl", () => {
            $.CONSUME(tokens.FormatDirective);
            $.CONSUME(tokens.Identifier);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("domainDecl", () => {
            $.CONSUME(tokens.DomainDirective);
            $.CONSUME(tokens.Identifier);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("sourceDecl", () => {
            $.CONSUME(tokens.SourceDirective);
            $.CONSUME(tokens.Identifier); // path
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("urlDecl", () => {
            $.CONSUME(tokens.UrlDirective);
            $.CONSUME(tokens.Identifier); // URL pattern
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("regDecl", () => {
            $.CONSUME(tokens.RegDirective);
            $.AT_LEAST_ONE_SEP({ SEP: tokens.Comma, DEF: () => $.SUBRULE($.regMapping) });
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("regMapping", () => {
            $.CONSUME(tokens.Identifier);  // role: ip, sp, stack...
            $.CONSUME(tokens.Equals);
            $.CONSUME2(tokens.Identifier); // actual var name
        });

        // Constants
        $.RULE("constantsSection", () => {
            $.CONSUME(tokens.SectionDirective);
            $.CONSUME(tokens.Identifier); // "constants"
            $.CONSUME(tokens.NewLine);
            $.MANY(() => $.SUBRULE($.constDecl));
        });

        $.RULE("constDecl", () => {
            $.CONSUME(tokens.ConstDirective);
            $.CONSUME(tokens.KRef);
            $.CONSUME(tokens.Equals);
            $.SUBRULE($.typedValue);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("typedValue", () => {
            $.OR([
                { ALT: () => { $.CONSUME(tokens.TypeString); $.CONSUME(tokens.LParen); $.CONSUME(tokens.QuotedString); $.CONSUME(tokens.RParen); }},
                { ALT: () => { $.CONSUME2(tokens.TypeNumber); $.CONSUME2(tokens.LParen); $.CONSUME(tokens.NumericLiteral); $.CONSUME2(tokens.RParen); }},
                { ALT: () => { $.CONSUME(tokens.TypeBoolean); $.CONSUME3(tokens.LParen); $.CONSUME(tokens.BooleanLiteral); $.CONSUME3(tokens.RParen); }},
                { ALT: () => $.CONSUME(tokens.TypeNull) },
                { ALT: () => { $.CONSUME(tokens.TypeObject); $.CONSUME4(tokens.LParen); $.CONSUME2(tokens.QuotedString); $.CONSUME4(tokens.RParen); }}
            ]);
        });

        // Code
        $.RULE("codeSection", () => {
            $.CONSUME(tokens.SectionDirective);
            $.CONSUME(tokens.Identifier); // "code"
            $.CONSUME(tokens.NewLine);
            $.OPTION(() => $.SUBRULE($.entryDecl));
            $.MANY(() => $.SUBRULE($.instruction));
        });

        $.RULE("entryDecl", () => {
            $.CONSUME(tokens.EntryDirective);
            $.CONSUME(tokens.HexAddress);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("instruction", () => {
            $.CONSUME(tokens.HexAddress);
            $.CONSUME(tokens.Identifier); // opcode
            $.MANY(() => $.SUBRULE($.operand));
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("operand", () => $.OR([
            { ALT: () => $.CONSUME(tokens.KRef) },
            { ALT: () => $.CONSUME(tokens.VRef) },
            { ALT: () => $.CONSUME(tokens.HexAddress) },
            { ALT: () => $.CONSUME(tokens.NumericLiteral) },
            { ALT: () => $.CONSUME(tokens.QuotedString) },
            { ALT: () => $.CONSUME(tokens.Identifier) }
        ]));

        this.performSelfAnalysis();
    }
}

module.exports = { LirParser };
```

---

## AST Visitor

```javascript
class LirVisitor extends LirParser.getBaseCstVisitorConstructor() {
    constructor() {
        super();
        this.validateVisitor();
    }

    program(ctx) {
        return {
            header: this.visit(ctx.headerSection),
            constants: this.visit(ctx.constantsSection),
            code: this.visit(ctx.codeSection)
        };
    }

    headerSection(ctx) {
        const regs = {};
        if (ctx.regDecl) {
            for (const m of this.visit(ctx.regDecl)) {
                regs[m.role] = m.name;
            }
        }
        return {
            format: ctx.formatDecl?.[0]?.children.Identifier[0].image,
            domain: ctx.domainDecl?.[0]?.children.Identifier[0].image,
            source: ctx.sourceDecl?.[0]?.children.Identifier[0].image,
            url: ctx.urlDecl?.[0]?.children.Identifier[0].image,
            registers: regs
        };
    }

    // ... 其他 visitor 方法
}
```

---

## 解析结果 AST

```javascript
{
    header: {
        format: "v1.1",
        domain: "douyin.com",
        source: "source/bdms.js",
        url: "https://*.douyin.com/*/bdms.js",
        registers: { ip: "a", sp: "p", stack: "v", bc: "o", storage: "l", const: "Z" }
    },
    // 注入点元数据
    injectionPoints: {
        dispatcher: { location: { line: 2, column: 131618 }, breakpoint: { line: 2, column: 131639 } },
        globalBytecode: { variable: "Z", location: { line: 2, column: 91578 } },
        loopEntry: { location: { line: 2, column: 131029 } }
    },
    constants: [
        { index: 0, type: "String", value: "signature" },
        { index: 1, type: "Number", value: 1024 }
    ],
    code: {
        entry: 0,
        instructions: [
            { addr: 0x0000, opcode: "PUSH_CONST", operands: [{ type: "const", ref: "K[0]" }] },
            { addr: 0x0005, opcode: "GET_GLOBAL", operands: [] }
        ]
    }
}
```

---

## VSCode Extension 集成

```typescript
import { mapManager } from './utils/map-manager';

const cache = mapManager.parseVmasm('/path/to/file.vmasm');
const metadata = mapManager.getMetadata('/path/to/file.vmasm');
const addr = mapManager.getAddressFromLine('/path/to/file.vmasm', lineNumber);
const regs = mapManager.getRegisterMapping('/path/to/file.vmasm');
```

---

## 在 lib/*.js 中使用

```javascript
// 需要先编译: cd jsvmp-ir-extension && npm run compile
const { VmasmLexer } = require('../../jsvmp-ir-extension/out/utils/vmasm-lexer');
const { vmasmParser } = require('../../jsvmp-ir-extension/out/utils/vmasm-parser');
const { vmasmVisitor } = require('../../jsvmp-ir-extension/out/utils/vmasm-visitor');

function parseVmasmFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lexResult = VmasmLexer.tokenize(content);
    vmasmParser.input = lexResult.tokens;
    return vmasmVisitor.visit(vmasmParser.program());
}

// 返回 VmasmAST:
// { format, domain, registers, dispatcher?, constants[], instructions[], lineToAddr, addrToLine }
```

### AST 关键字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `instructions[].addr` | number | 字节码地址 (十六进制) |
| `instructions[].opcode` | string | 操作码 |
| `instructions[].operands` | string[] | 操作数列表 |
| `instructions[].lineNumber` | number | IR 文件行号 |
| `constants[].index` | number | K[index] |
| `constants[].type` | string | String/Number/Boolean/Null |
| `constants[].value` | any | 常量值 |
| `lineToAddr` | Map | IR 行号 → 字节码地址 |
| `addrToLine` | Map | 字节码地址 → IR 行号 |
