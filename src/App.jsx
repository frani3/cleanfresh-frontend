import AuthGuard from "./components/AuthGuard";
import Navbar from "./components/Navbar";
import BentoDashboard from "./pages/BentoDashboard";
import "./App.css";

function App() {
  return (
    <AuthGuard>
      <div className="app-shell">
        <Navbar />
        <BentoDashboard />
      </div>
    </AuthGuard>
  );
}

export default App;
