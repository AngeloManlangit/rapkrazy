// src/tracery-grammar.d.ts
declare module 'tracery-grammar' {
  export type TraceryModifier = (input: string, params?: string) => string;

  export interface Grammar {
    addModifiers(modifiers: Record<string, TraceryModifier>): void;
    flatten(rule: string): string;
  }

  export function createGrammar(rules: Record<string, string[]>): Grammar;
  export const baseEngModifiers: Record<string, TraceryModifier>;
}