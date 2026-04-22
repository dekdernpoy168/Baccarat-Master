import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthorManagement() {
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAuthor, setCurrentAuthor] = useState<any>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchAuthors();
  }, []);

  const fetchAuthors = async () => {
    try {
      const response = await fetch('/api/authors');
      if (response.ok) {
        const data = await response.json();
        setAuthors(data as any[]);
      }
    } catch (error) {
      console.error('Error fetching authors:', error);
      showNotification('ไม่สามารถโหลดข้อมูลผู้เขียนได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = currentAuthor.id ? `/api/authors/${currentAuthor.id}` : '/api/authors';
      const method = currentAuthor.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentAuthor)
      });

      if (response.ok) {
        showNotification('บันทึกข้อมูลสำเร็จ', 'success');
        fetchAuthors();
        setIsEditing(false);
        setCurrentAuthor(null);
      } else {
        const err = await response.json() as { error: string };
        showNotification(`เกิดข้อผิดพลาด: ${err.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving author:', error);
      showNotification('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    // window.confirm is already being used, which is fine as simple confirmation
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผู้เขียนนี้?')) return;
    
    try {
      const response = await fetch(`/api/authors/${id}`, { 
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        showNotification('ลบผู้เขียนสำเร็จ', 'success');
        await fetchAuthors(); // Refetch after success
      } else {
        const errorData = await response.json() as { error?: string, message?: string };
        const errorMsg = errorData.error || errorData.message || 'เกิดข้อผิดพลาดในการลบ';
        showNotification(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error deleting author:', error);
      showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>;
  }

  return (
    <div className="bg-gray-900 border border-gold/20 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center">
          <User className="mr-2 text-gold" size={24} />
          จัดการรายชื่อผู้เขียน
        </h2>
        {!isEditing && (
          <button 
            onClick={() => {
              setCurrentAuthor({ name: '', description: '', position: '', image: '' });
              setIsEditing(true);
            }}
            className="flex items-center bg-baccarat-red hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"
          >
            <Plus size={18} className="mr-1" />
            เพิ่มผู้เขียนใหม่
          </button>
        )}
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 mb-6 rounded-lg ${notification.type === 'success' ? 'bg-green-500/10 border border-green-500/50 text-green-400' : 'bg-red-500/10 border border-red-500/50 text-red-400'}`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {isEditing ? (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700"
        >
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">ชื่อผู้เขียน <span className="text-baccarat-red">*</span></label>
                <input 
                  type="text" 
                  value={currentAuthor?.name || ''}
                  onChange={e => setCurrentAuthor({...currentAuthor, name: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">ตำแหน่ง (Position)</label>
                <input 
                  type="text" 
                  value={currentAuthor?.position || ''}
                  onChange={e => setCurrentAuthor({...currentAuthor, position: e.target.value})}
                  placeholder="เช่น เซียนบาคาร่า, บรรณาธิการ"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">คำอธิบายสั้นๆ (Description)</label>
                <input 
                  type="text" 
                  value={currentAuthor?.description || ''}
                  onChange={e => setCurrentAuthor({...currentAuthor, description: e.target.value})}
                  placeholder="ความถนัดหรือประวัติย่อ..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">URL รูปโปรไฟล์ผู้เขียน</label>
                <input 
                  type="url" 
                  value={currentAuthor?.image || ''}
                  onChange={e => setCurrentAuthor({...currentAuthor, image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-4 text-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-4">
              <button 
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setCurrentAuthor(null);
                }}
                className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <X size={18} className="mr-1" />
                ยกเลิก
              </button>
              <button 
                type="submit"
                className="flex items-center px-4 py-2 bg-gold hover:bg-yellow-500 text-baccarat-black font-bold rounded-lg transition-colors"
              >
                <Save size={18} className="mr-1" />
                บันทึก
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        <>
          {authors.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg bg-gray-800/50">
              <User size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">ยังไม่มีข้อมูลผู้เขียน</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {authors.map(author => (
                <div key={author.id} className="bg-gray-800 rounded-lg p-5 border border-gray-700 flex flex-col h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                      {author.image ? (
                        <img src={author.image} alt={author.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <User size={24} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg leading-tight">{author.name}</h3>
                      <p className="text-gold text-sm">{author.position || 'นักเขียน'}</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-sm mb-6 flex-grow line-clamp-3">
                    {author.description || 'ไม่มีคำอธิบาย'}
                  </p>
                  
                  <div className="flex gap-2 pt-4 border-t border-gray-700 mt-auto">
                    <button 
                      onClick={() => {
                        setCurrentAuthor(author);
                        setIsEditing(true);
                      }}
                      className="flex-1 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white rounded py-1.5 text-sm transition-colors"
                    >
                      <Edit2 size={14} className="mr-1" />
                      แก้ไข
                    </button>
                    <button 
                      onClick={() => handleDelete(author.id)}
                      className="flex-1 flex items-center justify-center bg-red-900/30 hover:bg-red-800 text-red-500 hover:text-white rounded py-1.5 text-sm transition-colors"
                    >
                      <Trash2 size={14} className="mr-1" />
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
