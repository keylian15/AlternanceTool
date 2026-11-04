import { login } from '../actions';
import SubmitButton from '@/components/SubmitButton';

export default function LoginPage({ searchParams }: { searchParams: { err?: string } }) {
  return (
    <main className="login">
      <form action={login} className="panel">
        <h1>Alternance</h1>
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {searchParams.err && <p className="err" role="alert">{searchParams.err}</p>}
        <SubmitButton>Se connecter</SubmitButton>
      </form>
    </main>
  );
}
