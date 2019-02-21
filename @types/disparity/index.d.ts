declare module 'disparity' {
  interface Options {
    paths?: [string?, string?]
    context?: number
  }

  export function unified(str1: string, str2: string, opts?: Options): string;
  export function unifiedNoColor(str1: string, str2: string, opts?: Options): string;
}
