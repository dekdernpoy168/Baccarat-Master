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
  Search
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
              <Link to="/articles" className={cn("px-3 py-2 rounded-md text-sm font-medium transition-colors", location.pathname.startsWith('/articles') ? "text-gold" : "text-gray-300 hover:text-gold")}>บทความ</Link>
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
            <li><a href="#" className="hover:text-gold transition-colors">สูตรบาคาร่า</a></li>
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
        <p>© 2024 Baccarat Master Guide. All rights reserved. เนื้อหาเพื่อความรู้และการศึกษาเท่านั้น</p>
      </div>
    </div>
  </footer>
);

const ArticleCard = ({ article }: { article: Article }) => (
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
              <span className="text-gold text-xs font-bold uppercase tracking-widest">The Ultimate Guide 2024</span>
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
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-black text-white mb-6">คลังบทความ <span className="gold-gradient">บาคาร่า</span></h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          รวบรวมทุกเรื่องราวเกี่ยวกับบาคาร่า ตั้งแต่วิธีเล่น สูตรเดินเงิน การอ่านเค้าไพ่ 
          และเทคนิคต่างๆ ที่จะช่วยให้คุณเป็นมืออาชีพ
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
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
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <img src={article.image || 'https://picsum.photos/seed/baccarat/100/100'} className="w-12 h-12 rounded-lg object-cover mr-4" alt="" />
                      <span className="text-white font-bold line-clamp-1">{article.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-400 text-sm">{article.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-500 text-xs">{article.date}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-3">
                      <button 
                        onClick={() => { setIsEditing(true); setCurrentArticle(article); }}
                        className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(article.id)}
                        className="p-2 text-baccarat-red hover:bg-baccarat-red/10 rounded-lg transition-colors"
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
