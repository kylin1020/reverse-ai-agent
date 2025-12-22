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
                await evaluateScript.handler({ params: { script: '2 * 5' } }, response, context);
                const output = response.responseLines.join('\n');
                assert.ok(output.includes('10'), 'Should return 10');
            });
        });
        it('runs in selected page', async () => {
            await withMcpContext(async (response, context) => {
                await evaluateScript.handler({ params: { script: 'document.title' } }, response, context);
                let output = response.responseLines.join('\n');
                assert.ok(output.includes('""'), 'Should return empty string');
                const page = await context.newPage();
                await page.setContent(`
          <head>
            <title>New Page</title>
          </head>
        `);
                response.resetResponseLineForTesting();
                await evaluateScript.handler({ params: { script: 'document.title' } }, response, context);
                output = response.responseLines.join('\n');
                assert.ok(output.includes('New Page'), 'Should return New Page');
            });
        });
        it('work for complex objects', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<script src="./scripts.js"></script> `);
                await evaluateScript.handler({
                    params: {
                        script: `(() => {
                const scripts = Array.from(
                  document.head.querySelectorAll('script'),
                ).map(s => ({src: s.src, async: s.async, defer: s.defer}));
                return {scripts};
              })()`,
                    },
                }, response, context);
                const output = response.responseLines.join('\n');
                assert.ok(output.includes('scripts'), 'Should return scripts object');
            });
        });
        it('work for async functions', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<script src="./scripts.js"></script> `);
                await evaluateScript.handler({
                    params: {
                        script: `(async () => {
                await new Promise(res => setTimeout(res, 0));
                return 'Works';
              })()`,
                    },
                }, response, context);
                const output = response.responseLines.join('\n');
                assert.ok(output.includes('Works'), 'Should return Works');
            });
        });
        it('work with element query', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<button id="test">test</button>`);
                await evaluateScript.handler({
                    params: {
                        script: `document.querySelector('#test').id`,
                    },
                }, response, context);
                const output = response.responseLines.join('\n');
                assert.ok(output.includes('test'), 'Should return test');
            });
        });
        it('work with DOM operations', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<div id="container"><button id="test">test</button></div>`);
                await evaluateScript.handler({
                    params: {
                        script: `document.querySelector('#container').contains(document.querySelector('#test'))`,
                    },
                }, response, context);
                const output = response.responseLines.join('\n');
                assert.ok(output.includes('true'), 'Should return true');
            });
        });
        it('work for elements inside iframes', async () => {
            server.addHtmlRoute('/iframe', html `<main><button>I am iframe button</button></main>`);
            server.addHtmlRoute('/main', html `<iframe src="/iframe"></iframe>`);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/main'));
                await evaluateScript.handler({
                    params: {
                        script: `document.querySelector('iframe').contentDocument.querySelector('button').textContent`,
                    },
                }, response, context);
                const output = response.responseLines.join('\n');
                assert.ok(output.includes('I am iframe button'), 'Should return iframe button text');
            });
        });
    });
    describe('debugger integration', () => {
        it('should pause at breakpoint when script triggers debugger', async () => {
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
            });
        });
        it('should allow step_over command when paused', async () => {
            server.addRoute('/step-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function stepTestFunction() {
  debugger;
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
                // Trigger the debugger statement by calling the function
                page.evaluate(() => window.stepTestFunction()).catch(() => { });
                // Wait for debugger to pause
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Verify we're paused
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Paused: Yes')), 'Should be paused at debugger statement');
                response.resetResponseLineForTesting();
                // Step over to next line
                await stepOver.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Stepped over')), 'Should confirm step over');
            });
        });
        it('should allow step_into command when paused', async () => {
            server.addRoute('/step-into-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function innerFunction() {
  return 42;
}
function outerFunction() {
  debugger;
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
                // Trigger the debugger statement
                page.evaluate(() => window.outerFunction()).catch(() => { });
                // Wait for debugger to pause
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Step over first to get to the innerFunction call
                await stepOver.handler({ params: {} }, response, context);
                response.resetResponseLineForTesting();
                // Step into the inner function
                await stepInto.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Stepped into')), 'Should confirm step into');
            });
        });
        it('should allow step_out command when paused', async () => {
            server.addRoute('/step-out-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function innerFunc() {
  debugger;
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
                // Trigger the debugger statement
                page.evaluate(() => window.outerFunc()).catch(() => { });
                // Wait for debugger to pause
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Step out of the inner function
                await stepOut.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Stepped out')), 'Should confirm step out');
            });
        });
        it('should allow resume command when paused', async () => {
            server.addRoute('/resume-test.js', (_req, res) => {
                res.setHeader('Content-Type', 'application/javascript');
                res.statusCode = 200;
                res.end(`
function resumeTestFunction() {
  debugger;
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
                // Trigger the debugger statement
                page.evaluate(() => window.resumeTestFunction()).catch(() => { });
                // Wait for debugger to pause
                await new Promise(resolve => setTimeout(resolve, 500));
                response.resetResponseLineForTesting();
                // Verify we're paused
                await getDebuggerStatus.handler({ params: {} }, response, context);
                assert.ok(response.responseLines.some(line => line.includes('Paused: Yes')), 'Should be paused at debugger statement');
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