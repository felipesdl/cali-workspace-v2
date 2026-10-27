import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Página não encontrada</h1>
      <Link to="/cliente">Voltar ao início</Link>
    </main>
  );
}
