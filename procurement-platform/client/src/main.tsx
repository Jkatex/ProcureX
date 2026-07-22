/* Mounts the React application with global providers and browser routing at the only DOM entrypoint. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { Providers } from './app/providers';
import './i18n';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
