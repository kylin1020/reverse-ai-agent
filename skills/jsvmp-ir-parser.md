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
    FormatDirective, DomainDirective, SourceDirective, UrlDirective,
    RegDirective, SectionDirective, ConstDirective, EntryDirective,
    TypeString, TypeNumber, TypeBoolean, TypeNull, TypeObject,
    HexAddress, KRef, VRef,
    QuotedString, BooleanLiteral, NumericLiteral,
    Equals, Comma, LParen, RParen, LBracket, RBracket,
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

Extension 使用简化的行解析（不需要完整 Chevrotain）：

```typescript
// 地址正则：匹配行首 0xHHHH:
const ADDRESS_REGEX = /^(0x[0-9A-Fa-f]+):/;

// 指令正则
const DIRECTIVE_REGEX = /^@(\w+)\s+(.+)/;

function parseVmasmLine(line: string, lineNum: number) {
    const trimmed = line.trim();
    
    // 跳过注释和空行
    if (!trimmed || trimmed.startsWith(';;')) return null;
    
    // 解析指令
    const dirMatch = trimmed.match(DIRECTIVE_REGEX);
    if (dirMatch) {
        return { type: 'directive', name: dirMatch[1], value: dirMatch[2] };
    }
    
    // 解析代码行
    const addrMatch = trimmed.match(ADDRESS_REGEX);
    if (addrMatch) {
        return { type: 'instruction', addr: parseInt(addrMatch[1], 16), line: lineNum };
    }
    
    return null;
}
```
