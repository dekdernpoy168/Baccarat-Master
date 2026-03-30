import React, { useState, useEffect } from 'react';
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
  Type,
  FileText,
  Search,
  Heart,
  Crown
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import { format } from 'date-fns';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
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

// --- Helpers ---

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
    <nav className="sticky top-0 z-50 bg-baccarat-black/90 backdrop-blur-md border-b border-gold/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-baccarat-red rounded-full flex items-center justify-center border border-gold">
                <Award className="text-gold w-6 h-6" />
              </div>
              <span className="text-2xl font-bold gold-gradient tracking-tighter uppercase">Baccarat Master</span>
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <Link to="/" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location.pathname === '/' ? "text-gold" : "text-gray-300 hover:text-gold")}>หน้าแรก</Link>
              <Link to="/articles" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location.pathname === '/articles' ? "text-gold" : "text-gray-300 hover:text-gold")}>บทความ</Link>
              <Link to="/formula" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location.pathname === '/formula' ? "text-gold" : "text-gray-300 hover:text-gold")}>สูตรบาคาร่าฟรี</Link>
              {user?.email === ADMIN_EMAIL && (
                <Link to="/admin" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location.pathname.startsWith('/admin') ? "text-gold" : "text-gray-300 hover:text-gold")}>จัดการหลังบ้าน</Link>
              )}
              {!user ? (
                <Link to="/login" className="gold-bg-gradient text-baccarat-black px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-gold/20">
                  เข้าสู่ระบบ
                </Link>
              ) : (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-400 text-xs">{user.email}</span>
                  <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-baccarat-red transition-colors">
                    <LogOut size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gold p-2">
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-baccarat-black border-b border-gold/20"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link to="/" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gold">หน้าแรก</Link>
              <Link to="/articles" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300">บทความ</Link>
              <Link to="/formula" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300">สูตรบาคาร่าฟรี</Link>
              {user?.email === ADMIN_EMAIL && (
                <Link to="/admin" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300">จัดการหลังบ้าน</Link>
              )}
              {!user ? (
                <Link to="/login" onClick={() => setIsOpen(false)} className="block w-full mt-4 gold-bg-gradient text-baccarat-black px-6 py-3 rounded-full font-bold text-sm text-center">
                  เข้าสู่ระบบ
                </Link>
              ) : (
                <button onClick={() => { signOut(auth); setIsOpen(false); }} className="w-full mt-4 bg-gray-800 text-white px-6 py-3 rounded-full font-bold text-sm">
                  ออกจากระบบ
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => (
  <footer className="bg-baccarat-black border-t border-gold/20 pt-16 pb-8">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <Link to="/" className="flex items-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-baccarat-red rounded-full flex items-center justify-center border border-gold">
              <Award className="text-gold w-5 h-5" />
            </div>
            <span className="text-xl font-bold gold-gradient tracking-tighter uppercase">Baccarat Master</span>
          </Link>
          <p className="text-gray-400 max-w-md leading-relaxed">
            ศูนย์รวมความรู้และเทคนิคการเล่นบาคาร่าออนไลน์ที่ครบถ้วนที่สุด 
            เรามุ่งเน้นการให้ข้อมูลที่ถูกต้อง แม่นยำ และเป็นประโยชน์ต่อผู้เล่นทุกระดับ
          </p>
        </div>
        <div>
          <h3 className="text-gold font-bold mb-6 uppercase tracking-wider">ลิงก์ด่วน</h3>
          <ul className="space-y-4 text-gray-400">
            <li><Link to="/" className="hover:text-gold transition-colors">หน้าแรก</Link></li>
            <li><Link to="/articles" className="hover:text-gold transition-colors">บทความทั้งหมด</Link></li>
            <li><Link to="/formula" className="hover:text-gold transition-colors">สูตรบาคาร่าฟรี</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-gold font-bold mb-6 uppercase tracking-wider">หมวดหมู่</h3>
          <ul className="space-y-4 text-gray-400">
            <li><a href="#" className="hover:text-gold transition-colors">วิธีเล่นเบื้องต้น</a></li>
            <li><a href="#" className="hover:text-gold transition-colors">เทคนิคการเดินเงิน</a></li>
            <li><a href="#" className="hover:text-gold transition-colors">การอ่านเค้าไพ่</a></li>
          </ul>
        </div>
      </div>
      <div className="mt-16 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
        <p>© 2026 Baccarat Master Guide. All rights reserved. เนื้อหาเพื่อความรู้และการศึกษาเท่านั้น</p>
      </div>
    </div>
  </footer>
);

const ArticleCard = ({ article }: { article: Article; key?: string }) => (
  <motion.div 
    whileHover={{ y: -10 }}
    className="bg-gray-900/50 border border-gold/10 rounded-2xl overflow-hidden article-card group"
  >
    <Link to={`/articles/${article.slug}`}>
      <div className="relative h-56 overflow-hidden">
        <img 
          src={article.image || 'https://picsum.photos/seed/baccarat/800/400'} 
          alt={article.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4">
          <span className="bg-baccarat-red text-white text-xs font-bold px-3 py-1 rounded-full border border-gold/50">
            {article.category}
          </span>
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
          <span className="text-gold text-sm font-bold flex items-center">
            อ่านต่อ <ChevronRight size={16} className="ml-1" />
          </span>
        </div>
      </div>
    </Link>
  </motion.div>
);

// --- Pages ---

const HomePage = ({ articles }: { articles: Article[] }) => {
  return (
    <div className="space-y-24 pb-24">
      <section className="relative h-[80vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-baccarat-black via-baccarat-black/80 to-transparent z-10" />
          <img 
            src="https://picsum.photos/seed/casino/1920/1080" 
            className="w-full h-full object-cover opacity-40"
            alt="Hero Background"
            referrerPolicy="no-referrer"
          />
        </div>
        
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center space-x-2 bg-baccarat-red/20 border border-baccarat-red px-4 py-2 rounded-full mb-6">
              <Zap className="text-gold w-4 h-4" />
              <span className="text-gold text-xs font-bold uppercase tracking-widest">The Ultimate Guide 2026</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tighter">
              เซียนบาคาร่า <br />
              <span className="gold-gradient">ตัวจริงต้องรู้!</span>
            </h1>
            <p className="text-xl text-gray-300 mb-10 leading-relaxed">
              เจาะลึกทุกเทคนิค สอนอ่านเค้าไพ่ และสูตรเดินเงินที่แม่นยำที่สุด 
              เพื่อทำกำไรจากการเล่นบาคาร่าอย่างยั่งยืน
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/articles" className="gold-bg-gradient text-baccarat-black px-10 py-4 rounded-full font-black text-lg text-center hover:scale-105 transition-transform">
                เริ่มเรียนรู้เลย
              </Link>
              <a href="https://example.com" target="_blank" rel="noopener noreferrer" className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-10 py-4 rounded-full font-black text-lg text-center hover:bg-white/20 transition-all flex items-center justify-center">
                ทางเข้าเล่น <ExternalLink size={20} className="ml-2" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <BookOpen className="w-8 h-8" />, title: "คู่มือฉบับสมบูรณ์", desc: "ตั้งแต่พื้นฐานจนถึงระดับเซียน รวบรวมไว้ที่นี่ที่เดียว" },
            { icon: <TrendingUp className="w-8 h-8" />, title: "สูตรเดินเงินแม่นยำ", desc: "จัดการทุนอย่างเป็นระบบ ลดความเสี่ยง เพิ่มโอกาสชนะ" },
            { icon: <ShieldCheck className="w-8 h-8" />, title: "ข้อมูลที่เชื่อถือได้", desc: "คัดกรองจากประสบการณ์จริงของเหล่าเซียนในวงการ" }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
              viewport={{ once: true }}
              className="bg-gray-900/40 border border-gold/10 p-8 rounded-3xl hover:border-gold/30 transition-colors"
            >
              <div className="text-gold mb-6">{feature.icon}</div>
              <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-4xl font-black text-white mb-4">บทความ <span className="text-gold">ล่าสุด</span></h2>
            <p className="text-gray-400">อัปเดตเทคนิคและข่าวสารใหม่ๆ ทุกสัปดาห์</p>
          </div>
          <Link to="/articles" className="hidden md:flex items-center text-gold font-bold hover:underline">
            ดูทั้งหมด <ChevronRight size={20} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.slice(0, 3).map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-baccarat-red to-red-900 rounded-[3rem] p-12 md:p-20 relative overflow-hidden red-glow">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8 leading-tight">
              พร้อมที่จะทำกำไร <br />
              <span className="text-gold-light">กับเว็บอันดับ 1 แล้วหรือยัง?</span>
            </h2>
            <p className="text-white/80 text-lg mb-12">
              เราได้คัดสรรเว็บไซต์ที่มั่นคง ปลอดภัย และมีอัตราการจ่ายที่สูงที่สุดมาให้คุณแล้ว 
              คลิกที่ปุ่มด้านล่างเพื่อรับสิทธิพิเศษทันที
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <a 
                href="https://your-target-site.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-baccarat-red px-12 py-5 rounded-full font-black text-xl hover:scale-105 transition-transform shadow-2xl"
              >
                สมัครสมาชิกตอนนี้
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ArticlesPage = ({ articles }: { articles: Article[] }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const categoryFilter = searchParams.get('category');

  const filteredArticles = categoryFilter 
    ? articles.filter(a => a.category === categoryFilter)
    : articles;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-black text-white mb-6">
          {categoryFilter ? (
            <>คลังบทความ <span className="gold-gradient">{categoryFilter}</span></>
          ) : (
            <>คลังบทความ <span className="gold-gradient">บาคาร่า</span></>
          )}
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          {categoryFilter === 'สูตรบาคาร่าฟรี' 
            ? 'รวบรวมสูตรบาคาร่าฟรี เทคนิคการเดินเงิน และวิธีการอ่านเค้าไพ่ที่แม่นยำที่สุด เพื่อเพิ่มโอกาสชนะให้กับคุณ'
            : 'รวบรวมทุกเรื่องราวเกี่ยวกับบาคาร่า ตั้งแต่วิธีเล่น สูตรเดินเงิน การอ่านเค้าไพ่ และเทคนิคต่างๆ ที่จะช่วยให้คุณเป็นมืออาชีพ'}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        ) : (
          <div className="col-span-full text-center py-20 text-gray-500">
            ยังไม่มีบทความในหมวดหมู่นี้
          </div>
        )}
      </div>
    </div>
  );
};

const ArticleDetailPage = ({ articles }: { articles: Article[] }) => {
  const { slug } = useParams();
  const article = articles.find(a => a.slug === slug);

  useEffect(() => {
    if (article) {
      document.title = article.title + " | Baccarat Master";
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', article.excerpt);
    }
  }, [article]);

  if (!article) return <div className="text-center py-20 text-white">ไม่พบเนื้อหาที่ต้องการ</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
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
          <h1 className="text-4xl md:text-5xl font-black text-white mt-6 mb-6 leading-tight">
            {article.title}
          </h1>
          <div className="flex items-center text-gray-500 text-sm space-x-6">
            <span className="flex items-center"><Award size={16} className="mr-2" /> โดย {article.author}</span>
            <span className="flex items-center"><Target size={16} className="mr-2" /> {article.date}</span>
          </div>
        </div>
        
        <div className="rounded-3xl overflow-hidden mb-12 border border-gold/20">
          <img 
            src={article.image || 'https://picsum.photos/seed/baccarat/800/400'} 
            alt={article.title} 
            className="w-full h-auto"
            referrerPolicy="no-referrer"
          />
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
      </motion.div>
    </div>
  );
};

const LoginPage = ({ user }: { user: User | null }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gold/20 p-10 rounded-[2rem] text-center">
        <div className="w-16 h-16 bg-baccarat-red rounded-full flex items-center justify-center border border-gold mx-auto mb-8">
          <Lock className="text-gold w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Admin Login</h1>
        <p className="text-gray-400 mb-10">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบเพื่อจัดการบทความ</p>
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center space-x-3 bg-white text-black font-bold py-4 rounded-full hover:bg-gray-200 transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          <span>เข้าสู่ระบบด้วย Google</span>
        </button>
      </div>
    </div>
  );
};

const AdminDashboard = ({ articles }: { articles: Article[] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<Article>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Remove id from data object to avoid saving it as a field
      const { id, ...dataWithoutId } = currentArticle;
      
      const articleData = {
        ...dataWithoutId,
        updatedAt: serverTimestamp(),
        date: format(new Date(), 'yyyy-MM-dd'),
        author: auth.currentUser?.displayName || 'Admin',
      };

      if (id) {
        const docRef = doc(db, 'articles', id);
        await updateDoc(docRef, articleData);
      } else {
        await addDoc(collection(db, 'articles'), {
          ...articleData,
          createdAt: serverTimestamp(),
        });
      }
      setIsEditing(false);
      setCurrentArticle({});
    } catch (err: any) {
      let message = "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error.includes('permission-denied')) {
          message = "คุณไม่มีสิทธิ์ในการบันทึกข้อมูล (Permission Denied)";
        } else {
          message = parsed.error;
        }
      } catch (e) {
        message = err.message || message;
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Admin <span className="text-gold">Dashboard</span></h1>
        <button 
          onClick={() => { setIsEditing(true); setCurrentArticle({}); }}
          className="gold-bg-gradient text-baccarat-black px-6 py-3 rounded-full font-bold flex items-center"
        >
          <Plus size={20} className="mr-2" /> เพิ่มบทความใหม่
        </button>
      </div>

      {isEditing ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 border border-gold/20 p-8 rounded-3xl"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gold">{currentArticle.id ? 'แก้ไขบทความ' : 'สร้างบทความใหม่'}</h2>
            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-baccarat-red/20 border border-baccarat-red rounded-xl text-white text-sm">
              <strong>เกิดข้อผิดพลาด:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-gold text-sm font-bold flex items-center"><Type size={16} className="mr-2" /> หัวข้อบทความ (Title)</label>
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
                <label className="text-gold text-sm font-bold flex items-center"><ExternalLink size={16} className="mr-2" /> Slug (URL)</label>
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
                <label className="text-gold text-sm font-bold flex items-center"><Target size={16} className="mr-2" /> หมวดหมู่</label>
                <select 
                  required
                  value={currentArticle.category || ''} 
                  onChange={e => setCurrentArticle({...currentArticle, category: e.target.value})}
                  className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                >
                  <option value="">เลือกหมวดหมู่</option>
                  <option value="วิธีเล่น">วิธีเล่น</option>
                  <option value="เทคนิคการเดิมพัน">เทคนิคการเดิมพัน</option>
                  <option value="การอ่านเค้าไพ่">การอ่านเค้าไพ่</option>
                  <option value="รีวิวคาสิโน">รีวิวคาสิโน</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-gold text-sm font-bold flex items-center"><FileText size={16} className="mr-2" /> คำโปรย (Excerpt)</label>
              <textarea 
                value={currentArticle.excerpt || ''} 
                onChange={e => setCurrentArticle({...currentArticle, excerpt: e.target.value})}
                className="w-full bg-black border border-gold/20 rounded-xl px-4 py-3 text-white focus:border-gold outline-none h-24"
                placeholder="สรุปสั้นๆ เกี่ยวกับบทความ..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-gold text-sm font-bold flex items-center"><BookOpen size={16} className="mr-2" /> เนื้อหาบทความ</label>
              <ReactQuill 
                theme="snow" 
                value={currentArticle.content || ''} 
                onChange={val => setCurrentArticle({...currentArticle, content: val})}
                modules={modules}
              />
            </div>

            <div className="bg-black/50 p-6 rounded-2xl border border-gold/10 space-y-6">
              <h3 className="text-white font-bold flex items-center"><Search size={18} className="mr-2 text-gold" /> SEO Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs font-bold uppercase">Meta Title</label>
                  <input 
                    type="text" 
                    value={currentArticle.metaTitle || ''} 
                    onChange={e => setCurrentArticle({...currentArticle, metaTitle: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs font-bold uppercase">Meta Description</label>
                  <input 
                    type="text" 
                    value={currentArticle.metaDescription || ''} 
                    onChange={e => setCurrentArticle({...currentArticle, metaDescription: e.target.value})}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button 
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-8 py-3 rounded-full text-gray-400 font-bold hover:text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                disabled={loading}
                type="submit"
                className="gold-bg-gradient text-baccarat-black px-12 py-3 rounded-full font-black text-lg flex items-center disabled:opacity-50"
              >
                {loading ? 'กำลังบันทึก...' : <><Save size={20} className="mr-2" /> บันทึกบทความ</>}
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="bg-gray-900 border border-gold/20 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/50 border-b border-gold/20">
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs">บทความ</th>
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs">หมวดหมู่</th>
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs">วันที่</th>
                <th className="px-6 py-4 text-gold font-bold uppercase text-xs text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {articles.map((article, index) => (
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
                          src={article.image || 'https://picsum.photos/seed/baccarat/100/100'} 
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
                    <span className="text-gray-500 text-xs font-medium">{article.date}</span>
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
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black text-white mb-6">สูตรบาคาร่า <span className="gold-gradient">AI 2026</span></h1>
        <p className="text-gray-400 max-w-3xl mx-auto">
          สูตรบาคาร่า AI 2026 มาด้วยระบบคำนวณ สูตรบาคาร่า ด้วย AI แม่นยำที่สุดในขณะนี้ รองรับทั้งค่าย Sexy Baccarat และ SA Gaming อัปเดตอัตราชนะแบบเรียลไทม์
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
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });

    const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Article[];
      
      // If Firestore is empty, use static articles as fallback
      if (docs.length === 0) {
        setArticles(STATIC_ARTICLES);
      } else {
        setArticles(docs);
      }
    }, (error) => {
      console.error("Firestore Error:", error);
      setArticles(STATIC_ARTICLES); // Fallback on error
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFirestore();
    };
  }, []);

  if (!authReady) return <div className="min-h-screen bg-baccarat-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-baccarat-black">
        <Navbar user={user} />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage articles={articles} />} />
            <Route path="/articles" element={<ArticlesPage articles={articles} />} />
            <Route path="/articles/:slug" element={<ArticleDetailPage articles={articles} />} />
            <Route path="/formula" element={<FormulaPage />} />
            <Route path="/login" element={<LoginPage user={user} />} />
            <Route 
              path="/admin" 
              element={
                user?.email === ADMIN_EMAIL ? (
                  <AdminDashboard articles={articles} />
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
