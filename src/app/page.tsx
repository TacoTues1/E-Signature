'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
  });

  const handleNext = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const docId = uuidv4();
      
      // Let's create an ObjectURL and put it in localStorage as a mock of upload 
      // if Supabase is not configured, to ensure seamless UX for demo purposes.
      // In production with Supabase, we would do:
      // const { data, error } = await supabase.storage.from('documents').upload(`${docId}`, file);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        // Always save to localStorage immediately so transitions are robust and instant
        localStorage.setItem(`doc_${docId}`, base64data);
        
        try {
          const { error: dbError } = await supabase
            .from('documents')
            .insert([{ id: docId, file_url: base64data, status: 'pending' }]);
          
          if (dbError) {
             console.warn("Supabase insert failed, relying purely on localStorage", dbError);
          }
        } catch (e) {
          console.warn("Using local storage fallback due to exception", e);
        }

        router.push(`/prepare/${docId}`);
      };
      reader.readAsDataURL(file);

    } catch (err) {
      console.error(err);
      setError('Failed to upload document.');
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
          <UploadCloud className="w-16 h-16 mx-auto mb-4 text-blue-100" />
          <h1 className="text-3xl font-bold mb-2">Upload Document</h1>
          <p className="text-blue-100">Upload a PDF or image to configure and send for e-signature.</p>
        </div>

        <div className="p-8">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors duration-200 ease-in-out ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            {!file ? (
              <div className="flex flex-col items-center">
                <File className="w-10 h-10 text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium">Drag & drop your file here</p>
                <p className="text-gray-400 text-sm mt-1">or click to browse</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <File className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-800 font-semibold">{file.name}</p>
                <p className="text-gray-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleNext}
              disabled={!file || isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Next Step'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
