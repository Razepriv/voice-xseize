import '@testing-library/jest-dom';

declare module 'pdfkit' {
  import { Writable } from 'stream';

  interface PDFDocumentOptions {
    autoFirstPage?: boolean;
    size?: string | [number, number];
    margins?: { top?: number; left?: number; bottom?: number; right?: number };
    layout?: 'portrait' | 'landscape';
  }

  class PDFDocument extends Writable {
    constructor(options?: PDFDocumentOptions);
    fontSize(size: number): this;
    text(text: string, options?: { align?: 'left' | 'center' | 'right'; underline?: boolean }): this;
    text(text: string, x?: number, y?: number, options?: object): this;
    moveDown(lines?: number): this;
    end(): void;
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export default PDFDocument;
}
