import { Link } from '@tanstack/react-router';

export function RouteErrorPage() {
  return (
    <main style={{ padding: 24 }} role="alert">
      <h1>Não foi possível abrir esta página</h1>
      <Link to="/cliente">Voltar ao início</Link>
    </main>
  );
}
