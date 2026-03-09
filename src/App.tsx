import React, { useState, useEffect, useRef } from 'react';
import { Category, NewsArticle, Language } from './types';
import { fetchNews, speakArticle, decodeAudio, createWavBlob } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Download, 
  ChevronLeft, 
  Radio, 
  AlertCircle,
  RefreshCw,
  Key,
  Sword,
  TrendingUp,
  Cpu,
  Trophy,
  Stethoscope,
  Globe,
  Palette,
  CloudSun,
  Newspaper,
  LayoutGrid
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const CATEGORY_IMAGES: Record<string, string> = {
  [Category.UNES]: "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80",
  [Category.GEOPOLITIQUE]: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80",
  [Category.FINANCE]: "https://images.unsplash.com/photo-1611974714024-46202e33bc3b?auto=format&fit=crop&w=1200&q=80",
  [Category.METEO]: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1200&q=80",
  [Category.SOCIETE]: "https://images.unsplash.com/photo-1560161407-063991206644?auto=format&fit=crop&w=1200&q=80",
  [Category.TECH]: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80"
};

const ArticleIllustration: React.FC<{ category: Category; className?: string }> = ({ category, className }) => {
  const imageUrl = CATEGORY_IMAGES[category] || CATEGORY_IMAGES[Category.UNES];
  return (
    <div className={cn("relative w-full h-full overflow-hidden border border-zinc-100", className)}>
      <img src={imageUrl} alt={category} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
      <div className="absolute bottom-4 left-4 right-4">
        <p className="text-[7px] font-black uppercase tracking-[0.4em] text-white/80">L'ÉCHO DU MATIN • {category}</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(Language.FR);
  const [category, setCategory] = useState<Category>(Category.UNES);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [radioIndex, setRadioIndex] = useState(-1);
  const [hasKey, setHasKey] = useState(true);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioSource = useRef<AudioBufferSourceNode | null>(null);
  const todayStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        let envKey = "";
        try { envKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""; } catch (e) {}
        setHasKey(!!(envKey || localStorage.getItem('GEMINI_API_KEY')));
      }
    };
    checkKey();
  }, []);

  const handleOpenKey = async () => { if (window.aistudio) { await window.aistudio.openSelectKey(); setHasKey(true); } };

  const handleShare = async (article: NewsArticle) => {
    const shareText = `${article.title}\n\n${article.content}\n\n— L'Écho du Matin par Atmani Bachir`;
    if (navigator.share) {
      try { await navigator.share({ title: article.title, text: shareText, url: window.location.href }); } catch (err) {}
    } else { copyToClipboard(shareText); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDownloadAudio = async (article: NewsArticle) => {
    const bytes = await speakArticle(article.content, lang);
    if (bytes) {
      const blob = createWavBlob(bytes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${article.title.slice(0, 30)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const cacheKey = `news_v11_${category}_${lang}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setArticles(JSON.parse(cached)); setLoading(false); } else { setLoading(true); }
      setIsUpdating(true);
      setError(null);
      try {
        const data = await fetchNews(category, lang);
        if (data && data.length > 0) { setArticles(data); localStorage.setItem(cacheKey, JSON.stringify(data)); }
        else { throw new Error("Aucun article trouvé."); }
      } catch (err: any) {
        if (!cached) { setArticles([]); setError(err.message || "Erreur de chargement."); }
      } finally { setLoading(false); setIsUpdating(false); }
    };
    loadData();
  }, [category, lang]);

  const handleSpeak = async (text: string, id: string, onEnded?: () => void) => {
    if (speakingId === id) { if (audioSource.current) audioSource.current.stop(); setSpeakingId(null); return; }
    if (audioSource.current) audioSource.current.stop();
    setSpeakingId(id);
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    try {
      const bytes = await speakArticle(text, lang);
      if (bytes && audioCtx.current) {
        const buffer = await decodeAudio(bytes, audioCtx.current);
        const source = audioCtx.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.current.destination);
        source.onended = () => { setSpeakingId(null); if (onEnded) onEnded(); };
        audioSource.current = source;
        source.start(0);
      } else { setSpeakingId(null); }
    } catch (err) { setSpeakingId(null); }
  };

  const startRadioMode = () => { if (articles.length > 0) { setIsRadioMode(true); playNextRadioArticle(0); } };
  const stopRadioMode = () => { setIsRadioMode(false); setRadioIndex(-1); if (audioSource.current) audioSource.current.stop(); setSpeakingId(null); };
  const playNextRadioArticle = (index: number) => {
    if (index >= articles.length) { stopRadioMode(); return; }
    setRadioIndex(index);
    handleSpeak(`${articles[index].title}. ${articles[index].content}`, articles[index].id, () => playNextRadioArticle(index + 1));
  };

  if (!hasKey) return <div className="min-h-screen flex items-center justify-center p-6"><button onClick={handleOpenKey} className="bg-black text-white px-8 py-4 rounded-full">Sélectionner ma Clé API</button></div>;

  return (
    <div className={cn("min-h-screen bg-[#FDFCF8] text-zinc-950 flex flex-col", lang === Language.AR ? 'text-right font-serif' : 'text-left')} dir={lang === Language.AR ? 'rtl' : 'ltr'}>
      <header className="border-b-4 border-zinc-900 mx-4 md:mx-10 mt-6 pb-6 text-center">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-4">
          <span className="bg-red-600 text-white px-2 py-0.5">{category}</span>
          <div className="text-zinc-400 hidden lg:block italic">DIRECTEUR : <span className="text-zinc-900 font-bold uppercase">Atmani Bachir</span></div>
          <div className="flex gap-3">
            {Object.values(Language).map(l => (
              <button key={l} onClick={() => setLang(l)} className={`transition-all ${lang === l ? 'font-black border-b-2 border-black' : 'text-zinc-300'}`}>{l.slice(0, 2).toUpperCase()}</button>
            ))}
          </div>
        </div>
        <h1 className="font-serif text-[2.8rem] md:text-[7rem] font-black italic tracking-tighter leading-none">L'Écho du Matin</h1>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mt-4">
          <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">6 HEURES, VU PAR L'IA • {todayStr}</p>
          {!loading && articles.length > 0 && (
            <button onClick={isRadioMode ? stopRadioMode : startRadioMode} className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">
              <Radio className="w-4 h-4" /> {isRadioMode ? 'STOP RADIO' : 'ÉCOUTER LE JOURNAL'}
            </button>
          )}
        </div>
      </header>

      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur z-50 border-b border-zinc-900">
        <nav className="no-scrollbar py-4 gap-6 px-6 flex overflow-x-auto">
          {Object.values(Category).map(cat => (
            <button key={cat} onClick={() => { setCategory(cat); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`whitespace-nowrap text-[10px] font-black uppercase tracking-widest ${category === cat ? 'text-black border-b-2 border-black' : 'text-zinc-300'}`}>{cat}</button>
          ))}
        </nav>
      </div>

      <main className="flex-grow max-w-7xl mx-auto px-4 md:px-6 py-10 w-full">
        {loading && articles.length === 0 ? (
          <div className="space-y-6">
            <div className="aspect-video overflow-hidden rounded-sm relative border border-zinc-200">
              <ArticleIllustration category={category} />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="text-center p-6 bg-white/90 rounded-3xl shadow-2xl">
                  <div className="w-12 h-12 border-4 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4"></div>
                  <h3 className="font-serif text-xl italic font-black">Rédaction en cours...</h3>
                </div>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 space-y-6">
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
            <h3 className="font-serif text-2xl italic font-black">L'Écho est interrompu</h3>
            <p className="text-zinc-500">{error}</p>
            <button onClick={() => window.location.reload()} className="bg-black text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest">Réessayer</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            {articles.map((art, idx) => (
              <article key={art.id} className={`${idx === 0 ? 'md:col-span-12 lg:col-span-8' : 'md:col-span-6 lg:col-span-4'} border-b border-zinc-100 pb-10 cursor-pointer group`} onClick={() => setSelected(art)}>
                <div className="aspect-video overflow-hidden mb-6 rounded-sm relative border border-zinc-200">
                  <ArticleIllustration category={art.category} />
                  <div className="absolute top-4 left-4"><span className="text-[7px] font-black px-2 py-1 rounded uppercase tracking-widest bg-green-600 text-white shadow-lg">Vérifié</span></div>
                </div>
                <h2 className={`font-serif font-black italic tracking-tighter ${idx === 0 ? 'text-3xl md:text-6xl mb-4' : 'text-2xl mb-2'}`}>{art.title}</h2>
                <p className="text-zinc-500 text-sm italic line-clamp-3">{art.summary}</p>
              </article>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className={cn("fixed inset-0 z-[100] bg-white overflow-y-auto", isReadingMode ? 'bg-zinc-950 text-white' : '')}>
          <div className="sticky top-0 p-4 flex justify-between items-center z-50 border-b bg-inherit backdrop-blur">
            <button onClick={() => setSelected(null)} className="p-2 hover:bg-zinc-100 rounded-full"><ChevronLeft className="w-6 h-6" /></button>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              <button onClick={() => setIsReadingMode(!isReadingMode)} className="whitespace-nowrap px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest bg-zinc-100 text-zinc-600">Lecture</button>
              <button onClick={() => copyToClipboard(`🗞️ L'ÉCHO DU MATIN\n\n${selected.title.toUpperCase()}\n\n${selected.content}\n\n✨ Par Atmani Bachir`)} className="whitespace-nowrap bg-zinc-900 text-white px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest shadow-lg">TIKTOK</button>
              <button onClick={() => handleShare(selected)} className="whitespace-nowrap bg-zinc-100 text-zinc-900 px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest border border-zinc-200">PARTAGER</button>
              <button onClick={() => { window.open(CATEGORY_IMAGES[selected.category], '_blank'); }} className="whitespace-nowrap bg-zinc-100 text-zinc-900 px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest border border-zinc-200">IMAGE</button>
            </div>
          </div>
          <article className="max-w-3xl mx-auto py-10 px-4 space-y-12 pb-32">
            <h2 className="font-serif font-black italic tracking-tighter leading-[0.9] text-4xl md:text-7xl">{selected.title}</h2>
            {!isReadingMode && <div className="aspect-video rounded-sm overflow-hidden border-2 border-zinc-900 shadow-2xl"><ArticleIllustration category={selected.category} /></div>}
            <div className="leading-relaxed font-serif italic text-lg md:text-2xl text-zinc-800">
              <ReactMarkdown components={{ p: ({children}) => <p className="mb-12 p-6 bg-zinc-50/50 rounded-2xl border border-zinc-100 shadow-sm">{children}</p> }}>{selected.content}</ReactMarkdown>
            </div>
            {selected.strategicAdvice && <div className="bg-zinc-900 text-white p-8 rounded-[2rem] shadow-xl"><h4 className="text-[8px] font-black text-zinc-500 uppercase mb-3 tracking-widest">CONSEIL D'ATMANI BACHIR</h4><p className="font-bold text-lg italic mb-2">"{selected.strategicAdvice.action}"</p><p className="text-xs text-zinc-400">{selected.strategicAdvice.details}</p></div>}
          </article>
        </div>
      )}
    </div>
  );
};

export default App;
