import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from 'react-oidc-context';
import { userManager } from './authConfig';

// Después de procesar el login (cuando redirect.html rebota a "/" con
// ?code=&state= en la URL), limpiamos la URL para no dejar esos
// parámetros visibles ni reprocesarlos en un F5 posterior.
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
    <App />
  </AuthProvider>
);
