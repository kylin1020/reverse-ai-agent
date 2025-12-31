# JSVMP IR Parser Specification (Chevrotain) v1.1

> **MANDATORY**: Use Chevrotain for ALL IR parsing. NEVER use regex.
> **Install**: `npm install chevrotain`
> **Version**: 1.1 - 自包含 LIR 格式，内嵌常量池和寄存器映射

## 核心变更 (v1.1)

| 特性 | v1.0 | v1.1 |
|------|------|------|
| 常量池 | 外部 JSON | 内嵌 `@section constants` |
| 寄存器映射 | 硬编码 | `@reg` 头部声明 |
| 地址格式 | 十进制 | 十六进制 (`0x0000`) |
| 文件结构 | 单一指令段 | Header + Constants + Code |

## 文件结构

```
lib/ir_parser/
├── tokens.js      # 共享 Token 定义 (v1.1 更新)
├── lir_parser.js  # LIR 解析器 (三段式结构)
├── mir_parser.js  # MIR 解析器
├── hir_parser.js  # HIR 解析器
└── index.js       # 统一入口
```

---

## 1. LIR 文件结构 (`.vmasm` v1.1)

```vmasm
;; ==========================================
;; 1. HEADER SECTION (寄存器与元数据)
;; ==========================================
@format v1.1
@domain target-website.com
@reg ip=a, sp=p, stack=v, bc=o, storage=l, const=k

;; ==========================================
;; 2. CONSTANTS SECTION (常量池声明)
;; 格式: @const K[索引] = 类型(值)
;; ==========================================
@section constants
@const K[0] = String("signature")
@const K[1] = Number(1024)
@const K[2] = Boolean(true)
@const K[3] = Null

;; ==========================================
;; 3. CODE SECTION (反汇编指令)
;; ==========================================
@section code
@entry 0x0000

0x0000: PUSH_CONST K[0]    ; "signature"    [sp:1 | K[0]]
0x0005: GET_GLOBAL         ; window         [sp:2 | K[0], <Global>]
0x000A: CALL 2             ;                [sp:1 | <result>]
0x000F: RET                ;                [sp:0 |]
```

---

## 2. Token 定义 (tokens.js) - v1.1 更新

