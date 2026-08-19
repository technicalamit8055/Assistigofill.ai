import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/ui.css';
import { SidePanel } from './SidePanel';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <SidePanel />
    </StrictMode>,
  );
}
