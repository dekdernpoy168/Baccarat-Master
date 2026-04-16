import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings2, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Eye,
  EyeOff,
  Bot,
  Brain,
  Zap,
  Sparkles,
  Box,
  MessageSquare,
  Cloud,
  Edit2,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AiProviderConfig {
  enabled: boolean;
  apiKey: string;
  proxyUrl: string;
  models: string[];
}

interface AiConfig {
  [key: string]: AiProviderConfig;
}

const PROVIDER_DETAILS = {
  openai: { name: 'OpenAI', icon: Bot, color: 'text-green-600', defaultModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'] },
  deepseek: { name: 'DeepSeek', icon: Brain, color: 'text-blue-600', defaultModels: ['deepseek-chat', 'deepseek-reasoner'] },
  groq: { name: 'Groq', icon: Zap, color: 'text-orange-500', defaultModels: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'] },
  gemini: { name: 'Google (Gemini)', icon: Sparkles, color: 'text-blue-500', defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro'] },
  ollama: { name: 'Ollama', icon: Box, color: 'text-gray-700', defaultModels: ['deepseek-r1', 'llama3.2', 'llama3.1', 'mistral'] },
  anthropic: { name: 'Anthropic (Claude)', icon: MessageSquare, color: 'text-purple-600', defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'] },
  azure_openai: { name: 'Azure OpenAI', icon: Cloud, color: 'text-blue-700', defaultModels: [] },
  azure_ai: { name: 'Azure AI', icon: Cloud, color: 'text-blue-800', defaultModels: [] },
};

export const McpSettings: React.FC = () => {
  const [config, setConfig] = useState<AiConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/providers');
      if (res.ok) {
        const data = await res.json() as Record<string, any>;
        // Ensure all providers exist in config
        const fullConfig: AiConfig = { ...(data || {}) };
        Object.keys(PROVIDER_DETAILS).forEach(key => {
          if (!fullConfig[key]) {
            fullConfig[key] = { enabled: false, apiKey: '', proxyUrl: '', models: PROVIDER_DETAILS[key as keyof typeof PROVIDER_DETAILS].defaultModels };
          }
        });
        setConfig(fullConfig);
      }
    } catch (err: any) {
      setError("Failed to load AI configuration.");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: AiConfig) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      if (!res.ok) throw new Error("Failed to save");
      setConfig(newConfig);
    } catch (err: any) {
      setError("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProvider = (provider: string, enabled: boolean) => {
    const newConfig = { ...config, [provider]: { ...config[provider], enabled } };
    saveConfig(newConfig);
  };

  const handleUpdateProvider = (provider: string, updates: Partial<AiProviderConfig>) => {
    setConfig(prev => ({
      ...prev,
      [provider]: { ...prev[provider], ...updates }
    }));
  };

  const handleSaveModal = () => {
    saveConfig(config);
    setSelectedProvider(null);
    setTestResult(null);
  };

  const testConnection = async (provider: string) => {
    setTestingConnection(true);
    setTestResult(null);
    setError(null);
    
    const providerConfig = config[provider];
    if (!providerConfig) return;

    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: providerConfig.apiKey,
          proxyUrl: providerConfig.proxyUrl
        })
      });
      
      const data = await res.json() as { success: boolean, error?: string };
      if (data.success) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setError(`การเชื่อมต่อล้มเหลว: ${data.error}`);
      }
    } catch (err: any) {
      setTestResult('error');
      setError("เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อ");
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">ผู้ให้บริการ</h2>
        <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>คีย์ API ที่กำหนดเอง</option>
        </select>
      </div>
      
      <p className="text-sm text-gray-500 mb-8">
        คีย์ API ของคุณถูกเก็บไว้ในเซิร์ฟเวอร์ของคุณและจะไม่ถูกส่งไปที่อื่น หมายเหตุ: บางฟีเจอร์อาจถูกจำกัดหากไม่ได้ตั้งค่าคีย์
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(PROVIDER_DETAILS).map(([key, details]) => {
          const providerConfig = config[key] || { enabled: false, apiKey: '', proxyUrl: '', models: [] };
          const Icon = details.icon;
          const isConfigured = key === 'ollama' || !!providerConfig.apiKey;
          const isUsable = providerConfig.enabled && isConfigured;
          
          return (
            <div key={key} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 transition-colors bg-white">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg bg-gray-50 relative", details.color)}>
                  <Icon className="w-5 h-5" />
                  <div className={cn(
                    "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                    isUsable ? "bg-green-500" : (providerConfig.enabled ? "bg-yellow-500" : "bg-gray-300")
                  )} title={isUsable ? "พร้อมใช้งาน" : (providerConfig.enabled ? "เปิดใช้งานแต่ยังไม่ได้ตั้งค่าคีย์" : "ปิดใช้งาน")}></div>
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">{details.name}</span>
                  <span className="text-xs text-gray-500">
                    {isUsable ? "พร้อมใช้งาน" : (providerConfig.enabled ? "ขาด API Key" : "ปิดใช้งาน")}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedProvider(key)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="ตั้งค่า"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={providerConfig.enabled}
                    onChange={(e) => handleToggleProvider(key, e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {selectedProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">
                  {PROVIDER_DETAILS[selectedProvider as keyof typeof PROVIDER_DETAILS]?.name}
                </h3>
                <button
                  onClick={() => {
                    setSelectedProvider(null);
                    setTestResult(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {selectedProvider !== 'ollama' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      API key
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={config[selectedProvider]?.apiKey || ''}
                        onChange={(e) => handleUpdateProvider(selectedProvider, { apiKey: e.target.value })}
                        placeholder="กรุณาใส่คีย์ API ของคุณ"
                        className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    URL พร็อกซี API {selectedProvider !== 'ollama' && '(ไม่บังคับ)'}
                  </label>
                  <input
                    type="text"
                    value={config[selectedProvider]?.proxyUrl || ''}
                    onChange={(e) => handleUpdateProvider(selectedProvider, { proxyUrl: e.target.value })}
                    placeholder={selectedProvider === 'ollama' ? "http://localhost:11434" : "https://api.example.com/v1"}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="mb-6 flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">ตรวจสอบการเชื่อมต่อ</h4>
                    <p className="text-xs text-gray-500 mt-0.5">ตรวจสอบว่าคีย์ API และพร็อกซีของคุณถูกต้องหรือไม่</p>
                  </div>
                  <button
                    onClick={() => testConnection(selectedProvider)}
                    disabled={testingConnection}
                    className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingConnection && <Loader2 className="w-3 h-3 animate-spin" />}
                    ตรวจสอบ
                  </button>
                </div>

                {testResult === 'success' && (
                  <div className="mb-6 p-3 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    เชื่อมต่อสำเร็จ
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      รายการโมเดล <span className="text-gray-500 font-normal">(มีโมเดล {config[selectedProvider]?.models?.length || 0} รายการที่พร้อมใช้งาน)</span>
                    </h4>
                    <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {(config[selectedProvider]?.models || PROVIDER_DETAILS[selectedProvider as keyof typeof PROVIDER_DETAILS]?.defaultModels || []).map((model, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{model}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked={true} />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button
                  onClick={() => {
                    setSelectedProvider(null);
                    setTestResult(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveModal}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  บันทึก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
