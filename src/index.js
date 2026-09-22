import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './authConfig';
import { configureApiAuth } from './services/apiService';

const msalInstance = new PublicClientApplication(msalConfig);
configureApiAuth(msalInstance);

// getActiveAccount() (y por lo tanto useAccount() de msal-react) solo
// devuelve algo si se llamó setActiveAccount() antes. Con cacheLocation
// "localStorage" la sesión sobrevive a recargas y a otras pestañas, así que
// hace falta reactivar la cuenta tanto al restaurar la sesión (initialize)
// como cada vez que se completa un login (evento LOGIN_SUCCESS).
msalInstance.initialize().then(() => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }
});

msalInstance.addEventCallback((event) => {
  if (
    (event.eventType === EventType.LOGIN_SUCCESS ||
      event.eventType === EventType.SSO_SILENT_SUCCESS) &&
    event.payload?.account
  ) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>
);
