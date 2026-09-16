import { createRoot } from 'react-dom/client';
import App from './App';
import './lan.css';

createRoot(document.getElementById('root')!).render(
  <div className="fde-lan-shell">
    <main className="fde-lan-main"><App/></main>
  </div>
);
