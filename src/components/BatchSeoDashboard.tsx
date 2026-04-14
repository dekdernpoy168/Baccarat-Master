import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  LayoutGrid,
  List,
  Sparkles,
  Wand2,
  Zap
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface BatchResult {
  custom_id: string;
  response: {
    body: {
      content: Array<{
        type: string;
        text: string;
      }>;
    };
  };
}

interface ParsedResult {
  id: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

interface McpServer {
  id: string;
  name: string;
  url: string;
  token?: string;
  enabled: boolean;
}

export const BatchSeoDashboard: React.FC = () => {
  const [titlesText, setTitlesText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<ParsedResult[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  useEffect(() => {
    fetchMcpServers();
  }, []);

  const fetchMcpServers = async () => {
    try {
      const q = query(collection(db, 'mcp_servers'), where('enabled', '==', true));
      const querySnapshot = await getDocs(q);
      const servers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as McpServer[];
      setMcpServers(servers);
    } catch (err) {
      console.error("Error fetching MCP servers:", err);
    }
  };

  const handleStartBatch = async () => {
    const titles = titlesText.split('\n').filter(t => t.trim() !== '');
    if (titles.length === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/batch-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          titles,
          mcpServers: mcpServers.map(s => ({ name: s.name, url: s.url, token: s.token }))
        })
      });
      const data = await response.json() as any;
      if (data.batchId) {
        setBatchId(data.batchId);
        setStatus(data.status);
        // Initialize results with pending status
        setResults(titles.map((title, i) => ({
          id: `seo-req-${i}`,
          title,
          metaTitle: '',
          metaDescription: '',
          status: 'pending'
        })));
      }
    } catch (error) {
      console.error('Batch start error:', error);
    }
  };

  useEffect(() => {
    let interval: any;
    if (batchId && status !== 'ended') {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/ai/batch-results/${batchId}`);
          const data = await response.json() as any;
          setStatus(data.status);
          
          if (data.status === 'ended' && data.results) {
            const newResults = [...results];
            data.results.forEach((res: BatchResult) => {
              const index = newResults.findIndex(r => r.id === res.custom_id);
              if (index !== -1) {
                try {
                  const content = res.response.body.content[0].text;
                  const parsed = JSON.parse(content);
                  newResults[index] = {
                    ...newResults[index],
                    metaTitle: parsed.metaTitle,
                    metaDescription: parsed.metaDescription,
                    status: 'completed'
                  };
                } catch (e) {
                  newResults[index].status = 'error';
                  newResults[index].error = 'Failed to parse AI response';
                }
              }
            });
            setResults(newResults);
            clearInterval(interval);
            setIsProcessing(false);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [batchId, status, results]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-950 min-h-screen text-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <RefreshCw className={cn("w-8 h-8 text-blue-400", isProcessing && "animate-spin")} />
            ระบบสร้าง SEO อัตโนมัติ
          </h1>
          <p className="text-gray-400 mt-1">สร้าง Meta Title และ Description สำหรับบทความหลายรายการพร้อมกัน</p>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('list')}
            className={cn("p-2 rounded-md transition-all", viewMode === 'list' ? "bg-gray-800 shadow-sm text-blue-400" : "text-gray-400 hover:text-gray-200")}
          >
            <List size={20} />
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={cn("p-2 rounded-md transition-all", viewMode === 'grid' ? "bg-gray-800 shadow-sm text-blue-400" : "text-gray-400 hover:text-gray-200")}
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText size={16} />
              หัวข้อบทความ (หนึ่งรายการต่อบรรทัด)
            </label>
            <textarea
              value={titlesText}
              onChange={(e) => setTitlesText(e.target.value)}
              placeholder="ใส่หัวข้อบทความที่นี่..."
              className="w-full h-64 p-4 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-gray-900"
              disabled={isProcessing}
            />
            {!titlesText.trim() && !isProcessing && (
              <p className="text-[10px] text-red-500 mt-1">* กรุณาใส่หัวข้อบทความอย่างน้อย 1 รายการ</p>
            )}
            
            {mcpServers.length > 0 && (
              <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2">เครื่องมือ MCP ที่ใช้งานอยู่</p>
                <div className="flex flex-wrap gap-2">
                  {mcpServers.map(s => (
                    <span key={s.id} className="px-2 py-1 bg-gray-800 rounded-lg text-[10px] font-medium text-purple-300 border border-purple-800 flex items-center gap-1">
                      <Zap size={10} />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleStartBatch}
              disabled={isProcessing || !titlesText.trim()}
              className={cn(
                "w-full mt-4 py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all",
                isProcessing || !titlesText.trim() 
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
              )}
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Send size={18} />}
              {isProcessing ? 'กำลังประมวลผล...' : 'เริ่มสร้างข้อมูล SEO'}
            </button>
          </div>

          {batchId && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">สถานะการทำงาน</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                  status === 'ended' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700 animate-pulse"
                )}>
                  {status === 'ended' ? 'เสร็จสิ้น' : status}
                </span>
              </div>
              <p className="text-xs text-blue-800 break-all">ID: {batchId}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2">
          {results.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl p-12">
              <Sparkles size={48} className="mb-4 opacity-20" />
              <p>ผลลัพธ์จะปรากฏที่นี่เมื่อเริ่มการสร้างข้อมูล</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
            )}>
              <AnimatePresence mode="popLayout">
                {results.map((result) => (
                  <motion.div
                    key={result.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "bg-gray-900 rounded-2xl border border-gray-800 transition-all overflow-hidden",
                      result.status === 'completed' ? "border-gray-100 hover:border-blue-200 hover:shadow-xl" : "border-gray-100 opacity-70"
                    )}
                  >
                    <div 
                      className="p-4 flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                    >
                      <div className="flex items-start gap-3">
                        {result.status === 'completed' ? (
                          <CheckCircle2 className="text-green-500 mt-1 flex-shrink-0" size={18} />
                        ) : result.status === 'error' ? (
                          <AlertCircle className="text-red-500 mt-1 flex-shrink-0" size={18} />
                        ) : (
                          <Loader2 className="text-blue-500 mt-1 animate-spin flex-shrink-0" size={18} />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900 line-clamp-1">{result.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {result.status === 'completed' ? 'สร้างข้อมูลสำเร็จ' : result.status === 'error' ? result.error : 'กำลังรอ AI...'}
                          </p>
                        </div>
                      </div>
                      {expandedId === result.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {expandedId === result.id && result.status === 'completed' && (
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        className="px-4 pb-4 border-t border-gray-50 pt-4 space-y-4"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meta Title</span>
                            <button onClick={() => copyToClipboard(result.metaTitle)} className="text-gray-400 hover:text-blue-600 transition-colors">
                              <Copy size={14} />
                            </button>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-800 font-medium">
                            {result.metaTitle}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meta Description</span>
                            <button onClick={() => copyToClipboard(result.metaDescription)} className="text-gray-400 hover:text-blue-600 transition-colors">
                              <Copy size={14} />
                            </button>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 leading-relaxed">
                            {result.metaDescription}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-12 bg-gray-50 p-6 rounded-3xl border border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-widest">คู่มือ AI SEO</h3>
            <div className="prose prose-sm max-w-none text-gray-600">
              <Markdown remarkPlugins={[remarkGfm]}>
                {`
### วิธีการทำงาน
1. **ใส่ข้อมูล**: ใส่รายการหัวข้อบทความที่คุณต้องการปรับแต่ง
2. **ประมวลผล**: AI จะวิเคราะห์แต่ละหัวข้อและสร้าง Metadata ที่เหมาะสม
3. **ผลลัพธ์**: คุณจะได้รับ **Meta Title** (ไม่เกิน 60 ตัวอักษร) และ **Meta Description** (ไม่เกิน 160 ตัวอักษร)

> **คำแนะนำ**: ใช้คีย์เวิร์ดที่เฉพาะเจาะจงในหัวข้อเพื่อให้ AI ให้ผลลัพธ์ที่ดีขึ้น
                `}
              </Markdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
