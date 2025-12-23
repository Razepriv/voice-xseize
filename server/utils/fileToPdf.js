// Utility for converting files to PDF
// Supports: .txt, .doc, .docx

import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import stream from 'stream';

/**
 * Convert a text file buffer to PDF buffer
 */
async function textToPdfBuffer(buffer) {
  const doc = new PDFDocument();
  const passthrough = new stream.PassThrough();
  const chunks = [];
  doc.pipe(passthrough);
  doc.font('Times-Roman').fontSize(12).text(buffer.toString('utf-8'));
  doc.end();
  return await new Promise((resolve, reject) => {
    passthrough.on('data', chunk => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);
  });
}

/**
 * Convert a doc/docx file buffer to PDF buffer (via HTML)
 */
async function docxToPdfBuffer(buffer) {
  // Convert docx to HTML
  const { value: html } = await mammoth.convertToHtml({ buffer });
  // Use PDFKit to render HTML as plain text (no formatting)
  const doc = new PDFDocument();
  const passthrough = new stream.PassThrough();
  const chunks = [];
  doc.pipe(passthrough);
  doc.font('Times-Roman').fontSize(12).text(html.replace(/<[^>]+>/g, ''));
  doc.end();
  return await new Promise((resolve, reject) => {
    passthrough.on('data', chunk => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', reject);
  });
}

export { textToPdfBuffer, docxToPdfBuffer };