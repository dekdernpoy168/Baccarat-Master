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
  Tag,
  RefreshCw,
  Database,
  Clock
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import { calculateReadTime } from './lib/readTime';
import { formatInTimeZone } from 'date-fns-tz';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from 'openai';
import { io } from 'socket.io-client';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}
import { Helmet } from 'react-helmet-async';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { auth } from './firebase';
import { Article, API_BASE } from './constants';
import { cn } from './lib/utils';
import { AuthProvider } from './auth';

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

const ADMIN_EMAIL = "admin";

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

// --- Components ---

const Navbar = ({ user }: { user: User | null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-baccarat-black/90 backdrop-blur-md border-b border-gold/30 py-3 lg:py-4">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 flex flex-col items-center gap-3 lg:gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 md:space-x-3">
          <img 
            src="https://img2.pic.in.th/LOGO1-Baccarat-Master.png" 
            alt="Baccarat Master Logo" 
            className="h-10 md:h-12 lg:h-14 w-auto object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="text-xl md:text-2xl lg:text-3xl font-bold gold-gradient tracking-tighter uppercase whitespace-nowrap">Baccarat Master</span>
        </Link>

        {/* Menu */}
        <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 lg:gap-3 w-full">
          <Link to="/" className={cn("px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[12px] sm:text-[13px] lg:text-sm font-medium transition-all whitespace-nowrap border", location.pathname === '/' ? "bg-gold/10 text-gold border-gold/30" : "bg-white/5 text-gray-300 border-transparent hover:bg-white/10 hover:text-white")}>หน้าแรก</Link>
          <Link to="/formula" className={cn("px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[12px] sm:text-[13px] lg:text-sm font-medium transition-all whitespace-nowrap border", location.pathname === '/formula' ? "bg-gold/10 text-gold border-gold/30" : "bg-white/5 text-gray-300 border-transparent hover:bg-white/10 hover:text-white")}>สูตรบาคาร่าฟรี</Link>
          <Link to="/articles" className={cn("px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[12px] sm:text-[13px] lg:text-sm font-medium transition-all whitespace-nowrap border", location.pathname === '/articles' ? "bg-gold/10 text-gold border-gold/30" : "bg-white/5 text-gray-300 border-transparent hover:bg-white/10 hover:text-white")}>บทความ</Link>
          <Link to="/about" className={cn("px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[12px] sm:text-[13px] lg:text-sm font-medium transition-all whitespace-nowrap border", location.pathname === '/about' ? "bg-gold/10 text-gold border-gold/30" : "bg-white/5 text-gray-300 border-transparent hover:bg-white/10 hover:text-white")}>เกี่ยวกับเรา</Link>
          {user?.email === ADMIN_EMAIL && (
            <Link to="/admin" className={cn("px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[12px] sm:text-[13px] lg:text-sm font-medium transition-all whitespace-nowrap border", location.pathname.startsWith('/admin') ? "bg-gold/10 text-gold border-gold/30" : "bg-white/5 text-gray-300 border-transparent hover:bg-white/10 hover:text-white")}>จัดการหลังบ้าน</Link>
          )}
          {!user ? (
            <>
              <Link to="/login" className="gold-bg-gradient text-baccarat-black px-3 sm:px-4 lg:px-6 py-1.5 lg:py-2 rounded-lg font-bold text-[12px] sm:text-[13px] lg:text-sm hover:scale-105 transition-transform shadow-lg shadow-gold/20 whitespace-nowrap">
                เข้าสู่ระบบ
              </Link>
              <a href="https://inlnk.co/registerbocker168" target="_blank" rel="noopener noreferrer" className="bg-baccarat-red text-white px-3 sm:px-4 lg:px-6 py-1.5 lg:py-2 rounded-lg font-bold text-[12px] sm:text-[13px] lg:text-sm hover:scale-105 transition-transform shadow-lg shadow-baccarat-red/20 whitespace-nowrap">
                สมัครสมาชิก
              </a>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-xs hidden sm:inline-block max-w-[100px] lg:max-w-[120px] truncate">{user.email}</span>
              <button 
                onClick={() => {
                  signOut(auth);
                  localStorage.removeItem('custom_admin_user');
                  window.location.href = '/';
                }} 
                className="bg-baccarat-red/20 text-baccarat-red hover:bg-baccarat-red hover:text-white p-1.5 lg:p-2 rounded-lg transition-colors"
              >
                <LogOut size={16} className="lg:w-[18px] lg:h-[18px]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const Footer = () => (
  <footer className="bg-baccarat-black border-t border-gold/20 pt-16 pb-8">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        {/* Brand & Info */}
        <div className="col-span-1 lg:col-span-1">
          <Link to="/" className="flex items-center space-x-3 mb-6">
            <img 
              src="https://img2.pic.in.th/LOGO1-Baccarat-Master.png" 
              alt="Baccarat Master Logo" 
              className="h-10 w-auto object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="text-xl font-bold gold-gradient tracking-tighter uppercase">Baccarat Master</span>
          </Link>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            ศูนย์รวมความรู้และเทคนิคการเล่นบาคาร่าออนไลน์ที่ครบถ้วนที่สุด 
            เรามุ่งเน้นการให้ข้อมูลที่ถูกต้อง แม่นยำ และเป็นประโยชน์ต่อผู้เล่นทุกระดับ
          </p>
          <div className="flex space-x-4">
            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-gold/20 hover:text-gold transition-colors">
              <Facebook size={18} />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-gold/20 hover:text-gold transition-colors">
              <Twitter size={18} />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-gold font-bold mb-6 uppercase tracking-wider">ลิงก์ด่วน</h3>
          <ul className="space-y-4 text-gray-400 text-sm">
            <li><Link to="/" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> หน้าแรก</Link></li>
            <li><Link to="/articles" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> บทความทั้งหมด</Link></li>
            <li><Link to="/formula" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> AI Formula</Link></li>
            <li><Link to="/about" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> About Us</Link></li>
          </ul>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-gold font-bold mb-6 uppercase tracking-wider">หมวดหมู่</h3>
          <ul className="space-y-4 text-gray-400 text-sm">
            <li><Link to="/articles?category=วิธีเล่นเบื้องต้น" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> วิธีเล่นเบื้องต้น</Link></li>
            <li><Link to="/articles?category=เทคนิคการเดินเงิน" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> เทคนิคการเดินเงิน</Link></li>
            <li><Link to="/articles?category=การอ่านเค้าไพ่" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> การอ่านเค้าไพ่</Link></li>
            <li><Link to="/articles?category=ทริคระดับเซียน" className="hover:text-gold transition-colors flex items-center"><ChevronRight size={14} className="mr-1 text-gold/50" /> ทริคระดับเซียน</Link></li>
          </ul>
        </div>

        {/* Contact & Warning */}
        <div>
          <h3 className="text-gold font-bold mb-6 uppercase tracking-wider">ติดต่อเรา</h3>
          <ul className="space-y-4 text-gray-400 text-sm mb-6">
            <li className="flex items-center gap-2">
              <span className="text-gold font-bold">Line:</span> @so168
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gold font-bold">Email:</span> contact@baccaratmaster.com
            </li>
          </ul>
          <div className="p-4 bg-baccarat-red/10 border border-baccarat-red/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2 text-baccarat-red font-bold text-sm">
              <ShieldCheck size={16} />
              <span>คำเตือน 18+</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              การพนันมีความเสี่ยง ผู้เล่นควรมีอายุ 18 ปีขึ้นไป โปรดเล่นอย่างมีสติและใช้เพื่อความบันเทิงเท่านั้น
            </p>
          </div>
        </div>
      </div>

      {/* SEO Keywords */}
      <div className="mt-12 pt-8 border-t border-gray-800">
        <h4 className="text-gray-500 text-xs font-bold mb-3 uppercase tracking-wider">คำค้นหายอดนิยม</h4>
        <div className="flex flex-wrap gap-2">
          {["บาคาร่า", "สูตรบาคาร่า", "เล่นบาคาร่า", "บาคาร่าออนไลน์", "เทคนิคบาคาร่า", "บาคาร่ามือถือ", "เว็บบาคาร่า", "เซียนบาคาร่า", "วิธีเล่นบาคาร่า", "สูตรเดินเงินบาคาร่า"].map((keyword) => (
            <span key={keyword} className="text-xs text-gray-600 hover:text-gold transition-colors cursor-default">
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
        <p>© 2026 Baccarat Master Guide. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/privacy-policy" className="hover:text-gold transition-colors">นโยบายความเป็นส่วนตัว</Link>
          <span className="text-gray-700">|</span>
          <Link to="/terms" className="hover:text-gold transition-colors">ข้อตกลงและเงื่อนไข</Link>
        </div>
      </div>
    </div>
  </footer>
);

const ArticleCard = ({ article }: { article: Article; key?: string | number }) => {
  const isDraft = article.status === 'draft';
  
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="bg-gray-900/50 border border-gold/10 rounded-2xl overflow-hidden article-card group"
    >
      <Link to={`/articles/${article.slug}`}>
        <div className="relative h-56 overflow-hidden">
          <img 
            src={article.image || `https://picsum.photos/seed/${article.slug || 'baccarat'}/800/400`} 
            alt={article.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="bg-baccarat-red text-white text-xs font-bold px-3 py-1 rounded-full border border-gold/50">
              {article.category}
            </span>
            {isDraft && (
              <span className="bg-yellow-500/90 text-black text-[10px] font-black px-3 py-1 rounded-full border border-black/20 flex items-center shadow-lg">
                <FileText size={10} className="mr-1" /> ฉบับร่าง
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gold transition-colors line-clamp-2">
            {article.title}
          </h3>
          <p className="text-gray-400 text-sm mb-6 line-clamp-3 leading-relaxed">
            {article.excerpt}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">{article.date}</span>
            <span className="text-gray-500 text-xs flex items-center"><Clock size={12} className="mr-1" /> {calculateReadTime(article.content)}</span>
            <span className="text-gold text-sm font-bold flex items-center">
              อ่านต่อ <ChevronRight size={16} className="ml-1" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const PrivacyPolicyPage = () => (
  <div className="pt-20 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <SEO 
      title="นโยบายความเป็นส่วนตัว" 
      description="นโยบายความเป็นส่วนตัวของเว็บไซต์ Baccarat Master Guide" 
    />
    <div className="bg-gray-900/50 border border-gold/20 rounded-[2rem] p-8 md:p-12">
      <h1 className="text-3xl md:text-4xl font-black text-white mb-8 gold-gradient uppercase tracking-tight text-center">
        นโยบายความเป็นส่วนตัว (Privacy Policy)
      </h1>
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <p>
          เว็บไซต์ Baccarat Master Guide (ต่อไปนี้จะเรียกว่า "เรา" หรือ "เว็บไซต์") ให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้งานทุกท่าน นโยบายความเป็นส่วนตัวนี้จัดทำขึ้นเพื่ออธิบายถึงวิธีการที่เรารวบรวม ใช้ และปกป้องข้อมูลส่วนบุคคลของท่านเมื่อท่านเข้าใช้งานเว็บไซต์ของเรา
        </p>
        
        <h2 className="text-xl font-bold text-gold mt-8 mb-4">1. ข้อมูลที่เรารวบรวม</h2>
        <p>เราอาจรวบรวมข้อมูลต่อไปนี้เมื่อท่านเข้าใช้งานเว็บไซต์:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>ข้อมูลที่ท่านให้ไว้โดยตรง เช่น ชื่อ อีเมล เมื่อท่านสมัครสมาชิกหรือติดต่อเรา</li>
          <li>ข้อมูลการใช้งาน เช่น หน้าที่ท่านเข้าชม ระยะเวลาที่ใช้งาน และพฤติกรรมการคลิก</li>
          <li>ข้อมูลทางเทคนิค เช่น หมายเลข IP, ประเภทของเบราว์เซอร์, และอุปกรณ์ที่ท่านใช้งาน</li>
        </ul>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">2. การใช้ข้อมูล</h2>
        <p>เราใช้ข้อมูลที่รวบรวมเพื่อวัตถุประสงค์ดังต่อไปนี้:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>เพื่อให้บริการและปรับปรุงเนื้อหาบนเว็บไซต์ให้ตรงกับความสนใจของท่าน</li>
          <li>เพื่อวิเคราะห์สถิติการเข้าชมและนำไปพัฒนาเว็บไซต์ให้ดียิ่งขึ้น</li>
          <li>เพื่อติดต่อสื่อสาร ตอบข้อซักถาม หรือส่งข้อมูลข่าวสารที่อาจเป็นประโยชน์ (หากท่านยินยอม)</li>
        </ul>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">3. การเปิดเผยข้อมูล</h2>
        <p>
          เราจะไม่ขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอกโดยไม่ได้รับความยินยอม ยกเว้นในกรณีที่กฎหมายกำหนด หรือเพื่อปกป้องสิทธิและทรัพย์สินของเรา
        </p>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">4. การรักษาความปลอดภัยของข้อมูล</h2>
        <p>
          เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสมเพื่อปกป้องข้อมูลของท่านจากการเข้าถึง การใช้ หรือการเปิดเผยที่ไม่ได้รับอนุญาต อย่างไรก็ตาม ไม่มีการส่งข้อมูลผ่านอินเทอร์เน็ตใดที่ปลอดภัย 100% เราจึงไม่สามารถรับประกันความปลอดภัยได้อย่างสมบูรณ์
        </p>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">5. การใช้คุกกี้ (Cookies)</h2>
        <p>
          เว็บไซต์ของเราอาจใช้คุกกี้เพื่อจดจำการตั้งค่าของท่านและปรับปรุงประสบการณ์การใช้งาน ท่านสามารถตั้งค่าเบราว์เซอร์เพื่อปฏิเสธคุกกี้ได้ แต่บางส่วนของเว็บไซต์อาจทำงานได้ไม่สมบูรณ์
        </p>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">6. การเปลี่ยนแปลงนโยบาย</h2>
        <p>
          เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นระยะ การเปลี่ยนแปลงใดๆ จะถูกประกาศในหน้านี้ เราขอแนะนำให้ท่านตรวจสอบหน้านี้อย่างสม่ำเสมอ
        </p>

        <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-gray-500 text-center">
          อัปเดตล่าสุด: มีนาคม 2026
        </div>
      </div>
    </div>
  </div>
);

const TermsPage = () => (
  <div className="pt-20 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <SEO 
      title="ข้อตกลงและเงื่อนไข" 
      description="ข้อตกลงและเงื่อนไขการใช้งานเว็บไซต์ Baccarat Master Guide" 
    />
    <div className="bg-gray-900/50 border border-gold/20 rounded-[2rem] p-8 md:p-12">
      <h1 className="text-3xl md:text-4xl font-black text-white mb-8 gold-gradient uppercase tracking-tight text-center">
        ข้อตกลงและเงื่อนไข (Terms and Conditions)
      </h1>
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <p>
          ยินดีต้อนรับสู่ Baccarat Master Guide การเข้าใช้งานเว็บไซต์นี้ถือว่าท่านได้อ่าน ทำความเข้าใจ และยอมรับข้อตกลงและเงื่อนไขเหล่านี้อย่างครบถ้วน หากท่านไม่เห็นด้วยกับข้อตกลงใดๆ โปรดงดการใช้งานเว็บไซต์นี้
        </p>
        
        <h2 className="text-xl font-bold text-gold mt-8 mb-4">1. วัตถุประสงค์ของเว็บไซต์</h2>
        <p>
          เว็บไซต์นี้จัดทำขึ้นเพื่อวัตถุประสงค์ในการให้ข้อมูล ความรู้ เทคนิค และสถิติที่เกี่ยวข้องกับเกมบาคาร่าเพื่อการศึกษาและความบันเทิงเท่านั้น <span className="text-baccarat-red font-bold">เราไม่ใช่เว็บไซต์การพนันออนไลน์ และไม่สนับสนุนให้มีการเล่นการพนันที่ผิดกฎหมาย</span>
        </p>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">2. ข้อจำกัดความรับผิดชอบ (Disclaimer)</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>ข้อมูล สูตร และเทคนิคที่นำเสนอในเว็บไซต์นี้ เป็นเพียงการวิเคราะห์เชิงสถิติและความน่าจะเป็น ไม่มีการรับประกันผลลัพธ์หรือความสำเร็จใดๆ</li>
          <li>ผู้ใช้งานต้องรับผิดชอบต่อการตัดสินใจและการกระทำของตนเองทั้งหมด เราจะไม่รับผิดชอบต่อความสูญเสียหรือความเสียหายใดๆ ที่เกิดขึ้นจากการนำข้อมูลจากเว็บไซต์ไปใช้</li>
          <li>การพนันมีความเสี่ยง ผู้เล่นควรมีอายุ 18 ปีขึ้นไป และควรเล่นอย่างมีสติ ภายใต้ขอบเขตที่ตนเองรับได้</li>
        </ul>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">3. ทรัพย์สินทางปัญญา</h2>
        <p>
          เนื้อหาทั้งหมดบนเว็บไซต์นี้ รวมถึงข้อความ รูปภาพ กราฟิก โลโก้ และซอฟต์แวร์ เป็นทรัพย์สินทางปัญญาของ Baccarat Master Guide ห้ามมิให้ผู้ใดทำซ้ำ ดัดแปลง เผยแพร่ หรือนำไปใช้ในเชิงพาณิชย์โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร
        </p>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">4. การใช้งานที่เหมาะสม</h2>
        <p>ผู้ใช้งานตกลงที่จะไม่ใช้เว็บไซต์นี้ในทางที่ผิดกฎหมาย หรือกระทำการใดๆ ที่อาจก่อให้เกิดความเสียหายต่อเว็บไซต์หรือผู้ใช้งานท่านอื่น</p>

        <h2 className="text-xl font-bold text-gold mt-8 mb-4">5. การปรับปรุงข้อตกลง</h2>
        <p>
          เราขอสงวนสิทธิ์ในการแก้ไขหรือเปลี่ยนแปลงข้อตกลงและเงื่อนไขนี้ได้ตลอดเวลาโดยไม่ต้องแจ้งให้ทราบล่วงหน้า การที่ท่านยังคงใช้งานเว็บไซต์ต่อไปหลังจากการเปลี่ยนแปลง ถือว่าท่านยอมรับข้อตกลงที่แก้ไขแล้ว
        </p>

        <div className="mt-12 pt-8 border-t border-gray-800 text-sm text-gray-500 text-center">
          อัปเดตล่าสุด: มีนาคม 2026
        </div>
      </div>
    </div>
  </div>
);

const AnalyticsDashboard = () => {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/analytics/visits')
      .then(res => res.json())
      .then(data => {
        setData(data.data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-gray-900/50 border border-gold/20 rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Analytics (Last 24h)</h2>
      <table className="w-full text-left text-gray-300">
        <thead>
          <tr>
            <th className="pb-2">City</th>
            <th className="pb-2">Total Visits</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, i: number) => (
            <tr key={i} className="border-t border-white/10">
              <td className="py-2">{row.city}</td>
              <td className="py-2">{row.total_visits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Pages ---

const AboutPage = () => {
  return (
    <div className="pt-20 pb-24">
      <SEO 
        title="เกี่ยวกับเรา" 
        description="Baccarat Master Guide ศูนย์รวมความรู้ เทคนิค และสูตรบาคาร่าที่ครบถ้วนที่สุด" 
      />
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gold/5 -skew-y-6 transform origin-top-left"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center space-x-2 bg-gold/10 px-4 py-2 rounded-full border border-gold/20 mb-6"
            >
              <Award className="text-gold w-4 h-4" />
              <span className="text-gold text-xs font-bold uppercase tracking-widest">เกี่ยวกับเรา</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-bold gold-gradient mb-8 leading-tight uppercase"
            >
              Baccarat Master Guide
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 text-lg leading-relaxed"
            >
              เราคือศูนย์รวมข้อมูลและเทคนิคการเล่นบาคาร่าระดับมืออาชีพ 
              ที่มุ่งเน้นการให้ความรู้ที่ถูกต้องและแม่นยำ เพื่อยกระดับการเล่นของคุณให้ก้าวไปอีกขั้น
            </motion.p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20 mb-8">
                <Target className="text-gold w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-6 uppercase tracking-tight">ภารกิจของเรา (Our Mission)</h2>
              <div className="space-y-6 text-gray-400 leading-relaxed">
                <p>
                  ภารกิจหลักของ Baccarat Master Guide คือการสร้างชุมชนผู้เล่นบาคาร่าที่มีคุณภาพ 
                  โดยการแบ่งปันความรู้ เทคนิค และกลยุทธ์ที่ผ่านการพิสูจน์แล้วว่าใช้งานได้จริง
                </p>
                <p>
                  เราเชื่อว่าการเล่นอย่างมีสติและมีความรู้ คือกุญแจสำคัญสู่ความสำเร็จในระยะยาว 
                  เราจึงมุ่งมั่นที่จะนำเสนอเนื้อหาที่ครอบคลุม ตั้งแต่พื้นฐานไปจนถึงเทคนิคขั้นสูง 
                  รวมถึงการบริหารจัดการเงินทุนอย่างมีประสิทธิภาพ
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-video rounded-3xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/10">
                <img 
                  src="https://picsum.photos/seed/mission/800/600" 
                  alt="Our Mission" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 bg-baccarat-red p-8 rounded-3xl border border-gold/50 hidden lg:block">
                <ShieldCheck className="text-gold w-12 h-12 mb-4" />
                <div className="text-2xl font-bold text-white">100%</div>
                <div className="text-gold text-xs font-bold uppercase">ข้อมูลที่เชื่อถือได้</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4 uppercase tracking-tight">ทีมงานของเรา (The Team)</h2>
            <p className="text-gray-400">เบื้องหลังความสำเร็จของ Baccarat Master Guide คือทีมงานผู้เชี่ยวชาญที่มีประสบการณ์</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Master K", role: "Founder & Lead Strategist", bio: "ผู้เชี่ยวชาญด้านการอ่านเค้าไพ่และเทคนิคการเดินเงินที่มีประสบการณ์กว่า 10 ปี" },
              { name: "Sarah J.", role: "Content Editor", bio: "บรรณาธิการผู้ดูแลเนื้อหาและตรวจสอบความถูกต้องของข้อมูลทั้งหมดในเว็บไซต์" },
              { name: "Alex T.", role: "Data Analyst", bio: "นักวิเคราะห์ข้อมูลที่ช่วยพัฒนาสูตรและระบบการคำนวณต่างๆ ให้มีความแม่นยำสูงสุด" }
            ].map((member) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-gray-900/50 border border-gold/10 p-8 rounded-3xl text-center hover:border-gold/30 transition-colors group"
              >
                <div className="w-24 h-24 bg-gold/10 rounded-full mx-auto mb-6 flex items-center justify-center border border-gold/20 group-hover:scale-110 transition-transform">
                  <Heart className="text-gold w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{member.name}</h3>
                <div className="text-gold text-sm font-bold uppercase mb-4">{member.role}</div>
                <p className="text-gray-400 text-sm leading-relaxed">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const HomePage = ({ articles, user }: { articles: Article[], user: User | null }) => {
  const isAdmin = user?.email === ADMIN_EMAIL;
  const publishedArticles = articles.filter(a => isAdmin || isPublished(a));
  const guideArticle = publishedArticles.find(a => a.title.includes('คู่มือฉบับสมบูรณ์'));
  const guideLink = guideArticle ? `/articles/${guideArticle.slug}` : '/articles';

  const baseUrl = import.meta.env.VITE_APP_URL || "https://huisache.com";
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Baccarat Master Guide",
    "url": `${baseUrl}/`,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/articles?category={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="space-y-20 md:space-y-32 pb-32">
      <SEO 
        title="คู่มือการเล่น บาคาร่า ฉบับสมบูรณ์ ปี 2026 เจาะลึกทุกกลยุทธ์" 
        description="คู่มือการเล่น บาคาร่า ปี 2026 เจาะลึกสอนทุกขั้นตอนตั้งแต่พื้นฐานถึงสูตรทำเงินระดับเซียน พร้อมกลยุทธ์เด็ดที่ช่วยเพิ่มโอกาสชนะให้คุณแบบมืออาชีพ" 
        keywords="บาคาร่า, สูตรบาคาร่า, เล่นบาคาร่า, บาคาร่าออนไลน์, เทคนิคบาคาร่า, บาคาร่ามือถือ, เว็บบาคาร่า, เซียนบาคาร่า"
        canonicalUrl={`${baseUrl}/`} 
        schema={schema}
      />
      {/* Hero Section */}
      <section className="relative min-h-[80vh] md:h-[90vh] flex items-center overflow-hidden py-20 md:py-0">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-baccarat-black via-baccarat-black/70 to-transparent z-10" />
          <img 
            src="https://img2.pic.in.th/The-Secret-Scripture-of-the-Baccarat-Master.jpg" 
            className="w-full h-full object-cover opacity-50"
            alt="Hero Background"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-baccarat-black to-transparent z-10" />
        </div>
        
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center space-x-2 bg-gold/10 border border-gold/30 px-4 py-2 rounded-full mb-8 backdrop-blur-md">
              <Sparkles className="text-gold w-4 h-4 animate-pulse" />
              <span className="text-gold text-xs font-bold uppercase tracking-[0.3em]">Baccarat Master Guide 2026</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight tracking-tighter">
              คัมภีร์ลับ <span className="gold-gradient">เซียนบาคาร่า</span>
              <span className="block text-xl sm:text-2xl md:text-4xl lg:text-5xl opacity-90 mt-2 md:mt-4">ชนะทุกเกมแบบมือโปร!</span>
            </h1>
            <p className="text-xl text-gray-300 mb-12 leading-relaxed max-w-xl">
              ยินดีต้อนรับสู่แหล่งรวมข้อมูลบาคาร่าที่ใหญ่ที่สุดในไทย เราเจาะลึกทุกกลยุทธ์ 
              ตั้งแต่พื้นฐานไปจนถึงเทคนิคขั้นสูง เผยแพร่แบบไม่มีกั๊ก เพื่อให้คุณเป็นผู้ชนะในระยะยาว
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6">
              <a href="https://inlnk.co/registerbocker168" target="_blank" rel="noopener noreferrer" className="bg-baccarat-red text-white px-8 md:px-12 py-4 md:py-5 rounded-full font-black text-lg md:text-xl text-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                สมัครสมาชิก
              </a>
              <Link to="/articles" className="gold-bg-gradient text-baccarat-black px-8 md:px-12 py-4 md:py-5 rounded-full font-black text-lg md:text-xl text-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                เริ่มเรียนรู้ฟรี
              </Link>
              <Link to="/formula" className="bg-white/5 backdrop-blur-xl border border-white/10 text-white px-8 md:px-12 py-4 md:py-5 rounded-full font-black text-lg md:text-xl text-center hover:bg-white/10 transition-all flex items-center justify-center group">
                สูตรบาคาร่า AI <ChevronRight size={24} className="ml-2 group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Knowledge Hub */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-20">
          <h2 className="text-3xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight">
            ศูนย์รวมความรู้ <span className="text-gold">บาคาร่า</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            เราคัดสรรเนื้อหาที่จำเป็นที่สุดสำหรับการทำกำไร รวบรวมทริคและเทคนิคจากประสบการณ์จริง 
            เพื่อให้คุณเข้าถึงข้อมูลที่แม่นยำและใช้งานได้จริง 100% แบบไม่มีกั๊ก
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {[
            { 
              id: "basic",
              title: "วิธีเล่นเบื้องต้น", 
              desc: "ทำความเข้าใจกฎ กติกา อัตราการจ่ายเงิน และเงื่อนไขการจั่วไพ่ใบที่สามอย่างละเอียดสำหรับมือใหม่ที่ต้องการเริ่มอย่างถูกต้อง",
              icon: <BookOpen className="w-6 h-6 text-gold" />,
              image: "https://img1.pic.in.th/images/Basic-way-to-play.jpg",
              color: "from-blue-500/20 to-transparent"
            },
            { 
              id: "reading",
              title: "การอ่านเค้าไพ่", 
              desc: "เจาะลึกเค้าไพ่มังกร ปิงปอง เ้าไพ่ลูกคู่ และการวิเคราะห์โรดแมพ (Roadmap) ทั้ง 5 รูปแบบที่เซียนใช้ทำเงินจริง",
              icon: <Eye className="w-6 h-6 text-gold" />,
              image: "https://img1.pic.in.th/images/Reading-the-cards.jpg",
              color: "from-purple-500/20 to-transparent"
            },
            { 
              id: "money",
              title: "เทคนิคการเดินเงิน", 
              desc: "สอนระบบการวางเดิมพันแบบ Martingale, Fibonacci, 1-3-2-4 และสูตรเดินเงินคงที่เพื่อรักษาพอร์ตและทำกำไรยั่งยืน",
              icon: <TrendingUp className="w-6 h-6 text-gold" />,
              image: "https://img1.pic.in.th/images/money-transfer-techniques.jpg",
              color: "from-green-500/20 to-transparent"
            },
            { 
              id: "expert",
              title: "ทริคระดับเซียน", 
              desc: "รวบรวมเคล็ดลับจิตวิทยาการเล่น การจัดการอารมณ์ และเทคนิคการเลือกห้องที่เพิ่มโอกาสชนะได้มากกว่า 80%",
              icon: <Zap className="w-6 h-6 text-gold" />,
              image: "https://img1.pic.in.th/images/Expert-tricks-1.jpg",
              color: "from-red-500/20 to-transparent"
            }
          ].map((item, i) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className={cn(
                "bg-gray-900/40 border border-white/5 rounded-[2rem] hover:border-gold/30 transition-all group relative overflow-hidden flex flex-col",
                "hover:shadow-[0_0_40px_rgba(212,175,55,0.05)]"
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", item.color)} />
              
              {/* Card Image */}
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                <div className="absolute top-4 left-4 p-2 bg-baccarat-black/80 backdrop-blur-md rounded-xl border border-white/10">
                  {item.icon}
                </div>
              </div>

              <div className="relative z-10 p-8 pt-4 flex-grow flex flex-col">
                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-gold transition-colors">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow">{item.desc}</p>
                <Link to="/articles" className="text-gold text-xs font-bold uppercase tracking-widest flex items-center group-hover:gap-2 transition-all mt-auto">
                  อ่านเพิ่มเติม <ChevronRight size={14} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Detailed Strategy Overview Section */}
        <div className="bg-white/5 border border-white/10 rounded-[2rem] md:rounded-[3rem] p-8 md:p-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold/5 blur-[100px] rounded-full -mr-48 -mt-48" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl md:text-5xl font-black text-white mb-12 leading-tight">
                ทำไมต้องเรียนรู้กับ <br />
                <span className="gold-gradient">Baccarat Master Guide?</span>
              </h2>
              <div className="space-y-12">
                <div className="text-center lg:text-left">
                  <h4 className="text-white font-bold text-2xl mb-3">ข้อมูลเชิงลึกแบบไม่มีกั๊ก</h4>
                  <p className="text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    เราไม่เพียงแต่สอนวิธีเล่น แต่เราสอน "วิธีชนะ" ด้วยข้อมูลที่ผ่านการวิเคราะห์จากสถิติจริง 
                    และประสบการณ์ของเซียนพนันระดับมืออาชีพที่คลุกคลีอยู่ในวงการมานานกว่า 10 ปี
                  </p>
                </div>
                <div className="text-center lg:text-left">
                  <h4 className="text-white font-bold text-2xl mb-3">เทคนิคที่ใช้งานได้จริง</h4>
                  <p className="text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    ทุกสูตรและเทคนิคที่เรานำเสนอ ผ่านการทดสอบแล้วว่าสามารถเพิ่มโอกาสชนะได้จริง 
                    ไม่ว่าจะเป็นการอ่านเค้าไพ่ที่แม่นยำ หรือระบบการเดินเงินที่ช่วยลดความเสี่ยงได้สูงสุด
                  </p>
                </div>
                <div className="text-center lg:text-left">
                  <h4 className="text-white font-bold text-2xl mb-3">อัปเดตเนื้อหาตลอดเวลา</h4>
                  <p className="text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    โลกของบาคาร่ามีการเปลี่ยนแปลงตลอดเวลา เราจึงไม่หยุดที่จะอัปเดตเทคนิคใหม่ๆ 
                    และสูตร AI ที่ทันสมัยที่สุด เพื่อให้คุณก้าวทันทุกสถานการณ์ในคาสิโนออนไลน์
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-baccarat-black/50 border border-white/5 p-8 rounded-[2rem] backdrop-blur-xl">
              <h3 className="text-2xl font-bold text-gold mb-6 border-b border-gold/20 pb-4">สรุปหัวใจสำคัญของการเป็นเซียน</h3>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-2 h-2 bg-gold rounded-full" />
                  <p className="text-gray-300"><span className="text-white font-bold">วินัยในการเดินเงิน:</span> หัวใจหลักไม่ใช่การแทงถูกทุกตา แต่คือการบริหารเงินทุนให้เหลือกำไรเมื่อจบรอบ</p>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-2 h-2 bg-gold rounded-full" />
                  <p className="text-gray-300"><span className="text-white font-bold">การเลือกห้อง:</span> ห้องที่มีเค้าไพ่ชัดเจนคือขุมทรัพย์ การเลือกห้องถูกมีชัยไปกว่าครึ่ง</p>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-2 h-2 bg-gold rounded-full" />
                  <p className="text-gray-300"><span className="text-white font-bold">การควบคุมอารมณ์:</span> เมื่อเสียต้องหยุด เมื่อได้ต้องพอ จิตวิทยาคือสิ่งที่แยกเซียนออกจากมือสมัครเล่น</p>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1.5 w-2 h-2 bg-gold rounded-full" />
                  <p className="text-gray-300"><span className="text-white font-bold">การใช้เครื่องมือ:</span> อย่าพึ่งพาโชคชะตาเพียงอย่างเดียว ใช้สูตร AI และสถิติช่วยในการตัดสินใจ</p>
                </li>
              </ul>
              <div className="mt-10 p-6 bg-gold/10 border border-gold/20 rounded-xl">
                <p className="text-gold text-sm italic text-center">
                  "บาคาร่าไม่ใช่เรื่องของดวง 100% แต่เป็นเรื่องของสถิติและวินัย"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Content / Bento Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1: Complete Guide */}
          <div className="md:col-span-2 lg:col-span-1 h-full">
            <Link to={guideLink} className="block group h-full">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-gray-900/60 border border-gold/10 overflow-hidden rounded-[3rem] hover:border-gold/50 transition-all duration-500 h-full relative group shadow-2xl min-h-[450px]"
              >
                <div className="absolute inset-0">
                  <img 
                    src="https://img1.pic.in.th/images/Baccarat-Guide.jpg" 
                    alt="Complete Guide" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-40"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-baccarat-black via-baccarat-black/60 to-transparent" />
                </div>
                <div className="relative z-10 p-10 h-full flex flex-col justify-end">
                  <div className="inline-block bg-baccarat-red/80 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-4 border border-gold/30 w-fit">
                    MUST READ
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight">
                    คู่มือบาคาร่า <br />
                    <span className="gold-gradient">ฉบับสมบูรณ์ 2026</span>
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed mb-6">
                    รวบรวมทุกอย่างที่คุณต้องรู้ ตั้งแต่กติกาพื้นฐานไปจนถึงเทคนิคขั้นสูงที่เซียนไม่เคยบอกใคร
                  </p>
                  <div className="flex items-center text-gold font-black text-xs uppercase tracking-[0.2em] group-hover:translate-x-2 transition-transform">
                    เจาะลึกรายละเอียด <ChevronRight size={16} className="ml-1" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Card 2: AI Money Management */}
          <div className="h-full">
            <Link to="/formula" className="block group h-full">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-900/60 border border-gold/10 rounded-[3rem] hover:border-gold/50 transition-all shadow-xl relative overflow-hidden h-full min-h-[450px]"
              >
                <div className="absolute inset-0">
                  <img 
                    src="https://img2.pic.in.th/AI-money-management-formula.jpg" 
                    alt="AI Baccarat Formula" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-30"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-baccarat-black via-baccarat-black/40 to-transparent" />
                </div>
                <div className="relative z-10 p-10 h-full flex flex-col justify-end">
                  <div className="inline-block bg-gold/10 text-gold text-[10px] font-bold px-3 py-1 rounded-full mb-4 border border-gold/30 w-fit">
                    AI POWERED
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-4">สูตรบาคาร่า AI 2026</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    จัดการเงินทุนอย่างเป็นระบบด้วยเทคโนโลยี AI ที่ช่วยคำนวณโอกาสชนะและลดความเสี่ยงในการเดิมพัน
                  </p>
                  <div className="text-gold font-bold text-xs uppercase tracking-widest flex items-center group-hover:translate-x-2 transition-transform">
                    ทดลองใช้ฟรี <ChevronRight size={16} className="ml-1" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Card 3: Pattern Reading */}
          <div className="h-full">
            <Link to="/articles" className="block group h-full">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="bg-gray-900/60 border border-gold/10 rounded-[3rem] hover:border-gold/50 transition-all shadow-xl relative overflow-hidden h-full min-h-[450px]"
              >
                <div className="absolute inset-0">
                  <img 
                    src="https://img1.pic.in.th/images/Card-reading-techniques.jpg" 
                    alt="Pattern Reading" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-30"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-baccarat-black via-baccarat-black/40 to-transparent" />
                </div>
                <div className="relative z-10 p-10 h-full flex flex-col justify-end">
                  <div className="inline-block bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full mb-4 border border-blue-500/30 w-fit">
                    STRATEGY
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white mb-4">เทคนิคอ่านเค้าไพ่</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">
                    รวมเค้าไพ่ยอดนิยมกว่า 20 รูปแบบ พร้อมวิธีสังเกตและจังหวะการเข้าทำกำไรที่แม่นยำที่สุด
                  </p>
                  <div className="text-gold font-bold text-xs uppercase tracking-widest flex items-center group-hover:translate-x-2 transition-transform">
                    ดูเค้าไพ่ทั้งหมด <ChevronRight size={16} className="ml-1" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      {/* Step-by-Step Mastery Guide */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 uppercase tracking-tight">
            เส้นทางสู่การเป็น <span className="text-gold">เซียนบาคาร่า</span>
          </h2>
          <p className="text-gray-400">4 ขั้นตอนง่ายๆ ที่จะเปลี่ยนคุณจากมือใหม่ให้กลายเป็นมือโปร</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { 
              step: "01", 
              title: "ศึกษาพื้นฐาน", 
              desc: "เรียนรู้กฎกติกา อัตราการจ่าย และเงื่อนไขต่างๆ ให้แม่นยำที่สุดก่อนเริ่มเล่นจริง" 
            },
            { 
              step: "02", 
              title: "ฝึกอ่านเค้าไพ่", 
              desc: "สังเกตรูปแบบไพ่ที่ออกบ่อยๆ และฝึกวิเคราะห์แนวโน้มของเกมในแต่ละห้อง" 
            },
            { 
              step: "03", 
              title: "วางแผนการเงิน", 
              desc: "กำหนดงบประมาณ กำไรที่ต้องการ และจุดตัดขาดทุน (Stop Loss) อย่างเคร่งครัด" 
            },
            { 
              step: "04", 
              title: "ใช้เครื่องมือช่วย", 
              desc: "นำสูตร AI และเทคนิคการเดินเงินมาประยุกต์ใช้เพื่อเพิ่มความแม่นยำในการตัดสินใจ" 
            }
          ].map((item, i) => (
            <div key={item.step} className="relative group">
              <div className="text-8xl font-black text-white/5 absolute -top-8 -left-4 group-hover:text-gold/10 transition-colors">
                {item.step}
              </div>
              <div className="relative z-10 pt-8">
                <h3 className="text-xl font-bold text-white mb-4 group-hover:text-gold transition-colors">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
              {i < 3 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gold/20" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* AI Baccarat Formula Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-br from-gray-900 to-baccarat-black border border-gold/20 rounded-[3rem] overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 hidden lg:block">
            <img 
              src="https://img2.pic.in.th/AI-money-management-formula.jpg" 
              alt="AI Formula Background" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-baccarat-black" />
          </div>
          
          <div className="p-8 md:p-16 lg:w-2/3 relative z-10">
            <div className="inline-flex items-center space-x-2 bg-gold/10 px-4 py-2 rounded-full border border-gold/20 mb-8">
              <Zap className="text-gold w-4 h-4" />
              <span className="text-gold text-xs font-bold uppercase tracking-widest">AI Technology</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black text-white mb-8 leading-tight">
              สูตรบาคาร่า <span className="gold-gradient">AI 2026 อัจฉริยะ</span> <br />
              แม่นยำที่สุดแห่งปี 2026
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20 shrink-0">
                    <Target className="text-gold w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-1">คำนวณความเสี่ยง</h4>
                    <p className="text-gray-400 text-sm">วิเคราะห์โอกาสชนะในแต่ละตาแบบ Real-time เพื่อการวางเดิมพันที่ปลอดภัย</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20 shrink-0">
                    <TrendingUp className="text-gold w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-1">ระบบเดินเงินอัตโนมัติ</h4>
                    <p className="text-gray-400 text-sm">แนะนำการปรับเบทตามสถานการณ์จริง ช่วยรักษาพอร์ตและทำกำไรสูงสุด</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20 shrink-0">
                    <Award className="text-gold w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-1">ความแม่นยำ 98%</h4>
                    <p className="text-gray-400 text-sm">ผ่านการทดสอบด้วย Big Data กว่า 10 ล้านตา เพื่อความมั่นใจในทุกการเดิมพัน</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20 shrink-0">
                    <ShieldCheck className="text-gold w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold mb-1">ปลอดภัย ไร้กังวล</h4>
                    <p className="text-gray-400 text-sm">ระบบทำงานแยกส่วน ไม่มีการเก็บข้อมูลส่วนตัว มั่นใจได้ในความเป็นส่วนตัว</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                to="/formula" 
                className="gold-bg-gradient text-baccarat-black px-10 py-4 rounded-full font-black text-center hover:scale-105 transition-transform"
              >
                เข้าใช้งานสูตร AI ฟรี
              </Link>
              <a 
                href="https://your-target-site.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white/10 text-white border border-white/20 px-10 py-4 rounded-full font-black text-center hover:bg-white/20 transition-colors"
              >
                สมัครสมาชิกรับสิทธิ์
              </a>
            </div>
          </div>
          
          <div className="lg:hidden w-full h-64">
            <img 
              src="https://img2.pic.in.th/AI-money-management-formula.jpg" 
              alt="AI Formula Mobile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* Latest Articles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12 md:mb-16 gap-4">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter">
              บทความ <span className="text-gold">ล่าสุด</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg">อัปเดตเทคนิคและข่าวสารใหม่ๆ ส่งตรงจากเหล่าเซียนทุกสัปดาห์</p>
          </div>
          <Link to="/articles" className="flex items-center text-gold font-bold hover:underline group">
            ดูทั้งหมด <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {publishedArticles.slice(0, 4).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* Trust / CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-24 relative overflow-hidden border border-white/10 shadow-[0_0_40px_rgba(139,0,0,0.3)]">
          {/* Background Image */}
          <img 
            src="https://img1.pic.in.th/images/Are-you-ready-to-become-a-true-baccarat-master.jpg" 
            alt="Baccarat Master CTA Background" 
            className="absolute inset-0 w-full h-full object-cover z-0"
            referrerPolicy="no-referrer"
          />
          {/* Gradient Overlay to ensure text readability while keeping the red theme */}
          <div className="absolute inset-0 bg-gradient-to-br from-baccarat-red/80 to-baccarat-black/90 z-0" />
          
          {/* Decorative glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold/20 rounded-full -mr-48 -mt-48 blur-[100px] z-0" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-baccarat-red/40 rounded-full -ml-32 -mb-32 blur-[80px] z-0" />
          
          <div className="relative z-10 text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-10 leading-[1.1] tracking-tighter">
                พร้อมที่จะเป็น <br />
                <span className="text-gold-light">เซียนบาคาร่าตัวจริง</span> แล้วหรือยัง?
              </h2>
              <p className="text-white/80 text-lg md:text-xl mb-10 md:mb-14 leading-relaxed max-w-2xl mx-auto px-4">
                เราได้รวบรวมทุกอย่างที่คุณต้องการไว้ที่นี่แล้ว ไม่ว่าจะเป็นเทคนิค สูตร หรือทางเข้าเล่นที่มั่นคง 
                อย่าปล่อยให้โอกาสทำกำไรหลุดมือไป
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6 px-4">
                <a 
                  href="https://your-target-site.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white text-baccarat-red px-8 md:px-16 py-4 md:py-6 rounded-full font-black text-lg md:text-2xl hover:scale-105 transition-transform shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center w-full sm:w-auto"
                >
                  สมัครสมาชิกตอนนี้ <ChevronRight className="ml-2 w-6 h-6 md:w-7 md:h-7" />
                </a>
              </div>
              <div className="mt-10 md:mt-12 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-white/60 text-xs md:text-sm font-bold uppercase tracking-widest px-4">
                <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-gold" /> มั่นคง 100%</div>
                <div className="flex items-center gap-2"><Award size={18} className="text-gold" /> มาตรฐานสากล</div>
                <div className="flex items-center gap-2"><Zap size={18} className="text-gold" /> บริการ 24 ชม.</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ArticlesPage = ({ articles, user }: { articles: Article[], user: User | null }) => {
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
  const publishedArticles = articles.filter(a => isAdmin || isPublished(a));
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const categoryFilter = searchParams.get('category');
  const tagFilter = searchParams.get('tag');

  const filteredArticles = publishedArticles.filter(a => {
    const categoryMatch = categoryFilter ? a.category === categoryFilter : true;
    const tagMatch = tagFilter ? (a.tags && a.tags.split(',').map(t => t.trim()).includes(tagFilter)) : true;
    return categoryMatch && tagMatch;
  });

  const [visibleCount, setVisibleCount] = useState(9);
  
  // Reset visible count when category or tag changes
  useEffect(() => {
    setVisibleCount(9);
  }, [categoryFilter, tagFilter]);

  const displayedArticles = filteredArticles.slice(0, visibleCount);
  const hasMore = visibleCount < filteredArticles.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 9);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <SEO 
        title={categoryFilter ? `บทความหมวดหมู่: ${categoryFilter}` : "บทความบาคาร่าทั้งหมด"} 
        description="รวมบทความ เทคนิค และสูตรบาคาร่าที่อัพเดทล่าสุด เพื่อช่วยให้คุณเป็นเซียนบาคาร่า" 
      />
      <div className="mb-16 text-center">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
          {categoryFilter ? (
            <>คลังบทความ <span className="gold-gradient">{categoryFilter}</span></>
          ) : (
            <>คลังบทความ <span className="gold-gradient">บาคาร่า</span></>
          )}
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto mb-6">
          {categoryFilter === 'สูตรบาคาร่าฟรี' 
            ? 'รวบรวมสูตรบาคาร่าฟรี เทคนิคการเดินเงิน และวิธีการอ่านเค้าไพ่ที่แม่นยำที่สุด เพื่อเพิ่มโอกาสชนะให้กับคุณ'
            : 'รวบรวมทุกเรื่องราวเกี่ยวกับบาคาร่า ตั้งแต่วิธีเล่น สูตรเดินเงิน การอ่านเค้าไพ่ และเทคนิคต่างๆ ที่จะช่วยให้คุณเป็นมืออาชีพ'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-gold/60 hover:text-gold text-sm flex items-center gap-2 mx-auto transition-colors"
        >
          <RefreshCw size={14} /> รีเฟรชข้อมูล
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {displayedArticles.length > 0 ? (
          displayedArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        ) : (
          <div className="col-span-full text-center py-20 text-gray-500">
            ยังไม่มีบทความในหมวดหมู่นี้
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-16 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLoadMore}
            className="bg-gradient-to-r from-gold-light via-gold to-gold-dark text-black font-black px-10 py-4 rounded-full shadow-2xl shadow-gold/20 hover:shadow-gold/40 transition-all flex items-center gap-2 mx-auto"
          >
            <Plus size={20} /> โหลดบทความเพิ่มเติม
          </motion.button>
          <p className="mt-4 text-gray-500 text-sm">
            แสดง {displayedArticles.length} จากทั้งหมด {filteredArticles.length} บทความ
          </p>
        </div>
      )}
    </div>
  );
};

const ArticleDetailPage = ({ articles, user }: { articles: Article[], user: User | null }) => {
  const { slug } = useParams();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const article = articles.find(a => a.slug === slug);

  if (!article || (!isAdmin && !isPublished(article))) return <div className="text-center py-20 text-white">ไม่พบเนื้อหาที่ต้องการ หรือบทความยังไม่ถึงเวลาเผยแพร่</div>;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.metaTitle || article.title,
    "description": article.metaDescription || article.excerpt,
    "image": article.image || "https://img2.pic.in.th/LOGO1-Baccarat-Master.png",
    "datePublished": article.publishedAt ? new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt).toISOString() : new Date(article.createdAt.seconds ? article.createdAt.seconds * 1000 : article.createdAt).toISOString(),
    "dateModified": new Date(article.updatedAt.seconds ? article.updatedAt.seconds * 1000 : article.updatedAt).toISOString(),
    "author": {
      "@type": "Person",
      "name": "Baccarat Master"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Baccarat Master Guide",
      "logo": {
        "@type": "ImageObject",
        "url": "https://img2.pic.in.th/LOGO1-Baccarat-Master.png"
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <SEO 
        title={article.metaTitle || article.title} 
        description={article.metaDescription || article.excerpt} 
        keywords={article.metaKeywords}
        image={article.image}
        type="article"
        schema={schema}
      />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link to="/articles" className="text-gold flex items-center mb-8 hover:underline">
          <ChevronRight size={20} className="rotate-180 mr-2" /> กลับไปหน้าบทความ
        </Link>
        <div className="mb-8">
          <span className="bg-baccarat-red text-white text-xs font-bold px-4 py-1.5 rounded-full border border-gold/50">
            {article.category}
          </span>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white mt-6 mb-6 leading-tight">
            {article.title}
          </h1>
          <div className="flex items-center text-gray-500 text-sm space-x-6">
            <span className="flex items-center"><Award size={16} className="mr-2" /> โดย {article.author}</span>
            <span className="flex items-center"><Target size={16} className="mr-2" /> {article.date}</span>
            <span className="flex items-center"><Clock size={16} className="mr-2" /> {calculateReadTime(article.content)}</span>
          </div>
        </div>
        
        <div className="prose prose-invert prose-gold max-w-none">
          <div 
            className="text-gray-300 leading-loose text-lg space-y-6 article-content"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>

        <div className="mt-20 p-8 bg-gray-900 border border-gold/30 rounded-3xl text-center">
          <h3 className="text-2xl font-bold text-white mb-4">สนใจนำเทคนิคนี้ไปใช้จริง?</h3>
          <p className="text-gray-400 mb-8">เราขอแนะนำเว็บไซต์ที่ได้มาตรฐานสากล มั่นคง และปลอดภัยที่สุดในขณะนี้</p>
          <a 
            href="https://your-target-site.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gold-bg-gradient text-baccarat-black px-10 py-4 rounded-full font-black text-lg hover:scale-105 transition-transform"
          >
            ไปที่หน้าเดิมพัน <ExternalLink size={20} className="ml-2" />
          </a>
        </div>

        <div className="mt-20">
          <h3 className="text-2xl font-bold text-white mb-8">บทความที่เกี่ยวข้อง</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles
              .filter(a => a.id !== article.id && (a.category === article.category || (a.tags && article.tags && a.tags.split(',').some(t => article.tags.split(',').includes(t)))))
              .slice(0, 3)
              .map(related => (
                <ArticleCard key={related.id} article={related} />
              ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LoginPage = ({ user, setUser }: { user: User | null, setUser: (u: User | null) => void }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Check for the requested credentials
    if (username === 'admin' && password === 'Bankk2599++') {
      const mockUser = { email: 'admin', uid: 'admin-uid' } as User;
      setUser(mockUser);
      localStorage.setItem('custom_admin_user', JSON.stringify(mockUser));
      navigate('/admin');
    } else {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <SEO 
        title="เข้าสู่ระบบ" 
        description="เข้าสู่ระบบเพื่อจัดการบทความและข้อมูลเว็บไซต์ Baccarat Master Guide" 
      />
      <div className="max-w-md w-full bg-gray-900 border border-gold/20 p-10 rounded-[2rem] text-center shadow-2xl">
        <div className="w-16 h-16 bg-baccarat-red rounded-full flex items-center justify-center border border-gold mx-auto mb-8">
          <Lock className="text-gold w-8 h-8" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white mb-4 uppercase tracking-tighter">Admin Login</h1>
        <p className="text-gray-400 mb-10">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบเพื่อจัดการบทความ</p>
        
        {error && (
          <div className="bg-red-900/40 border border-red-500 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="text-left">
            <label className="block text-gray-400 text-xs font-bold uppercase mb-2 ml-4">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black border border-gold/20 rounded-full px-6 py-4 text-white outline-none focus:border-gold transition-colors"
              placeholder="admin"
              required
            />
          </div>
          <div className="text-left">
            <label className="block text-gray-400 text-xs font-bold uppercase mb-2 ml-4">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black border border-gold/20 rounded-full px-6 py-4 text-white outline-none focus:border-gold transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          <button 
            type="submit"
            className="w-full gold-bg-gradient text-baccarat-black font-black py-4 rounded-full hover:scale-105 transition-transform shadow-lg shadow-gold/20 mt-4"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};

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
      
      const data = await response.json() as any;
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

const AdminDashboard = ({ articles, categories, setArticles, setCategories }: { articles: Article[], categories: string[], setArticles: (articles: Article[]) => void, setCategories: (categories: string[]) => void }) => {
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

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedArticles = async () => {
    if (!confirm('ต้องการเพิ่มบทความเริ่มต้นเข้าระบบหรือไม่? (บทความทดลองจะถูกเพิ่มเข้าไป)')) return;
    
    setIsSeeding(true);
    try {
      // Import ARTICLES from constants (we need to make sure it's available or just define a few here)
      const defaultArticles = [
        {
          id: 'welcome-article',
          title: 'ยินดีต้อนรับสู่คลังบทความบาคาร่า',
          slug: 'welcome-to-baccarat-articles',
          excerpt: 'เริ่มต้นเรียนรู้เทคนิคและสูตรบาคาร่าที่นี่ เพื่อเพิ่มโอกาสในการชนะเดิมพันของคุณ',
          content: '<h1>ยินดีต้อนรับ</h1><p>นี่คือบทความแรกของคุณ คุณสามารถแก้ไขหรือลบบทความนี้ได้ในหน้าจัดการหลังบ้าน</p>',
          category: 'เทคนิคบาคาร่า',
          image: 'https://picsum.photos/seed/baccarat/800/600',
          status: 'published',
          publishedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: 'Admin',
          views: 0,
          readTime: '2 min read',
          tags: ['บาคาร่า', 'เทคนิค'],
          metaTitle: 'ยินดีต้อนรับสู่คลังบทความบาคาร่า',
          metaDescription: 'เริ่มต้นเรียนรู้เทคนิคและสูตรบาคาร่าที่นี่',
          keywords: 'บาคาร่า, เทคนิค'
        }
      ];

      for (const article of defaultArticles) {
        await fetch(`${API_BASE}/api/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(article)
        });
      }
      
      // Refresh articles
      const response = await fetch(`${API_BASE}/api/articles`);
      if (response.ok) {
        const docs = await response.json() as Article[];
        setArticles(docs);
      }
      
      alert('เพิ่มบทความเริ่มต้นเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error seeding articles:', error);
      alert('เกิดข้อผิดพลาดในการเพิ่มบทความ');
    } finally {
      setIsSeeding(false);
    }
  };

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

    const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการเขียนบทความ SEO และการพนันออนไลน์ (บาคาร่า) ที่มีประสบการณ์จริง เขียนด้วยภาษาที่อ่านง่าย สื่อสารได้ใจความ ไม่ซับซ้อน มีความเป็นมนุษย์ มีมุมมองเฉพาะตัวเหมือนคนเขียนจริงๆ ไม่ใช่หุ่นยนต์`;
    const userPrompt = `โจทย์/คีย์เวิร์ด: ${aiPrompt}

ข้อกำหนด:
- เขียนเนื้อหาบทความในรูปแบบ HTML (ใช้ <h2>, <p>, <ul>, <li>, <strong>)
- **ความยาวของเนื้อหาบทความต้องอยู่ระหว่าง 1000 - 1500 คำ** (เน้นเนื้อหาที่เจาะลึกและมีประโยชน์)
- นำคีย์เวิร์ดที่เกี่ยวข้องมาแทรกในเนื้อหาและติดตัวหนา (<strong>) ไว้ด้วย
- เน้นความแม่นยำของข้อมูล
- **Meta Title: ห้ามเกิน 60 ตัวอักษร**
- **Meta Description: ห้ามเกิน 160 ตัวอักษร**
- **URL Slug: ภาษาอังกฤษเท่านั้น ใช้ - แทนช่องว่าง**

สำคัญ: ให้ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างที่กำหนด ห้ามมีข้อความอื่นนอกเหนือจาก JSON:
{
  "content": "เนื้อหาบทความ HTML ความยาว 1000-1500 คำ",
  "metaTitle": "Meta Title สำหรับ SEO",
  "metaDescription": "Meta Description สำหรับ SEO",
  "slug": "URL Slug ภาษาอังกฤษ"
}`;

    try {
      let result: any = null;
      let rawResponse = '';

      // Try Gemini first
      try {
        console.log('Attempting generation with Gemini...');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `${systemPrompt}\n\n${userPrompt}`,
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
        rawResponse = response.text || '';
      } catch (geminiErr) {
        console.error('Gemini failed, falling back to OpenAI:', geminiErr);
        
        // Fallback to OpenAI
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          dangerouslyAllowBrowser: true
        });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        });

        rawResponse = completion.choices[0].message.content || '';
      }

      console.log('AI Raw Response:', rawResponse);
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawResponse;
      
      try {
        result = JSON.parse(jsonStr || '{}');
        console.log('AI Parsed Result:', result);
        
        if (result && result.content) {
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
        } else {
          throw new Error('Invalid AI response structure');
        }
      } catch (parseErr) {
        console.error('JSON Parse Error:', parseErr);
        // Fallback: if JSON parse fails, just use the raw text as content
        setCurrentArticle(prev => ({
          ...prev,
          content: (prev.content || '') + rawResponse
        }));
      }
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setError('ไม่สามารถเชื่อมต่อกับ AI ทั้ง Gemini และ ChatGPT ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      if (!res.ok) throw new Error('Failed to save category');
      setNewCategoryName('');
      
      // Update categories state
      const catsRes = await fetch(`${API_BASE}/api/categories`);
      if (catsRes.ok) {
        const catsData = await catsRes.json() as any[];
        const cats = catsData.map((cat: any) => cat.name);
        setCategories(cats);
      }
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
      const res = await fetch(`${API_BASE}/api/categories/by-name/${encodeURIComponent(editingCategory.old)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: editingCategory.new.trim() })
      });
      if (!res.ok) throw new Error('Failed to update category');
      setEditingCategory(null);
      
      // Update categories state
      const catsRes = await fetch(`${API_BASE}/api/categories`);
      if (catsRes.ok) {
        const catsData = await catsRes.json() as any[];
        const cats = catsData.map((cat: any) => cat.name);
        setCategories(cats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    // Removed window.confirm as it is blocked in the sandboxed environment
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/categories/by-name/${encodeURIComponent(catName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete category');
      
      // Update categories state
      const catsRes = await fetch(`${API_BASE}/api/categories`);
      if (catsRes.ok) {
        const catsData = await catsRes.json() as any[];
        const cats = catsData.map((cat: any) => cat.name);
        setCategories(cats);
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
        if (!currentArticle.publishedAt) return new Date().toISOString();
        // If it's a string from the datetime-local input
        if (typeof currentArticle.publishedAt === 'string') {
          const dateStr = currentArticle.publishedAt.includes('+') || currentArticle.publishedAt.includes('Z') 
            ? currentArticle.publishedAt 
            : `${currentArticle.publishedAt}+07:00`;
          return new Date(dateStr).toISOString();
        }
        // If it's already a Firestore Timestamp or Date object
        if (currentArticle.publishedAt.seconds) return new Date(currentArticle.publishedAt.seconds * 1000).toISOString();
        return new Date(currentArticle.publishedAt).toISOString();
      };

      const articleData = {
        ...dataWithoutId,
        status,
        date: formatInTimeZone(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'),
        author: auth.currentUser?.displayName || 'Admin',
        publishedAt: getPublishedAt(),
      };

      // Check document size (SQLite limit is higher, but keep reasonable)
      const estimatedSize = JSON.stringify(articleData).length;
      if (estimatedSize > 5000000) {
        throw new Error(`บทความมีขนาดใหญ่เกินไป (${(estimatedSize / 1024 / 1024).toFixed(2)} MB) กรุณาลดขนาดเนื้อหาหรือรูปภาพที่ฝังอยู่ในบทความ`);
      }

      let res;
      if (id) {
        res = await fetch(`${API_BASE}/api/articles/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articleData)
        });
      } else {
        res = await fetch(`${API_BASE}/api/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(articleData)
        });
      }

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to save article');
        } else {
          throw new Error(`Failed to save article: ${res.status} ${res.statusText}`);
        }
      }

      // Also ensure category exists in categories collection
      if (articleData.category) {
        const catRes = await fetch(`${API_BASE}/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: articleData.category })
        });
        if (!catRes.ok) {
          console.error('Failed to save category');
        }
      }

      setIsEditing(false);
      setCurrentArticle({});
      
      // Update articles and categories state
      const [articlesRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE}/api/articles`),
        fetch(`${API_BASE}/api/categories`)
      ]);
      if (articlesRes.ok) {
        const docs = await articlesRes.json() as Article[];
        setArticles(docs);
      }
      if (categoriesRes.ok) {
        const catsData = await categoriesRes.json() as any[];
        const cats = catsData.map((cat: any) => cat.name);
        setCategories(cats);
      }
    } catch (err: any) {
      let message = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error && parsed.error.includes('permission-denied')) {
          message = "คุณไม่มีสิทธิ์ในการบันทึกข้อมูล (Permission Denied)";
        } else if (parsed.error && parsed.error.includes('exceeds the maximum allowed size')) {
          message = "บทความมีขนาดใหญ่เกินไป (เกิน 1MB) กรุณาลดขนาดรูปภาพหรือเนื้อหาลง";
        } else {
          message = parsed.error || err.message;
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

  const handleDelete = async (id: string | number) => {
    // Removed window.confirm as it is blocked in the sandboxed environment
    try {
      const res = await fetch(`${API_BASE}/api/articles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete article');
      window.location.reload();
    } catch (error: any) {
      console.error("Delete Error:", error);
      setError("ไม่สามารถลบบทความได้: " + error.message);
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
              {categories.map((cat, index) => (
                <div key={cat + index} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl">
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
          <button 
            onClick={handleSeedArticles}
            disabled={isSeeding}
            className="bg-blue-600/20 text-blue-400 px-6 py-3 rounded-full font-bold hover:bg-blue-600/30 border border-blue-600/30 transition-all disabled:opacity-50 flex items-center"
          >
            {isSeeding ? 'กำลังเพิ่ม...' : <><Database size={20} className="mr-2" /> เพิ่มบทความเริ่มต้น</>}
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
                  value={currentArticle.publishedAt ? formatInTimeZone(new Date(currentArticle.publishedAt.seconds ? currentArticle.publishedAt.seconds * 1000 : currentArticle.publishedAt), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm") : ''} 
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
                        <span className="flex items-center"><Target size={16} className="mr-2" /> {currentArticle.date || formatInTimeZone(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd')}</span>
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
                            <Calendar size={12} className="mr-1" /> ตั้งเวลา: {formatInTimeZone(new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')}
                          </span>
                        ) : (
                          <span className="text-green-400 flex items-center">
                            <Check size={12} className="mr-1" /> เผยแพร่แล้ว: {formatInTimeZone(new Date(article.publishedAt.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')}
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

const FormulaPage = () => {
  const [activeTab, setActiveTab] = useState<'sexy' | 'sa'>('sexy');
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [timer, setTimer] = useState(25); // 20s countdown + 5s reveal

  // Initialize tables on mount and when activeTab changes
  useEffect(() => {
    const generateTables = () => {
      return Array.from({ length: 12 }, (_, i) => {
        const history: string[] = [];
        const rounds = 40 + Math.floor(Math.random() * 15); // Start with some rounds
        for (let j = 0; j < rounds; j++) {
          const rand = Math.random();
          if (rand < 0.46) history.push('B');
          else if (rand < 0.92) history.push('P');
          else history.push('T');
        }
        
        const b = history.filter(x => x === 'B').length;
        const p = history.filter(x => x === 'P').length;
        const t = history.filter(x => x === 'T').length;

        return {
          id: i + 1,
          name: `Table ${i + 1}`,
          b,
          p,
          t,
          history,
          winRate: 85 + Math.floor(Math.random() * 15),
          isFull: false,
          resetTimer: 0
        };
      });
    };

    setTables(generateTables());
    setTimer(25);
  }, [activeTab]);

  // Global timer interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev - 1);
      
      // Handle individual table reset timers
      setTables(currentTables => currentTables.map(table => {
        if (table.isFull && table.resetTimer > 0) {
          const nextResetTimer = table.resetTimer - 1;
          if (nextResetTimer === 0) {
            // Reset table completely
            return {
              ...table,
              history: [],
              b: 0,
              p: 0,
              t: 0,
              isFull: false,
              resetTimer: 0,
              winRate: 85 + Math.floor(Math.random() * 15)
            };
          }
          return { ...table, resetTimer: nextResetTimer };
        }
        return table;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle table updates when timer hits 0
  useEffect(() => {
    if (timer <= 0) {
      setTables(currentTables => currentTables.map(table => {
        if (table.isFull) return table; // Don't update full tables

        const rand = Math.random();
        let newResult = 'B';
        if (rand < 0.46) newResult = 'B';
        else if (rand < 0.92) newResult = 'P';
        else newResult = 'T';

        const newHistory = [...table.history, newResult];
        const isNowFull = newHistory.length >= 60;

        return {
          ...table,
          history: newHistory,
          b: newHistory.filter(x => x === 'B').length,
          p: newHistory.filter(x => x === 'P').length,
          t: newHistory.filter(x => x === 'T').length,
          winRate: 85 + Math.floor(Math.random() * 15),
          isFull: isNowFull,
          resetTimer: isNowFull ? 60 : 0
        };
      }));
      setTimer(25);
    }
  }, [timer]);

  // Sync selectedTable with tables updates
  useEffect(() => {
    if (selectedTable) {
      const updated = tables.find(t => t.id === selectedTable.id);
      if (updated) setSelectedTable(updated);
    }
  }, [tables]);

  if (selectedTable) {
    const isSexy = activeTab === 'sexy';
    const themeColor = isSexy ? 'bg-baccarat-red' : 'bg-[#1e293b]'; // Slate 800
    const themeBorder = isSexy ? 'border-gold/30' : 'border-gold/40';
    const themeBg = isSexy ? 'bg-[#1a0b2e]' : 'bg-[#020617]'; // Very dark navy
    const themeShadow = isSexy ? 'shadow-purple-900/40' : 'shadow-blue-900/20';
    const themeHeaderBg = isSexy ? 'from-purple-900/20' : 'from-blue-900/20';
    const themeLogoBg = isSexy ? 'from-pink-600 to-purple-800' : 'from-slate-800 to-slate-950';

    const total = selectedTable.b + selectedTable.p + selectedTable.t;
    const bPercent = total > 0 ? Math.round((selectedTable.b / total) * 100) : 0;
    const pPercent = total > 0 ? Math.round((selectedTable.p / total) * 100) : 0;
    const tPercent = total > 0 ? 100 - bPercent - pPercent : 0;

    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <SEO 
          title="สูตรบาคาร่า AI 2026 แม่นยำที่สุด ฟรี" 
          description="สูตรบาคาร่าฟรี ระบบคำนวณด้วย AI แม่นยำที่สุด รองรับ Sexy Baccarat และ SA Gaming อัปเดตอัตราชนะแบบเรียลไทม์" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "border-2 rounded-[2rem] overflow-hidden shadow-2xl transition-colors duration-500",
            themeBg,
            themeBorder,
            themeShadow
          )}
        >
          {/* Header Section */}
          <div className={cn("p-4 sm:p-6 md:p-8 border-b border-gold/10 bg-gradient-to-b to-transparent", themeHeaderBg)}>
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 sm:gap-8">
              <div className="flex flex-col sm:flex-row items-center sm:space-x-6 text-center sm:text-left">
                <div className={cn("w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br rounded-3xl flex items-center justify-center border-2 border-gold shadow-lg mb-4 sm:mb-0", themeLogoBg)}>
                  <div className="text-center">
                    <Award className="text-gold w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
                    <div className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-tighter leading-none mt-1">
                      {isSexy ? 'Sexy' : 'SA'}<br/>Gaming
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-3xl sm:text-4xl font-black text-white mb-1 uppercase tracking-tight">{selectedTable.name}</div>
                  <div className="flex items-center justify-center sm:justify-start space-x-3">
                    <span className="text-gray-400 font-bold text-xs sm:text-sm">ตาถัดไป :</span>
                    <span className={cn(
                      "font-black text-lg sm:text-xl animate-pulse tracking-widest",
                      (selectedTable.history.length % 2 === 0) ? "text-baccarat-red" : "text-blue-500"
                    )}>
                      {selectedTable.history.length % 2 === 0 ? 'BANKER' : 'PLAYER'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center lg:items-end space-y-4 w-full lg:w-auto">
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="bg-black/60 border-2 border-gold/50 rounded-2xl flex overflow-hidden shadow-lg w-full sm:w-auto">
                    <div className={cn("px-3 sm:px-6 py-2 sm:py-3 text-white font-black text-base sm:text-2xl border-r border-gold/20 flex items-center justify-center whitespace-nowrap", isSexy ? "bg-purple-900/40" : "bg-slate-800/80")}>อัตราชนะ</div>
                    <div className="flex-grow sm:flex-grow-0 px-4 sm:px-10 py-2 sm:py-3 bg-gradient-to-b from-yellow-300 to-gold text-baccarat-black font-black text-2xl sm:text-5xl flex items-center justify-center">
                      {selectedTable.winRate}%
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedTable(null)}
                    className={cn(
                      "flex items-center justify-center space-x-2 text-white px-6 py-3 sm:py-4 rounded-2xl font-bold transition-all border border-gold/20 shadow-lg group w-full sm:w-auto",
                      isSexy ? "bg-gray-900 hover:bg-baccarat-red" : "bg-gray-900 hover:bg-slate-800"
                    )}
                  >
                    <LogOut size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    <span className="whitespace-nowrap">ออกจากห้อง</span>
                  </button>
                </div>
                <div className="text-gold font-bold italic text-xs sm:text-sm tracking-wider text-center lg:text-right">
                  {selectedTable.isFull ? (
                    <span className="text-red-400 animate-pulse">เริ่มกระดานถัดไปในอีก {selectedTable.resetTimer} วินาที</span>
                  ) : timer > 5 ? (
                    <span>รอบต่อไปเริ่มในอีก {timer - 5} วินาที</span>
                  ) : (
                    <span className="animate-pulse">รอผลสักครู่..</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Game Rounds */}
            <div className="lg:col-span-3">
              <div className="bg-black/20 rounded-3xl border border-gold/20 overflow-hidden h-full flex flex-col">
                <div className={cn("p-4 text-center font-black text-white text-xl shadow-lg", themeColor)}>เกมรอบที่ {selectedTable.history.length}</div>
                <div className="flex-grow h-[420px] overflow-y-auto p-4 space-y-2 custom-scrollbar bg-black/20">
                  {[...selectedTable.history].reverse().map((type: string, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                      <span className="text-gray-400 font-bold w-8">{selectedTable.history.length - i}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white",
                        type === 'B' ? "bg-baccarat-red" : type === 'P' ? "bg-blue-600" : "bg-green-600"
                      )}>
                        {type}
                      </div>
                      <div className={cn(
                        "px-4 py-1 rounded-lg font-black text-xs min-w-[60px] text-center shadow-sm bg-green-600 text-white"
                      )}>
                        ชนะ
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle: Roadmap */}
            <div className="lg:col-span-6">
              <div className="bg-black/20 rounded-3xl border border-gold/20 p-4 sm:p-6 h-full flex flex-col">
                <div className="flex-grow grid grid-rows-6 grid-cols-10 gap-1 sm:gap-2">
                  {Array.from({ length: 60 }, (_, i) => {
                    const type = selectedTable.history[i] || '';
                    return (
                      <div key={i} className="aspect-square rounded-full border border-white/10 flex items-center justify-center text-[10px] sm:text-[12px] font-black shadow-inner bg-black/20">
                        {type === 'B' && <div className="w-full h-full rounded-full bg-baccarat-red flex items-center justify-center text-white border-2 border-white/30 shadow-[0_0_5px_rgba(255,0,0,0.5)]">B</div>}
                        {type === 'P' && <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white border-2 border-white/30 shadow-[0_0_5px_rgba(37,99,235,0.5)]">P</div>}
                        {type === 'T' && <div className="w-full h-full rounded-full bg-green-600 flex items-center justify-center text-white border-2 border-white/30 shadow-[0_0_5px_rgba(22,163,74,0.5)]">T</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="lg:col-span-3">
              <div className="bg-black/20 rounded-3xl border border-gold/20 overflow-hidden h-full flex flex-col">
                <div className={cn("p-4 text-center font-black text-white text-xl shadow-lg", isSexy ? "bg-purple-900/90" : "bg-slate-900/90")}>สถิติการเล่น</div>
                <div className="p-6 space-y-8 bg-black/20 flex-grow">
                  <div className="flex justify-center space-x-4 mb-8">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-baccarat-red flex items-center justify-center text-white font-black border-2 border-white/30 mb-2 shadow-lg">B</div>
                      <div className="text-white font-black text-lg">{selectedTable.b}</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-black border-2 border-white/30 mb-2 shadow-lg">P</div>
                      <div className="text-white font-black text-lg">{selectedTable.p}</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-black border-2 border-white/30 mb-2 shadow-lg">T</div>
                      <div className="text-white font-black text-lg">{selectedTable.t}</div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm font-bold text-gray-300 mb-2">
                        <span className="flex items-center"><span className="w-2 h-2 bg-baccarat-red rounded-full mr-2"></span>เจ้ามือ</span>
                        <span>{bPercent}%</span>
                      </div>
                      <div className="h-4 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-baccarat-red to-pink-600 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-all duration-1000"
                          style={{ width: `${bPercent}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-bold text-gray-300 mb-2">
                        <span className="flex items-center"><span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>ผู้เล่น</span>
                        <span>{pPercent}%</span>
                      </div>
                      <div className="h-4 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-1000"
                          style={{ width: `${pPercent}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm font-bold text-gray-300 mb-2">
                        <span className="flex items-center"><span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>เสมอ</span>
                        <span>{tPercent}%</span>
                      </div>
                      <div className="h-4 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full shadow-[0_0_10px_rgba(22,163,74,0.5)] transition-all duration-1000"
                          style={{ width: `${tPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Graph Section */}
          <div className="p-6 md:p-8 bg-black/40 border-t border-gold/10">
            <div className={cn("rounded-[2.5rem] border border-gold/20 overflow-hidden shadow-inner", isSexy ? "bg-purple-950/60" : "bg-slate-900/60")}>
              <div className={cn("p-4 text-center font-black text-white text-xl border-b border-gold/10", isSexy ? "bg-purple-900/40" : "bg-slate-800/40")}>Graph</div>
              <div className="p-4 sm:p-8 md:p-12">
                <div className="text-center mb-6 sm:mb-10 font-black text-white text-xl sm:text-3xl tracking-tight">กราฟแสดงสถิติผล</div>
                
                {/* Vertical Bead Plate Style Columns */}
                <div className="flex justify-start sm:justify-center gap-1.5 sm:gap-2 mb-8 sm:mb-12 overflow-x-auto pb-4 no-scrollbar">
                  {Array.from({ length: 10 }).map((_, colIdx) => {
                    const colHistory = selectedTable.history.slice(colIdx * 6, (colIdx + 1) * 6);
                    return (
                      <div key={colIdx} className="flex flex-col gap-1 sm:gap-1.5">
                        {Array.from({ length: 6 }).map((_, rowIdx) => {
                          const result = colHistory[rowIdx];
                          return (
                            <div 
                              key={rowIdx} 
                              className={cn(
                                "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-black border border-white/5",
                                !result ? "bg-white/5" :
                                result === 'B' ? "bg-baccarat-red text-white" :
                                result === 'P' ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                              )}
                            >
                              {result || ''}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Trend Line Graph with Grid */}
                <div className="relative h-64 sm:h-80 w-full bg-black/60 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl group/graph">
                  {/* Grid Background */}
                  <div className="absolute inset-0 grid grid-cols-10 grid-rows-6 opacity-10">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div key={i} className="border-[0.5px] border-white/20"></div>
                    ))}
                  </div>

                  {/* Zone Labels */}
                  <div className="absolute top-4 left-6 flex flex-col space-y-1 opacity-40 group-hover/graph:opacity-100 transition-opacity">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-baccarat-red shadow-[0_0_8px_rgba(255,0,0,0.8)]"></div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Banker Zone</span>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-6 flex flex-col space-y-1 opacity-40 group-hover/graph:opacity-100 transition-opacity">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Player Zone</span>
                    </div>
                  </div>

                  {/* Zero Line (Center) */}
                  <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-0"></div>

                  {/* Trend Line SVG */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isSexy ? "#ef4444" : "#fbbf24"} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={isSexy ? "#ef4444" : "#fbbf24"} stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Area Fill */}
                    <path
                      d={(() => {
                        let currentY = 50;
                        const points = selectedTable.history.slice(-40).map((res: string, i: number) => {
                          if (res === 'B') currentY = Math.max(10, currentY - 5);
                          if (res === 'P') currentY = Math.min(90, currentY + 5);
                          return `${(i / 39) * 100},${currentY}`;
                        });
                        if (points.length === 0) return "";
                        return `M 0,100 L ${points.join(' L ')} L 100,100 Z`;
                      })()}
                      fill="url(#graphGradient)"
                      className="transition-all duration-1000"
                    />

                    {/* Main Line */}
                    <polyline
                      fill="none"
                      stroke={isSexy ? "#ef4444" : "#fbbf24"}
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      points={(() => {
                        let currentY = 50;
                        return selectedTable.history.slice(-40).map((res: string, i: number) => {
                          if (res === 'B') currentY = Math.max(10, currentY - 5);
                          if (res === 'P') currentY = Math.min(90, currentY + 5);
                          return `${(i / 39) * 100},${currentY}`;
                        }).join(' ');
                      })()}
                    />

                    {/* Data Points */}
                    {(() => {
                      let currentY = 50;
                      const history = selectedTable.history.slice(-40);
                      return history.map((res: string, i: number) => {
                        if (res === 'B') currentY = Math.max(10, currentY - 5);
                        if (res === 'P') currentY = Math.min(90, currentY + 5);
                        
                        const isLast = i === history.length - 1;
                        
                        return (
                          <g key={i}>
                            {isLast && (
                              <circle
                                cx={(i / 39) * 100}
                                cy={currentY}
                                r="2"
                                fill={res === 'B' ? "#ef4444" : res === 'P' ? "#2563eb" : "#16a34a"}
                                className="animate-ping opacity-50"
                              />
                            )}
                            <circle
                              cx={(i / 39) * 100}
                              cy={currentY}
                              r={isLast ? "1.2" : "0.6"}
                              fill={res === 'B' ? "#ef4444" : res === 'P' ? "#2563eb" : "#16a34a"}
                              className={cn(
                                "transition-all duration-500",
                                isLast ? "drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" : "opacity-80"
                              )}
                            />
                          </g>
                        );
                      });
                    })()}
                  </svg>

                  {/* Current Value Indicator */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end pointer-events-none">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1 shadow-xl">
                      <span className="text-[10px] font-black text-gold uppercase tracking-tighter">Live Trend</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 sm:mt-8 text-center text-gray-300 font-black text-sm sm:text-lg tracking-wide uppercase px-4">
                  ลูกค้าสามารถดูกราฟเพื่อเป็นเทคนิคในการเดิมพัน
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-gold via-yellow-300 to-gold p-4 text-center text-xs font-black text-baccarat-black uppercase tracking-widest">
            เว็บไซต์ ใช้สูตรฟรี เป็นเพียงโปรแกรมคำนวณตัวเลขเชิงสถิติเพื่อใช้ในการวิเคราะห์และทำนายผลบาคาร่าเท่านั้น! เว็บไซต์เราไม่ใช่เว็บไซต์แทงหวยหรือพนันออนไลน์ เราไม่สนับสนุนการเล่นพนันออนไลน์ทุกรูปแบบ
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <SEO 
        title="สูตรบาคาร่า AI 2026 แม่นยำที่สุด ฟรี" 
        description="สูตรบาคาร่าฟรี ระบบคำนวณด้วย AI แม่นยำที่สุด รองรับ Sexy Baccarat และ SA Gaming อัปเดตอัตราชนะแบบเรียลไทม์" 
      />
      <div className="text-center mb-16">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
          สูตรบาคาร่าฟรี ต้องที่นี้ <br />
          <span className="gold-gradient uppercase tracking-tighter">สูตรบาคาร่า AI 2026 แม่นยำที่สุด</span>
        </h1>
        <p className="text-gray-400 max-w-3xl mx-auto text-sm md:text-base leading-relaxed">
          สำหรับทุกท่านที่ตามหา สูตรบาคาร่าฟรี ต้องที่นี้เลย สูตรบาคาร่า AI 2026 ของ Baccarat Master Guide มาด้วยระบบคำนวณ สูตรบาคาร่า ด้วย AI แม่นยำที่สุดในขณะนี้ รองรับทั้งค่าย Sexy Baccarat และ SA Gaming อัปเดตอัตราชนะแบบเรียลไทม์
        </p>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4 mb-12">
        <button 
          onClick={() => setActiveTab('sexy')}
          className={cn(
            "w-full md:w-64 h-24 rounded-2xl flex items-center justify-between px-6 transition-all border-2 group",
            activeTab === 'sexy' 
              ? "bg-rose-900 border-gold shadow-lg shadow-rose-900/40 scale-105" 
              : "bg-gray-900 border-gray-800 opacity-50 hover:opacity-100"
          )}
        >
          <div className="text-left">
            <span className="block text-[10px] font-bold text-gold/80 mb-1 uppercase tracking-widest">คลิกเพื่อใช้สูตร</span>
            <span className="text-xl font-black text-white italic uppercase tracking-tighter group-hover:gold-gradient transition-all">Sexy Baccarat</span>
          </div>
          <Heart className={cn("w-8 h-8 transition-all", activeTab === 'sexy' ? "text-gold fill-gold animate-pulse" : "text-gray-700")} />
        </button>
        <button 
          onClick={() => setActiveTab('sa')}
          className={cn(
            "w-full md:w-64 h-24 rounded-2xl flex items-center justify-between px-6 transition-all border-2 group",
            activeTab === 'sa' 
              ? "bg-slate-800 border-gold shadow-lg shadow-slate-800/40 scale-105" 
              : "bg-gray-900 border-gray-800 opacity-50 hover:opacity-100"
          )}
        >
          <div className="text-left">
            <span className="block text-[10px] font-bold text-gold/80 mb-1 uppercase tracking-widest">คลิกเพื่อใช้สูตร</span>
            <span className="text-xl font-black text-white italic uppercase tracking-tighter group-hover:gold-gradient transition-all">SA Gaming</span>
          </div>
          <Crown className={cn("w-8 h-8 transition-all", activeTab === 'sa' ? "text-gold fill-gold animate-bounce" : "text-gray-700")} />
        </button>
      </div>

      <motion.div 
        key={activeTab}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.05
            }
          }
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {tables.map((table) => (
          <motion.div 
            key={table.id}
            variants={{
              hidden: { opacity: 0, y: 20, scale: 0.95 },
              visible: { 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: {
                  type: "spring",
                  stiffness: 100,
                  damping: 15
                }
              }
            }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className={cn(
              "relative p-6 rounded-3xl border-2 overflow-hidden transition-colors group",
              activeTab === 'sexy' 
                ? "bg-gradient-to-br from-rose-950/40 to-red-900/20 border-rose-900/30 hover:border-rose-500/50" 
                : "bg-gradient-to-br from-slate-950/40 to-indigo-900/20 border-slate-800/30 hover:border-indigo-500/50"
            )}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  {activeTab === 'sexy' ? (
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  ) : (
                    <Crown className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                  )}
                  <div className="text-[10px] font-bold text-gold uppercase tracking-widest">
                    {activeTab === 'sexy' ? 'Sexy Gaming' : 'SA Gaming'}
                  </div>
                </div>
                <div className="text-2xl font-black text-white group-hover:gold-gradient transition-all">{table.name}</div>
              </div>
              <div className="flex space-x-1">
                <span className={cn(
                  "text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm",
                  activeTab === 'sexy' ? "bg-rose-600" : "bg-slate-600"
                )}>B {table.b}</span>
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">P {table.p}</span>
                <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">T {table.t}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex-grow">
                <div className="bg-black/40 rounded-2xl p-4 border border-gold/20 text-center">
                  <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">อัตราชนะ</div>
                  <div className={cn(
                    "text-3xl font-black",
                    table.winRate >= 90 ? "text-green-400" : "text-gold"
                  )}>
                    {table.winRate}%
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTable(table)}
                className="gold-bg-gradient text-baccarat-black px-4 py-3 rounded-xl font-black text-xs hover:scale-105 transition-transform"
              >
                คลิกเพื่อเข้าดู
              </button>
            </div>

            {/* Decorative background elements */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gold/5 rounded-full blur-2xl"></div>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-20 bg-gray-900/30 border border-gold/10 rounded-[2.5rem] p-8 md:p-12">
        <div className="mb-16">
          <h2 className="text-3xl font-black text-white mb-8 gold-gradient">
            สูตรบาคาร่า AI 2026 ฟรี ใช้ได้จริง รองรับค่าย SEXY และ SA
          </h2>
          <div className="space-y-6 text-gray-400 leading-relaxed text-lg">
            <p>
              เปิดให้ใช้ฟรี สูตรบาคาร่า AI 2026 ที่ออกแบบมาเพื่อช่วยวิเคราะห์เกมด้วยระบบ AI ซึ่งคำนวณข้อมูลอย่างเป็นระบบ ทำให้ใช้งานได้แม่นยำกว่าสูตรบาคาร่าฟรีทั่วไป โดยทางเว็บมีให้เลือกใช้งานถึง 2 สูตร ครอบคลุมทั้งค่าย SEXY และ SA เหมาะสำหรับผู้เล่นที่ต้องการตัวช่วยในการวางแผนเดิมพันแบบใช้งานได้จริง
            </p>
            <p>
              ระบบนี้ถูกพัฒนาโดยทีมงานมืออาชีพที่มีประสบการณ์ด้านคาสิโนโดยตรง จึงช่วยเพิ่มความมั่นใจให้กับผู้ใช้งานได้มากยิ่งขึ้น สำหรับใครที่กำลังมองหา สูตรบาคาร่า AI 2026 ใช้ได้จริง และต้องการตัวช่วยเพิ่มโอกาสทำกำไร สูตรนี้ถือเป็นอีกหนึ่งทางเลือกที่ไม่ควรมองข้าม พร้อมตอบโจทย์สายมองหา สูตรบาคาร่าแม่นๆ ที่ใช้งานฟรีและเข้าถึงได้ง่าย
            </p>
          </div>
        </div>

        <div className="pt-16 border-t border-gold/10">
          <h2 className="text-3xl font-black text-white mb-12 gold-gradient">
            วิธีใช้งานสูตรบาคาร่าฟรี 2026 แบบเข้าใจง่าย สำหรับผู้เล่นทุกระดับ
          </h2>
          
          <div className="space-y-16">
            {/* Step 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="order-2 lg:order-1">
                <h3 className="text-2xl font-black text-gold mb-4">1. เลือกคาสิโนที่ต้องการใช้งานสูตรบาคาร่า</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  ก่อนเริ่มใช้งาน ผู้เล่นสามารถเลือกค่ายคาสิโนที่ต้องการใช้ สูตรบาคาร่าฟรี 2026 ได้ 2 ค่าย คือ SA GAMING และ SEXY BACCARAT โดยแต่ละสูตรจะใช้ระบบ AI ในการคำนวณที่แตกต่างกัน เพื่อช่วยวิเคราะห์แนวทางการเล่นให้เหมาะกับแต่ละห้อง
                </p>
              </div>
              <div className="order-1 lg:order-2 rounded-3xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/5">
                <img 
                  src="https://img1.pic.in.th/images/Select-the-game-provider-you-want-to-use-the-cheat-code-with..jpg" 
                  alt="เลือกคาสิโน" 
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="rounded-3xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/5">
                <img 
                  src="https://img1.pic.in.th/images/Select-the-desired-casino-room.jpg" 
                  alt="เลือกห้องคาสิโน" 
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gold mb-4">2. เลือกห้องคาสิโนที่ต้องการเล่น</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  หลังจากเลือกค่ายคาสิโนแล้ว ระบบจะพาไปยังหน้ารวมห้องต่าง ๆ ซึ่งจะแสดงหมายเลขห้องให้เลือก ผู้ใช้สามารถเลือกได้ตามต้องการว่าอยากใช้งาน สูตรบาคาร่า AI 2026 กับห้องไหน
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="order-2 lg:order-1">
                <h3 className="text-2xl font-black text-gold mb-4">3. ดูอัตราส่วนและเลือกห้องที่เหมาะสม</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  ระบบจะแสดงข้อมูลของแต่ละห้องเพื่อช่วยในการตัดสินใจ โดยแนะนำให้เลือกห้องที่มีอัตราส่วนสูตรสูงประมาณ 90-100% เพราะเป็นห้องที่มีแนวโน้มสถิติค่อนข้างดี นอกจากนี้ยังมีบางห้องที่ระบบขึ้นข้อความว่า ห้องน่าเล่น เพื่อช่วยให้ผู้ใช้เลือกห้องที่มีสถิติโดดเด่นได้ง่ายขึ้น
                </p>
              </div>
              <div className="order-1 lg:order-2 rounded-3xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/5">
                <img 
                  src="https://img1.pic.in.th/images/How-to-choose-the-right-baccarat-room.png" 
                  alt="เลือกห้องที่เหมาะสม" 
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Step 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="rounded-3xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/5">
                <img 
                  src="https://img2.pic.in.th/Im-coming-to-the-recipe-room.jpg" 
                  alt="วิเคราะห์ข้อมูล" 
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="text-2xl font-black text-gold mb-4">4. วิเคราะห์ข้อมูลภายในห้องสูตร</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  เมื่อเข้าสู่ห้องสูตรแล้ว ผู้ใช้จะพบรายละเอียดสำคัญต่าง ๆ เช่น ตาถัดไปควรเดิมพันฝั่งไหน, อัตราการชนะ, และสถิติย้อนหลัง ซึ่งมีทั้งแบบตัวเลขและแบบกราฟ เพื่อช่วยให้ดูข้อมูลง่ายและนำไปวิเคราะห์ต่อได้สะดวกมากขึ้น หากต้องการเปลี่ยนไปดูห้องอื่น ก็สามารถกด ออกจากห้อง ได้ทันที
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-16 border-t border-gold/10">
          <h2 className="text-3xl font-black text-white mb-12 gold-gradient">
            รวมสูตรบาคาร่าฟรี แม่นๆ ที่ยังนิยมใช้ในปี 2026
          </h2>
          
          <div className="space-y-10 text-gray-400 leading-relaxed text-lg">
            <div>
              <h3 className="text-xl font-black text-gold mb-3">1. สูตรบาคาร่าไพ่มังกร SA และ SEXY</h3>
              <p>
                สูตรนี้เป็นหนึ่งในสูตรบาคาร่าที่ได้รับความนิยมมาอย่างต่อเนื่อง ผู้เล่นหลายคนคุ้นเคยกับรูปแบบนี้เป็นอย่างดี โดยหลักการคือ หากผลออก BANKER หรือ PLAYER ติดต่อกันประมาณ 4-5 ตา ให้สังเกตแนวโน้มของเกมไว้ เพราะหลายคนมักเลือกแทงตามฝั่งเดิมที่ออกต่อเนื่อง เนื่องจากมองว่าเกมยังอยู่ในจังหวะเดิม
              </p>
            </div>

            <div>
              <h3 className="text-xl font-black text-gold mb-3">2. สูตรบาคาร่าสวนไพ่มังกร</h3>
              <p>
                หลังจากมีการแทงตามไพ่มังกรแล้ว อีกหนึ่งสูตรที่นิยมไม่แพ้กันก็คือการแทงสวน โดยหากผลออกฝั่งเดิมติดต่อกันยาว เช่น BANKER หรือ PLAYER ออกต่อกัน 7-8 ตา ผู้เล่นบางส่วนจะเลือกแทงสวนในตาถัดไป เพราะมองว่าเกมอาจมีโอกาสเปลี่ยนจังหวะได้ สูตรนี้จึงเป็นอีกแนวทางที่หลายคนนำมาใช้วางแผน
              </p>
            </div>

            <div>
              <h3 className="text-xl font-black text-gold mb-3">3. สูตรบาคาร่าไพ่ปิงปอง</h3>
              <p>
                สูตรนี้สามารถเจอได้บ่อยในบาคาร่าออนไลน์ ลักษณะของผลจะออกสลับกันไปมา เช่น<br/>
                รอบที่ 1 ออก BANKER<br/>
                รอบที่ 2 ออก PLAYER<br/>
                รอบที่ 3 ออก BANKER<br/>
                รอบที่ 4 ออก PLAYER<br/>
                หากเห็นรูปแบบแบบนี้ต่อเนื่อง ผู้เล่นจำนวนมากจะใช้วิธีวิเคราะห์ตามจังหวะของเกม และเลือกแทงสลับตามรูปแบบที่เกิดขึ้น
              </p>
            </div>

            <div>
              <h3 className="text-xl font-black text-gold mb-3">4. สูตรบาคาร่าไพ่ลูกคู่</h3>
              <p>
                สูตรนี้มีลักษณะคล้ายกับสูตรไพ่ปิงปอง แต่จะแตกต่างตรงที่ผลจะออกซ้ำฝั่งละ 2 ครั้ง เช่น<br/>
                รอบที่ 1 ออก PLAYER<br/>
                รอบที่ 2 ออก PLAYER<br/>
                รอบที่ 3 ออก BANKER<br/>
                รอบที่ 4 ออก BANKER<br/>
                เมื่อเจอรูปแบบนี้ ผู้เล่นหลายคนมักใช้เป็นอีกหนึ่งสัญญาณในการวิเคราะห์ตาถัดไป เพราะถือเป็นสูตรที่นิยมใช้งานกันมาอย่างยาวนาน และยังถูกพูดถึงอยู่ในปี 2026
              </p>
            </div>

            <div>
              <h3 className="text-xl font-black text-gold mb-3">5. สูตรบาคาร่าไพ่ 3 ตัด</h3>
              <p>
                อีกหนึ่งสูตรที่พบเห็นได้ค่อนข้างบ่อย คือเมื่อผลออกฝั่งเดิมติดต่อกัน 3 ครั้ง ผู้เล่นบางคนจะรอจังหวะในตาถัดไปเพื่อดูแนวโน้มว่ารูปเกมจะเปลี่ยนหรือไม่ สูตรนี้จึงเป็นเทคนิคที่หลายคนเลือกใช้ เพราะเข้าใจง่าย และนำไปประยุกต์ดูแนวโน้มของเกมได้ไม่ยาก
              </p>
            </div>

            <div>
              <h3 className="text-xl font-black text-gold mb-3">6. สูตรบาคาร่า AI 2026</h3>
              <p>
                สำหรับผู้ที่ต้องการความสะดวกและตัวช่วยในการวิเคราะห์มากขึ้น ปัจจุบันมี สูตรบาคาร่า AI 2026 ที่พัฒนาด้วยระบบ ML (Machine Learning) ซึ่งช่วยให้ระบบสามารถเรียนรู้จากข้อมูลและประมวลผลแนวโน้มของเกมได้อย่างเป็นระบบมากขึ้น ทำให้ผู้ใช้งานสามารถนำข้อมูลที่ได้ไปใช้ประกอบการตัดสินใจได้ง่ายกว่าเดิม และเป็นอีกหนึ่งตัวเลือกที่ได้รับความสนใจมากในปี 2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    // Check for custom admin user in localStorage
    const savedUser = localStorage.getItem('custom_admin_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('custom_admin_user');
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (!savedUser) {
        setUser(u);
      }
      setAuthReady(true);
    });

    // Fetch Articles
    const fetchArticles = async () => {
      console.log('Fetching articles from API...');
      try {
        const response = await fetch(`${API_BASE}/api/articles`);
        if (!response.ok) throw new Error('Failed to fetch articles');
        const docs = await response.json() as Article[];
        console.log(`Fetched ${docs.length} articles from API`);
        
        // Only use articles from the database
        setArticles(docs);
      } catch (error) {
        console.error("API Error (Articles):", error);
        // Set to empty array on error instead of static articles
        setArticles([]);
      }
    };

    // Fetch Categories
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        const catsData = await response.json() as any[];
        const cats = catsData.map((cat: any) => cat.name);
        setCategories(cats);
      } catch (error) {
        console.error("API Error (Categories):", error);
      }
    };

    fetchArticles();
    fetchCategories();

    // Socket.io for real-time updates
    console.log('Initializing socket.io client...');
    const socket = io(window.location.origin, {
      path: '/socket.io',
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 30000,
      autoConnect: true
    });
    
    socket.on('connect', () => {
      console.log('Socket.io connected with ID:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error.message, error);
      // If websocket fails, try polling explicitly if not already tried
      if (socket.io.opts.transports[0] === 'websocket') {
        console.log('Falling back to polling...');
      }
    });

    socket.on('articles_updated', () => {
      console.log('Articles updated via socket - fetching new data...');
      fetchArticles();
      setNotification({ message: 'อัพเดตบทความเรียบร้อยแล้ว', type: 'info' });
    });
    socket.on('categories_updated', () => {
      console.log('Categories updated via socket - fetching new data...');
      fetchCategories();
      setNotification({ message: 'อัพเดตหมวดหมู่เรียบร้อยแล้ว', type: 'info' });
    });

    return () => {
      unsubscribeAuth();
      socket.disconnect();
    };
  }, []);

  if (!authReady) return <div className="min-h-screen bg-baccarat-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-baccarat-black">
        <Navbar user={user} />
        
        {/* Real-time Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className="fixed bottom-10 left-1/2 z-[200] px-6 py-3 bg-gold text-baccarat-black font-bold rounded-full shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center gap-2"
            >
              <Zap size={18} className="animate-pulse" />
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage articles={articles} user={user} />} />
            <Route path="/articles" element={<ArticlesPage articles={articles} user={user} />} />
            <Route path="/articles/:slug" element={<ArticleDetailPage articles={articles} user={user} />} />
            <Route path="/formula" element={<FormulaPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/login" element={<LoginPage user={user} setUser={setUser} />} />
            <Route 
              path="/admin" 
              element={
                user?.email === ADMIN_EMAIL ? (
                  <AdminDashboard articles={articles} categories={categories} setArticles={setArticles} setCategories={setCategories} />
                ) : (
                  <Navigate to="/login" />
                )
              } 
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}
