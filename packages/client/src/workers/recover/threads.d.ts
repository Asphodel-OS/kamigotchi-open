// threads ships typings its package exports hide from bundler resolution
declare module 'threads' {
  export function expose(exposed: Record<string, (...args: any[]) => any>): void;
}
