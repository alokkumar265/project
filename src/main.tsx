import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Error handling for root rendering
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

// Create root with error boundary
const root = createRoot(rootElement);

// Render with error handling
try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to render app:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1 style="color: red;">Something went wrong</h1>
      <p>Please refresh the page or try again later.</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto;">
        ${error instanceof Error ? error.message : 'Unknown error'}
      </pre>
    </div>
  `;
}
