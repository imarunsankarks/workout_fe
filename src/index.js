import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration.ts';

// serviceWorkerRegistration.register();
const root = ReactDOM.createRoot(document.getElementById('root'));
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`).then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, (error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

