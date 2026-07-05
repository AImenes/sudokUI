import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import './ui/styles.css';
import { useGame } from './state/gameStore';

if (import.meta.env.DEV) {
  (window as any).__game = useGame;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
