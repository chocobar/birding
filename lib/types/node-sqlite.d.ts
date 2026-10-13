/**
 * Minimal ambient types for node:sqlite.
 *
 * The app runs on Node 24, which ships the built-in node:sqlite module, but
 * @types/node is pinned to 20.x (which predates it). Only the surface this
 * project uses is declared here; delete this shim once @types/node ships real
 * node:sqlite types.
 */
declare module 'node:sqlite' {
  type SupportedValueType = null | number | bigint | string | Uint8Array;

  export interface StatementResultingChanges {
    changes: number | bigint | undefined;
    lastInsertRowid: number | bigint | undefined;
  }

  export class StatementSync {
    private constructor();
    run(...anonymousParameters: SupportedValueType[]): StatementResultingChanges;
    get(...anonymousParameters: SupportedValueType[]): unknown;
    all(...anonymousParameters: SupportedValueType[]): unknown[];
    iterate(...anonymousParameters: SupportedValueType[]): IterableIterator<unknown>;
  }

  export interface DatabaseSyncOptions {
    open?: boolean | undefined;
    readOnly?: boolean | undefined;
    enableForeignKeyConstraints?: boolean | undefined;
    enableDoubleQuotedStringLiterals?: boolean | undefined;
    allowExtension?: boolean | undefined;
  }

  export class DatabaseSync {
    constructor(location?: string, options?: DatabaseSyncOptions);
    open(location: string): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
