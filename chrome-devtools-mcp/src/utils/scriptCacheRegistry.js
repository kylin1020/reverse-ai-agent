/**
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import{ScriptCacheManager as e}from"./scriptCacheManager.js";export const ScriptCacheRegistry=new class{managers=new WeakMap;sessionIds=new WeakMap;nextSessionId=0;getOrCreate(s){let a=this.managers.get(s);if(!a){const n="session-"+this.nextSessionId++;this.sessionIds.set(s,n),a=new e(n),this.managers.set(s,a)}return a}get(e){return this.managers.get(e)}async remove(e){const s=this.managers.get(e);s&&(await s.cleanup(),this.managers.delete(e),this.sessionIds.delete(e))}async cleanupAll(){console.warn("cleanupAll: WeakMap does not support iteration. Individual sessions should be cleaned up via remove().")}};