```javascript
const { createToken, Lexer } = require("chevrotain");

// ==========================================
// 1. 基础 Token
// ==========================================
const WhiteSpace = createToken({ 
    name: "WhiteSpace", 
    pattern: /[ \t]+/, 
    group: Lexer.SKIPPED 
});

const NewLine = createToken({ 
    name: "NewLine", 
    pattern: /\r?\n/ 
});

const LineComment = createToken({ 
    name: "LineComment", 
    pattern: /;[^\n]*/, 
    group: Lexer.SKIPPED 
});

// ==========================================
// 2. 指令关键字 (v1.1 新增)
// ==========================================
const FormatDirective = createToken({ 
    name: "FormatDirective", 
    pattern: /@format/ 
});

const DomainDirective = createToken({ 
    name: "DomainDirective", 
    pattern: /@domain/ 
});

const RegDirective = createToken({ 
    name: "RegDirective", 
    pattern: /@reg/ 
});

const SectionDirective = createToken({ 
    name: "SectionDirective", 
    pattern: /@section/ 
});

const ConstDirective = createToken({ 
    name: "ConstDirective", 
    pattern: /@const/ 
});

const EntryDirective = createToken({ 
    name: "EntryDirective", 
    pattern: /@entry/ 
});

// ==========================================
// 3. 类型构造器 (v1.1 新增)
// ==========================================
const TypeString = createToken({ 
    name: "TypeString", 
    pattern: /String/ 
});

const TypeNumber = createToken({ 
    name: "TypeNumber", 
    pattern: /Number/ 
});

const TypeBoolean = createToken({ 
    name: "TypeBoolean", 
    pattern: /Boolean/ 
});

const TypeNull = createToken({ 
    name: "TypeNull", 
    pattern: /Null/ 
});

const TypeObject = createToken({ 
    name: "TypeObject", 
    pattern: /Object/ 
});

// ==========================================
// 4. 地址与引用
// ==========================================
const HexAddress = createToken({ 
    name: "HexAddress", 
    pattern: /0x[0-9A-Fa-f]+:?/ 
});

const KRef = createToken({ 
    name: "KRef", 
    pattern: /K\[\d+\]/ 
});

const VRef = createToken({ 
    name: "VRef", 
    pattern: /v\[\d+\]/ 
});

// ==========================================
// 5. 字面量
// ==========================================
const QuotedString = createToken({ 
    name: "QuotedString", 
    pattern: /"(?:[^\\"]|\\.)*"/ 
});

const NumericLiteral = createToken({ 
    name: "NumericLiteral", 
    pattern: /-?\d+(?:\.\d+)?/ 
});

const BooleanLiteral = createToken({ 
    name: "BooleanLiteral", 
    pattern: /true|false/ 
});

// ==========================================
// 6. 标识符与操作符
// ==========================================
const Identifier = createToken({ 
    name: "Identifier", 
    pattern: /[a-zA-Z_$][a-zA-Z0-9_$]*/ 
});

const Equals = createToken({ name: "Equals", pattern: /=/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const LBracket = createToken({ name: "LBracket", pattern: /\[/ });
const RBracket = createToken({ name: "RBracket", pattern: /\]/ });
const Colon = createToken({ name: "Colon", pattern: /:/ });

// ==========================================
// 7. MIR/HIR 专用 Token
// ==========================================
const BBLabel = createToken({ 
    name: "BBLabel", 
    pattern: /BB\d+/ 
});

const SpAnnotation = createToken({ 
    name: "SpAnnotation", 
    pattern: /\[sp:\d+→\d+\]/ 
});

const TempVar = createToken({ 
    name: "TempVar", 
    pattern: /t\d+/ 
});

const Arrow = createToken({ 
    name: "Arrow", 
    pattern: /->/ 
});

// ==========================================
// Token 导出 (按优先级排序)
// ==========================================
const lirTokens = [
    WhiteSpace, NewLine, LineComment,
    // 指令 (长匹配优先)
    FormatDirective, DomainDirective, RegDirective, 
    SectionDirective, ConstDirective, EntryDirective,
    // 类型
    TypeString, TypeNumber, TypeBoolean, TypeNull, TypeObject,
    // 地址与引用
    HexAddress, KRef, VRef,
    // 字面量
    QuotedString, BooleanLiteral, NumericLiteral,
    // 操作符
    Equals, Comma, LParen, RParen, LBracket, RBracket, Colon,
    // 标识符 (最后)
    Identifier
];

const mirTokens = [
    WhiteSpace, NewLine, LineComment,
    HexAddress, BBLabel, SpAnnotation, TempVar, KRef, VRef,
    QuotedString, BooleanLiteral, NumericLiteral,
    Arrow, Equals, Comma, LParen, RParen, LBracket, RBracket, Colon,
    Identifier
];

const hirTokens = [
    ...mirTokens
    // HIR 复用 MIR Token，可按需扩展
];

module.exports = {
    lirTokens,
    mirTokens,
    hirTokens,
    tokens: {
        WhiteSpace, NewLine, LineComment,
        FormatDirective, DomainDirective, RegDirective,
        SectionDirective, ConstDirective, EntryDirective,
        TypeString, TypeNumber, TypeBoolean, TypeNull, TypeObject,
        HexAddress, KRef, VRef, BBLabel, SpAnnotation, TempVar,
        QuotedString, BooleanLiteral, NumericLiteral,
        Arrow, Equals, Comma, LParen, RParen, LBracket, RBracket, Colon,
        Identifier
    }
};
```

---

## 3. LIR Parser (lir_parser.js) - v1.1 三段式结构

