import os
import math

# 依赖检查
try:
    from ast_grep_py import SgRoot
    AST_GREP_AVAILABLE = True
except ImportError:
    AST_GREP_AVAILABLE = False

from mcp.server.fastmcp import FastMCP


mcp = FastMCP("smart-fs")


@mcp.tool()
def read_code_robust(file_path: str, start_line: int, end_line: int, char_limit: int = 200) -> str:
    """
    读取代码并添加行号。智能截断超长字符串，同时保持行号与原始文件一致。
    """
    # --- 1. 基础检查 ---
    if not AST_GREP_AVAILABLE:
        return "❌ Error: 'ast-grep-py' not installed."
    
    if not os.path.exists(file_path):
        return f"❌ Error: File not found: {file_path}"
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            source_code = f.read()
    except Exception as e:
        return f"❌ Error reading file: {e}"

    # --- 2. AST 智能截断 ---
    # 我们不仅要截断，还要保证截断后，文件的总行数不变，这样行号才能对上
    modified_code = source_code
    
    try:
        sg = SgRoot(source_code, "javascript")
        root = sg.root()
        
        # 查找所有字符串
        string_nodes = root.find_all(kind="string") + root.find_all(kind="template_string")
        
        edits = []
        for node in string_nodes:
            rng = node.range()
            # ast-grep 的 range index 是字节偏移
            start_byte = rng.start.index
            end_byte = rng.end.index
            text_len = end_byte - start_byte
            
            if text_len > char_limit:
                original_text = source_code[start_byte:end_byte]
                
                # [关键逻辑] 计算该字符串跨越了多少行
                newline_count = original_text.count('\n')
                
                # 保留首尾引号
                quote_start = original_text[0]
                quote_end = original_text[-1]
                
                # 构建替换文本
                # 1. 截断提示
                # 2. [重要] 补齐被吃掉的换行符，确保后续行号不偏移！
                truncated_marker = f" ...[TRUNCATED {text_len} CHARS]... "
                padding_newlines = "\n" * newline_count
                
                # 如果是多行字符串，我们把换行符放在截断提示后面，保持结构
                new_text = (
                    quote_start + 
                    original_text[1:20] + 
                    truncated_marker + 
                    padding_newlines + # <--- 保持行号同步的核心
                    original_text[-20:-1] + 
                    quote_end
                )
                
                edits.append((start_byte, end_byte, new_text))

        # 倒序应用修改
        edits.sort(key=lambda x: x[0], reverse=True)
        for start, end, replacement in edits:
            modified_code = modified_code[:start] + replacement + modified_code[end:]

    except Exception as e:
        # 如果 AST 失败，降级使用原始代码，并在输出中警告
        modified_code = source_code
        return f"⚠️ AST Warning: {str(e)}\n" + _format_lines(source_code, start_line, end_line)

    # --- 3. 格式化输出 (带行号) ---
    return _format_lines(modified_code, start_line, end_line)

def _format_lines(content: str, start_line: int, end_line: int) -> str:
    lines = content.splitlines()
    total_lines = len(lines)
    
    # 转换为 0-based 索引
    start_idx = max(0, start_line - 1)
    end_idx = min(total_lines, end_line)
    
    if start_idx >= total_lines:
        return f"⚠️ End of file reached (Total lines: {total_lines})"

    output = []
    
    # [关键逻辑] 动态计算行号宽度 (例如 1000 行需要 4 位宽)
    # 这样 output 永远是对齐的
    #   1 | var a
    #  10 | var b
    # 100 | var c
    max_digits = len(str(end_idx))
    
    for i in range(start_idx, end_idx):
        line_num = i + 1
        line_content = lines[i]
        
        # 使用 f-string 的对齐功能: {var:>{width}} 右对齐
        formatted_line = f"{line_num:>{max_digits}} | {line_content}"
        output.append(formatted_line)
        
    return "\n".join(output)


if __name__ == "__main__":
    mcp.run()
    