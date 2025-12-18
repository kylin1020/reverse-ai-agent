/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import{logger as e}from"../logger.js";import{getCdpSession as a}from"../utils/cdp.js";const n=new WeakMap;const t=new WeakSet;export async function initializeDebuggerForPage(r){const g=await a(r),i=function(e){let a=n.get(e);return a||(a={enabled:!1,isPaused:!1},n.set(e,a)),a}(r);if(i.enabled||(await g.send("Debugger.enable"),i.enabled=!0,g.on("Debugger.paused",()=>{i.isPaused=!0,e("[debugger] Execution paused at breakpoint")}),g.on("Debugger.resumed",()=>{i.isPaused=!1,e("[debugger] Execution resumed")})),!t.has(r)){t.add(r),g.on("Page.frameStartedLoading",async()=>{try{await g.send("Debugger.enable"),e("[debugger] Debugger re-enabled after navigation")}catch{}});try{await g.send("Page.enable")}catch{}}}