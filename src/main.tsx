import 'reflect-metadata';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import { JeepSqlite } from 'jeep-sqlite/dist/components/jeep-sqlite';
import { defineCustomElements as pwaElements } from '@ionic/pwa-elements/loader';
import sqliteParams from './databases/sqliteParams';
import { initializeDataSources } from './databases/utilities';

pwaElements(window);
customElements.define('jeep-sqlite', JeepSqlite);

const rootRender = async () => {
  await initializeDataSources();

  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

const initWeb = async () => {
  const jeepEl = document.createElement("jeep-sqlite");
  jeepEl.buttonOptions = '{"backgroundColor":"#fb2a2a", "top":"70%","fontSize":"1.1em"}';
  document.body.appendChild(jeepEl);

  await customElements.whenDefined('jeep-sqlite');
  await sqliteParams.connection.initWebStore();
  await rootRender();
};

if (sqliteParams.platform !== "web") {
  rootRender();
} else {
  // Cek jika DOM sudah siap saat script dieksekusi
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initWeb);
  } else {
    initWeb();
  }
}