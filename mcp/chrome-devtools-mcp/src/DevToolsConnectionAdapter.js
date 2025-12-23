/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import{CDPSessionEvent as s}from"./third_party/index.js";export class PuppeteerDevToolsConnection{#s;#e=new Set;#n=new Map;constructor(e){this.#s=e.connection(),e.on(s.SessionAttached,this.#t.bind(this)),e.on(s.SessionDetached,this.#o.bind(this)),this.#t(e)}send(s,e,n){if(void 0===n)throw new Error("Attempting to send on the root session. This must not happen");const t=this.#s.session(n);if(!t)throw new Error("Unknown session "+n);return t.send(s,e).then(s=>({result:s})).catch(s=>({error:s}))}observe(s){this.#e.add(s)}unobserve(s){this.#e.delete(s)}#t(s){const e=this.#r.bind(this,s.id());this.#n.set(s.id(),e),s.on("*",e)}#o(s){const e=this.#n.get(s.id());e&&s.off("*",e)}#r(e,n,t){"string"==typeof n&&n!==s.SessionAttached&&n!==s.SessionDetached&&this.#e.forEach(s=>s.onEvent({method:n,sessionId:e,params:t}))}}