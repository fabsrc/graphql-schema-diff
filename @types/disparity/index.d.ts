declare module 'disparity' {
  interface Options {
    paths: string[]
  }

  export function unified(str1: string, str2: string, opts?: Options): string;
}
