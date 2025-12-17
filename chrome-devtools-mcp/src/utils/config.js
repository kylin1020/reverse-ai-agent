/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
function e(e,n){if(!e)return n;const r=parseInt(e,10);return Number.isNaN(r)||r<=0?n:r}export function getConfig(){return{maxBodySize:e(process.env.MCP_MAX_BODY_SIZE,1e4),defaultPageSize:e(process.env.MCP_DEFAULT_PAGE_SIZE,20),maxSnippetLength:e(process.env.MCP_MAX_SNIPPET_LENGTH,200),maxProperties:e(process.env.MCP_MAX_PROPERTIES,20),maxInlineStringLength:e(process.env.MCP_MAX_INLINE_STRING_LENGTH,200),maxUrlLength:e(process.env.MCP_MAX_URL_LENGTH,150)}}