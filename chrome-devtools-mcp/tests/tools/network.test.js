/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { getNetworkRequest, listNetworkRequests, saveNetworkRequest, } from '../../src/tools/network.js';
import { serverHooks } from '../server.js';
import { getTextContent, html, stabilizeResponseOutput, withMcpContext, } from '../utils.js';
describe('network', () => {
    const server = serverHooks();
    describe('network_list_requests', () => {
        it('list requests', async () => {
            await withMcpContext(async (response, context) => {
                await listNetworkRequests.handler({ params: {} }, response, context);
                assert.ok(response.includeNetworkRequests);
                assert.strictEqual(response.networkRequestsPageIdx, undefined);
            });
        });
        it('list requests form current navigations only', async (t) => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            server.addHtmlRoute('/two', html `<main>Second</main>`);
            server.addHtmlRoute('/three', html `<main>Third</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                await page.goto(server.getRoute('/two'));
                await page.goto(server.getRoute('/three'));
                await listNetworkRequests.handler({
                    params: {},
                }, response, context);
                const responseData = await response.handle('list_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
        it('list requests from previous navigations', async (t) => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            server.addHtmlRoute('/two', html `<main>Second</main>`);
            server.addHtmlRoute('/three', html `<main>Third</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                await page.goto(server.getRoute('/two'));
                await page.goto(server.getRoute('/three'));
                await listNetworkRequests.handler({
                    params: {
                        includePreservedRequests: true,
                    },
                }, response, context);
                const responseData = await response.handle('list_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
        it('list requests from previous navigations from redirects', async (t) => {
            server.addRoute('/redirect', async (_req, res) => {
                res.writeHead(302, {
                    Location: server.getRoute('/redirected'),
                });
                res.end();
            });
            server.addHtmlRoute('/redirected', html `<script>
          document.location.href = '/redirected-page';
        </script>`);
            server.addHtmlRoute('/redirected-page', html `<main>I was redirected 2 times</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/redirect'));
                await listNetworkRequests.handler({
                    params: {
                        includePreservedRequests: true,
                    },
                }, response, context);
                const responseData = await response.handle('list_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
    });
    describe('network_get_request', () => {
        it('attaches request', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto('data:text/html,<div>Hello MCP</div>');
                await getNetworkRequest.handler({ params: { reqid: 1 } }, response, context);
                assert.equal(response.attachedNetworkRequestId, 1);
            });
        });
        it('should not add the request list', async () => {
            await withMcpContext(async (response, context) => {
                const page = context.getSelectedPage();
                await page.goto('data:text/html,<div>Hello MCP</div>');
                await getNetworkRequest.handler({ params: { reqid: 1 } }, response, context);
                assert(!response.includeNetworkRequests);
            });
        });
        it('should get request from previous navigations', async (t) => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            server.addHtmlRoute('/two', html `<main>Second</main>`);
            server.addHtmlRoute('/three', html `<main>Third</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                await page.goto(server.getRoute('/two'));
                await page.goto(server.getRoute('/three'));
                await getNetworkRequest.handler({
                    params: {
                        reqid: 1,
                    },
                }, response, context);
                const responseData = await response.handle('get_request', context);
                t.assert.snapshot?.(stabilizeResponseOutput(getTextContent(responseData[0])));
            });
        });
    });
    describe('network_save_request', () => {
        it('saves a request+response as raw HTTP text', async () => {
            server.addHtmlRoute('/one', html `<main>First</main>`);
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/one'));
                const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-devtools-mcp-test-'));
                const filePath = path.join(dir, 'request.http');
                await saveNetworkRequest.handler({ params: { reqid: 1, filePath } }, response, context);
                const saved = await fs.readFile(filePath, 'utf-8');
                assert.match(saved, /^GET \/one HTTP\/1\.1\r\n/m);
                assert.match(saved, /\r\nhost: localhost:\d+\r\n/m);
                assert.match(saved, /\r\nHTTP\/1\.1 200/m);
            });
        });
        it('saves binary response bodies to a separate file', async () => {
            server.addRoute('/bin', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'image/jpeg');
                // Minimal JPEG header bytes; not valid UTF-8.
                res.end(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/bin'));
                const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chrome-devtools-mcp-test-'));
                const filePath = path.join(dir, 'request.http');
                const bodyPath = path.join(dir, 'response-body.jpg');
                await saveNetworkRequest.handler({ params: { reqid: 1, filePath, responseBodyFilePath: bodyPath } }, response, context);
                const saved = await fs.readFile(filePath, 'utf-8');
                assert.match(saved, /<binary response body saved to: .*response-body\.jpg>/);
                const body = await fs.readFile(bodyPath);
                assert.equal(body[0], 0xff);
                assert.equal(body[1], 0xd8);
            });
        });
    });
    describe('get_network_request includes initiator', () => {
        it('returns initiator info for script-initiated requests', async () => {
            server.addHtmlRoute('/fetch-page', html `<script>
          async function makeRequest() {
            await fetch('/api/data');
          }
          makeRequest();
        </script>`);
            server.addRoute('/api/data', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/fetch-page'));
                // Wait for the fetch request to complete
                await new Promise(resolve => setTimeout(resolve, 500));
                // Find the fetch request (should be reqid 2 after the page load)
                const requests = context.getNetworkRequests();
                const fetchRequest = requests.find(r => r.url().includes('/api/data'));
                assert.ok(fetchRequest, 'Fetch request should exist');
                const reqid = context.getNetworkRequestStableId(fetchRequest);
                await getNetworkRequest.handler({ params: { reqid } }, response, context);
                const responseData = await response.handle('get_network_request', context);
                const textContent = getTextContent(responseData[0]);
                // Should contain initiator information in the response
                assert.match(textContent, /### Initiator/);
                assert.match(textContent, /Type: script/);
            });
        });
        it('returns parser initiator for HTML-initiated requests', async () => {
            server.addHtmlRoute('/img-page', html `<img src="/test-image.png" />`);
            server.addRoute('/test-image.png', async (_req, res) => {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'image/png');
                res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header
            });
            await withMcpContext(async (response, context) => {
                await context.setUpNetworkCollectorForTesting();
                const page = context.getSelectedPage();
                await page.goto(server.getRoute('/img-page'));
                // Wait for the image request to complete
                await new Promise(resolve => setTimeout(resolve, 500));
                const requests = context.getNetworkRequests();
                const imgRequest = requests.find(r => r.url().includes('/test-image.png'));
                assert.ok(imgRequest, 'Image request should exist');
                const reqid = context.getNetworkRequestStableId(imgRequest);
                await getNetworkRequest.handler({ params: { reqid } }, response, context);
                const responseData = await response.handle('get_network_request', context);
                const textContent = getTextContent(responseData[0]);
                // Should contain initiator information with parser type
                assert.match(textContent, /### Initiator/);
                assert.match(textContent, /Type: parser/);
            });
        });
    });
});
//# sourceMappingURL=network.test.js.map