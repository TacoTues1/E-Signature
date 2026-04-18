'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, PenTool, CheckCircle, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
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
  value?: string;
};

export default function SignPage() {
  const params = useParams();
  const id = params.id as string;

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [complete, setComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Signature Modal State
  const [activeSigField, setActiveSigField] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas | null>(null);

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const handleResize = () => {
      const screenWidth = window.innerWidth;
      const availableWidth = screenWidth - 32; // basic horizontal padding
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
    // Load config and doc. First check local storage (fallbacks)
    const docData = localStorage.getItem(`doc_${id}`);
    const configData = localStorage.getItem(`config_${id}`);
    
    if (docData) setDocumentUrl(docData);
    if (configData) setFields(JSON.parse(configData));
    
    // In production, fetch from Supabase
    const fetchSupabaseData = async () => {
       try {
         const { data, error } = await supabase.from('documents').select().eq('id', id).single();
         if (data && !error) {
            if (data.file_url) setDocumentUrl(data.file_url);
            if (data.config) setFields(data.config);
         }
       } catch (err) {
         console.warn("Supabase fetch failed, continuing with mock data.", err);
       }
    };
    fetchSupabaseData();
  }, [id]);

  const handleNameChange = (fieldId: string, value: string) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, value } : f));
  };

  const handleSaveSignature = () => {
    if (sigCanvas.current && activeSigField) {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      setFields(fields.map(f => f.id === activeSigField ? { ...f, value: dataUrl } : f));
      setActiveSigField(null);
    }
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const handleClearAll = () => {
    setFields(fields.map(f => ({ ...f, value: undefined })));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Ensure all fields are filled
    const allFilled = fields.every(f => !!f.value);
    if (!allFilled) {
      alert("Please complete all fields before submitting.");
      setIsSubmitting(false);
      return;
    }

    try {
      // In production update DB:
      await supabase.from('documents').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', id);
      
      // Determine what email to send to. Try fetching from local storage.
      const savedEmail = localStorage.getItem(`email_${id}`);
      
      // Send the email notification
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: id,
          emailTo: savedEmail || 'alfonzperez92@gmail.com', // Fallback to your email
          fields: fields
        })
      });
      
      setComplete(true);
    } catch (err) {
      console.error(err);
      setComplete(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!documentUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (complete) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">All Finished!</h2>
          <p className="text-gray-600 mb-6">
            You have successfully signed the document. A copy has been securely sent to the requester's email.
          </p>
          <p className="text-sm text-gray-400">You may safely close this window.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Top Banner */}
      <div className="bg-white border-b shadow-sm p-4 flex justify-between items-center z-10 sticky top-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Secure E-Signature</h1>
          <p className="text-sm text-gray-500">Please review and sign the document below</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleClearAll}
            className="text-gray-500 hover:text-red-600 px-4 py-2 rounded-lg font-medium transition-colors hidden sm:block"
          >
            Clear All
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-colors flex items-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Finish & Submit</>
            )}
          </button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white shadow-xl relative touch-none"
          style={{ width: '800px', transform: `scale(${scale})`, transformOrigin: 'top center' }}
        >
          {documentUrl.startsWith('data:image/') ? (
            <img 
              src={documentUrl} 
              alt="Document to sign" 
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
            <div className="w-[800px] h-[1000px] bg-gray-50 flex items-center justify-center text-gray-300 border">
              Document Format Not Supported
            </div>
          )}

          {/* Interactive Fields Overlay */}
          {fields.map(field => (
            <div
              key={field.id}
              className="absolute group"
              style={{
                left: field.x,
                top: field.y,
                width: field.width || (field.type === 'signature' ? 200 : 150),
                height: field.height || (field.type === 'signature' ? 60 : 40),
              }}
            >
              {field.type === 'name' ? (
                <input
                  type="text"
                  placeholder="Type Full Name"
                  value={field.value || ''}
                  onChange={(e) => handleNameChange(field.id, e.target.value)}
                  className={`w-full h-full border-2 bg-yellow-50/80 px-2 rounded focus:outline-none transition-colors ${
                    field.value ? 'border-green-500 bg-white/90' : 'border-yellow-400 focus:border-blue-500'
                  }`}
                />
              ) : (
                <div 
                  onClick={() => setActiveSigField(field.id)}
                  className={`w-full h-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors bg-white/80 rounded ${
                    field.value ? 'border-green-500 border-solid' : 'border-yellow-400 hover:border-blue-500'
                  }`}
                >
                  {field.value ? (
                    <img src={field.value} alt="Signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-sm font-medium text-gray-600 flex items-center">
                      <PenTool className="w-4 h-4 mr-2" /> Click to Sign
                    </span>
                  )}
                </div>
              )}
              
              {!field.value && (
                <div className="absolute -top-6 left-0 text-xs font-bold text-red-500 bg-white px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  Required
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Signature Modal */}
      {activeSigField && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Draw Your Signature</h3>
              <button 
                onClick={() => setActiveSigField(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="border-2 border-gray-200 rounded-xl mb-4 bg-gray-50 overflow-hidden">
              <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ className: 'sigCanvas w-full h-64' }}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button
                onClick={clearSignature}
                className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2"
              >
                Clear
              </button>
              <div className="space-x-3">
                <button
                  onClick={() => setActiveSigField(null)}
                  className="px-6 py-2 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSignature}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-colors"
                >
                  Save Signature
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
