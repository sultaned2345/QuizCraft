file: src/types/pdf-parse-fork.d.ts
declare module 'pdf-parse-fork' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  interface Options {
    pagerender?: (pageData: any) => string;
    max?: number;
    version?: string;
  }

  function pdf(dataBuffer: Buffer, options?: Options): Promise<PdfData>;

  export default pdf;
}