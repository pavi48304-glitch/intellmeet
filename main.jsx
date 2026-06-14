import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from 'react-error-boundary';

import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your_google_client_id_here';

function fallbackRender({ error, resetErrorBoundary }) {
  return (
    <div role="alert" style={{ padding: '2rem', backgroundColor: '#333', color: 'red', fontFamily: 'monospace' }}>
      <h2>Something went wrong in the React App:</h2>
      <pre style={{ color: 'white' }}>{error.message}</pre>
      <pre style={{ color: '#ccc', fontSize: '12px' }}>{error.stack}</pre>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fallbackRender={fallbackRender}>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
