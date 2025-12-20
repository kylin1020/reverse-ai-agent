/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it, afterEach } from 'node:test';
import { setBreakpoint, getDebuggerStatus, stepOver, stepInto, stepOut, resumeExecution, disableDebugger, } from '../../src/tools/debugger.js';
import { evaluateScript } from '../../src/tools/script.js';
import { serverHooks } from '../server.js';
import { html, withMcpContext } from '../utils.js';
describe('script', () => {
    const server = serverHooks();
    // Clean up debugger after each test
    afterEach(async () => {
        await withMcpContext(async (response, context) => {
            await disableDebugger.handler({ params: {} }, response, context);
        });
    });
    describe('browser_evaluate_script', () => {
        it('evaluates', async () => {
            await withMcpContext(async (response, context) => {
                await evaluateScript.handler({ params: { function: String(() => 2 * 5) } }, response, context);
                const lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), 10);
            });
        });
        it('runs in selected page', async () => {
            await withMcpContext(async (response, context) => {
                await evaluateScript.handler({ params: { function: String(() => document.title) } }, response, context);
                let lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), '');
                const page = await context.newPage();
                await page.setContent(`
          <head>
            <title>New Page</title>
          </head>
        `);
                response.resetResponseLineForTesting();
                await evaluateScript.handler({ params: { function: String(() => document.title) } }, response, context);
                lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), 'New Page');
            });
        });
        it('work for complex objects', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<script src="./scripts.js"></script> `);
                await evaluateScript.handler({
                    params: {
                        function: String(() => {
                            const scripts = Array.from(document.head.querySelectorAll('script')).map(s => ({ src: s.src, async: s.async, defer: s.defer }));
                            return { scripts };
                        }),
                    },
                }, response, context);
                const lineEvaluation = response.responseLines.at(2);
                assert.deepEqual(JSON.parse(lineEvaluation), {
                    scripts: [],
                });
            });
        });
        it('work for async functions', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<script src="./scripts.js"></script> `);
                await evaluateScript.handler({
                    params: {
                        function: String(async () => {
                            await new Promise(res => setTimeout(res, 0));
                            return 'Works';
                        }),
                    },
                }, response, context);
                const lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), 'Works');
            });
        });
        it('work with one argument', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<button id="test">test</button>`);
                await context.createTextSnapshot();
                await evaluateScript.handler({
                    params: {
                        function: String(async (el) => {
                            return el.id;
                        }),
                        args: [{ uid: '1_1' }],
                    },
                }, response, context);
                const lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), 'test');
            });
        });
        it('work with multiple args', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<button id="test">test</button>`);
                await context.createTextSnapshot();
                await evaluateScript.handler({
                    params: {
                        function: String((container, child) => {
                            return container.contains(child);
                        }),
                        args: [{ uid: '1_0' }, { uid: '1_1' }],
                    },
                }, response, context);
                const lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), true);
            });
        });
        it('work for elements inside iframes', async () => {
            server.addHtmlRoute('/iframe', html `<main><button>I am iframe button</button></main>`);
            server.addHtmlRoute('/main', html `<iframe src="/iframe"></iframe>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/main'));
                await context.createTextSnapshot();
                await evaluateScript.handler({
                    params: {
                        function: String((element) => {
                            return element.textContent;
                        }),
                        args: [{ uid: '1_3' }],
                    },
                }, response, context);
                const lineEvaluation = response.responseLines.at(2);
                assert.strictEqual(JSON.parse(lineEvaluation), 'I am iframe button');
            });
        });
    });
    describe('background execution with debugger integration', () => {
        it('should pause at breakpoint when script is executed in background mode', async () => {
            // Set up a script file with a function that can be debugged
            server.addRoute('/debug-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function testFunction() {
  const x = 1;
  const y = 2;
  const z = x + y;
  return z;
}
window.testFunction = testFunction;
        `);
            });
            server.addHtmlRoute('/debug-page', html `<script src="/debug-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/debug-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint at line 4 (const y = 2)
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*debug-test\\.js.*',
                        lineNumber: 4,
                    },
                }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Breakpoint set successfully')), 'Should confirm breakpoint was set');
                response.resetResponseLineForTesting();
                // Execute the function in background mode
                await evaluateScript.handler({
                    params: {
                        function: String(() => {
                            return window.testFunction();
                        }),
                        background: true,
                    },
                }, response, context);
                // Verify background mode response
                assert.ok(response.responseLines.some(line => line.includes('Script started in background mode')), 'Should indicate script started in background mode');
                assert.ok(response.responseLines.some(line => line.includes('Execution ID:')), 'Should return execution ID');
                // Wait a bit for the script to hit the breakpoint
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Check debugger status - should be paused
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Paused: Yes')), 'Debugger should be paused at breakpoint');
                assert.ok(response.responseLines.some(line => line.includes('debug-test.js')), 'Should show the script file in call stack');
            });
        });
        it('should allow step_over command after background execution pause', async () => {
            server.addRoute('/step-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function stepTestFunction() {
  const a = 10;
  const b = 20;
  const c = a + b;
  return c;
}
window.stepTestFunction = stepTestFunction;
        `);
            });
            server.addHtmlRoute('/step-page', html `<script src="/step-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/step-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint at line 3 (const a = 10)
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*step-test\\.js.*',
                        lineNumber: 3,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Execute in background mode
                await evaluateScript.handler({
                    params: {
                        function: String(() => {
                            return window.stepTestFunction();
                        }),
                        background: true,
                    },
                }, response, context);
                // Wait for breakpoint to be hit
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Verify we're paused
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Paused: Yes')), 'Should be paused at breakpoint');
                response.resetResponseLineForTesting();
                // Step over to next line
                await stepOver.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Stepped over')), 'Should confirm step over');
            });
        });
        it('should allow step_into command after background execution pause', async () => {
            server.addRoute('/step-into-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function innerFunction() {
  return 42;
}
function outerFunction() {
  const result = innerFunction();
  return result;
}
window.outerFunction = outerFunction;
        `);
            });
            server.addHtmlRoute('/step-into-page', html `<script src="/step-into-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/step-into-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint at line 6 (const result = innerFunction())
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*step-into-test\\.js.*',
                        lineNumber: 6,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Execute in background mode
                await evaluateScript.handler({
                    params: {
                        function: String(() => {
                            return window.outerFunction();
                        }),
                        background: true,
                    },
                }, response, context);
                // Wait for breakpoint to be hit
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Step into the inner function
                await stepInto.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Stepped into')), 'Should confirm step into');
            });
        });
        it('should allow step_out command after background execution pause', async () => {
            server.addRoute('/step-out-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function innerFunc() {
  const x = 1;
  return x;
}
function outerFunc() {
  const result = innerFunc();
  return result * 2;
}
window.outerFunc = outerFunc;
        `);
            });
            server.addHtmlRoute('/step-out-page', html `<script src="/step-out-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/step-out-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint inside innerFunc at line 3 (const x = 1)
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*step-out-test\\.js.*',
                        lineNumber: 3,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Execute in background mode
                await evaluateScript.handler({
                    params: {
                        function: String(() => {
                            return window.outerFunc();
                        }),
                        background: true,
                    },
                }, response, context);
                // Wait for breakpoint to be hit
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Step out of the inner function
                await stepOut.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Stepped out')), 'Should confirm step out');
            });
        });
        it('should allow resume command after background execution pause', async () => {
            server.addRoute('/resume-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function resumeTestFunction() {
  const x = 1;
  const y = 2;
  return x + y;
}
window.resumeTestFunction = resumeTestFunction;
        `);
            });
            server.addHtmlRoute('/resume-page', html `<script src="/resume-test.js"></script>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/resume-page'), { waitUntil: 'networkidle0' });
                // Set a breakpoint at line 3 (const x = 1)
                await setBreakpoint.handler({
                    params: {
                        urlRegex: '.*resume-test\\.js.*',
                        lineNumber: 3,
                    },
                }, response, context);
                response.resetResponseLineForTesting();
                // Execute in background mode
                await evaluateScript.handler({
                    params: {
                        function: String(() => {
                            return window.resumeTestFunction();
                        }),
                        background: true,
                    },
                }, response, context);
                // Wait for breakpoint to be hit
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Verify we're paused
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Paused: Yes')), 'Should be paused at breakpoint');
                response.resetResponseLineForTesting();
                // Resume execution
                await resumeExecution.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Execution resumed')), 'Should confirm execution resumed');
                // Wait for execution to complete
                await new Promise(resolve => setTimeout(resolve, 200));
                response.resetResponseLineForTesting();
                // Verify we're no longer paused
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Paused: No')), 'Should no longer be paused after resume');
            });
        });
    });
});
//# sourceMappingURL=script.test.js.map