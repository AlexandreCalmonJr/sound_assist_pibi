import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

const AiChat = () => {
  const { emit } = useSocket();
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou o cérebro acústico do SoundMaster Pro. Posso te ajudar a equalizar instrumentos, calcular delays ou gerenciar o sistema. O que deseja fazer?' }
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
    } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'O motor de IA está processando outros dados. Tente novamente em instantes.' }]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="page-enter h-full flex flex-col max-w-4xl mx-auto">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-5">
            <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 rounded-3xl text-3xl shadow-xl shadow-brand-primary/5">🤖</div>
            <div>
                <h2 className="text-4xl font-black text-white tracking-tighter">Assistente IA</h2>
                <p className="text-text-muted font-medium text-lg">Processamento de Linguagem Natural Acústica</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">IA Ativa</span>
            <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-[0_0_10px_var(--color-brand-primary)]"></div>
        </div>
      </header>

      <div className="flex-1 bg-surface-elevated/20 border border-white/5 rounded-[40px] shadow-2xl flex flex-col overflow-hidden mb-8">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-6 rounded-[32px] text-sm leading-relaxed shadow-xl border ${
                        m.role === 'user' 
                            ? 'bg-brand-primary text-white border-brand-primary/20 rounded-tr-none' 
                            : 'bg-white/5 border-white/10 text-text-primary rounded-tl-none'
                    }`}>
                        {m.text}
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex justify-start animate-in fade-in">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] rounded-tl-none flex gap-2">
                        <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                </div>
            )}
        </div>

        <div className="p-8 bg-black/40 border-t border-white/5">
            <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="relative flex items-center"
            >
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Peça algo: 'Como está o RT60?' ou 'Equalize o bumbo'..."
                    className="w-full bg-white/5 border border-white/10 rounded-[28px] pl-8 pr-20 py-6 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                />
                <button 
                    type="submit"
                    className="absolute right-4 w-12 h-12 bg-brand-primary text-white rounded-2xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-brand-primary/30"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
