import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initDB } from './services/db'

// Initialize IndexedDB
initDB().catch(error => {
  console.error('Failed to initialize IndexedDB:', error);
});

// Import debug helpers (makes them available on window object)
import './utils/debugCompact.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
