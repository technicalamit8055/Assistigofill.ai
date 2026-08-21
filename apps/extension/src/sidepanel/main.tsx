import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/ui.css';
import { ReviewPanel } from '../review/ReviewPanel';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ReviewPanel />
    </StrictMode>,
  );
}
