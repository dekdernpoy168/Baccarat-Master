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
import { db, auth } from '../firebase'; // Assuming Firestore is exported from firebase.ts

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
    <div className="p-6 max-w-4xl mx-auto bg-white min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-purple-600" />
            MCP Connector Settings
          </h1>
          <p className="text-gray-500 mt-1">Manage remote Model Context Protocol servers for AI tools.</p>
        </div>
        
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
        >
          <Plus size={18} />
          Add Server
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={20} />
            <p className="font-bold">Error</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
          <div className="text-sm bg-white/50 p-3 rounded-lg font-mono break-all overflow-auto max-h-32">
            {error.startsWith('{') ? (
              (() => {
                try {
                  const errObj = JSON.parse(error);
                  return (
                    <div>
                      <p className="text-red-600 font-bold mb-1">{errObj.error}</p>
                      <p className="text-gray-600">Operation: {errObj.operationType} on {errObj.path}</p>
                      <p className="text-gray-600">User: {errObj.authInfo.email || 'Not logged in'}</p>
                      {errObj.error.includes('permission') && (
                        <p className="mt-2 text-blue-600 font-medium">
                          Tip: Only the administrator (dekdernpoy168@gmail.com) can manage MCP settings.
                        </p>
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
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Server Name</label>
                  <input 
                    type="text" 
                    value={newServer.name}
                    onChange={e => setNewServer({...newServer, name: e.target.value})}
                    placeholder="e.g. Google Search"
                    className="w-full p-3 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Server URL (SSE/HTTP)</label>
                  <input 
                    type="text" 
                    value={newServer.url}
                    onChange={e => setNewServer({...newServer, url: e.target.value})}
                    placeholder="https://..."
                    className="w-full p-3 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Authorization Token (Optional)</label>
                <input 
                  type="password" 
                  value={newServer.token}
                  onChange={e => setNewServer({...newServer, token: e.target.value})}
                  placeholder="Bearer token..."
                  className="w-full p-3 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-gray-500 font-semibold hover:text-gray-700"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddServer}
                  disabled={saving || !newServer.name || !newServer.url}
                  className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Server
                </button>
              </div>
            </motion.div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading MCP servers...</p>
            </div>
          ) : servers.length === 0 && !isAdding ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
              <Server size={48} className="mb-4 opacity-20" />
              <p>No MCP servers configured yet.</p>
            </div>
          ) : (
            servers.map((server) => (
              <motion.div
                key={server.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  "bg-white p-5 rounded-2xl border transition-all flex items-center justify-between",
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
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
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
        <h3 className="text-sm font-bold text-purple-900 mb-4 uppercase tracking-widest">About MCP Connector</h3>
        <div className="prose prose-sm max-w-none text-purple-800/80">
          <p>
            The <strong>Model Context Protocol (MCP)</strong> is an open-source standard for connecting AI applications to external systems. 
            By adding remote MCP servers here, you enable Claude to access real-time data and specialized tools directly.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Direct Integration</strong>: Connect without a separate client.</li>
            <li><strong>Tool Calling</strong>: Access remote tools through the Messages API.</li>
            <li><strong>OAuth Support</strong>: Securely connect to authenticated servers.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
