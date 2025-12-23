/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { click, fill, pressKey, } from '../../src/tools/input.js';
import { parseKey } from '../../src/utils/keyboard.js';
import { serverHooks } from '../server.js';
import { html, withMcpContext } from '../utils.js';
describe('input', () => {
    const server = serverHooks();
    describe('click', () => {
        it('clicks', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<button onclick="this.innerText = 'clicked';">test</button>`);
                await context.createTextSnapshot();
                await click.handler({
                    params: {
                        uid: '1_1',
                    },
                }, response, context);
                assert.strictEqual(response.responseLines[0], 'Successfully clicked on the element');
                assert.ok(response.includeSnapshot);
                assert.ok(await page.$('text/clicked'));
            });
        });
        it('double clicks', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<button ondblclick="this.innerText = 'dblclicked';"
            >test</button
          >`);
                await context.createTextSnapshot();
                await click.handler({
                    params: {
                        uid: '1_1',
                        dblClick: true,
                    },
                }, response, context);
                assert.strictEqual(response.responseLines[0], 'Successfully double clicked on the element');
                assert.ok(response.includeSnapshot);
                assert.ok(await page.$('text/dblclicked'));
            });
        });
        it('waits for navigation', async () => {
            const resolveNavigation = Promise.withResolvers();
            server.addHtmlRoute('/link', html `<a href="/navigated">Navigate page</a>`);
            server.addRoute('/navigated', async (_req, res) => {
                await resolveNavigation.promise;
                res.write(html `<main>I was navigated</main>`);
                res.end();
            });
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/link'));
                await context.createTextSnapshot();
                const clickPromise = click.handler({
                    params: {
                        uid: '1_1',
                    },
                }, response, context);
                const [t1, t2] = await Promise.all([
                    clickPromise.then(() => Date.now()),
                    new Promise(res => {
                        setTimeout(() => {
                            resolveNavigation.resolve();
                            res(Date.now());
                        }, 300);
                    }),
                ]);
                assert(t1 > t2, 'Waited for navigation');
            });
        });
        it('waits for stable DOM', async () => {
            server.addHtmlRoute('/unstable', html `
          <button>Click to change to see time</button>
          <script>
            const button = document.querySelector('button');
            button.addEventListener('click', () => {
              setTimeout(() => {
                button.textContent = Date.now();
              }, 50);
            });
          </script>
        `);
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/unstable'));
                await context.createTextSnapshot();
                const handlerResolveTime = await click
                    .handler({
                    params: {
                        uid: '1_1',
                    },
                }, response, context)
                    .then(() => Date.now());
                const buttonChangeTime = await page.evaluate(() => {
                    const button = document.querySelector('button');
                    return Number(button?.textContent);
                });
                assert(handlerResolveTime > buttonChangeTime, 'Waited for navigation');
            });
        });
    });
    describe('fill', () => {
        it('fills out an input', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<input />`);
                await context.createTextSnapshot();
                await fill.handler({
                    params: {
                        uid: '1_1',
                        value: 'test',
                    },
                }, response, context);
                assert.strictEqual(response.responseLines[0], 'Successfully filled out the element');
                assert.ok(response.includeSnapshot);
                assert.ok(await page.$('text/test'));
            });
        });
        it('fills out a select by text', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<select
            ><option value="v1">one</option
            ><option value="v2">two</option></select
          >`);
                await context.createTextSnapshot();
                await fill.handler({
                    params: {
                        uid: '1_1',
                        value: 'two',
                    },
                }, response, context);
                assert.strictEqual(response.responseLines[0], 'Successfully filled out the element');
                assert.ok(response.includeSnapshot);
                const selectedValue = await page.evaluate(() => document.querySelector('select').value);
                assert.strictEqual(selectedValue, 'v2');
            });
        });
    });
    describe('press_key', () => {
        it('parses keys', () => {
            assert.deepStrictEqual(parseKey('Shift+A'), ['A', 'Shift']);
            assert.deepStrictEqual(parseKey('Shift++'), ['+', 'Shift']);
            assert.deepStrictEqual(parseKey('Control+Shift++'), [
                '+',
                'Control',
                'Shift',
            ]);
            assert.deepStrictEqual(parseKey('Shift'), ['Shift']);
            assert.deepStrictEqual(parseKey('KeyA'), ['KeyA']);
        });
        it('throws on empty key', () => {
            assert.throws(() => {
                parseKey('');
            });
        });
        it('throws on invalid key', () => {
            assert.throws(() => {
                parseKey('aaaaa');
            });
        });
        it('throws on multiple keys', () => {
            assert.throws(() => {
                parseKey('Shift+Shift');
            });
        });
        it('processes press_key', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.setContent(html `<script>
            logs = [];
            document.addEventListener('keydown', e => logs.push('d' + e.key));
            document.addEventListener('keyup', e => logs.push('u' + e.key));
          </script>`);
                await context.createTextSnapshot();
                await pressKey.handler({
                    params: {
                        key: 'Control+Shift+C',
                    },
                }, response, context);
                assert.deepStrictEqual(await page.evaluate('logs'), [
                    'dControl',
                    'dShift',
                    'dC',
                    'uC',
                    'uShift',
                    'uControl',
                ]);
            });
        });
    });
});
//# sourceMappingURL=input.test.js.map