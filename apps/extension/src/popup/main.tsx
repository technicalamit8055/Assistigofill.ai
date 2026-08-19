import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/ui.css';
import { Popup } from './Popup';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Popup />
    </StrictMode>,
  );
}
