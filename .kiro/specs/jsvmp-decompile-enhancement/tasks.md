# Implementation Plan: JSVMP Decompile Enhancement

## Overview

本实现计划将增强JSVMP反编译功能分为三个主要部分：
1. 更新AI提示词（skills文件）
2. 实现Extension的Transform解析和Hover增强
3. 属性测试验证

## Tasks

- [x] 1. 更新 jsvmp-ir-format.md 提示词
  - 添加增强的@opcode_transform格式规范
  - 添加通用的opcode类别模板（CALL, NEW, BINARY_OP, UNARY_OP, LOAD, STORE, JUMP）
  - 添加栈表达式转换规则表
  - 描述如何从VM调度器代码推导transform
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. 实现 Transform 解析器
  - [x] 2.1 创建 OpcodeTransform 接口和类型定义
    - 定义 OpcodeTransform, DebugVariable 接口
    - 在 jsvmp-ir-extension/src/utils/ 目录下创建 transform-parser.ts
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 实现 parseOpcodeTransforms 函数
    - 解析@opcode_transform指令
    - 提取opcode编号、名称、语句列表
    - 处理多行transform
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.3 编写属性测试：Transform解析往返
    - **Property 5: Transform Parsing Round-Trip**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 3. 实现 RegisterMapper 组件
  - [x] 3.1 创建 RegisterMapper 类
    - 实现 substitute 方法
    - 支持嵌套表达式替换
    - 在 jsvmp-ir-extension/src/utils/ 目录下创建 register-mapper.ts
    - _Requirements: 4.2_

  - [ ]* 3.2 编写属性测试：寄存器替换正确性
    - **Property 4: Register Substitution Correctness**
    - **Validates: Requirements 4.2**

- [x] 4. 增强 VmasmHoverProvider
  - [x] 4.1 集成 TransformParser 到 VmasmHoverProvider
    - 在文件加载时解析@opcode_transform
    - 缓存解析结果
    - _Requirements: 4.1_

  - [x] 4.2 实现 formatTransformHover 方法
    - 格式化transform为markdown
    - 显示调试变量和可复制表达式
    - 处理未知opcode情况
    - _Requirements: 4.1, 4.3, 4.4_

  - [ ]* 4.3 编写单元测试：Hover功能
    - 测试CALL指令hover
    - 测试二元运算hover
    - 测试未知opcode hover

- [x] 5. Checkpoint - 确保所有测试通过
  - 运行 `npm test` 验证所有测试
  - 如有问题，询问用户

- [x] 6. 更新 vmasm 示例文件
  - [x] 6.1 更新 bdms_disasm.vmasm 的 @opcode_transform 部分
    - 确保所有77个opcode都有transform定义
    - 使用栈表达式而非栈指针修改
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 6.2 编写属性测试：Transform格式验证
    - **Property 1: Transform Format Validation**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 6.3 编写属性测试：Transform完整性
    - **Property 2: CALL/NEW Transform Completeness**
    - **Property 3: Operator Transform Completeness**
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3**

- [x] 7. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证Extension功能正常
  - 如有问题，询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
