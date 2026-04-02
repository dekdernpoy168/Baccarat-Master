import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  TrendingUp, 
  ShieldCheck, 
  ChevronRight, 
  Menu, 
  X, 
  Facebook, 
  Twitter, 
  ExternalLink,
  Award,
  Zap,
  Target,
  Plus,
  Edit,
  Trash2,
  Save,
  LogOut,
  Lock,
  Image as ImageIcon,
  FileText,
  Search,
  Heart,
  Crown,
  Check,
  Upload,
  Download,
  Sparkles,
  Wand2,
  Type as TypeIcon,
  Eye,
  Calendar,
  Tag
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import { format } from 'date-fns';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}
import { Helmet } from 'react-helmet-async';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where,
  getDocs,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { ARTICLES as STATIC_ARTICLES, Article } from './constants';
import { cn } from './lib/utils';

// --- Types & Constants ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const ADMIN_EMAIL = "dekdernpoy168@gmail.com";

// --- SEO Component ---
const SEO = ({ title, description, keywords, canonicalUrl, type = "website", image, schema }: { title: string, description: string, keywords?: string, canonicalUrl?: string, type?: string, image?: string, schema?: any }) => {
  const siteName = "Baccarat Master Guide";
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const defaultImage = localStorage.getItem('baccarat_master_logo') || "https://img2.pic.in.th/LOGO1-Baccarat-Master.png";
  const ogImage = image || defaultImage;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image || defaultImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image || defaultImage} />
      
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Schema.org */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
};

// --- Helpers ---
const isPublished = (article: Article) => {
  if (article.status === 'draft') return false;
  if (!article.publishedAt) return true;
  const pubDate = new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt);
  return pubDate <= new Date();
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Extracted Components ---