```javascript
const { CstParser, Lexer } = require("chevrotain");
const { lirTokens, tokens } = require("./tokens");

const LirLexer = new Lexer(lirTokens);

class LirParser extends CstParser {
    constructor() {
        super(lirTokens);
        const $ = this;

        // ==========================================
        // 顶层规则: 三段式结构
        // ==========================================
        $.RULE("program", () => {
            $.SUBRULE($.headerSection);
            $.SUBRULE($.constantsSection);
            $.SUBRULE($.codeSection);
        });

        // ==========================================
        // 1. HEADER SECTION
        // ==========================================
        $.RULE("headerSection", () => {
            $.OPTION(() => $.SUBRULE($.formatDecl));
            $.OPTION2(() => $.SUBRULE($.domainDecl));
            $.SUBRULE($.regDecl);
        });

        $.RULE("formatDecl", () => {
            $.CONSUME(tokens.FormatDirective);
            $.CONSUME(tokens.Identifier); // v1.1
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("domainDecl", () => {
            $.CONSUME(tokens.DomainDirective);
            $.CONSUME(tokens.Identifier); // domain name
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("regDecl", () => {
            $.CONSUME(tokens.RegDirective);
            $.AT_LEAST_ONE_SEP({
                SEP: tokens.Comma,
                DEF: () => $.SUBRULE($.regMapping)
            });
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("regMapping", () => {
            $.CONSUME(tokens.Identifier); // ip, sp, stack, bc, storage, const
            $.CONSUME(tokens.Equals);
            $.CONSUME2(tokens.Identifier); // actual variable name
        });

        // ==========================================
        // 2. CONSTANTS SECTION
        // ==========================================
        $.RULE("constantsSection", () => {
            $.CONSUME(tokens.SectionDirective);
            $.CONSUME(tokens.Identifier); // "constants"
            $.CONSUME(tokens.NewLine);
            $.MANY(() => $.SUBRULE($.constDecl));
        });

        $.RULE("constDecl", () => {
            $.CONSUME(tokens.ConstDirective);
            $.CONSUME(tokens.KRef);       // K[0]
            $.CONSUME(tokens.Equals);
            $.SUBRULE($.typedValue);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("typedValue", () => {
            $.OR([
                { ALT: () => {
                    $.CONSUME(tokens.TypeString);
                    $.CONSUME(tokens.LParen);
                    $.CONSUME(tokens.QuotedString);
                    $.CONSUME(tokens.RParen);
                }},
                { ALT: () => {
                    $.CONSUME2(tokens.TypeNumber);
                    $.CONSUME2(tokens.LParen);
                    $.CONSUME(tokens.NumericLiteral);
                    $.CONSUME2(tokens.RParen);
                }},
                { ALT: () => {
                    $.CONSUME(tokens.TypeBoolean);
                    $.CONSUME3(tokens.LParen);
                    $.CONSUME(tokens.BooleanLiteral);
                    $.CONSUME3(tokens.RParen);
                }},
                { ALT: () => $.CONSUME(tokens.TypeNull) },
                { ALT: () => {
                    $.CONSUME(tokens.TypeObject);
                    $.CONSUME4(tokens.LParen);
                    $.CONSUME2(tokens.QuotedString); // JSON string
                    $.CONSUME4(tokens.RParen);
                }}
            ]);
        });

        // ==========================================
        // 3. CODE SECTION
        // ==========================================
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
            $.CONSUME(tokens.HexAddress);  // 0x0000:
            $.CONSUME(tokens.Identifier);  // OPCODE
            $.MANY(() => $.SUBRULE($.operand));
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("operand", () => $.OR([
            { ALT: () => $.CONSUME(tokens.KRef) },      // K[0]
            { ALT: () => $.CONSUME(tokens.VRef) },      // v[1]
            { ALT: () => $.CONSUME(tokens.NumericLiteral) },
            { ALT: () => $.CONSUME(tokens.QuotedString) },
            { ALT: () => $.CONSUME(tokens.Identifier) }
        ]));

        this.performSelfAnalysis();
    }
}

// ==========================================
// Visitor: CST → AST
// ==========================================
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
            const mappings = this.visit(ctx.regDecl);
            for (const m of mappings) {
                regs[m.role] = m.name;
            }
        }
        return {
            format: ctx.formatDecl ? ctx.formatDecl[0].children.Identifier[0].image : null,
            domain: ctx.domainDecl ? ctx.domainDecl[0].children.Identifier[0].image : null,
            registers: regs
        };
    }

    regDecl(ctx) {
        return ctx.regMapping.map(m => this.visit(m));
    }

    regMapping(ctx) {
        return {
            role: ctx.Identifier[0].image,
            name: ctx.Identifier[1].image
        };
    }

    constantsSection(ctx) {
        return (ctx.constDecl || []).map(c => this.visit(c));
    }

    constDecl(ctx) {
        const kref = ctx.KRef[0].image;
        const index = parseInt(kref.match(/\d+/)[0]);
        const typed = this.visit(ctx.typedValue);
        return { index, ...typed };
    }

    typedValue(ctx) {
        if (ctx.TypeString) {
            return { type: "String", value: JSON.parse(ctx.QuotedString[0].image) };
        }
        if (ctx.TypeNumber) {
            return { type: "Number", value: parseFloat(ctx.NumericLiteral[0].image) };
        }
        if (ctx.TypeBoolean) {
            return { type: "Boolean", value: ctx.BooleanLiteral[0].image === "true" };
        }
        if (ctx.TypeNull) {
            return { type: "Null", value: null };
        }
        if (ctx.TypeObject) {
            return { type: "Object", value: JSON.parse(ctx.QuotedString[0].image) };
        }
    }

    codeSection(ctx) {
        return {
            entry: ctx.entryDecl ? parseInt(ctx.entryDecl[0].children.HexAddress[0].image, 16) : 0,
            instructions: (ctx.instruction || []).map(i => this.visit(i))
        };
    }

    instruction(ctx) {
        const addrStr = ctx.HexAddress[0].image.replace(":", "");
        return {
            addr: parseInt(addrStr, 16),
            opcode: ctx.Identifier[0].image,
            operands: (ctx.operand || []).map(o => this.visit(o))
        };
    }

    operand(ctx) {
        if (ctx.KRef) return { type: "const", ref: ctx.KRef[0].image };
        if (ctx.VRef) return { type: "var", ref: ctx.VRef[0].image };
        if (ctx.NumericLiteral) return { type: "number", value: parseFloat(ctx.NumericLiteral[0].image) };
        if (ctx.QuotedString) return { type: "string", value: JSON.parse(ctx.QuotedString[0].image) };
        if (ctx.Identifier) return { type: "ident", value: ctx.Identifier[0].image };
    }
}

// ==========================================
// 导出解析函数
// ==========================================
const lirLexer = new Lexer(lirTokens);
const lirParser = new LirParser();
const lirVisitor = new LirVisitor();

function parseLir(code) {
    const lexResult = lirLexer.tokenize(code);
    if (lexResult.errors.length > 0) {
        throw new Error(`Lexer errors: ${JSON.stringify(lexResult.errors)}`);
    }
    
    lirParser.input = lexResult.tokens;
    const cst = lirParser.program();
    
    if (lirParser.errors.length > 0) {
        throw new Error(`Parser errors: ${JSON.stringify(lirParser.errors)}`);
    }
    
    return lirVisitor.visit(cst);
}

module.exports = { LirParser, LirVisitor, parseLir };
```

