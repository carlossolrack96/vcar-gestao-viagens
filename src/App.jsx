
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./services/firebase";
import "./App.css";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Informe seu e-mail e sua senha.");
      return;
    }

    setLoading(true);

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      setUser(result.user);
    } catch (err) {
      const messages = {
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/invalid-email": "Informe um e-mail válido.",
        "auth/user-disabled": "Esta conta está desativada.",
        "auth/too-many-requests":
          "Muitas tentativas. Aguarde e tente novamente.",
        "auth/network-request-failed":
          "Falha de conexão. Verifique sua internet.",
      };

      setError(
        messages[err.code] ||
          "Não foi possível entrar. Verifique seus dados e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand">
            <div className="brand-logo">V</div>
            <div>
              <h1>VCAR</h1>
              <p>Gestão de Viagens</p>
            </div>
          </div>

          <div className="login-heading">
            <h2>Login realizado!</h2>
            <p>Você está autenticado no VCAR.</p>
          </div>

          <p>{user.email}</p>

          <button
            className="logout-button"
            onClick={async () => {
              const { signOut } = await import("firebase/auth");
              await signOut(auth);
              setUser(null);
            }}
          >
            Sair
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <div className="brand-logo">V</div>
          <div>
            <h1>VCAR</h1>
            <p>Gestão de Viagens</p>
          </div>
        </div>

        <div className="login-heading">
          <h2>Bem-vindo</h2>
          <p>Entre para acessar sua empresa</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="login-footer">
          VCAR Gestão de Viagens
        </div>
      </section>
    </main>
  );
}

export default App;

