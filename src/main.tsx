import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';
import {initServiceWorker} from './services/pwaService';

initServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
