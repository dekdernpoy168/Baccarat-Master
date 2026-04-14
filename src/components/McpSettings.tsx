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

  useEffect(() => {
    fetchServers();
  }, []);

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
        
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
        >
          <Plus size={18} />
          เพิ่มเซิร์ฟเวอร์
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={20} />
            <p className="font-bold">ข้อผิดพลาด</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
          <div className="text-sm bg-gray-900/50 p-3 rounded-lg font-mono break-all overflow-auto max-h-32">
            {error.startsWith('{') ? (
              (() => {
                try {
                  const errObj = JSON.parse(error);
                  return (
                    <div>
                      <p className="text-red-600 font-bold mb-1">{errObj.error}</p>
                      <p className="text-gray-600">การดำเนินการ: {errObj.operationType} ที่ {errObj.path}</p>
                      <p className="text-gray-600">ผู้ใช้: {errObj.authInfo.email || 'ยังไม่ได้เข้าสู่ระบบ'}</p>
                      {errObj.error.includes('permission') && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-blue-700 font-medium text-xs mb-2">
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
              className="bg-gray-50 p-6 rounded-2xl border-2 border-purple-100 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">ชื่อเซิร์ฟเวอร์</label>
                  <input 
                    type="text" 
                    value={newServer.name}
                    onChange={e => setNewServer({...newServer, name: e.target.value})}
                    placeholder="เช่น Google Search"
                    className="w-full p-3 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  />
                  {!newServer.name && <p className="text-[10px] text-red-500 mt-1">* กรุณาใส่ชื่อเซิร์ฟเวอร์</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">URL เซิร์ฟเวอร์ (SSE/HTTP)</label>
                  <input 
                    type="text" 
                    value={newServer.url}
                    onChange={e => setNewServer({...newServer, url: e.target.value})}
                    placeholder="https://..."
                    className="w-full p-3 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  />
                  {!newServer.url && <p className="text-[10px] text-red-500 mt-1">* กรุณาใส่ URL เซิร์ฟเวอร์</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">โทเค็นการยืนยันตัวตน (ไม่บังคับ)</label>
                <input 
                  type="password" 
                  value={newServer.token}
                  onChange={e => setNewServer({...newServer, token: e.target.value})}
                  placeholder="Bearer token..."
                  className="w-full p-3 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-gray-500 font-semibold hover:text-gray-700"
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
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
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
                  server.enabled ? "border-gray-100 hover:border-purple-200" : "border-gray-100 opacity-60"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    server.enabled ? "bg-purple-50 text-purple-600" : "bg-gray-50 text-gray-400"
                  )}>
                    <Zap size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{server.name}</h3>
                      {server.token && <Shield size={14} className="text-green-500" />}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <ExternalLink size={12} />
                      {server.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleServer(server)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                      server.enabled ? "bg-purple-600" : "bg-gray-200"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-gray-200 transition-transform",
                      server.enabled ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                  <button 
                    onClick={() => handleDeleteServer(server.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="mt-12 bg-purple-50 p-6 rounded-3xl border border-purple-100">
        <h3 className="text-sm font-bold text-purple-900 mb-4 uppercase tracking-widest">เกี่ยวกับ MCP Connector</h3>
        <div className="prose prose-sm max-w-none text-purple-800/80">
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
