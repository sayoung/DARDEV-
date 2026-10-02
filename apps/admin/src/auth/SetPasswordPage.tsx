import { PasswordSchema } from '@xplor/shared';
import { useState, type MouseEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { acceptInvite, ApiError, resetPassword } from '../api/client.js';
import { hrefFor, navigate, type Notice } from '../router.js';

import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import logoUrl from '../assets/brand/xplor-logo.svg';

type SetPasswordErrorKey =
  | 'auth.setPassword.mismatch'
  | 'auth.errors.TOKEN_INVALID'
  | 'auth.errors.PASSWORD_TOO_COMMON'
  | 'auth.errors.PASSWORD_INVALID'
  | 'auth.errors.request';

const TITLE_KEY = {
  reset: 'auth.setPassword.titleReset',
  invite: 'auth.setPassword.titleInvite',
} as const satisfies Record<Notice, string>;

export function SetPasswordPage({ kind, token }: { kind: Notice; token: string }) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<SetPasswordErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const password = readField(data, 'password');
    const confirmation = readField(data, 'confirm');
    setErrorKey(null);
    if (password !== confirmation) {
      setErrorKey('auth.setPassword.mismatch');
      return;
    }
    if (!PasswordSchema.safeParse(password).success) {
      setErrorKey('auth.errors.PASSWORD_INVALID');
      return;
    }
    const submit = kind === 'reset' ? resetPassword : acceptInvite;
    setPending(true);
    void submit({ token, password }).then(
      () => {
        navigate('/', kind);
      },
      (error: unknown) => {
        setErrorKey(setPasswordErrorKey(error));
        setPending(false);
      },
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <img src={logoUrl} alt="Xplor" className="h-12 mb-2" />
      <p className="font-comfortaa text-xl mb-6 text-foreground">Votre voyage commence ici</p>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="set-password-title">{t(TITLE_KEY[kind])}</CardTitle>
        </CardHeader>
        <CardContent>
          <form aria-labelledby="set-password-title" onSubmit={onSubmit} className="flex flex-col gap-4">
            {errorKey !== null ? (
              <Alert variant="destructive">
                {t(errorKey)}
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="set-password">{t('auth.setPassword.password')}</Label>
              <Input
                id="set-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="set-password-confirm">{t('auth.setPassword.confirm')}</Label>
              <Input
                id="set-password-confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full mt-2">
              {t('auth.setPassword.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <a 
            href={hrefFor('/')} 
            onClick={goToLogin}
            className="text-primary underline-offset-4 hover:underline text-sm font-medium"
          >
            {t('auth.setPassword.back')}
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}

function goToLogin(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) {
    return;
  }
  event.preventDefault();
  navigate('/');
}

function setPasswordErrorKey(error: unknown): SetPasswordErrorKey {
  if (error instanceof ApiError && error.status === 400) {
    if (error.code === 'TOKEN_INVALID') {
      return 'auth.errors.TOKEN_INVALID';
    }
    if (error.code === 'PASSWORD_TOO_COMMON') {
      return 'auth.errors.PASSWORD_TOO_COMMON';
    }
    if (error.code === 'PASSWORD_INVALID') {
      return 'auth.errors.PASSWORD_INVALID';
    }
  }
  return 'auth.errors.request';
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
