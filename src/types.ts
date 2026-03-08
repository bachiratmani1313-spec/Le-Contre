export enum Category {
  UNES = "À la une",
  GEOPOLITIQUE = "Géopolitique & Conflits",
  FINANCE = "Finance & Crypto",
  METEO = "Météo & Alertes Sat",
  SOCIETE = "Belgique & Europe",
  TECH = "IA & Futur"
}

export enum Language {
  FR = "Français",
  EN = "English",
  AR = "العربية"
}

export type ArticleType = "FACTUAL" | "MAGAZINE_COMIC" | "MAGAZINE_FABLE" | "AI_REFLECTION";

export interface NewsArticle {
  id: string;
  type: ArticleType;
  title: string;
  summary: string;
  content: string; 
  truthContent: string; 
  physicalFacts: string; 
  audioAnnounce: string; 
  imagePrompt: string; 
  strategicAdvice: {
    action: string; 
    details: string;
  };
  location: string;
  timestamp: string;
  category: Category;
  icon?: string;
  imageUrl?: string;
  dynamicImageUrl?: string;
  sources: { title: string; uri: string }[];
}
