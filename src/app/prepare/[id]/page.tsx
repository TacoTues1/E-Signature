'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Type, PenTool, CheckCircle, Move } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Field = {
  id: string;
  type: 'name' | 'signature';
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export default function PreparePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const handleResize = () => {
      const screenWidth = window.innerWidth;
      // If mobile layout (e.g., md breakpoint is 768px), sidebar goes top, doc goes bottom
      // We leave some padding (e.g. 64px max)
      const availableWidth = screenWidth < 768 ? screenWidth - 32 : screenWidth - 320 - 64;
      if (availableWidth < 800) {
        setScale(availableWidth / 800);
      } else {
        setScale(1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Load document from localStorage (fallback mechanism)
    const data = localStorage.getItem(`doc_${id}`);
    
    const fetchDoc = async () => {
      try {
        const { data: dbData, error } = await supabase.from('documents').select().eq('id', id).single();
        if (dbData && !error) {
          if (dbData.file_url) setDocumentUrl(dbData.file_url);
          if (dbData.config) setFields(dbData.config);
        } else if (data) {
          setDocumentUrl(data);
        }
      } catch (err) {
        if (data) setDocumentUrl(data);
      }
    };
    
    fetchDoc();
  }, [id]);

  const addField = (type: 'name' | 'signature') => {
    const newField: Field = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 100, // default position
      y: 100,
      width: type === 'signature' ? 200 : 150,
      height: type === 'signature' ? 60 : 40,
    };
    setFields([...fields, newField]);
    setActiveField(newField.id);
  };

  const updateFieldPosition = (fieldId: string, x: number, y: number) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, x, y } : f));
  };

  const [draggingField, setDraggingField] = useState<{ id: string, offsetX: number, offsetY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent, fieldId: string) => {
    if (e.button !== 0) return; // Only left mouse button or touch
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDraggingField({ id: fieldId, offsetX, offsetY });
    setActiveField(fieldId);
  };

  const handlePointerMove = (e: React.PointerEvent, fieldId: string) => {
    if (!draggingField || draggingField.id !== fieldId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - draggingField.offsetX;
    const y = e.clientY - rect.top - draggingField.offsetY;

    updateFieldPosition(fieldId, Math.max(0, x), Math.max(0, y));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingField) {
      const target = e.currentTarget as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      setDraggingField(null);
    }
  };

  const [resizingField, setResizingField] = useState<{ id: string, startWidth: number, startHeight: number, startX: number, startY: number } | null>(null);

  const handleResizeDown = (e: React.PointerEvent, field: Field) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setResizingField({ 
      id: field.id, 
      startWidth: field.width || (field.type === 'signature' ? 200 : 150),
      startHeight: field.height || (field.type === 'signature' ? 60 : 40),
      startX: e.clientX,
      startY: e.clientY
    });
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizingField) return;
    e.stopPropagation();
    const newWidth = Math.max(50, resizingField.startWidth + (e.clientX - resizingField.startX));
    const newHeight = Math.max(30, resizingField.startHeight + (e.clientY - resizingField.startY));
    
    setFields(fields.map(f => f.id === resizingField.id ? { ...f, width: newWidth, height: newHeight } : f));
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (resizingField) {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
      setResizingField(null);
    }
  };

  const handleNext = () => {
    // Save fields to local storage or Supabase
    localStorage.setItem(`config_${id}`, JSON.stringify(fields));
    router.push(`/send/${id}`);
  };

  if (!documentUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Tool Panel */}
      <div className="w-full md:w-80 bg-white border-b md:border-r shadow-sm p-6 flex flex-col md:h-screen z-20 shrink-0">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Add Fields</h2>
        <p className="text-gray-500 mb-6 text-sm">Select fields and drag them onto the document to position them correctly.</p>

        <div className="space-y-4">
          <button 
            onClick={() => addField('name')}
            className="w-full flex items-center p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
          >
            <Type className="text-blue-600 w-6 h-6 mr-3" />
            <span className="font-medium text-gray-700">Full Name</span>
          </button>

          <button 
            onClick={() => addField('signature')}
            className="w-full flex items-center p-4 border rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors shadow-sm"
          >
            <PenTool className="text-blue-600 w-6 h-6 mr-3" />
            <span className="font-medium text-gray-700">Signature</span>
          </button>
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={handleNext}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium shadow-md transition-colors flex items-center justify-center"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Continue to Send
          </button>
        </div>
      </div>

      {/* Document View Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start bg-gray-200">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: scale }}
            style={{ transformOrigin: 'top center', width: '800px' }}
            className="bg-white shadow-xl relative touch-none"
            ref={containerRef}
          >
          {documentUrl.startsWith('data:image/') ? (
            <img 
              src={documentUrl} 
              alt="Document Preview" 
              className="w-full h-auto select-none pointer-events-none"
              style={{ display: 'block' }} 
            />
          ) : documentUrl.startsWith('data:application/pdf') ? (
            <Document file={documentUrl} loading={
              <div className="w-[800px] h-[1000px] flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            }>
              <Page pageNumber={1} width={800} renderTextLayer={false} renderAnnotationLayer={false} className="select-none pointer-events-none" />
            </Document>
          ) : (
             <div className="w-[800px] h-[1000px] flex items-center justify-center text-gray-400 bg-gray-50 border">
               Document Format Not Supported
             </div>
          )}

          {/* Render Fields */}
          {fields.map(field => (
            <div
              key={field.id}
              className={`absolute border-2 rounded p-2 flex items-center space-x-2 bg-white/90 backdrop-blur-sm shadow-sm transition-colors touch-none ${
                activeField === field.id ? 'border-blue-500 z-10' : 'border-gray-300 z-0'
              } ${draggingField?.id === field.id ? 'cursor-grabbing opacity-90 scale-105 transition-transform shadow-lg' : 'cursor-grab'}`}
              onPointerDown={(e) => handlePointerDown(e, field.id)}
              onPointerMove={(e) => handlePointerMove(e, field.id)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={() => setActiveField(field.id)}
              style={{
                left: field.x,
                top: field.y,
                width: field.width || (field.type === 'signature' ? 200 : 150),
                height: field.height || (field.type === 'signature' ? 60 : 40),
              }}
            >
              <Move className="w-4 h-4 text-gray-400 pointer-events-none shrink-0" />
              <span className="text-sm font-medium text-gray-700 capitalize select-none pointer-events-none truncate">
                {field.type} Field
              </span>
              
              {/* Resize Handle */}
              {activeField === field.id && (
                <div
                  className="absolute right-0 bottom-0 w-4 h-4 bg-blue-500 cursor-nwse-resize rounded-br rounded-tl-lg shadow-sm"
                  onPointerDown={(e) => handleResizeDown(e, field)}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeUp}
                  onPointerCancel={handleResizeUp}
                />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