### 解析结果 AST 结构

```javascript
{
    header: {
        format: "v1.1",
        domain: "target-website.com",
        registers: {
            ip: "a",
            sp: "p",
            stack: "v",
            bc: "o",
            storage: "l",
            const: "k"
        }
    },
    constants: [
        { index: 0, type: "String", value: "signature" },
        { index: 1, type: "Number", value: 1024 },
        { index: 2, type: "Boolean", value: true },
        { index: 3, type: "Null", value: null }
    ],
    code: {
        entry: 0,
        instructions: [
            { addr: 0x0000, opcode: "PUSH_CONST", operands: [{ type: "const", ref: "K[0]" }] },
            { addr: 0x0005, opcode: "GET_GLOBAL", operands: [] },
            { addr: 0x000A, opcode: "CALL", operands: [{ type: "number", value: 2 }] },
            { addr: 0x000F, opcode: "RET", operands: [] }
        ]
    }
}
```

---

## 4. MIR Parser (mir_parser.js)

Format: `{addr}: [sp:X→Y] {statement}`

```javascript
const { CstParser, Lexer } = require("chevrotain");
const { mirTokens, tokens } = require("./tokens");

class MirParser extends CstParser {
    constructor() {
        super(mirTokens);
        const $ = this;

        $.RULE("program", () => $.MANY(() => $.SUBRULE($.mirLine)));

        $.RULE("mirLine", () => {
            $.CONSUME(tokens.HexAddress);
            $.CONSUME(tokens.SpAnnotation);
            $.SUBRULE($.statement);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("statement", () => $.OR([
            { ALT: () => $.SUBRULE($.returnStmt) },
            { ALT: () => $.SUBRULE($.gotoStmt) },
            { ALT: () => $.SUBRULE($.ifGotoStmt) },
            { ALT: () => $.SUBRULE($.assignment) }
        ]));

        $.RULE("returnStmt", () => {
            $.CONSUME(tokens.Identifier, { LABEL: "return" }); // "return"
            $.OPTION(() => $.SUBRULE($.expression));
        });

        $.RULE("gotoStmt", () => {
            $.CONSUME(tokens.Identifier, { LABEL: "goto" }); // "goto"
            $.CONSUME(tokens.HexAddress);
        });

        $.RULE("ifGotoStmt", () => {
            $.CONSUME(tokens.Identifier, { LABEL: "if" }); // "if"
            $.CONSUME(tokens.LParen);
            $.SUBRULE($.expression);
            $.CONSUME(tokens.RParen);
            $.CONSUME2(tokens.Identifier, { LABEL: "goto" }); // "goto"
            $.CONSUME2(tokens.HexAddress);
        });

        $.RULE("assignment", () => {
            $.SUBRULE($.lvalue);
            $.CONSUME(tokens.Equals);
            $.SUBRULE($.expression);
        });

        $.RULE("lvalue", () => $.OR([
            { ALT: () => $.CONSUME(tokens.TempVar) },
            { ALT: () => $.CONSUME(tokens.VRef) },
            { ALT: () => $.SUBRULE($.memberExpr) }
        ]));

        $.RULE("expression", () => $.SUBRULE($.binaryExpr));

        $.RULE("binaryExpr", () => {
            $.SUBRULE($.unaryExpr);
            $.MANY(() => {
                $.CONSUME(tokens.Identifier); // operator
                $.SUBRULE2($.unaryExpr);
            });
        });

        $.RULE("unaryExpr", () => {
            $.OPTION(() => $.CONSUME(tokens.Identifier)); // unary op
            $.SUBRULE($.primaryExpr);
        });

        $.RULE("primaryExpr", () => $.OR([
            { ALT: () => $.CONSUME(tokens.TempVar) },
            { ALT: () => $.CONSUME(tokens.KRef) },
            { ALT: () => $.CONSUME(tokens.VRef) },
            { ALT: () => $.CONSUME(tokens.NumericLiteral) },
            { ALT: () => $.CONSUME(tokens.QuotedString) },
            { ALT: () => $.CONSUME(tokens.BooleanLiteral) },
            { ALT: () => $.SUBRULE($.callExpr) },
            { ALT: () => $.SUBRULE($.memberExpr) },
            { ALT: () => {
                $.CONSUME(tokens.LParen);
                $.SUBRULE($.expression);
                $.CONSUME(tokens.RParen);
            }}
        ]));

        $.RULE("callExpr", () => {
            $.SUBRULE($.primaryExpr);
            $.CONSUME(tokens.LParen);
            $.OPTION(() => {
                $.SUBRULE($.expression);
                $.MANY(() => {
                    $.CONSUME(tokens.Comma);
                    $.SUBRULE2($.expression);
                });
            });
            $.CONSUME(tokens.RParen);
        });

        $.RULE("memberExpr", () => {
            $.SUBRULE($.primaryExpr);
            $.CONSUME(tokens.LBracket);
            $.SUBRULE($.expression);
            $.CONSUME(tokens.RBracket);
        });

        this.performSelfAnalysis();
    }
}

module.exports = { MirParser };
```

