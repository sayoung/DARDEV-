import { ForgotPasswordRequestSchema } from '@xplor/shared';
import { useState, type MouseEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { forgotPassword } from '../api/client.js';
import { hrefFor, navigate } from '../router.js';

import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { AuthLayout } from './AuthLayout.js';

type ForgotErrorKey = 'auth.forgot.invalidEmail' | 'auth.errors.request';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<ForgotErrorKey | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const email = readField(new FormData(event.currentTarget), 'email');
    const parsed = ForgotPasswordRequestSchema.safeParse({ email });
    setErrorKey(null);
    if (!parsed.success) {
      setErrorKey('auth.forgot.invalidEmail');
      return;
    }
    setPending(true);
    void forgotPassword(parsed.data).then(
      () => {
        setSent(true);
        setPending(false);
      },
      () => {
        setErrorKey('auth.errors.request');
        setPending(false);
      },
    );
  }

  if (sent) {
    return (
      <AuthLayout>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle id="forgot-title">{t('auth.forgot.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="default" role="status">
              {t('auth.forgot.sent')}
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <a 
              href={hrefFor('/')} 
              onClick={goToLogin}
              className="text-primary underline-offset-4 hover:underline text-sm font-medium"
            >
              {t('auth.forgot.back')}
            </a>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="forgot-title">{t('auth.forgot.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form aria-labelledby="forgot-title" onSubmit={onSubmit} className="flex flex-col gap-4">
            {errorKey !== null ? (
              <Alert variant="destructive">
                {t(errorKey)}
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="forgot-email">{t('auth.forgot.email')}</Label>
              <Input id="forgot-email" name="email" type="email" autoComplete="username" required />
            </div>
            <Button type="submit" disabled={pending} className="w-full mt-2">
              {t('auth.forgot.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <a 
            href={hrefFor('/')} 
            onClick={goToLogin}
            className="text-primary underline-offset-4 hover:underline text-sm font-medium"
          >
            {t('auth.forgot.back')}
          </a>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}

function goToLogin(event: MouseEvent<HTMLAnchorElement>): void {
  if (isModifiedClick(event)) {
    return;
  }
  event.preventDefault();
  navigate('/');
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0;
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
