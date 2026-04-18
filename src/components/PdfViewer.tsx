'use client';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ documentUrl, width = 800 }: { documentUrl: string, width?: number }) {
  return (
    <Document 
      file={documentUrl} 
      loading={
        <div className="flex items-center justify-center bg-gray-50" style={{ width: `${width}px`, height: '1000px' }}>
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <Page 
        pageNumber={1} 
        width={width} 
        renderTextLayer={false} 
        renderAnnotationLayer={false} 
        className="select-none pointer-events-none" 
      />
    </Document>
  );
}
