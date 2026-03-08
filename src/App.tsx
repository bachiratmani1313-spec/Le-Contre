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
  Key
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// PHOTOS STATIQUES ET DÉFINITIVES PAR CATÉGORIE
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
      <img 
        src={imageUrl} 
        alt={category} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
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
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [radioIndex, setRadioIndex] = useState(-1);
  const [hasKey, setHasKey] = useState(true);
  
  const audioCtx = useRef<AudioContext | null>(null);
  const audioSource = useRef<AudioBufferSourceNode | null>(null);

  const todayStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const checkKey = async () => {
      let envKey = "";
      try {
        // @ts-ignore
        envKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
      } catch (e) {}
      setHasKey(!!envKey);
    };
    checkKey();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchNews(category, lang);
        setArticles(data || []);
      } catch (err) {
        setError("Erreur de connexion.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [category, lang]);

  const handleSpeak = async (text: string, id: string, onEnded?: () => void) => {
    if (speakingId === id) {
      if (audioSource.current) { try { audioSource.current.stop(); } catch(e) {} }
      setSpeakingId(null);
      return;
    }
    if (audioSource.current) { try { audioSource.current.stop(); } catch(e) {} }
    setSpeakingId(id);
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    try {
      const bytes = await speakArticle(text, lang);
      if (bytes && audioCtx.current) {
        const buffer = await decodeAudio(bytes, audioCtx.current);
        const source = audioCtx.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.current.destination);
        source.onended = () => {
          setSpeakingId(null);
          if (onEnded) onEnded();
        };
        audioSource.current = source;
        source.start(0);
      } else { setSpeakingId(null); }
    } catch (err) { setSpeakingId(null); }
  };

  const startRadioMode = () => {
    if (articles.length === 0) return;
    setIsRadioMode(true);
    playNextRadioArticle(0);
  };

  const stopRadioMode = () => {
    setIsRadioMode(false);
    setRadioIndex(-1);
    if (audioSource.current) { try { audioSource.current.stop(); } catch(e) {} }
    setSpeakingId(null);
  };

  const playNextRadioArticle = (index: number) => {
    if (index >= articles.length) { stopRadioMode(); return; }
    setRadioIndex(index);
    const article = articles[index];
    handleSpeak(`${article.title}. ${article.content}`, article.id, () => {
      playNextRadioArticle(index + 1);
    });
  };

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl rotate-3">
            <Key className="w-10 h-10" />
          </div>
          <h1 className="font-serif text-4xl font-black italic tracking-tighter">L'ÉCHO DU MATIN : Accès Réservé</h1>
          <p className="text-zinc-500">Veuillez configurer votre clé API VITE_GEMINI_API_KEY sur Vercel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-[#FDFCF8] text-zinc-950 flex flex-col", lang === Language.AR ? 'text-right font-serif' : 'text-left')} dir={lang === Language.AR ? 'rtl' : 'ltr'}>
      <header className="border-b-4 border-zinc-900 mx-4 md:mx-10 mt-4 md:mt-6 pb-4 md:pb-6 text-center">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest mb-4">
          <span className="bg-zinc-900 text-white px-2 py-0.5">L'ÉCHO DU MATIN</span>
          <div className="text-zinc-400 hidden lg:block italic">FONDÉ PAR : <span className="text-zinc-900 font-bold uppercase">Atmani Bachir</span></div>
          <div className="flex gap-3">
            {Object.values(Language).map(l => (
              <button key={l} onClick={() => setLang(l)} className={`transition-all ${lang === l ? 'font-black border-b-2 border-black' : 'text-zinc-300'}`}>{l.slice(0, 2).toUpperCase()}</button>
            ))}
          </div>
        </div>
        <h1 className="font-serif text-[3.5rem] md:text-[8rem] font-black italic tracking-tighter leading-none">L'ÉCHO DU MATIN</h1>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mt-4">
            <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">6 HEURES, VU PAR L'IA</p>
            {!loading && articles.length > 0 && (
              <button onClick={isRadioMode ? stopRadioMode : startRadioMode} className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg ${isRadioMode ? 'bg-zinc-900 text-white animate-pulse' : 'bg-white text-zinc-900 border-zinc-900 hover:scale-110'}`}>
                <Radio className="w-4 h-4" />
                {isRadioMode ? `RADIO : ARTICLE ${radioIndex + 1}/3` : 'ÉCOUTER LE JOURNAL'}
              </button>
            )}
        </div>
      </header>

      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur z-50 border-b border-zinc-900 nav-container">
        <nav className="no-scrollbar py-4 gap-6 px-6 overflow-x-auto">
          {Object.values(Category).map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`nav-item whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all ${category === cat ? 'text-black border-b-2 border-black' : 'text-zinc-300 hover:text-zinc-600'}`}>{cat}</button>
          ))}
        </nav>
      </div>

      <main className="flex-grow max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-6"></div>
            <h3 className="font-serif text-2xl italic font-black">Recherche de l'information...</h3>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-6" />
            <h3 className="font-serif text-2xl italic font-black">{error}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            {articles.map((art, idx) => (
              <article key={art.id} className={`${idx === 0 ? 'md:col-span-12 lg:col-span-8' : 'md:col-span-6 lg:col-span-4'} border-b border-zinc-100 pb-10 cursor-pointer group`} onClick={() => setSelected(art)}>
                <div className="aspect-video overflow-hidden mb-6 rounded-sm relative border border-zinc-200">
                  <ArticleIllustration category={art.category} />
                  {isRadioMode && radioIndex === idx && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="flex gap-1 items-end h-8">
                        <div className="w-1.5 bg-white animate-[music-bar_0.6s_ease-in-out_infinite]"></div>
                        <div className="w-1.5 bg-white animate-[music-bar_0.9s_ease-in-out_infinite]"></div>
                        <div className="w-1.5 bg-white animate-[music-bar_0.7s_ease-in-out_infinite]"></div>
                      </div>
                    </div>
                  )}
                </div>
                <h2 className={`font-serif font-black italic tracking-tighter ${idx === 0 ? 'text-3xl md:text-6xl mb-4' : 'text-2xl mb-2'}`}>{art.title}</h2>
                <p className="text-zinc-500 text-sm italic line-clamp-3">{art.summary}</p>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-zinc-900 text-white py-16 px-10 text-center">
        <h2 className="font-serif text-3xl md:text-4xl italic font-black mb-4">L'ÉCHO DU MATIN</h2>
        <p className="text-[10px] tracking-[0.5em] text-zinc-500 uppercase mb-6">Propriété Exclusive : Atmani Bachir</p>
      </footer>

      {selected && (
        <div className={`fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300 ${isReadingMode ? 'bg-zinc-950 text-white' : ''}`}>
          <div className={`sticky top-0 p-4 flex justify-between items-center z-50 border-b ${isReadingMode ? 'bg-zinc-950/90 border-zinc-800' : 'bg-white/95 border-zinc-100'} backdrop-blur`}>
            <button onClick={() => setSelected(null)} className="p-2 rounded-full hover:bg-zinc-100">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="font-serif font-black italic text-lg md:text-xl hidden sm:block">L'ÉCHO DU MATIN</span>
            <div className="flex gap-2">
              <button onClick={() => setIsReadingMode(!isReadingMode)} className="px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest bg-zinc-100 text-zinc-600">LECTURE</button>
              <button onClick={() => handleSpeak(selected.content, selected.id)} className={`px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest ${speakingId === selected.id ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'}`}>ÉCOUTER</button>
            </div>
          </div>
          
          <article className="max-w-3xl mx-auto py-8 md:py-10 px-4 md:px-6 space-y-10">
            <h2 className="font-serif font-black italic tracking-tighter leading-[0.9] text-5xl md:text-8xl">{selected.title}</h2>
            <div className="aspect-video rounded-sm overflow-hidden border-2 border-zinc-900 shadow-2xl">
              <ArticleIllustration category={selected.category} />
            </div>
            <div className="leading-relaxed font-serif italic text-lg md:text-2xl text-zinc-800 markdown-body">
              <ReactMarkdown>{selected.content}</ReactMarkdown>
            </div>
          </article>
        </div>
      )}
    </div>
  );
};

export default App;
