// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import { checkForUpdate } from './utils/versionCheck';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    // Check for SW updates on every load so fixes roll out quickly
    registration.update().catch(() => {});
  }).catch((error) => {
    console.warn('Service Worker registration failed:', error);
  });

  // If a newer SW takes over mid-session, reload once so the page runs
  // under it. A page stays controlled by the old SW until reload, and a
  // stale SW serving cached media breaks iOS Safari playback.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('swReloaded')) return;
    sessionStorage.setItem('swReloaded', '1');
    window.location.reload();
  });
}

// Reload with cleared caches if the server has a newer build
checkForUpdate();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
