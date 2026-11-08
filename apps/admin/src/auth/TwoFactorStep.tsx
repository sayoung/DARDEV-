import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../api/client.js';
import { useAuth } from './AuthProvider.js';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { AuthLayout } from './AuthLayout.js';

type TwoFactorErrorKey = 'auth.twoFactor.invalidCode' | 'auth.errors.request';

export function TwoFactorStep() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [errorKey, setErrorKey] = useState<TwoFactorErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (pending) {
      return;
    }
    const data = new FormData(event.currentTarget);
    const code = readField(data, 'code');
    setErrorKey(null);
    setPending(true);
    void auth.verifyTwoFactor(code).catch((error: unknown) => {
      setErrorKey(twoFactorErrorKey(error));
      setPending(false);
    });
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="two-factor-title">{t('auth.twoFactor.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            aria-labelledby="two-factor-title"
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            {errorKey !== null ? (
              <Alert id="two-factor-error" variant="destructive">
                {t(errorKey)}
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="two-factor-code">{t('auth.twoFactor.code')}</Label>
              <Input
                id="two-factor-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                aria-required="true"
                aria-invalid={errorKey !== null ? 'true' : 'false'}
                aria-describedby={errorKey !== null ? 'two-factor-error' : undefined}
              />
            </div>
            <Button type="submit" disabled={pending} aria-busy={pending} className="w-full mt-2">
              {t('auth.twoFactor.verify')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

function readField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function twoFactorErrorKey(error: unknown): TwoFactorErrorKey {
  if (error instanceof ApiError && error.status === 401) {
    return 'auth.twoFactor.invalidCode';
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    if (error.status === 401) {
      return 'auth.twoFactor.invalidCode';
    }
  }
  return 'auth.errors.request';
}
