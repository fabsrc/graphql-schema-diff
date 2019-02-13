declare module 'disparity' {
  interface Options {
    paths?: [string?, string?]
  }

  export function unified(str1: string, str2: string, opts?: Options): string;
}
