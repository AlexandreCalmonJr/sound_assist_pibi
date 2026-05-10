import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

const AiPanel = () => {
  const { emit } = useSocket();
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou seu assistente acústico. Como posso ajudar na mixagem hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg })
        });
        const data = await response.json();
        
        setMessages(prev => [...prev, { role: 'assistant', text: data.response }]);
        
        // Se houver uma sugestão de comando, podemos emitir automaticamente ou pedir confirmação
        if (data.action) {
            emit('execute_ai_command', {
                action: data.action,
                hz: data.hz,
                desc: data.description || 'Comando sugerido pela IA'
            });
        }
    } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Desculpe, o motor de IA está offline no momento.' }]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="bg-surface-elevated/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[500px] shadow-2xl">
      <div className="px-6 py-4 bg-gradient-to-r from-brand-primary/20 to-transparent border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-[0_0_10px_var(--color-brand-primary)]"></div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary">IA SoundMaster</h3>
        </div>
        <span className="text-[10px] text-text-secondary opacity-50 font-mono">MODEL: PRO-v1</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-none">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
              m.role === 'user' 
                ? 'bg-brand-primary text-white rounded-tr-none' 
                : 'bg-white/5 border border-white/5 text-text-primary rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-text-secondary rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-black/20 border-t border-white/5">
        <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="relative flex items-center"
        >
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: 'Corta o sibilado do vocal principal'..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-4 pr-12 py-3 text-xs text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-brand-primary/50 transition-all"
            />
            <button 
                type="submit"
                className="absolute right-2 w-8 h-8 bg-brand-primary text-white rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
        </form>
      </div>
    </div>
  );
};

export default AiPanel;
