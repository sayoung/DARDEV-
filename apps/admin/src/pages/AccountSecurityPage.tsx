import { Role, z, type MeResponse } from '@xplor/shared';
import QRCode from 'qrcode';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { beginTwoFactorSetup, confirmTwoFactor, disableTwoFactor } from '../api/two-factor.js';
import { useAuth } from '../auth/AuthProvider.js';
import { PageHeader } from '../components/PageHeader.js';
import { Alert } from '../components/ui/Alert.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Label } from '../components/ui/Label.js';

const ProfileWithTotpSchema = z.object({
  totpEnabled: z.boolean(),
});

function isTotpEnabledInProfile(profile: MeResponse): boolean {
  const result = ProfileWithTotpSchema.safeParse(profile);
  if (result.success) {
    return result.data.totpEnabled;
  }
  return false;
}

interface SetupData {
  readonly secret: string;
  readonly qrDataUrl: string;
}

export function AccountSecurityPage() {
  const { t } = useTranslation();
  const auth = useAuth();

  if (auth.state.status !== 'authenticated' || auth.state.profile.role !== Role.ADMIN) {
    return <p className="p-4">{t('auth.accessDenied')}</p>;
  }

  return <AccountSecurityContent profile={auth.state.profile} />;
}

function AccountSecurityContent({ profile }: { profile: MeResponse }) {
  const { t } = useTranslation();
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState<boolean>(() =>
    isTotpEnabledInProfile(profile),
  );
  const [setupState, setSetupState] = useState<SetupData | null>(null);
  const [confirmCode, setConfirmCode] = useState<string>('');
  const [disableCode, setDisableCode] = useState<string>('');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isDisabling, setIsDisabling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleBeginSetup(): Promise<void> {
    if (isActivating) {
      return;
    }
    setIsActivating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const setup = await beginTwoFactorSetup();
      const qrDataUrl = await QRCode.toDataURL(setup.otpauthUri);
      setSetupState({
        secret: setup.secret,
        qrDataUrl,
      });
      setConfirmCode('');
    } catch {
      setErrorMessage(t('page.accountSecurity.error'));
    } finally {
      setIsActivating(false);
    }
  }

  function handleCancelSetup(): void {
    setSetupState(null);
    setConfirmCode('');
    setErrorMessage(null);
  }

  async function handleConfirm(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isConfirming) {
      return;
    }
    const trimmed = confirmCode.trim();
    setIsConfirming(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await confirmTwoFactor(trimmed);
      setIsTwoFactorEnabled(true);
      setSetupState(null);
      setConfirmCode('');
      setSuccessMessage(t('page.accountSecurity.successEnabled'));
    } catch {
      setErrorMessage(t('auth.twoFactor.invalidCode'));
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleDisable(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isDisabling) {
      return;
    }
    const trimmed = disableCode.trim();
    setIsDisabling(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await disableTwoFactor(trimmed);
      setIsTwoFactorEnabled(false);
      setDisableCode('');
      setSuccessMessage(t('page.accountSecurity.successDisabled'));
    } catch {
      setErrorMessage(t('auth.twoFactor.invalidCode'));
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.accountSecurity.title')}
        subtitle={t('page.accountSecurity.subtitle')}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle id="two-factor-section-title">
                {t('page.accountSecurity.twoFactorTitle')}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('page.accountSecurity.twoFactorDescription')}
              </p>
            </div>
            <Badge variant={isTwoFactorEnabled ? 'default' : 'secondary'}>
              {isTwoFactorEnabled
                ? t('page.accountSecurity.statusEnabled')
                : t('page.accountSecurity.statusDisabled')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {successMessage !== null ? (
            <div
              role="status"
              className="p-4 rounded-md border border-border bg-card text-foreground font-medium"
            >
              {successMessage}
            </div>
          ) : null}

          {errorMessage !== null ? (
            <Alert id="account-security-error" variant="destructive">
              {errorMessage}
            </Alert>
          ) : null}

          {!isTwoFactorEnabled ? (
            <div>
              {setupState === null ? (
                <Button
                  type="button"
                  onClick={() => {
                    void handleBeginSetup();
                  }}
                  disabled={isActivating}
                  aria-busy={isActivating}
                >
                  {isActivating
                    ? t('page.accountSecurity.activating')
                    : t('auth.twoFactor.enable')}
                </Button>
              ) : (
                <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/30">
                  <h4 className="text-base font-semibold">
                    {t('page.accountSecurity.setupTitle')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('page.accountSecurity.setupInstructions')}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <img
                      src={setupState.qrDataUrl}
                      alt={t('page.accountSecurity.qrAlt')}
                      className="w-48 h-48 border border-border rounded-md bg-card p-2 shrink-0"
                    />

                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">
                          {t('page.accountSecurity.secretLabel')}
                        </span>
                        <code className="p-2.5 bg-muted rounded font-mono text-sm select-all break-all border border-border">
                          {setupState.secret}
                        </code>
                      </div>

                      <form
                        onSubmit={(event) => {
                          void handleConfirm(event);
                        }}
                        className="space-y-4"
                        aria-label={t('page.accountSecurity.setupTitle')}
                      >
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="confirm-code">{t('auth.twoFactor.code')}</Label>
                          <Input
                            id="confirm-code"
                            name="code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            autoComplete="one-time-code"
                            value={confirmCode}
                            onChange={(event) => {
                              setConfirmCode(event.target.value);
                              setErrorMessage(null);
                            }}
                            disabled={isConfirming}
                            aria-required="true"
                            aria-invalid={errorMessage !== null}
                            aria-describedby={
                              errorMessage !== null ? 'account-security-error' : undefined
                            }
                            placeholder="123456"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="submit"
                            disabled={isConfirming || confirmCode.trim().length === 0}
                            aria-busy={isConfirming}
                          >
                            {isConfirming
                              ? t('page.accountSecurity.confirming')
                              : t('page.accountSecurity.confirmButton')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelSetup}
                            disabled={isConfirming}
                          >
                            {t('page.accountSecurity.cancel')}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/30">
              <form
                onSubmit={(event) => {
                  void handleDisable(event);
                }}
                className="space-y-4 max-w-md"
                aria-label={t('page.accountSecurity.disableButton')}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="disable-code">{t('auth.twoFactor.code')}</Label>
                  <Input
                    id="disable-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={disableCode}
                    onChange={(event) => {
                      setDisableCode(event.target.value);
                      setErrorMessage(null);
                    }}
                    disabled={isDisabling}
                    aria-required="true"
                    aria-invalid={errorMessage !== null}
                    aria-describedby={
                      errorMessage !== null ? 'account-security-error' : undefined
                    }
                    placeholder="123456"
                  />
                </div>

                <div>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isDisabling || disableCode.trim().length === 0}
                    aria-busy={isDisabling}
                  >
                    {isDisabling
                      ? t('page.accountSecurity.disabling')
                      : t('page.accountSecurity.disableButton')}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
