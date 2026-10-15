import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlassPreview } from './GlassPreview.js';
import '../styles.css';
import './opendesign-tokens.css';
import './glass.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing #root element');
createRoot(root).render(<StrictMode><GlassPreview /></StrictMode>);
