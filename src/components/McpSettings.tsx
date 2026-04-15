import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Server, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Shield,
  Zap,
  Settings2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase'; // Assuming Firestore is exported from firebase.ts

interface McpServer {
  id: string;
  name: string;
  url: string;
  token?: string;
  enabled: boolean;
  status?: 'online' | 'offline' | 'unknown' | 'testing';
  lastChecked?: string;
  error?: string;
}

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
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const McpSettings: React.FC = () => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newServer, setNewServer] = useState<Partial<McpServer>>({
    name: '',
    url: '',
    token: '',
    enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  const testServerConnection = async (server: McpServer) => {
    setServers(prev => prev.map(s => s.id === server.id ? { ...s, status: 'testing', error: undefined } : s));
    
    try {
      // Basic connectivity test
      // Note: MCP servers usually use SSE or HTTP. A simple fetch can check if the endpoint is reachable.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const headers: HeadersInit = {};
      if (server.token) {
        headers['Authorization'] = server.token.startsWith('Bearer ') ? server.token : `Bearer ${server.token}`;
      }

      const response = await fetch(server.url, { 
        method: 'GET', // Or HEAD if supported
        headers,
        signal: controller.signal,
        mode: 'no-cors' // Use no-cors to avoid preflight issues for simple reachability check
      });

      clearTimeout(timeoutId);
      
      // With no-cors, we can't see the status code, but if it didn't throw, it's reachable
      setServers(prev => prev.map(s => s.id === server.id ? { 
        ...s, 
        status: 'online', 
        lastChecked: new Date().toISOString(),
        error: undefined
      } : s));
      
      return true;
    } catch (err: any) {
      const errorMessage = err.name === 'AbortError' ? 'การเชื่อมต่อหมดเวลา (Timeout)' : 'ไม่สามารถเชื่อมต่อได้ (Connection Refused)';
      setServers(prev => prev.map(s => s.id === server.id ? { 
        ...s, 
        status: 'offline', 
        lastChecked: new Date().toISOString(),
        error: errorMessage
      } : s));
      return false;
    }
  };

  const testAllServers = async () => {
    setTestingAll(true);
    const enabledServers = servers.filter(s => s.enabled);
    for (const server of enabledServers) {
      await testServerConnection(server);
    }
    setTestingAll(false);
  };

  const fetchServers = async () => {
    setLoading(true);
    const path = 'mcp_servers';
    try {
      const querySnapshot = await getDocs(collection(db, path));
      const serverList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as McpServer[];
      setServers(serverList);
    } catch (err: any) {
      console.error("Error fetching MCP servers:", err);
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (formattedErr: any) {
        setError(formattedErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url) return;
    setSaving(true);
    const path = 'mcp_servers';
    try {
      const docRef = await addDoc(collection(db, path), {
        name: newServer.name,
        url: newServer.url,
        token: newServer.token || '',
        enabled: newServer.enabled ?? true,
        createdAt: new Date().toISOString()
      });
      setServers([...servers, { id: docRef.id, ...newServer } as McpServer]);
      setIsAdding(false);
      setNewServer({ name: '', url: '', token: '', enabled: true });
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (formattedErr: any) {
        setError(formattedErr.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteServer = async (id: string) => {
    const path = `mcp_servers/${id}`;
    try {
      await deleteDoc(doc(db, 'mcp_servers', id));
      setServers(servers.filter(s => s.id !== id));
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (formattedErr: any) {
        setError(formattedErr.message);
      }
    }
  };

  const toggleServer = async (server: McpServer) => {
    const path = `mcp_servers/${server.id}`;
    try {
      await updateDoc(doc(db, 'mcp_servers', server.id), {
        enabled: !server.enabled
      });
      setServers(servers.map(s => s.id === server.id ? { ...s, enabled: !s.enabled } : s));
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, path);
      } catch (formattedErr: any) {
        setError(formattedErr.message);
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-gray-950 min-h-screen text-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-purple-400" />
            ตั้งค่าการเชื่อมต่อ MCP
          </h1>
          <p className="text-gray-400 mt-1">จัดการเซิร์ฟเวอร์ Model Context Protocol สำหรับเครื่องมือ AI</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={testAllServers}
            disabled={loading || testingAll || servers.length === 0}
            className="bg-gray-800 text-gray-300 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-700 transition-all border border-white/5 disabled:opacity-50"
          >
            {testingAll ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} className="text-yellow-400" />}
            ทดสอบทั้งหมด
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-900/20"
          >
            <Plus size={18} />
            เพิ่มเซิร์ฟเวอร์
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/20 rounded-xl text-red-400">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={20} />
            <p className="font-bold">ข้อผิดพลาด</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">
              <X size={18} />
            </button>
          </div>
          <div className="text-sm bg-black/40 p-3 rounded-lg font-mono break-all overflow-auto max-h-32 border border-white/5">
            {error.startsWith('{') ? (
              (() => {
                try {
                  const errObj = JSON.parse(error);
                  return (
                    <div>
                      <p className="text-red-400 font-bold mb-1">{errObj.error}</p>
                      <p className="text-gray-400">การดำเนินการ: {errObj.operationType} ที่ {errObj.path}</p>
                      <p className="text-gray-400">ผู้ใช้: {errObj.authInfo.email || 'ยังไม่ได้เข้าสู่ระบบ'}</p>
                      {errObj.error.includes('permission') && (
                        <div className="mt-2 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                          <p className="text-blue-300 font-medium text-xs mb-2">
                            คำแนะนำ: เฉพาะผู้ดูแลระบบ (dekdernpoy168@gmail.com) เท่านั้นที่สามารถจัดการการตั้งค่า MCP ได้
                          </p>
                          {!errObj.authInfo.userId && (
                            <button 
                              onClick={async () => {
                                try {
                                  await signInWithPopup(auth, googleProvider);
                                  window.location.reload();
                                } catch (e: any) {
                                  setError(e.message);
                                }
                              }}
                              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3 h-3 brightness-0 invert" />
                              เข้าสู่ระบบด้วย Google
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                } catch (e) {
                  return error;
                }
              })()
            ) : error}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-900 p-6 rounded-2xl border border-purple-500/30 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">ชื่อเซิร์ฟเวอร์</label>
                  <input 
                    type="text" 
                    value={newServer.name}
                    onChange={e => setNewServer({...newServer, name: e.target.value})}
                    placeholder="เช่น Google Search"
                    className="w-full p-3 rounded-xl bg-black border border-white/10 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                  />
                  {!newServer.name && <p className="text-[10px] text-red-500 mt-1">* กรุณาใส่ชื่อเซิร์ฟเวอร์</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">URL เซิร์ฟเวอร์ (SSE/HTTP)</label>
                  <input 
                    type="text" 
                    value={newServer.url}
                    onChange={e => setNewServer({...newServer, url: e.target.value})}
                    placeholder="https://..."
                    className="w-full p-3 rounded-xl bg-black border border-white/10 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                  />
                  {!newServer.url && <p className="text-[10px] text-red-500 mt-1">* กรุณาใส่ URL เซิร์ฟเวอร์</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">โทเค็นการยืนยันตัวตน (ไม่บังคับ)</label>
                <input 
                  type="password" 
                  value={newServer.token}
                  onChange={e => setNewServer({...newServer, token: e.target.value})}
                  placeholder="Bearer token..."
                  className="w-full p-3 rounded-xl bg-black border border-white/10 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-gray-400 font-semibold hover:text-gray-200"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleAddServer}
                  disabled={saving || !newServer.name || !newServer.url}
                  className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  บันทึกเซิร์ฟเวอร์
                </button>
              </div>
            </motion.div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>กำลังโหลดเซิร์ฟเวอร์ MCP...</p>
            </div>
          ) : servers.length === 0 && !isAdding ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-2 border-dashed border-white/10 rounded-3xl">
              <Server size={48} className="mb-4 opacity-20" />
              <p>ยังไม่มีการกำหนดค่าเซิร์ฟเวอร์ MCP</p>
            </div>
          ) : (
            servers.map((server) => (
              <motion.div
                key={server.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "bg-gray-900 p-5 rounded-2xl border transition-all flex items-center justify-between",
                  server.enabled ? "border-purple-500/30 hover:border-purple-500/50" : "border-white/5 opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    server.enabled ? "bg-purple-900/40 text-purple-400" : "bg-gray-800 text-gray-500"
                  )}>
                    <Zap size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-100">{server.name}</h3>
                      {server.token && <Shield size={14} className="text-green-500" />}
                      {server.status === 'online' && (
                        <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                          <CheckCircle2 size={10} /> Online
                        </span>
                      )}
                      {server.status === 'offline' && (
                        <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full border border-red-400/20">
                          <AlertCircle size={10} /> Offline
                        </span>
                      )}
                      {server.status === 'testing' && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
                          <Loader2 size={10} className="animate-spin" /> Testing...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <ExternalLink size={12} />
                      {server.url}
                    </p>
                    {server.error && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> {server.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => testServerConnection(server)}
                    disabled={server.status === 'testing'}
                    className="p-2 text-gray-500 hover:text-yellow-400 transition-colors"
                    title="ทดสอบการเชื่อมต่อ"
                  >
                    <Zap size={18} className={cn(server.status === 'testing' && "animate-pulse")} />
                  </button>
                  <button 
                    onClick={() => toggleServer(server)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                      server.enabled ? "bg-purple-600" : "bg-gray-700"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      server.enabled ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <button 
                    onClick={() => handleDeleteServer(server.id)}
                    className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="mt-12 bg-purple-900/20 p-6 rounded-3xl border border-purple-500/20">
        <h3 className="text-sm font-bold text-purple-400 mb-4 uppercase tracking-widest">เกี่ยวกับ MCP Connector</h3>
        <div className="prose prose-sm max-w-none text-purple-300/80">
          <p>
            <strong>Model Context Protocol (MCP)</strong> เป็นมาตรฐานโอเพนซอร์สสำหรับการเชื่อมต่อแอปพลิเคชัน AI กับระบบภายนอก 
            การเพิ่มเซิร์ฟเวอร์ MCP ระยะไกลที่นี่ จะช่วยให้ Claude สามารถเข้าถึงข้อมูลแบบเรียลไทม์และเครื่องมือเฉพาะทางได้โดยตรง
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>การรวมระบบโดยตรง</strong>: เชื่อมต่อโดยไม่ต้องใช้ไคลเอนต์แยกต่างหาก</li>
            <li><strong>การเรียกใช้เครื่องมือ</strong>: เข้าถึงเครื่องมือระยะไกลผ่าน Messages API</li>
            <li><strong>รองรับ OAuth</strong>: เชื่อมต่อกับเซิร์ฟเวอร์ที่มีการยืนยันตัวตนอย่างปลอดภัย</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
