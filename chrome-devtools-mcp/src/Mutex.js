/**
 * @license
 * Copyright 2025 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
export class Mutex{static Guard=class{#e;constructor(e){this.#e=e}dispose(){return this.#e.release()}};#s=!1;#t=[];async acquire(){if(!this.#s)return this.#s=!0,new Mutex.Guard(this);const{resolve:e,promise:s}=Promise.withResolvers();return this.#t.push(e),await s,new Mutex.Guard(this)}release(){const e=this.#t.shift();e?e():this.#s=!1}}