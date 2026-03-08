import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Polyfills pour la compatibilité
if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = (window as any).process || { env: {} };
}

console.log("Démarrage de LE CONTRE...");

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (e) {
    console.error("Erreur fatale au rendu:", e);
  }
}