const PromptBuilderModal = ({ isOpen, onClose, onExecute }: { isOpen: boolean, onClose: () => void, onExecute: (prompt: string) => void }) => {
  const [category, setCategory] = useState('Copywriting');
  const [subCategory, setSubCategory] = useState('Blog Writing');
  const [template, setTemplate] = useState('Generate Paragraph Of Text');
  const [language, setLanguage] = useState('Thai');
  const [voiceTone, setVoiceTone] = useState('Professional');
  const [writingStyle, setWritingStyle] = useState('Informative');
  const [targetAudience, setTargetAudience] = useState('General');
  const [anchorText, setAnchorText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [totalWords, setTotalWords] = useState('1000');
  const [keywords, setKeywords] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywordCount, setSecondaryKeywordCount] = useState('10');
  const [isGeneratingSecondaryKeywords, setIsGeneratingSecondaryKeywords] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [isFetchingKeywords, setIsFetchingKeywords] = useState(false);

  const fetchKeywordsData = async () => {
    if (!topic.trim()) return;
    setIsFetchingKeywords(true);
    try {
      const apiKey = process.env.KEYWORDS_EVERYWHERE_API_KEY;
      if (!apiKey) {
        alert('กรุณาตั้งค่า KEYWORDS_EVERYWHERE_API_KEY ในระบบก่อนใช้งาน');
        return;
      }

      const formData = new URLSearchParams();
      formData.append('dataSource', 'gsc');
      formData.append('country', 'th');
      formData.append('currency', 'THB');
      formData.append('kw[]', topic);

      const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to fetch keywords');
      
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        const kwList = data.data.map((item: any) => item.keyword).join(', ');
        setKeywords(prev => prev ? `${prev}, ${kwList}` : kwList);
      }
    } catch (err) {
      console.error('Keywords Everywhere Error:', err);
      alert('ไม่สามารถดึงข้อมูล Keywords ได้ในขณะนี้');
    } finally {
      setIsFetchingKeywords(false);
    }
  };

  const generateSecondaryKeywords = async () => {
    if (!primaryKeyword.trim()) {
      alert('กรุณาใส่คีย์เวิร์ดหลักก่อน');
      return;
    }
    setIsGeneratingSecondaryKeywords(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate ${secondaryKeywordCount} secondary keywords (คีย์รอง) related to the primary keyword: "${primaryKeyword}". 
        Return ONLY the keywords as a comma-separated list. No other text.`,
      });
      
      const text = response.text || '';
      const generatedKeywords = text.trim().replace(/\s*,\s*/g, ',');
      if (generatedKeywords) {
        setKeywords(prev => prev ? `${prev},${generatedKeywords}` : generatedKeywords);
      }
    } catch (err) {
      console.error('AI Keyword Generation Error:', err);
      alert('ไม่สามารถสร้างคีย์เวิร์ดได้ในขณะนี้');
    } finally {
      setIsGeneratingSecondaryKeywords(false);
    }
  };

  useEffect(() => {
    let generatedPrompt = `Please ignore all previous instructions. You are an expert copywriter who writes detailed and thoughtful blog articles. 
    Tone of voice: ${voiceTone}. 
    Writing style: ${writingStyle}. 
    Target audience: ${targetAudience}. 
    Template type: ${template}.
    
    I want you to write around ${totalWords} words on "${topic}" in the ${language} language. 
    
    Keywords to include: "${keywords}". Please highlight these keywords in bold in the text using markdown.
    
    Instructions:
    - Intersperse short and long sentences. 
    - Utilize uncommon terminology to enhance the originality of the content. 
    - Format the content in a professional format using HTML tags (h2, p, ul, li, strong). 
    - Do not self-reference. 
    - Do not explain what you are doing.`;

    if (anchorText && linkUrl) {
      generatedPrompt += `\n\nInternal Linking: Please find a natural place to include an internal link using the anchor text "${anchorText}" pointing to the URL "${linkUrl}". Use the HTML format: <a href="${linkUrl}">${anchorText}</a>.`;
    }

    setPromptTemplate(generatedPrompt);
  }, [voiceTone, writingStyle, targetAudience, template, totalWords, topic, language, keywords, anchorText, linkUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1c1e] border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="bg-[#2d2f31] px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white text-black rounded-full flex items-center justify-center text-xs font-black">K</div>
            <h2 className="text-white font-bold text-sm">ChatGPT Prompt Templates by Keywords Everywhere</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Category:</label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              >
                <option>Copywriting</option>
                <option>SEO</option>
                <option>Marketing</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Sub-category:</label>
              <select 
                value={subCategory}
                onChange={e => setSubCategory(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              >
                <option>Blog Writing</option>
                <option>Product Description</option>
                <option>Social Media</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Templates:</label>
              <select 
                value={template}
                onChange={e => setTemplate(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              >
                <option>Generate Paragraph Of Text</option>
                <option>Generate Full Article</option>
                <option>Generate Outline</option>
                <option>How-to Guide</option>
                <option>Listicle (Top 10, etc.)</option>
                <option>Product Review</option>
                <option>Comparison Article</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Languages:</label>
              <select 
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              >
                <option>Thai</option>
                <option>English</option>
                <option>Chinese</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Voice Tones:</label>
              <select 
                value={voiceTone}
                onChange={e => setVoiceTone(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              >
                <option>Professional</option>
                <option>Friendly</option>
                <option>Witty</option>
                <option>Authoritative</option>
                <option>Empathetic</option>
                <option>Persuasive</option>
                <option>Inspirational</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Writing Styles:</label>
              <select 
                value={writingStyle}
                onChange={e => setWritingStyle(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              >
                <option>Informative</option>
                <option>Creative</option>
                <option>Analytical</option>
                <option>Conversational</option>
                <option>Descriptive</option>
                <option>Expository</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Target Audience:</label>
              <input 
                type="text" 
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="e.g. Beginners, Experts"
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Anchor Text (Internal Link):</label>
              <input 
                type="text" 
                value={anchorText}
                onChange={e => setAnchorText(e.target.value)}
                placeholder="Keywords for link"
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">Link URL:</label>
              <input 
                type="text" 
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase flex items-center gap-1">หัวข้อบทความ (Topic) <Search size={10} /></label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Topic"
                  className="flex-1 bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
                />
                <button 
                  onClick={fetchKeywordsData}
                  disabled={isFetchingKeywords || !topic.trim()}
                  className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-3 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isFetchingKeywords ? <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin"></div> : <Search size={12} />}
                  Get Keywords
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase flex items-center gap-1">Total Words <Search size={10} /></label>
              <input 
                type="number" 
                value={totalWords}
                onChange={e => setTotalWords(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase flex items-center gap-1">คีย์เวิร์ดหลัก (Primary Keyword) <Search size={10} /></label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={primaryKeyword}
                  onChange={e => setPrimaryKeyword(e.target.value)}
                  placeholder="เช่น บาคาร่า"
                  className="flex-1 bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
                />
                <button 
                  onClick={generateSecondaryKeywords}
                  disabled={isGeneratingSecondaryKeywords || !primaryKeyword.trim()}
                  className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-3 py-2 rounded text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingSecondaryKeywords ? (
                    <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Wand2 size={12} />
                  )}
                  Generate Keywords
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-400 text-[10px] font-bold uppercase">จำนวนคีย์รอง:</label>
              <input 
                type="number" 
                value={secondaryKeywordCount}
                onChange={e => setSecondaryKeywordCount(e.target.value)}
                className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-400 text-[10px] font-bold uppercase flex items-center gap-1">คีย์เวิร์ดรอง (Secondary Keywords) <Search size={10} /></label>
            <textarea 
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="คีย์รองจะแสดงที่นี่ แยกด้วยเครื่องหมายจุลภาค (,)"
              className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-white text-sm outline-none focus:border-gold h-24"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-400 text-[10px] font-bold uppercase">Prompt Template</label>
            <textarea 
              readOnly
              value={promptTemplate}
              className="w-full bg-[#2d2f31] border border-white/10 rounded px-3 py-2 text-gray-400 text-xs outline-none h-32"
            />
          </div>
        </div>

        <div className="bg-[#2d2f31] px-6 py-4 flex justify-end">
          <button 
            onClick={() => onExecute(promptTemplate)}
            className="bg-[#4a4c4e] hover:bg-[#5a5c5e] text-white px-6 py-2 rounded text-sm font-bold transition-colors"
          >
            Execute Template
          </button>
        </div>
      </motion.div>
    </div>
  );
};


const SelectionModal = ({ 
  isOpen, 
  onClose, 
  title, 
  options, 
  onSelect 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  title: string, 
  options: string[], 
  onSelect: (value: string) => void 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-gold/20 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-gold/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-gold" size={20} />
            {title}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-gray-400 text-sm">เลือกตัวเลือกที่คุณต้องการใช้:</p>
          <div className="space-y-3">
            {options.map((option, index) => (
              <div 
                key={index}
                className="group relative bg-black/40 border border-gold/10 rounded-2xl p-4 hover:border-gold/40 transition-all cursor-pointer"
                onClick={() => onSelect(option)}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-white text-sm leading-relaxed">{option}</p>
                  <button 
                    className="shrink-0 bg-gold/10 group-hover:bg-gold text-gold group-hover:text-black px-3 py-1 rounded-full text-xs font-bold transition-all"
                  >
                    เลือก
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t border-gold/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-gray-400 hover:text-white transition-colors font-bold"
          >
            ยกเลิก
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SeoGeneratorModal = ({ isOpen, onClose, onExecute, topic: initialTopic = '' }: { isOpen: boolean, onClose: () => void, onExecute: (data: { metaTitle: string, metaDescription: string }) => void, topic?: string }) => {
  const [keyword, setKeyword] = useState('');
  const [topic, setTopic] = useState(initialTopic);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!keyword.trim() || !topic.trim()) {
      alert('กรุณาใส่คีย์เวิร์ดและหัวข้อ');
      return;
    }
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `คุณคือผู้เชี่ยวชาญด้าน SEO เขียน Meta Title และ Meta Description โดยอิงจากคีย์เวิร์ดหลักและหัวข้อที่กำหนดให้
        
        คีย์เวิร์ดหลัก: ${keyword}
        หัวข้อ: ${topic}
        
        ข้อกำหนดที่สำคัญมาก:
        - Meta Title: **ห้ามเกิน 60 ตัวอักษร** ต้องมีคีย์เวิร์ดหลักอยู่ด้วย
        - Meta Description: **ห้ามเกิน 160 ตัวอักษร** ต้องมีคีย์เวิร์ดหลักและสรุปเนื้อหาที่น่าดึงดูด
        
        ให้ตอบกลับเป็น JSON เท่านั้น`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              metaTitle: { type: Type.STRING },
              metaDescription: { type: Type.STRING }
            },
            required: ["metaTitle", "metaDescription"]
          }
        }
      });
      
      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const result = JSON.parse(jsonStr);
      onExecute(result);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้างข้อมูล SEO');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1c1e] border border-gold/30 rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl shadow-gold/10"
      >
        <div className="bg-gold/10 px-6 py-4 flex items-center justify-between border-b border-gold/20">
          <h2 className="text-gold font-bold flex items-center gap-2"><Sparkles size={18} /> Generate Meta Title & Description</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-gray-400 text-[10px] font-bold uppercase">คีย์เวิร์ดหลัก (Primary Keyword)</label>
            <input 
              type="text" 
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="เช่น บาคาร่าออนไลน์, วิธีเล่นบาคาร่า"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-gold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-gray-400 text-[10px] font-bold uppercase">หัวข้อ (Topic)</label>
            <input 
              type="text" 
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="หัวข้อบทความ"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-gold"
            />
          </div>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !keyword.trim() || !topic.trim()}
            className="w-full gold-bg-gradient text-baccarat-black py-3 rounded-xl font-bold flex items-center justify-center transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-baccarat-black border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <Wand2 size={18} className="mr-2" />
            )}
            Generate Tit&Des
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AdminDashboard = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{old: string, new: string} | null>(null);
  const [currentArticle, setCurrentArticle] = useState<Partial<Article>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [showSeoModal, setShowSeoModal] = useState(false);
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(false);
  const [isGeneratingExcerpt, setIsGeneratingExcerpt] = useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isGeneratingLogo, setIsGeneratingLogo] = useState(false);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(localStorage.getItem('baccarat_master_logo'));
  const [slugOptions, setSlugOptions] = useState<string[]>([]);
  const [excerptOptions, setExcerptOptions] = useState<string[]>([]);
  const [showSlugSelection, setShowSlugSelection] = useState(false);
  const [showExcerptSelection, setShowExcerptSelection] = useState(false);

  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'scheduled'>('all');

  // Fetch data on mount
  useEffect(() => {
    const fetchArticles = () => {
      try {
        const qArticles = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(qArticles, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Article[];
          setArticles(docs);
        }, (err) => {
          console.error("Firestore Error (Articles):", err);
          setError("ไม่สามารถดึงข้อมูลบทความได้: " + err.message);
        });
        return unsubscribe;
      } catch (err: any) {
        console.error("Fetch Articles Error:", err);
        setError(err.message);
      }
    };

    const fetchCategories = () => {
      try {
        const qCategories = query(collection(db, 'categories'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(qCategories, (snapshot) => {
          const cats = snapshot.docs.map(doc => doc.data().name as string);
          setCategories(cats);
        }, (err) => {
          console.error("Firestore Error (Categories):", err);
        });
        return unsubscribe;
      } catch (err: any) {
        console.error("Fetch Categories Error:", err);
      }
    };

    const unsubArticles = fetchArticles();
    const unsubCategories = fetchCategories();

    return () => {
      if (unsubArticles && typeof unsubArticles === 'function') unsubArticles();
      if (unsubCategories && typeof unsubCategories === 'function') unsubCategories();
    };
  }, []);

  const filteredArticles = articles.filter(a => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'draft') return a.status === 'draft';
    if (filterStatus === 'published') return a.status !== 'draft' && (!a.publishedAt || new Date(a.publishedAt.seconds ? a.publishedAt.seconds * 1000 : a.publishedAt) <= new Date());
    if (filterStatus === 'scheduled') return a.status !== 'draft' && a.publishedAt && new Date(a.publishedAt.seconds ? a.publishedAt.seconds * 1000 : a.publishedAt) > new Date();
    return true;
  });

  const generateSlugFromTitle = async () => {
    if (!currentArticle.title?.trim()) {
      alert('กรุณาใส่หัวข้อบทความก่อน');
      return;
    }
    setIsGeneratingSlug(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 3 SEO-friendly URL slug options in English for this Thai article title: "${currentArticle.title}". Use only lowercase letters and hyphens.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["options"]
          }
        }
      });
      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const data = JSON.parse(jsonStr);
      const cleanedOptions = (data.options || []).map((s: string) => 
        s.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      );
      if (cleanedOptions.length > 0) {
        setSlugOptions(cleanedOptions);
        setShowSlugSelection(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingSlug(false);
    }
  };

  const generateLogo = async () => {
    setIsGeneratingLogo(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: "A professional and luxurious logo for a website named 'Baccarat Master Guide'. The design should feature a combination of playing cards, a golden crown, and elegant typography. The color palette should be gold, black, and deep red. High-end, minimalist but authoritative. Square aspect ratio.",
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const base64 = `data:image/png;base64,${part.inlineData.data}`;
          setGeneratedLogo(base64);
          localStorage.setItem('baccarat_master_logo', base64);
        }
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้างโลโก้');
    } finally {
      setIsGeneratingLogo(false);
    }
  };

  const generateKeywords = async () => {
    if (!currentArticle.title?.trim() && !currentArticle.metaTitle?.trim() && !currentArticle.metaDescription?.trim()) {
      alert('กรุณาใส่หัวข้อบทความ, Meta Title หรือ Meta Description ก่อน');
      return;
    }
    setIsGeneratingKeywords(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `คุณคือผู้เชี่ยวชาญด้าน SEO วิเคราะห์ข้อมูลบทความต่อไปนี้ แล้วสร้าง Keywords Meta Tag ที่เหมาะสมที่สุด 5-8 คำ (คั่นด้วยลูกน้ำ) โดยอิงจากคำที่ใช้และเนื้อหาที่ควรจะเป็น
        
        หัวข้อบทความ (Title): ${currentArticle.title || '-'}
        Meta Title: ${currentArticle.metaTitle || '-'}
        Meta Description: ${currentArticle.metaDescription || '-'}
        
        ตอบกลับมาเฉพาะคำคีย์เวิร์ดที่คั่นด้วยลูกน้ำ (,) เท่านั้น ห้ามมีข้อความอื่น`,
      });
      
      const keywords = response.text?.trim();
      if (keywords) {
        setCurrentArticle(prev => ({ ...prev, metaKeywords: keywords }));
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการสร้าง Keywords');
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const generateExcerptFromTitle = async () => {
    if (!currentArticle.title?.trim()) {
      alert('กรุณาใส่หัวข้อบทความก่อน');
      return;
    }
    setIsGeneratingExcerpt(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `เขียนคำโปรย (Excerpt) สั้นๆ ประมาณ 1-2 ประโยค จำนวน 3 ตัวเลือก สำหรับบทความหัวข้อ: "${currentArticle.title}". เน้นความน่าสนใจและดึงดูดผู้อ่าน.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["options"]
          }
        }
      });
      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const data = JSON.parse(jsonStr);
      if (data.options && data.options.length > 0) {
        setExcerptOptions(data.options);
        setShowExcerptSelection(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingExcerpt(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAI(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `คุณคือผู้เชี่ยวชาญด้านการเขียนบทความ SEO และการพนันออนไลน์ (บาคาร่า) ที่มีประสบการณ์จริง เขียนด้วยภาษาที่อ่านง่าย สื่อสารได้ใจความ ไม่ซับซ้อน มีความเป็นมนุษย์ มีมุมมองเฉพาะตัวเหมือนคนเขียนจริงๆ ไม่ใช่หุ่นยนต์

โจทย์/คีย์เวิร์ด: ${aiPrompt}

ข้อกำหนด:
- เขียนเนื้อหาบทความในรูปแบบ HTML (ใช้ <h2>, <p>, <ul>, <li>, <strong>)
- **ความยาวของเนื้อหาบทความต้องอยู่ระหว่าง 1000 - 1500 คำ** (เน้นเนื้อหาที่เจาะลึกและมีประโยชน์)
- นำคีย์เวิร์ดที่เกี่ยวข้องมาแทรกในเนื้อหาและติดตัวหนา (<strong>) ไว้ด้วย
- เน้นความแม่นยำของข้อมูล
- **Meta Title: ห้ามเกิน 60 ตัวอักษร**
- **Meta Description: ห้ามเกิน 160 ตัวอักษร**
- **URL Slug: ภาษาอังกฤษเท่านั้น ใช้ - แทนช่องว่าง**

สำคัญ: ให้ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างที่กำหนด ห้ามมีข้อความอื่นนอกเหนือจาก JSON`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING, description: "เนื้อหาบทความ HTML ความยาว 1000-1500 คำ" },
              metaTitle: { type: Type.STRING, description: "Meta Title สำหรับ SEO" },
              metaDescription: { type: Type.STRING, description: "Meta Description สำหรับ SEO" },
              slug: { type: Type.STRING, description: "URL Slug ภาษาอังกฤษ" }
            },
            required: ["content", "metaTitle", "metaDescription", "slug"]
          }
        }
      });
      
      const text = response.text || '';
      console.log('AI Raw Response:', text);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      
      try {
        const result = JSON.parse(jsonStr || '{}');
        console.log('AI Parsed Result:', result);
        
        if (result) {
          setCurrentArticle(prev => {
            const updated = {
              ...prev,
              content: (prev.content || '') + (result.content || ''),
              metaTitle: result.metaTitle || prev.metaTitle || '',
              metaDescription: result.metaDescription || prev.metaDescription || '',
              slug: result.slug || prev.slug || ''
            };
            console.log('Updating Article State:', updated);
            return updated;
          });
          setAiPrompt('');
        }
      } catch (parseErr) {
        console.error('JSON Parse Error:', parseErr);
        // Fallback: if JSON parse fails, just use the raw text as content
        setCurrentArticle(prev => ({
          ...prev,
          content: (prev.content || '') + text
        }));
      }
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setError('ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'categories'), where('name', '==', newCategoryName.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
      }
      setNewCategoryName('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.new.trim()) return;
    setLoading(true);
    try {
      // 1. Update Category Name in categories collection
      const q = query(collection(db, 'categories'), where('name', '==', editingCategory.old));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'categories', d.id), { name: editingCategory.new.trim() });
      }

      // 2. Update all articles using this category
      const articlesToUpdate = articles.filter(a => a.category === editingCategory.old);
      for (const art of articlesToUpdate) {
        if (art.id) {
          await updateDoc(doc(db, 'articles', art.id), { category: editingCategory.new.trim() });
        }
      }
      setEditingCategory(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${catName}"?`)) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'categories'), where('name', '==', catName));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'categories', d.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    setLoading(true);
    setError(null);

    try {
      if (extension === 'docx') {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const content = result.value;
            
            if (content.length > 1000000) {
              setError(`เนื้อหาจากไฟล์ Word มีขนาดใหญ่เกินไป (${(content.length / 1024 / 1024).toFixed(2)} MB) กรุณาลดขนาดรูปภาพในไฟล์ Word ก่อนอัปโหลด`);
              setLoading(false);
              return;
            }

            setCurrentArticle({
              ...currentArticle,
              title: currentArticle.title || file.name.replace('.docx', ''),
              content: content
            });
            setLoading(false);
          } catch (err) {
            console.error('Mammoth error:', err);
            setError('ไม่สามารถอ่านไฟล์ Word ได้');
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += pageText + '\n\n';
            }
            
            const content = fullText.replace(/\n/g, '<br>');
            if (content.length > 1000000) {
              setError(`เนื้อหาจากไฟล์ PDF มีขนาดใหญ่เกินไป (${(content.length / 1024 / 1024).toFixed(2)} MB) กรุณาลดจำนวนหน้าหรือเนื้อหา`);
              setLoading(false);
              return;
            }

            setCurrentArticle({
              ...currentArticle,
              title: currentArticle.title || file.name.replace('.pdf', ''),
              content: content
            });
            setLoading(false);
          } catch (err) {
            console.error('PDF.js error:', err);
            setError('ไม่สามารถอ่านไฟล์ PDF ได้');
            setLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (['txt', 'md', 'html', 'rtf'].includes(extension || '')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          
          if (text.length > 1000000) {
            setError(`เนื้อหาไฟล์มีขนาดใหญ่เกินไป (${(text.length / 1024 / 1024).toFixed(2)} MB)`);
            setLoading(false);
            return;
          }

          setCurrentArticle({
            ...currentArticle,
            title: currentArticle.title || file.name.split('.')[0],
            content: extension === 'html' ? text : text.replace(/\n/g, '<br>')
          });
          setLoading(false);
        };
        reader.readAsText(file);
      } else {
        setError('รูปแบบไฟล์ไม่รองรับในขณะนี้');
        setLoading(false);
      }
    } catch (err) {
      console.error('File upload error:', err);
      setError('เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent, status: 'published' | 'draft' = 'published') => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Remove id from data object to avoid saving it as a field
      const { id, ...dataWithoutId } = currentArticle;
      
      const getPublishedAt = () => {
        if (status === 'draft') return null;
        if (!currentArticle.publishedAt) return serverTimestamp();
        // If it's a string from the datetime-local input
        if (typeof currentArticle.publishedAt === 'string') return new Date(currentArticle.publishedAt);
        // If it's already a Firestore Timestamp or Date object
        return currentArticle.publishedAt;
      };

      const articleData = {
        ...dataWithoutId,
        status,
        updatedAt: serverTimestamp(),
        date: format(new Date(), 'yyyy-MM-dd'),
        author: auth.currentUser?.displayName || 'Admin',
        publishedAt: getPublishedAt(),
      };

      // Check document size (Firestore limit is 1MB)
      const estimatedSize = JSON.stringify(articleData).length;
      if (estimatedSize > 1000000) {
        throw new Error(`บทความมีขนาดใหญ่เกินไป (${(estimatedSize / 1024 / 1024).toFixed(2)} MB) ขีดจำกัดของระบบคือ 1 MB กรุณาลดขนาดเนื้อหาหรือรูปภาพที่ฝังอยู่ในบทความ`);
      }

      if (id) {
        const docRef = doc(db, 'articles', id);
        await updateDoc(docRef, articleData);
      } else {
        await addDoc(collection(db, 'articles'), {
          ...articleData,
          createdAt: serverTimestamp(),
        });
      }

      // Also ensure category exists in categories collection
      if (articleData.category) {
        const q = query(collection(db, 'categories'), where('name', '==', articleData.category));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, 'categories'), { name: articleData.category });
        }
      }

      setIsEditing(false);
      setCurrentArticle({});
    } catch (err: any) {
      let message = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error.includes('permission-denied')) {
          message = "คุณไม่มีสิทธิ์ในการบันทึกข้อมูล (Permission Denied)";
        } else if (parsed.error.includes('exceeds the maximum allowed size')) {
          message = "บทความมีขนาดใหญ่เกินไป (เกิน 1MB) กรุณาลดขนาดรูปภาพหรือเนื้อหาลง";
        } else {
          message = parsed.error;
        }
      } catch (e) {
        if (err.message.includes('เกินไป')) {
          message = err.message;
        } else {
          message = err.message || message;
        }
      }
      setError(message);
      console.error("Save Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("ยืนยันการลบตัวเลือกนี้?")) return;
    try {
      await deleteDoc(doc(db, 'articles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'articles');
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  if (isManagingCategories) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <SEO title="จัดการหมวดหมู่ | Admin" description="จัดการหมวดหมู่บทความ" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gold/20 p-8 rounded-3xl"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gold">จัดการหมวดหมู่</h2>
            <button onClick={() => setIsManagingCategories(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <input 
                type="text" 
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="ชื่อหมวดหมู่ใหม่..."
                className="flex-grow bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
              />
              <button 
                onClick={handleSaveCategory}
                disabled={loading}
                className="gold-bg-gradient text-baccarat-black px-6 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? '...' : 'เพิ่มหมวดหมู่'}
              </button>
            </div>

            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl">
                  {editingCategory?.old === cat ? (
                    <div className="flex-grow flex gap-2 mr-4">
                      <input 
                        type="text" 
                        value={editingCategory.new}
                        onChange={e => setEditingCategory({...editingCategory, new: e.target.value})}
                        className="flex-grow bg-black border border-gold rounded-lg px-3 py-1 text-white text-sm"
                      />
                      <button onClick={handleUpdateCategory} className="text-green-500 hover:text-green-400"><Check size={20} /></button>
                      <button onClick={() => setEditingCategory(null)} className="text-red-500 hover:text-red-400"><X size={20} /></button>
                    </div>
                  ) : (
                    <span className="text-white font-medium">{cat}</span>
                  )}
                  
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => setEditingCategory({old: cat, new: cat})}
                      className="text-gray-400 hover:text-gold transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO title="Admin Dashboard" description="จัดการบทความและเนื้อหาทั้งหมดของเว็บไซต์" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Admin <span className="text-gold">Dashboard</span></h1>
          <p className="text-gray-400">จัดการบทความและเนื้อหาทั้งหมดของเว็บไซต์</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsManagingCategories(true)}
            className="bg-gray-800 text-white px-6 py-3 rounded-full font-bold hover:bg-gray-700 transition-all flex items-center"
          >
            <Target size={20} className="mr-2 text-gold" /> จัดการหมวดหมู่
          </button>
          <button 
            onClick={() => { setIsEditing(true); setCurrentArticle({}); }}
            className="gold-bg-gradient text-baccarat-black px-8 py-3 rounded-full font-black hover:scale-105 transition-transform flex items-center"
          >
            <Plus size={20} className="mr-2" /> เพิ่มบทความใหม่
          </button>
        </div>
      </div>

      {isEditing ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gold/20 p-8 rounded-3xl"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-gold/10 pb-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-gold uppercase tracking-tight">
                {currentArticle.id ? 'แก้ไขบทความ' : 'สร้างบทความใหม่'}
              </h2>
              <p className="text-gray-500 text-xs">จัดการเนื้อหาและสถานะการเผยแพร่</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button 
                disabled={loading}
                type="button"
                onClick={(e) => handleSave(e, 'draft')}
                className="bg-gray-800 text-white px-6 py-2.5 rounded-full font-bold hover:bg-gray-700 transition-all flex items-center disabled:opacity-50 text-sm border border-white/5"
              >
                {loading ? '...' : <><FileText size={18} className="mr-2 text-gold" /> บันทึกฉบับร่าง</>}
              </button>
              <button 
                disabled={loading}
                type="button"
                onClick={(e) => handleSave(e, 'published')}
                className="gold-bg-gradient text-baccarat-black px-8 py-2.5 rounded-full font-black hover:scale-105 transition-all flex items-center disabled:opacity-50 text-sm shadow-lg shadow-gold/10"
              >
                {loading ? '...' : <><Save size={18} className="mr-2" /> เผยแพร่บทความ</>}
              </button>
              <button onClick={() => setIsEditing(false)} className="ml-2 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"><X size={24} /></button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-baccarat-red/20 border border-baccarat-red rounded-xl text-white text-sm">
              <strong>เกิดข้อผิดพลาด:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-gold/5 border border-gold/20 rounded-2xl mb-6">
              <div className="flex-grow">
                <p className="text-gold font-bold text-sm mb-1 flex items-center">
                  <Upload size={16} className="mr-2" /> นำเข้าเนื้อหาจากไฟล์
                </p>
                <p className="text-gray-400 text-xs">รองรับ .docx, .pdf, .txt, .md, .html, .rtf</p>
              </div>
              <label className="bg-gold text-baccarat-black px-4 py-2 rounded-xl font-bold text-sm cursor-pointer hover:scale-105 transition-transform flex items-center">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-baccarat-black border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Plus size={16} className="mr-2" />
                )}
                เลือกไฟล์
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".docx,.pdf,.txt,.md,.html,.rtf" 
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gold text-sm font-bold flex items-center"><TypeIcon size={16} className="mr-2" /> หัวข้อบทความ (Title)</label>
                </div>
                <input 
                  required
                  type="text" 
                  value={currentArticle.title || ''} 
                  onChange={e => setCurrentArticle({...currentArticle, title: e.target.value})}
                  className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  placeholder="เช่น วิธีเล่นบาคาร่า..."
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-gold text-sm font-bold flex items-center"><ExternalLink size={16} className="mr-2" /> Slug (URL)</label>
                  <button 
                    type="button"
                    onClick={generateSlugFromTitle}
                    disabled={isGeneratingSlug || !currentArticle.title?.trim()}
                    className="text-[10px] bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-2 py-1 rounded-md transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    {isGeneratingSlug ? <div className="w-2 h-2 border border-gold border-t-transparent rounded-full animate-spin"></div> : <Zap size={10} />}
                    Generate Slug
                  </button>
                </div>
                <input 
                  required
                  type="text" 
                  value={currentArticle.slug || ''} 
                  onChange={e => setCurrentArticle({...currentArticle, slug: e.target.value})}
                  className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  placeholder="เช่น how-to-play-baccarat"
                />
              </div>
            </div>


            <div className="bg-black/50 p-6 rounded-2xl border border-gold/10 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center"><Search size={18} className="mr-2 text-gold" /> SEO Settings</h3>
                <button 
                  type="button"
                  onClick={() => setShowSeoModal(true)}
                  className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center transition-all"
                >
                  <Sparkles size={14} className="mr-2" /> Generate SEO Tags
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-400 text-xs font-bold uppercase">Meta Title</label>
                    <span className={clsx("text-[10px]", (currentArticle.metaTitle?.length || 0) > 60 ? "text-red-500 font-bold" : "text-gray-500")}>
                      {currentArticle.metaTitle?.length || 0}/60
                    </span>
                  </div>
                  <input 
                    type="text" 
                    value={currentArticle.metaTitle || ''} 
                    onChange={e => setCurrentArticle({...currentArticle, metaTitle: e.target.value})}
                    className={clsx(
                      "w-full bg-black border rounded-xl px-4 py-3 text-white focus:border-gold outline-none transition-colors",
                      (currentArticle.metaTitle?.length || 0) > 60 ? "border-red-500/50" : "border-white/10"
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-400 text-xs font-bold uppercase">Meta Description</label>
                    <span className={clsx("text-[10px]", (currentArticle.metaDescription?.length || 0) > 160 ? "text-red-500 font-bold" : "text-gray-500")}>
                      {currentArticle.metaDescription?.length || 0}/160
                    </span>
                  </div>
                  <textarea 
                    value={currentArticle.metaDescription || ''} 
                    onChange={e => setCurrentArticle({...currentArticle, metaDescription: e.target.value})}
                    className={clsx(
                      "w-full bg-black border rounded-xl px-4 py-3 text-white focus:border-gold outline-none h-24 transition-colors",
                      (currentArticle.metaDescription?.length || 0) > 160 ? "border-red-500/50" : "border-white/10"
                    )}
                  />
                </div>
              </div>
            </div>


            <SeoGeneratorModal 
              isOpen={showSeoModal} 
              onClose={() => setShowSeoModal(false)} 
              topic={currentArticle.title}
              onExecute={(data) => {
                setCurrentArticle(prev => ({
                  ...prev,
                  metaTitle: data.metaTitle,
                  metaDescription: data.metaDescription
                }));
                setShowSeoModal(false);
              }}
            />

            <SelectionModal 
              isOpen={showSlugSelection}
              onClose={() => setShowSlugSelection(false)}
              title="เลือก Slug (URL)"
              options={slugOptions}
              onSelect={(value) => {
                setCurrentArticle(prev => ({ ...prev, slug: value }));
                setShowSlugSelection(false);
              }}
            />

            <SelectionModal 
              isOpen={showExcerptSelection}
              onClose={() => setShowExcerptSelection(false)}
              title="เลือกคำโปรย (Excerpt)"
              options={excerptOptions}
              onSelect={(value) => {
                setCurrentArticle(prev => ({ ...prev, excerpt: value }));
                setShowExcerptSelection(false);
              }}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-gold text-sm font-bold flex items-center"><FileText size={16} className="mr-2" /> คำโปรย (Excerpt)</label>
                <button 
                  type="button"
                  onClick={generateExcerptFromTitle}
                  disabled={isGeneratingExcerpt || !currentArticle.title?.trim()}
                  className="text-[10px] bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-2 py-1 rounded-md transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  {isGeneratingExcerpt ? <div className="w-2 h-2 border border-gold border-t-transparent rounded-full animate-spin"></div> : <Zap size={10} />}
                  Generate Excerpt
                </button>
              </div>
              <textarea 
                value={currentArticle.excerpt || ''} 
                onChange={e => setCurrentArticle({...currentArticle, excerpt: e.target.value})}
                className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none h-24"
                placeholder="สรุปสั้นๆ เกี่ยวกับบทความ..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-gold text-sm font-bold flex items-center"><Target size={16} className="mr-2" /> หมวดหมู่</label>
                <div className="flex flex-col space-y-2">
                  <select 
                    value={categories.includes(currentArticle.category || '') ? currentArticle.category : 'custom'} 
                    onChange={e => {
                      if (e.target.value === 'custom') {
                        setCurrentArticle({...currentArticle, category: ''});
                      } else {
                        setCurrentArticle({...currentArticle, category: e.target.value});
                      }
                    }}
                    className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="custom">+ เพิ่มหมวดหมู่ใหม่ / ระบุเอง</option>
                  </select>
                  
                  {(!categories.includes(currentArticle.category || '') || currentArticle.category === '') && (
                    <input 
                      required
                      type="text" 
                      value={currentArticle.category || ''} 
                      onChange={e => setCurrentArticle({...currentArticle, category: e.target.value})}
                      className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                      placeholder="พิมพ์ชื่อหมวดหมู่ใหม่ที่นี่..."
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-gold text-sm font-bold flex items-center"><Tag size={16} className="mr-2" /> Keywords Meta Tag</label>
                  <button 
                    type="button"
                    onClick={generateKeywords}
                    disabled={isGeneratingKeywords}
                    className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center transition-all disabled:opacity-50"
                  >
                    {isGeneratingKeywords ? (
                      <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <Sparkles size={14} className="mr-2" />
                    )}
                    Generate
                  </button>
                </div>
                <input 
                  type="text" 
                  value={currentArticle.metaKeywords || ''} 
                  onChange={e => setCurrentArticle({...currentArticle, metaKeywords: e.target.value})}
                  className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  placeholder="เช่น บาคาร่า, สูตรบาคาร่า, เล่นบาคาร่า (คั่นด้วยลูกน้ำ)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-gold text-sm font-bold flex items-center"><ImageIcon size={16} className="mr-2" /> URL รูปภาพหน้าปก</label>
                <input 
                  type="text" 
                  value={currentArticle.image || ''} 
                  onChange={e => setCurrentArticle({...currentArticle, image: e.target.value})}
                  className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-gold text-sm font-bold flex items-center"><Calendar size={16} className="mr-2" /> วันที่เผยแพร่ (Scheduling)</label>
                <input 
                  type="datetime-local" 
                  value={currentArticle.publishedAt ? format(new Date(currentArticle.publishedAt.seconds ? currentArticle.publishedAt.seconds * 1000 : currentArticle.publishedAt), "yyyy-MM-dd'T'HH:mm") : ''} 
                  onChange={e => setCurrentArticle({...currentArticle, publishedAt: e.target.value})}
                  className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                />
                <p className="text-[10px] text-gray-500">ปล่อยว่างไว้เพื่อเผยแพร่ทันที หรือเลือกเวลาในอนาคตเพื่อตั้งเวลาล่วงหน้า</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-gold text-sm font-bold flex items-center"><BookOpen size={16} className="mr-2" /> เนื้อหาบทความ</label>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowPromptBuilder(true)}
                    className="bg-gray-800 hover:bg-gray-700 text-white border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold flex items-center transition-all"
                  >
                    <div className="w-4 h-4 bg-white text-black rounded-full flex items-center justify-center text-[10px] font-black mr-2">K</div>
                    Templates
                  </button>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder="บอก AI ว่าอยากให้เขียนอะไร..."
                      className="bg-black border border-gold/20 rounded-full px-4 py-1.5 text-xs text-white focus:border-gold outline-none w-48 md:w-64 transition-all"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGeneratingAI || !aiPrompt.trim()}
                    className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 px-3 py-1.5 rounded-full text-xs font-bold flex items-center transition-all disabled:opacity-50"
                  >
                    {isGeneratingAI ? (
                      <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <Wand2 size={14} className="mr-2" />
                    )}
                    AI ช่วยเขียน
                  </button>
                </div>
              </div>
              <ReactQuill 
                theme="snow" 
                value={currentArticle.content || ''} 
                onChange={val => setCurrentArticle({...currentArticle, content: val})}
                modules={modules}
              />
            </div>

            <PromptBuilderModal 
              isOpen={showPromptBuilder} 
              onClose={() => setShowPromptBuilder(false)} 
              onExecute={(prompt) => {
                setAiPrompt(prompt);
                setShowPromptBuilder(false);
              }}
            />

            <div className="flex justify-end space-x-4">
              <button 
                type="button"
                onClick={() => setShowPreview(true)}
                className="px-8 py-3 rounded-full text-gold font-bold hover:bg-gold/10 transition-colors flex items-center"
              >
                <Eye size={20} className="mr-2" /> ดูตัวอย่าง
              </button>
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-8 py-3 rounded-full text-gray-400 font-bold hover:text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                disabled={loading}
                type="button"
                onClick={(e) => handleSave(e, 'draft')}
                className="bg-gray-800 text-white px-8 py-3 rounded-full font-bold hover:bg-gray-700 transition-all flex items-center disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : <><FileText size={20} className="mr-2" /> บันทึกฉบับร่าง</>}
              </button>
              <button 
                disabled={loading}
                type="button"
                onClick={(e) => handleSave(e, 'published')}
                className="gold-bg-gradient text-baccarat-black px-12 py-3 rounded-full font-black text-lg flex items-center disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : <><Save size={20} className="mr-2" /> เผยแพร่บทความ</>}
              </button>
            </div>
          </form>

          <AnimatePresence>
            {showPreview && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
              >
                <button 
                  onClick={() => setShowPreview(false)}
                  className="fixed top-6 right-6 text-gray-400 hover:text-white z-[110] bg-black/50 p-2 rounded-full transition-colors border border-gold/20"
                >
                  <X size={24} />
                </button>
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-baccarat-black border border-gold/30 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl relative custom-scrollbar"
                >
                  
                  <div className="p-8 md:p-16">
                    <div className="mb-8">
                      <span className="bg-baccarat-red text-white text-xs font-bold px-4 py-1.5 rounded-full border border-gold/50">
                        {currentArticle.category || 'หมวดหมู่'}
                      </span>
                      <h1 className="text-4xl md:text-5xl font-black text-white mt-6 mb-6 leading-tight">
                        {currentArticle.title || 'หัวข้อบทความ'}
                      </h1>
                      <div className="flex items-center text-gray-500 text-sm space-x-6">
                        <span className="flex items-center"><Award size={16} className="mr-2" /> โดย {currentArticle.author || 'Baccarat Master'}</span>
                        <span className="flex items-center"><Target size={16} className="mr-2" /> {currentArticle.date || format(new Date(), 'yyyy-MM-dd')}</span>
                      </div>
                    </div>
                    
                    <div className="prose prose-invert prose-gold max-w-none">
                      <div 
                        className="text-gray-300 leading-loose text-lg space-y-6 article-content"
                        dangerouslySetInnerHTML={{ __html: currentArticle.content || '' }}
                      />
                    </div>

                    <div className="mt-20 p-8 bg-gray-900 border border-gold/30 rounded-3xl text-center">
                      <h3 className="text-2xl font-bold text-white mb-4">สนใจนำเทคนิคนี้ไปใช้จริง?</h3>
                      <p className="text-gray-400 mb-8">เราขอแนะนำเว็บไซต์ที่ได้มาตรฐานสากล มั่นคง และปลอดภัยที่สุดในขณะนี้</p>
                      <button className="bg-white text-baccarat-red px-12 py-5 rounded-full font-black text-xl shadow-2xl">
                        สมัครสมาชิกตอนนี้
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* Logo & Assets Section */}
          <div className="bg-gray-900 border border-gold/20 rounded-3xl p-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                  <ImageIcon size={24} className="mr-2 text-gold" /> จัดการโลโก้และรูปภาพ
                </h3>
                <p className="text-gray-400 text-sm">สร้างโลโก้ระดับมืออาชีพด้วย AI สำหรับเว็บไซต์ Baccarat Master Guide</p>
              </div>
              <div className="flex items-center gap-4">
                {generatedLogo && (
                  <div className="relative group">
                    <img 
                      src={generatedLogo} 
                      alt="Generated Logo" 
                      className="w-20 h-20 rounded-xl border border-gold/30 object-contain bg-black p-2"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                      <a 
                        href={generatedLogo} 
                        download="baccarat-master-logo.png"
                        className="text-white hover:text-gold"
                      >
                        <Download size={20} />
                      </a>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => generateLogo()}
                  disabled={isGeneratingLogo}
                  className="gold-bg-gradient text-baccarat-black px-6 py-3 rounded-full font-bold flex items-center disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
                >
                  {isGeneratingLogo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-baccarat-black border-t-transparent rounded-full animate-spin mr-2"></div>
                      กำลังสร้างโลโก้...
                    </>
                  ) : (
                    <>
                      <Wand2 size={20} className="mr-2" />
                      {generatedLogo ? 'สร้างโลโก้ใหม่' : 'สร้างโลโก้ด้วย AI'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button 
              onClick={() => setFilterStatus('all')}
              className={cn("px-4 py-2 rounded-full text-xs font-bold transition-all border", filterStatus === 'all' ? "bg-gold text-baccarat-black border-gold" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10")}
            >
              ทั้งหมด ({articles.length})
            </button>
            <button 
              onClick={() => setFilterStatus('published')}
              className={cn("px-4 py-2 rounded-full text-xs font-bold transition-all border", filterStatus === 'published' ? "bg-green-500 text-white border-green-500" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10")}
            >
              เผยแพร่แล้ว ({articles.filter(a => a.status !== 'draft' && (!a.publishedAt || new Date(a.publishedAt.seconds ? a.publishedAt.seconds * 1000 : a.publishedAt) <= new Date())).length})
            </button>
            <button 
              onClick={() => setFilterStatus('draft')}
              className={cn("px-4 py-2 rounded-full text-xs font-bold transition-all border", filterStatus === 'draft' ? "bg-yellow-500 text-black border-yellow-500" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10")}
            >
              ฉบับร่าง ({articles.filter(a => a.status === 'draft').length})
            </button>
            <button 
              onClick={() => setFilterStatus('scheduled')}
              className={cn("px-4 py-2 rounded-full text-xs font-bold transition-all border", filterStatus === 'scheduled' ? "bg-blue-500 text-white border-blue-500" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10")}
            >
              ตั้งเวลา ({articles.filter(a => a.status !== 'draft' && a.publishedAt && new Date(a.publishedAt.seconds ? a.publishedAt.seconds * 1000 : a.publishedAt) > new Date()).length})
            </button>
          </div>

          <div className="bg-gray-900 border border-gold/20 rounded-3xl overflow-hidden">
            <table className="w-full text-left">
            <thead>
              <tr className="bg-black/50 border-b border-gold/20">
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs">บทความ</th>
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs">หมวดหมู่</th>
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs">สถานะ / วันที่เผยแพร่</th>
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredArticles.map((article, index) => (
                <tr 
                  key={article.id} 
                  className={cn(
                    "transition-all duration-200 group",
                    index % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]",
                    "hover:bg-gold/10"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="relative w-12 h-12 mr-4 flex-shrink-0">
                        <img 
                          src={article.image || `https://picsum.photos/seed/${article.slug || 'baccarat'}/100/100`} 
                          className="w-full h-full rounded-lg object-cover border border-white/10" 
                          alt="" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10 group-hover:ring-gold/30 transition-all"></div>
                      </div>
                      <span className="text-white font-bold line-clamp-1 group-hover:text-gold transition-colors">{article.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-[10px] font-bold bg-white/5 text-gray-400 rounded-md border border-white/5 group-hover:border-gold/20 group-hover:text-gold transition-all">
                      {article.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-gray-400">
                      {article.status === 'draft' ? (
                        <span className="text-yellow-500 flex items-center">
                          <FileText size={12} className="mr-1" /> ฉบับร่าง
                        </span>
                      ) : article.publishedAt ? (
                        new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt) > new Date() ? (
                          <span className="text-blue-400 flex items-center">
                            <Calendar size={12} className="mr-1" /> ตั้งเวลา: {format(new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt), 'dd/MM/yyyy HH:mm')}
                          </span>
                        ) : (
                          <span className="text-green-400 flex items-center">
                            <Check size={12} className="mr-1" /> เผยแพร่แล้ว: {format(new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt), 'dd/MM/yyyy HH:mm')}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-500">{article.date}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-3">
                      <button 
                        onClick={() => { setIsEditing(true); setCurrentArticle(article); }}
                        className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-all hover:scale-110 active:scale-95"
                        title="แก้ไข"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(article.id)}
                        className="p-2 text-baccarat-red hover:bg-baccarat-red/10 rounded-lg transition-all hover:scale-110 active:scale-95"
                        title="ลบ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {articles.length === 0 && (
            <div className="py-20 text-center text-gray-500">ยังไม่มีบทความในระบบ</div>
          )}
        </div>
      </div>
    )}
  </div>
  );
};

export default AdminDashboard;
