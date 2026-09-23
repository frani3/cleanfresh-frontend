import { render, screen } from "@testing-library/react";
import { AuthProvider } from "react-oidc-context";
import App from "./App";
import { userManager } from "./authConfig";

test("muestra la pantalla de inicio de sesión cuando no hay sesión activa", async () => {
  render(
    <AuthProvider userManager={userManager}>
      <App />
    </AuthProvider>
  );

  const loginButton = await screen.findByText(/iniciar sesión/i);
  expect(loginButton).toBeInTheDocument();
});
