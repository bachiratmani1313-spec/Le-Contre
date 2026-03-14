import React, { useState, useEffect, useRef } from 'react';
import { Category, NewsArticle, Language } from './types';
import { fetchNews, speakArticle, decodeAudio, createWavBlob } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
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
  LayoutGrid,
  CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
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

  // Vérification de la clé API au démarrage
  useEffect(() => {
    const checkKey = async () => {
      // On vérifie d'abord si on est dans l'environnement AI Studio
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Hors AI Studio, on vérifie si la clé est injectée via process.env
        // ou si elle a été sauvegardée localement (pour les tests)
        let envKey = "";
        try {
          // @ts-ignore
          envKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
        } catch (e) {}
        const localKey = localStorage.getItem('GEMINI_API_KEY');
        setHasKey(!!(envKey || localKey));
      }
    };
    checkKey();
  }, []);

  const handleOpenKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true); // On assume le succès selon les guidelines
    }
  };

  const handleShare = async (article: NewsArticle) => {
    const shareText = `🗞️ L'ÉCHO DU MATIN\n\n${article.title.toUpperCase()}\n\n${article.content}\n\n✨ Par Atmani Bachir`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: shareText,
          url: window.location.href
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Erreur de partage:", err);
          copyToClipboard(shareText);
        }
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    const performCopy = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(performCopy)
        .catch((err) => {
          console.error("Clipboard error:", err);
          fallbackCopy(text);
        });
    } else {
      fallbackCopy(text);
    }

    function fallbackCopy(text: string) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) performCopy();
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
    }
  };

  const handleDownloadAudio = async (article: NewsArticle) => {
    const bytes = await speakArticle(article.content, lang);
    if (bytes) {
      const blob = createWavBlob(bytes);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${article.title.slice(0, 30)}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Chargement ultra-robuste et instantané
  useEffect(() => {
    const loadData = async () => {
      const cacheKey = `news_v10_${category}_${lang}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setArticles(parsed);
          setLoading(false);
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      } else {
        setLoading(true);
      }

      setIsUpdating(true);
      setError(null);
      try {
        const data = await fetchNews(category, lang);
        if (data && data.length > 0) {
          setArticles(data);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } else {
          throw new Error("Aucun article trouvé pour cette catégorie.");
        }
      } catch (err: any) {
        console.error("Erreur de mise à jour:", err);
        // On ne montre l'erreur que si on n'a rien en cache
        if (!cached) {
          setArticles([]);
          setError(err.message || "Impossible de charger les nouvelles. Vérifiez votre connexion ou votre clé API.");
        }
      } finally {
        setLoading(false);
        setIsUpdating(false);
      }
    };

    loadData();
  }, [category, lang]);

  const handleSpeak = async (text: string, id: string, onEnded?: () => void) => {
    if (speakingId === id) {
      if (audioSource.current) {
        try { audioSource.current.stop(); } catch(e) {}
      }
      setSpeakingId(null);
      return;
    }
    
    // Stop previous if any
    if (audioSource.current) {
      try { audioSource.current.stop(); } catch(e) {}
    }

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
      } else {
        setSpeakingId(null);
      }
    } catch (err) {
      console.error("Speech error:", err);
      setSpeakingId(null);
    }
  };

  const startRadioMode = () => {
    if (articles.length === 0) return;
    setIsRadioMode(true);
    playNextRadioArticle(0);
  };

  const stopRadioMode = () => {
    setIsRadioMode(false);
    setRadioIndex(-1);
    if (audioSource.current) {
      try { audioSource.current.stop(); } catch(e) {}
    }
    setSpeakingId(null);
  };

  const playNextRadioArticle = (index: number) => {
    if (index >= articles.length) {
      stopRadioMode();
      return;
    }
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
          <div className="space-y-4">
            <h1 className="font-serif text-4xl font-black italic tracking-tighter">Accès Réservé</h1>
            <p className="text-zinc-500 leading-relaxed">
              Pour accéder à <strong>L'Écho du Matin</strong>, vous devez utiliser une clé <strong>Google Gemini API</strong>.
            </p>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-800 italic">
              ⚠️ Attention : Une clé <strong>ChatGPT (OpenAI)</strong> ne fonctionnera pas ici. Vous devez utiliser une clé commençant par <strong>"AIza..."</strong>.
            </div>
          </div>
          <button 
            onClick={handleOpenKey}
            className="w-full bg-zinc-900 text-white py-4 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
          >
            Sélectionner ma Clé API
          </button>
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest">
            Propriété de Atmani Bachir • Propulsé par Gemini
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-[#FDFCF8] text-zinc-950 flex flex-col transition-colors duration-500",
      lang === Language.AR ? 'text-right font-serif' : 'text-left'
    )} dir={lang === Language.AR ? 'rtl' : 'ltr'}>
      {/* HEADER FIXE ET OPTIMISÉ MOBILE */}
      <header className="border-b-4 border-zinc-900 mx-4 md:mx-10 mt-4 md:mt-6 pb-4 md:pb-6 text-center">
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
            <div className="flex items-center gap-2">
              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">6 HEURES, VU PAR L'IA</p>
              <span className="w-1 h-1 bg-zinc-200 rounded-full"></span>
              <span className="text-[10px] font-serif italic text-zinc-400 capitalize">{todayStr}</span>
            </div>
            
            {!loading && articles.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 text-white rounded text-[7px] font-black animate-pulse">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  DIRECT
                </div>
                <button 
                  onClick={isRadioMode ? stopRadioMode : startRadioMode}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full border-2 transition-all font-black text-[10px] uppercase tracking-widest shadow-lg ${isRadioMode ? 'bg-red-600 text-white border-red-400 animate-pulse' : 'bg-zinc-900 text-white border-zinc-700 hover:scale-110 hover:shadow-zinc-200'}`}
                >
                  <Radio className="w-4 h-4" />
                  {isRadioMode ? `RADIO : ARTICLE ${radioIndex + 1}/3` : 'ÉCOUTER LE JOURNAL (RADIO)'}
                </button>
              </div>
            )}
        </div>
      </header>

      {/* NAVIGATION SCROLLABLE MOBILE CORRIGÉE */}
      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur z-50 border-b border-zinc-900 nav-container">
        <nav className="no-scrollbar py-4 gap-6 px-6 overflow-x-auto">
          {Object.values(Category).map(cat => (
            <button 
              key={cat} 
              onClick={() => {
                if (category !== cat) {
                    setCategory(cat);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }} 
              className={`nav-item whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all ${category === cat ? 'text-black border-b-2 border-black' : 'text-zinc-300 hover:text-zinc-600'}`}
            >
              {cat}
            </button>
          ))}
        </nav>
        {isUpdating && <div className="absolute bottom-0 left-0 h-0.5 bg-black animate-[shimmer_2s_infinite] w-full" style={{ backgroundSize: '200% 100%' }}></div>}
      </div>

      <main className="flex-grow max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10 w-full">
        {loading && articles.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            <div className="md:col-span-12 lg:col-span-8 space-y-6">
              <div className="aspect-video overflow-hidden rounded-sm relative border border-zinc-200">
                <ArticleIllustration category={category} />
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="text-center p-6 bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-white/20 scale-90 md:scale-100">
                    <div className="w-12 h-12 border-4 border-zinc-100 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4"></div>
                    <h3 className="font-serif text-xl italic font-black mb-1">Rédaction en cours...</h3>
                    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-400">L'IA Atmani Bachir analyse le monde</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-12 skeleton w-full rounded-lg"></div>
                <div className="h-4 skeleton w-3/4 rounded-md"></div>
                <div className="h-4 skeleton w-1/2 rounded-md"></div>
              </div>
            </div>
            <div className="md:col-span-6 lg:col-span-4 space-y-6 hidden lg:block">
              <div className="aspect-video skeleton rounded-sm"></div>
              <div className="h-10 skeleton w-full rounded-lg"></div>
              <div className="h-4 skeleton w-3/4 rounded-md"></div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 max-w-md mx-auto">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl italic font-black">L'Écho est interrompu</h3>
              <p className="text-zinc-500 text-sm">{error}</p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => window.location.reload()} 
                className="bg-black text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </button>
              <button 
                onClick={handleOpenKey}
                className="bg-zinc-100 text-zinc-900 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
              >
                <Key className="w-4 h-4" />
                Changer de Clé API
              </button>
            </div>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <p className="text-zinc-500 font-serif italic text-xl">L'Écho est encore endormi... Réessayez dans un instant.</p>
            <button onClick={() => window.location.reload()} className="bg-black text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest">Réveiller l'Écho</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 animate-in fade-in duration-500">
            {articles.map((art, idx) => (
              <article key={art.id} className={`${idx === 0 ? 'md:col-span-12 lg:col-span-8' : 'md:col-span-6 lg:col-span-4'} border-b border-zinc-100 pb-10 cursor-pointer group relative`} onClick={() => setSelected(art)}>
                <div className="aspect-video overflow-hidden mb-6 rounded-sm relative border border-zinc-200">
                  <ArticleIllustration category={art.category} />
                  
                  {isRadioMode && radioIndex === idx && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="flex gap-1 items-end h-8">
                        <div className="w-1.5 bg-white animate-[music-bar_0.6s_ease-in-out_infinite]"></div>
                        <div className="w-1.5 bg-white animate-[music-bar_0.9s_ease-in-out_infinite]"></div>
                        <div className="w-1.5 bg-white animate-[music-bar_0.7s_ease-in-out_infinite]"></div>
                        <div className="w-1.5 bg-white animate-[music-bar_0.5s_ease-in-out_infinite]"></div>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`text-[7px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg ${art.type === 'FACTUAL' ? 'bg-green-600 text-white' : 'bg-amber-500 text-black'}`}>
                      {art.type === 'FACTUAL' ? 'Vérifié' : 'Magazine'}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDownloadAudio(art); }}
                      className="bg-white/90 backdrop-blur p-1 rounded shadow-lg hover:scale-110 transition-all"
                      title="Télécharger l'audio"
                    >
                      <Download className="w-3 h-3 text-zinc-900" />
                    </button>
                  </div>
                  {idx === 0 && (
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); startRadioMode(); }}
                        className="w-16 h-16 rounded-full bg-zinc-900 text-white border-2 border-zinc-700 flex flex-col items-center justify-center shadow-2xl hover:scale-110 transition-all"
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                        <span className="text-[7px] font-black uppercase mt-1">RADIO</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSpeak(art.content, art.id); }}
                        className={`w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all border-2 ${speakingId === art.id ? 'bg-red-600 text-white border-red-400 animate-pulse' : 'bg-white text-zinc-900 border-zinc-200 hover:scale-110'}`}
                      >
                        <div className="relative">
                          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                          <svg className="absolute -top-2 -right-2 w-5 h-5 text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
                        </div>
                        <span className="text-[7px] font-black uppercase mt-1 tracking-tighter">La Une</span>
                      </button>
                    </div>
                  )}
                </div>
                <h2 className={`font-serif font-black italic tracking-tighter transition-colors group-hover:text-zinc-700 ${idx === 0 ? 'text-3xl md:text-6xl mb-4' : 'text-2xl mb-2'}`}>
                  {art.title}
                </h2>
                <p className="text-zinc-500 text-sm leading-relaxed italic line-clamp-3">{art.summary}</p>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="bg-zinc-900 text-white py-16 px-10 text-center">
        <h2 className="font-serif text-3xl md:text-4xl italic font-black mb-4">L'Écho du Matin</h2>
        <p className="text-[10px] tracking-[0.5em] text-zinc-500 uppercase mb-6">Propriété Exclusive : Atmani Bachir</p>
        
        <button 
          onClick={handleOpenKey}
          className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white border border-zinc-800 px-4 py-2 rounded-full transition-all"
        >
          Changer de Clé API (Google Gemini)
        </button>
      </footer>

      {/* MODAL ARTICLE : INSTANTANÉ ET ADAPTÉ MOBILE */}
      {selected && (
        <div className={`fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in slide-in-from-bottom duration-300 ${isReadingMode ? 'bg-zinc-950 text-white' : ''}`}>
          <div className={`sticky top-0 p-4 flex justify-between items-center z-50 border-b ${isReadingMode ? 'bg-zinc-950/90 border-zinc-800' : 'bg-white/95 border-zinc-100'} backdrop-blur`}>
            <div className="flex items-center gap-4">
              <button onClick={() => { setSelected(null); setIsReadingMode(false); }} className={`p-2 rounded-full ${isReadingMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              </button>
              <span className="font-serif font-black italic text-lg md:text-xl hidden sm:block">L'Écho du Matin</span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
              <button 
                onClick={() => setIsReadingMode(!isReadingMode)} 
                className={`whitespace-nowrap px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest transition-all ${isReadingMode ? 'bg-white text-black' : 'bg-zinc-100 text-zinc-600'}`}
              >
                {isReadingMode ? 'Normal' : 'Lecture'}
              </button>
              <button 
                onClick={() => copyToClipboard(`🗞️ L'ÉCHO DU MATIN\n\n${selected.title.toUpperCase()}\n\n${selected.content}\n\n✨ Par Atmani Bachir`)} 
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all",
                  copied ? "bg-green-600 text-white" : "bg-zinc-900 text-white"
                )}
              >
                {copied ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 2h-8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14h-8V4h8v12zM6 4H4v12c0 1.1.9 2 2 2h2v-2H6V4z"/></svg>
                )}
                {copied ? 'COPIÉ !' : 'TIKTOK'}
              </button>
              <button 
                onClick={() => handleShare(selected)} 
                className="whitespace-nowrap bg-zinc-100 text-zinc-900 px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border border-zinc-200"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"></path></svg>
                PARTAGER
              </button>
              <button 
                onClick={() => copyToClipboard(`🗞️ L'ÉCHO DU MATIN\n\n${selected.title.toUpperCase()}\n\n${selected.content}\n\n✨ Par Atmani Bachir`)} 
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border transition-all",
                  copied ? "bg-green-50 border-green-200 text-green-700" : "bg-zinc-100 text-zinc-900 border-zinc-200"
                )}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z"></path><path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2H7a4 4 0 00-4 4v6H5V5z"></path></svg>
                {copied ? 'COPIÉ !' : 'COPIER'}
              </button>
              <button 
                onClick={() => {
                  const imageUrl = CATEGORY_IMAGES[selected.category] || CATEGORY_IMAGES[Category.UNES];
                  window.open(imageUrl, '_blank');
                }} 
                className="whitespace-nowrap bg-zinc-100 text-zinc-900 px-4 py-2 rounded-full font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border border-zinc-200"
              >
                <Download className="w-3 h-3" />
                IMAGE
              </button>
            </div>
          </div>
          
          <article className={`max-w-3xl mx-auto py-8 md:py-10 px-4 md:px-6 space-y-10 md:space-y-12 pb-32 ${isReadingMode ? 'text-center' : ''}`}>
            <h2 
              className={`font-serif font-black italic tracking-tighter leading-[0.9] cursor-pointer active:scale-95 transition-transform ${isReadingMode ? 'text-5xl md:text-8xl mb-12' : 'text-4xl md:text-7xl'}`}
              onClick={() => setIsReadingMode(!isReadingMode)}
            >
              {selected.title}
            </h2>
            
            {!isReadingMode && (
              <div className="aspect-video rounded-sm overflow-hidden border-2 border-zinc-900 shadow-2xl">
                <ArticleIllustration category={selected.category} />
              </div>
            )}
            
            <div 
              className={cn(
                "leading-relaxed font-serif italic dropcap whitespace-pre-line cursor-pointer active:opacity-80 transition-opacity markdown-body",
                isReadingMode ? 'text-2xl md:text-4xl text-zinc-300' : 'text-lg md:text-2xl text-zinc-800',
                selected.type !== 'FACTUAL' && !isReadingMode ? 'bg-amber-50/40 p-6 md:p-10 rounded-3xl border border-dashed border-amber-200' : ''
              )}
              onClick={() => setIsReadingMode(!isReadingMode)}
            >
              <ReactMarkdown>{selected.content}</ReactMarkdown>
            </div>

            {selected.strategicAdvice && !isReadingMode && (
                <div className="bg-zinc-900 text-white p-8 md:p-10 rounded-[2rem] shadow-xl">
                    <h4 className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase mb-3 tracking-widest">CONSEIL D'ATMANI BACHIR</h4>
                    <p className="font-bold text-base md:text-lg italic mb-2">"{selected.strategicAdvice.action}"</p>
                    <p className="text-[11px] md:text-xs text-zinc-400 leading-relaxed">{selected.strategicAdvice.details}</p>
                </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <button onClick={() => handleSpeak(selected.content, selected.id)} className={`flex-grow p-5 md:p-6 border-2 font-black uppercase tracking-widest flex items-center justify-center gap-4 rounded-full transition-all ${speakingId === selected.id ? 'bg-red-600 text-white border-red-600' : isReadingMode ? 'border-white text-white hover:bg-white hover:text-black' : 'border-black text-black hover:bg-zinc-50'}`}>
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                    <span className="text-[10px] md:text-xs">{speakingId === selected.id ? 'ARRÊTER' : 'ÉCOUTER'}</span>
                </button>
                <button onClick={() => handleDownloadAudio(selected)} className={`p-5 md:p-6 border-2 font-black uppercase tracking-widest flex items-center justify-center rounded-full transition-all ${isReadingMode ? 'border-white text-white hover:bg-white hover:text-black' : 'border-black text-black hover:bg-zinc-50'}`}>
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>
              
              {isReadingMode && (
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.5em] mt-10">Faites défiler pour lire • Maintenez pour copier</p>
              )}
            </div>
          </article>
        </div>
      )}
      {/* RADIO PLAYER FIXE (BAS DE PAGE) */}
      <AnimatePresence>
        {isRadioMode && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-6 right-6 z-[110] bg-zinc-900 text-white p-4 md:p-6 rounded-[2rem] shadow-2xl border border-zinc-700 flex flex-col md:flex-row items-center gap-4 md:gap-8"
          >
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center animate-pulse">
                <Radio className="w-6 h-6" />
              </div>
              <div className="flex-grow overflow-hidden">
                <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">RADIO L'ÉCHO DU MATIN</p>
                <h4 className="font-serif italic font-bold text-sm truncate">{articles[radioIndex]?.title || "Chargement..."}</h4>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <button 
                onClick={() => playNextRadioArticle(Math.max(0, radioIndex - 1))}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={stopRadioMode}
                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-all"
              >
                <Pause className="w-6 h-6" />
              </button>
              <button 
                onClick={() => playNextRadioArticle(radioIndex + 1)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <Play className="w-6 h-6 rotate-0" />
              </button>
            </div>

            <div className="hidden md:flex flex-grow items-center gap-4">
              <div className="flex gap-1 items-end h-4">
                <div className="w-1 bg-red-500 animate-[music-bar_0.6s_infinite]"></div>
                <div className="w-1 bg-red-500 animate-[music-bar_0.9s_infinite]"></div>
                <div className="w-1 bg-red-500 animate-[music-bar_0.7s_infinite]"></div>
                <div className="w-1 bg-red-500 animate-[music-bar_0.5s_infinite]"></div>
              </div>
              <div className="h-1 bg-zinc-800 flex-grow rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-red-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${((radioIndex + 1) / articles.length) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-black text-zinc-500">{radioIndex + 1} / {articles.length}</span>
            </div>

            <button 
              onClick={stopRadioMode}
              className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white"
            >
              Quitter
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {copied && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest"
          >
            <CheckCircle2 className="w-4 h-4" />
            Copié dans le presse-papiers
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
