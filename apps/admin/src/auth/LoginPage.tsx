import { useState, type MouseEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { isAccountLocked, isInvalidCredentials } from '../api/client.js';
import { hrefFor, navigate } from '../router.js';
import { useAuth } from './AuthProvider.js';

import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import logoUrl from '../assets/brand/xplor-logo.svg';

type LoginErrorKey = 'auth.login.error' | 'auth.login.locked' | 'auth.login.failed';

export function LoginPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const email = readField(data, 'email');
    const password = readField(data, 'password');
    setErrorKey(null);
    setPending(true);
    void auth.login({ email, password }).catch((error: unknown) => {
      setErrorKey(loginErrorKey(error));
      setPending(false);
    });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <img src={logoUrl} alt="Xplor" className="h-12 mb-2" />
      <p className="font-comfortaa text-xl mb-6 text-foreground">Votre voyage commence ici</p>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="login-title">{t('auth.login.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form aria-labelledby="login-title" onSubmit={onSubmit} className="flex flex-col gap-4">
            {errorKey !== null ? (
              <Alert variant="destructive">
                {t(errorKey)}
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">{t('auth.login.email')}</Label>
              <Input id="login-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-password">{t('auth.login.password')}</Label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full mt-2">
              {t('auth.login.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <a 
            href={hrefFor('/forgot')} 
            onClick={goToForgot}
            className="text-primary underline-offset-4 hover:underline text-sm font-medium"
          >
            {t('auth.forgot.link')}
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}

function goToForgot(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) {
    return;
  }
  event.preventDefault();
  navigate('/forgot');
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function loginErrorKey(error: unknown): LoginErrorKey {
  if (isAccountLocked(error)) {
    return 'auth.login.locked';
  }
  if (isInvalidCredentials(error)) {
    return 'auth.login.error';
  }
  return 'auth.login.failed';
}
