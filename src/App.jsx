import "./App.css";

function App() {
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

        <form className="login-form">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Digite sua senha"
            />
          </div>

          <button type="button">Entrar</button>
        </form>

        <div className="login-footer">
          VCAR Gestão de Viagens
        </div>
      </section>
    </main>
  );
}

export default App;