---

## 5. HIR Parser (hir_parser.js)

Format: Basic blocks with control flow

```
BB{id}: [0x{start}-0x{end}] ({type}) [{loop_info}]
  0x{addr}: {statement}
  -> {control_flow}
```

```javascript
const { CstParser, Lexer } = require("chevrotain");
const { hirTokens, tokens } = require("./tokens");

class HirParser extends CstParser {
    constructor() {
        super(hirTokens);
        const $ = this;

        $.RULE("program", () => $.MANY(() => $.SUBRULE($.basicBlock)));

        $.RULE("basicBlock", () => {
            $.CONSUME(tokens.BBLabel);
            $.CONSUME(tokens.Colon);
            $.SUBRULE($.blockRange);
            $.OPTION(() => $.SUBRULE($.blockType));
            $.OPTION2(() => $.SUBRULE($.loopInfo));
            $.CONSUME(tokens.NewLine);
            $.MANY(() => $.SUBRULE($.hirLine));
            $.OPTION3(() => $.SUBRULE($.controlFlow));
        });

        $.RULE("blockRange", () => {
            $.CONSUME(tokens.LBracket);
            $.CONSUME(tokens.HexAddress); // start
            $.CONSUME(tokens.Identifier); // "-"
            $.CONSUME2(tokens.HexAddress); // end
            $.CONSUME(tokens.RBracket);
        });

        $.RULE("blockType", () => {
            $.CONSUME(tokens.LParen);
            $.CONSUME(tokens.Identifier); // "condition", "statement", etc.
            $.CONSUME(tokens.RParen);
        });

        $.RULE("loopInfo", () => {
            $.CONSUME(tokens.LBracket);
            $.CONSUME(tokens.Identifier); // "while", "do-while", "endless"
            $.CONSUME2(tokens.Identifier); // "loop"
            $.CONSUME3(tokens.Identifier); // "header" or "latch"
            $.CONSUME(tokens.RBracket);
        });

        $.RULE("hirLine", () => {
            $.CONSUME(tokens.HexAddress);
            $.SUBRULE($.statement);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("controlFlow", () => {
            $.CONSUME(tokens.Arrow);
            $.OR([
                { ALT: () => $.SUBRULE($.conditionalCF) },
                { ALT: () => $.SUBRULE($.gotoCF) }
            ]);
            $.CONSUME(tokens.NewLine);
        });

        $.RULE("conditionalCF", () => {
            $.CONSUME(tokens.Identifier); // "if"
            $.CONSUME(tokens.LParen);
            $.SUBRULE($.expression);
            $.CONSUME(tokens.RParen);
            $.CONSUME2(tokens.Identifier); // "goto"
            $.CONSUME(tokens.BBLabel);
            $.CONSUME3(tokens.Identifier); // "else"
            $.CONSUME4(tokens.Identifier); // "goto"
            $.CONSUME2(tokens.BBLabel);
        });

        $.RULE("gotoCF", () => {
            $.CONSUME(tokens.Identifier); // "goto"
            $.CONSUME(tokens.BBLabel);
        });

        // 复用 MIR 的 statement/expression 规则
        // ... (省略，与 MirParser 相同)

        this.performSelfAnalysis();
    }
}

module.exports = { HirParser };
```

