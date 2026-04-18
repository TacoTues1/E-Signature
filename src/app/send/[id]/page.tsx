'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Mail, Link as LinkIcon, CheckCircle2, ChevronRight, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function SendPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSending(true);
    
    // Construct the link for the user to sign
    const link = `${window.location.origin}/sign/${id}`;

    // Save the recipient email and config
    // We already saved config to localStorage in previous step. In production:
    const configStr = localStorage.getItem(`config_${id}`) || '[]';
    
    try {
      // Supabase interaction (production)
      const { error } = await supabase
        .from('documents')
        .update({ email, config: JSON.parse(configStr) })
        .eq('id', id);

      if (error) {
        console.warn("Supabase save failed, continuing with local demo", error);
      }
      
      // Save locally too for demo purposes if Supabase fails
      localStorage.setItem(`email_${id}`, email);
      
      setShareLink(link);
    } catch (err) {
      console.error(err);
      setShareLink(link);
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
          <Mail className="w-16 h-16 mx-auto mb-4 text-blue-100" />
          <h1 className="text-3xl font-bold mb-2">Send for Signature</h1>
          <p className="text-blue-100">Enter the recipient's email address to receive the completed document.</p>
        </div>

        <div className="p-8">
          {!shareLink ? (
            <form onSubmit={handleGenerateLink} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
                    placeholder="recipient@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSending || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium shadow-md transition-all flex items-center justify-center disabled:opacity-50"
              >
                {isSending ? 'Processing...' : 'Generate Invite Link'}
                {!isSending && <ChevronRight className="w-5 h-5 ml-2" />}
              </button>
            </form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Link Generated!</h2>
              <p className="text-gray-500 mb-6">
                Share this unique link with the recipient to securely sign the document.
              </p>

              <div className="flex items-center space-x-2 bg-gray-50 p-4 rounded-xl border mb-6">
                <LinkIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input 
                  type="text" 
                  readOnly 
                  value={shareLink} 
                  className="bg-transparent border-none focus:ring-0 w-full text-sm text-gray-600 select-all"
                />
                <button
                  onClick={copyToClipboard}
                  className="flex-shrink-0 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>

              {copied && <p className="text-sm text-green-600 font-medium mb-4">Link copied to clipboard!</p>}

              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
              >
                Start Another Document
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