---

## 6. 统一入口 (index.js)

```javascript
const { parseLir } = require("./lir_parser");
const { MirParser } = require("./mir_parser");
const { HirParser } = require("./hir_parser");

module.exports = {
    parseLir,
    // parseMir, parseHir 类似实现
};
```

---

## 7. LSP 友好特性

v1.1 格式为 VSCode 插件提供以下能力：

| 功能 | 实现方式 |
|------|----------|
| **Jump to Definition** | 点击 `K[0]` → 跳转到 `@const K[0]` 声明行 |
| **Hover Preview** | 悬停 `K[0]` → 显示 `Type: String, Value: "signature"` |
| **Rename Symbol** | 重命名 `K[0]` → 同步更新所有引用 |
| **In-place Editing** | 直接修改 `@const K[0]` 的值，下游自动更新 |

### 解析位点提取

```javascript
// 从 CST 提取位置信息用于 LSP
function extractLocations(cst) {
    const locations = {
        constants: {},  // K[n] -> { line, column }
        instructions: {} // addr -> { line, column }
    };
    
    // 遍历 CST 提取位置
    // ...
    
    return locations;
}
```

---

## 8. 错误恢复

```javascript
class RobustLirParser extends LirParser {
    constructor() {
        super();
        // 启用错误恢复
        this.recoveryEnabled = true;
    }
}

// 使用示例
const result = parseLir(code);
if (result.errors.length > 0) {
    for (const err of result.errors) {
        console.error(`Line ${err.line}:${err.column}: ${err.message}`);
    }
}
```

---

## 9. 完整示例

### 输入 (.vmasm)

```vmasm
@format v1.1
@domain example.com
@reg ip=pc, sp=sp, stack=stk, bc=code, storage=mem, const=K

@section constants
@const K[0] = String("hello")
@const K[1] = Number(42)

@section code
@entry 0x0000

0x0000: PUSH_CONST K[0]
0x0005: PUSH_CONST K[1]
0x000A: ADD
0x000B: RET
```

### 输出 (AST)

```javascript
{
    header: {
        format: "v1.1",
        domain: "example.com",
        registers: { ip: "pc", sp: "sp", stack: "stk", bc: "code", storage: "mem", const: "K" }
    },
    constants: [
        { index: 0, type: "String", value: "hello" },
        { index: 1, type: "Number", value: 42 }
    ],
    code: {
        entry: 0,
        instructions: [
            { addr: 0, opcode: "PUSH_CONST", operands: [{ type: "const", ref: "K[0]" }] },
            { addr: 5, opcode: "PUSH_CONST", operands: [{ type: "const", ref: "K[1]" }] },
            { addr: 10, opcode: "ADD", operands: [] },
            { addr: 11, opcode: "RET", operands: [] }
        ]
    }
}
```
