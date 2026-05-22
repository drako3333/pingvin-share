import {
  Alert,
  Badge,
  Button,
  Center,
  Container,
  Group,
  Paper,
  PasswordInput,
  Progress,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, schemaResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { useEffect, useState } from "react";
import { TbAuth2Fa, TbBell, TbDatabase, TbAlertTriangle } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import * as yup from "yup";
import pushNotificationService from "../../services/pushNotification.service";
import Meta from "../../components/Meta";
import LanguagePicker from "../../components/account/LanguagePicker";
import ThemeSwitcher from "../../components/account/ThemeSwitcher";
import showEnableTotpModal from "../../components/account/showEnableTotpModal";
import useTranslate from "../../hooks/useTranslate.hook";
import useUser from "../../hooks/user.hook";
import useConfig from "../../hooks/config.hook";
import authService from "../../services/auth.service";
import userService from "../../services/user.service";
import { getOAuthIcon, getOAuthUrl, unlinkOAuth } from "../../utils/oauth.util";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import toast from "../../utils/toast.util";

// Helper to parse base64 VAPID keys
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PushNotificationSettings = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<string>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = useTranslate();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
          setLoading(false);
        }).catch(() => setLoading(false));
      }).catch(() => setLoading(false));
    } else {
      setIsSupported(false);
      setLoading(false);
    }
  }, []);

  const handleToggle = async () => {
    if (!isSupported || loading) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (isSubscribed) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await pushNotificationService.unsubscribe(subscription.endpoint);
        }
        setIsSubscribed(false);
        toast.success(t("account.card.security.push.notify.unsubscribed"));
      } else {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          toast.error(t("account.card.security.push.notify.permissionDenied"));
          setLoading(false);
          return;
        }

        const vapidKey = await pushNotificationService.getVapidPublicKey();
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("p256dh") as ArrayBuffer) as any));
        const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("auth") as ArrayBuffer) as any));

        await pushNotificationService.subscribe({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        });

        setIsSubscribed(true);
        toast.success(t("account.card.security.push.notify.subscribed"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("account.card.security.push.notify.error"));
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Text size="sm" color="dimmed" mt="xs">
        <FormattedMessage id="account.card.security.push.notSupported" />
      </Text>
    );
  }

  return (
    <Stack mt="xs">
      <Text size="sm" color="dimmed">
        <FormattedMessage id="account.card.security.push.description" />
      </Text>
      
      <Group justify="space-between" align="center" style={{ width: "100%" }} mt="sm">
        <div>
          <Text size="sm" fw={500}>
            <FormattedMessage id="account.card.security.push.label" />
          </Text>
          <Text size="xs" color="dimmed">
            {permission === "denied" ? (
              <span style={{ color: "var(--mantine-color-red-6)" }}>
                <FormattedMessage id="account.card.security.push.status.blocked" />
              </span>
            ) : isSubscribed ? (
              <span style={{ color: "var(--mantine-color-green-6)" }}>
                <FormattedMessage id="account.card.security.push.status.active" />
              </span>
            ) : (
              <FormattedMessage id="account.card.security.push.status.inactive" />
            )}
          </Text>
        </div>
        <Switch
          checked={isSubscribed}
          onChange={handleToggle}
          disabled={loading || permission === "denied"}
        />
      </Group>
    </Stack>
  );
};

const Account = () => {
  const [oauth, setOAuth] = useState<string[]>([]);
  const [oauthStatus, setOAuthStatus] = useState<Record<
    string,
    {
      provider: string;
      providerUsername: string;
    }
  > | null>(null);

  const { user, refreshUser } = useUser();
  const modals = useModals();
  const t = useTranslate();
  const config = useConfig();

  const defaultQuota = parseInt(config.get("share.defaultUserQuota") || "0");
  const effectiveQuota = user?.storageQuota && user.storageQuota > 0 ? user.storageQuota : defaultQuota;
  const storageUsed = user?.storageUsed || 0;
  const percentUsed = effectiveQuota > 0 ? Math.min(100, Math.round((storageUsed / effectiveQuota) * 100)) : 0;
  const progressColor = percentUsed >= 95 ? "red" : percentUsed >= 80 ? "orange" : "teal";

  const accountForm = useForm({
    initialValues: {
      username: user?.username,
      email: user?.email,
    },
    validate: schemaResolver(
      yup.object().shape({
        email: yup.string().email(t("common.error.invalid-email")),
        username: yup
          .string()
          .min(3, t("common.error.too-short", { length: 3 })),
      }),
    ),
  });

  const passwordForm = useForm({
    initialValues: {
      oldPassword: "",
      password: "",
    },
    validate: schemaResolver(
      yup.object().shape({
        oldPassword: yup.string().when([], {
          is: () => !!user?.hasPassword,
          then: (schema) =>
            schema
              .min(8, t("common.error.too-short", { length: 8 }))
              .required(t("common.error.field-required")),
          otherwise: (schema) => schema.notRequired(),
        }),
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .required(t("common.error.field-required")),
      }),
    ),
  });

  const enableTotpForm = useForm({
    initialValues: {
      password: "",
    },
    validate: schemaResolver(
      yup.object().shape({
        password: yup
          .string()
          .min(8, t("common.error.too-short", { length: 8 }))
          .required(t("common.error.field-required")),
      }),
    ),
  });

  const disableTotpForm = useForm({
    initialValues: {
      password: "",
      code: "",
    },
    validate: schemaResolver(
      yup.object().shape({
        password: yup.string().min(8),
        code: yup
          .string()
          .min(6, t("common.error.exact-length", { length: 6 }))
          .max(6, t("common.error.exact-length", { length: 6 }))
          .matches(/^[0-9]+$/, { message: t("common.error.invalid-number") }),
      }),
    ),
  });

  const refreshOAuthStatus = () => {
    authService
      .getOAuthStatus()
      .then((data) => {
        setOAuthStatus(data.data);
      })
      .catch(toast.axiosError);
  };

  useEffect(() => {
    authService
      .getAvailableOAuth()
      .then((data) => {
        setOAuth(data.data);
      })
      .catch(toast.axiosError);
    refreshOAuthStatus();
  }, []);

  return (
    <>
      <Meta title={t("account.title")} />
      <Container size="sm">
        <Title order={3} mb="xs">
          <FormattedMessage id="account.title" />
        </Title>

        {user && (
          <Paper withBorder p="xl" mb="lg">
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <TbDatabase size={20} style={{ color: "var(--mantine-color-blue-6)" }} />
                <Title order={5}>
                  <FormattedMessage id="account.storage.title" defaultMessage="Espace de stockage" />
                </Title>
              </Group>
              <Text size="sm" color="dimmed">
                {percentUsed}% <FormattedMessage id="account.storage.used" defaultMessage="utilisé" />
              </Text>
            </Group>

            {percentUsed >= 95 ? (
              <Alert
                color="red"
                variant="light"
                icon={<TbAlertTriangle size={20} />}
                title={t("account.storage.alert.critical.title", { defaultMessage: "Espace de stockage presque saturé !" })}
                mb="md"
                styles={{
                  root: {
                    borderLeft: "4px solid var(--mantine-color-red-6)",
                  },
                }}
              >
                <FormattedMessage id="account.storage.alert.critical.description" defaultMessage="Vous avez utilisé plus de 95% de votre quota de stockage. Libérez de l'espace ou contactez un administrateur." />
              </Alert>
            ) : percentUsed >= 80 ? (
              <Alert
                color="orange"
                variant="light"
                icon={<TbAlertTriangle size={20} />}
                title={t("account.storage.alert.warning.title", { defaultMessage: "Espace de stockage bientôt saturé" })}
                mb="md"
                styles={{
                  root: {
                    borderLeft: "4px solid var(--mantine-color-orange-6)",
                  },
                }}
              >
                <FormattedMessage id="account.storage.alert.warning.description" defaultMessage="Vous avez dépassé 80% de votre quota de stockage autorisé." />
              </Alert>
            ) : null}

            <Progress
              value={percentUsed}
              color={progressColor}
              size="md"
              radius="xl"
              striped
              animated={percentUsed >= 80}
              mb="xs"
            />

            <Group justify="space-between">
              <Text size="xs" color="dimmed">
                {byteToHumanSizeString(storageUsed)}
              </Text>
              <Text size="xs" color="dimmed">
                {byteToHumanSizeString(effectiveQuota)}
              </Text>
            </Group>
          </Paper>
        )}

        <Paper withBorder p="xl">
          <Title order={5} mb="xs">
            <FormattedMessage id="account.card.info.title" />
            {user?.isLdap ? (
              <Badge style={{ marginLeft: "1em" }}>LDAP</Badge>
            ) : null}
          </Title>
          <form
            onSubmit={accountForm.onSubmit((values) =>
              userService
                .updateCurrentUser({
                  username: values.username,
                  email: values.email,
                })
                .then(() => toast.success(t("account.notify.info.success")))
                .catch(toast.axiosError),
            )}
          >
            <Stack>
              <TextInput
                label={t("account.card.info.username")}
                disabled={user?.isLdap}
                {...accountForm.getInputProps("username")}
              />
              <TextInput
                label={t("account.card.info.email")}
                disabled={user?.isLdap}
                {...accountForm.getInputProps("email")}
              />
              {!user?.isLdap && (
                <Group justify="flex-end">
                  <Button type="submit">
                    <FormattedMessage id="common.button.save" />
                  </Button>
                </Group>
              )}
            </Stack>
          </form>
        </Paper>
        {user?.isLdap ? null : (
          <Paper withBorder p="xl" mt="lg">
            <Title order={5} mb="xs">
              <FormattedMessage id="account.card.password.title" />
            </Title>
            <form
              onSubmit={passwordForm.onSubmit((values) =>
                authService
                  .updatePassword(values.oldPassword, values.password)
                  .then(async () => {
                    refreshUser();
                    toast.success(t("account.notify.password.success"));
                    passwordForm.reset();
                  })
                  .catch(toast.axiosError),
              )}
            >
              <Stack>
                {user?.hasPassword ? (
                  <PasswordInput
                    label={t("account.card.password.old")}
                    {...passwordForm.getInputProps("oldPassword")}
                  />
                ) : (
                  <Text size="sm" color="dimmed">
                    <FormattedMessage id="account.card.password.noPasswordSet" />
                  </Text>
                )}
                <PasswordInput
                  label={t("account.card.password.new")}
                  {...passwordForm.getInputProps("password")}
                />
                <Group justify="flex-end">
                  <Button type="submit">
                    <FormattedMessage id="common.button.save" />
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        )}
        {oauth.length > 0 && (
          <Paper withBorder p="xl" mt="lg">
            <Title order={5} mb="xs">
              <FormattedMessage id="account.card.oauth.title" />
            </Title>

            <Tabs defaultValue={oauth[0] || ""}>
              <Tabs.List>
                {oauth.map((provider) => (
                  <Tabs.Tab
                    value={provider}
                    leftSection={getOAuthIcon(provider)}
                    key={provider}
                  >
                    {t(`account.card.oauth.${provider}`)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              {oauth.map((provider) => (
                <Tabs.Panel value={provider} pt="xs" key={provider}>
                  <Group justify="space-between">
                    <Text>
                      {oauthStatus?.[provider]
                        ? oauthStatus[provider].providerUsername
                        : t("account.card.oauth.unlinked")}
                    </Text>
                    {oauthStatus?.[provider] ? (
                      <Button
                        onClick={() => {
                          modals.openConfirmModal({
                            title: t("account.modal.unlink.title"),
                            children: (
                              <Text>
                                {t("account.modal.unlink.description")}
                              </Text>
                            ),
                            labels: {
                              confirm: t("account.card.oauth.unlink"),
                              cancel: t("common.button.cancel"),
                            },
                            confirmProps: { color: "red" },
                            onConfirm: () => {
                              unlinkOAuth(provider)
                                .then(() => {
                                  toast.success(
                                    t("account.notify.oauth.unlinked.success"),
                                  );
                                  refreshOAuthStatus();
                                })
                                .catch(toast.axiosError);
                            },
                          });
                        }}
                      >
                        {t("account.card.oauth.unlink")}
                      </Button>
                    ) : (
                      <Button
                        component="a"
                        href={getOAuthUrl(window.location.origin, provider)}
                      >
                        {t("account.card.oauth.link")}
                      </Button>
                    )}
                  </Group>
                </Tabs.Panel>
              ))}
            </Tabs>
          </Paper>
        )}
        <Paper withBorder p="xl" mt="lg">
          <Title order={5} mb="xs">
            <FormattedMessage id="account.card.security.title" />
          </Title>

          <Tabs defaultValue="totp">
            <Tabs.List>
              <Tabs.Tab value="totp" leftSection={<TbAuth2Fa size={14} />}>
                TOTP
              </Tabs.Tab>
              <Tabs.Tab value="push" leftSection={<TbBell size={14} />}>
                <FormattedMessage id="account.card.security.push.title" />
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="push" pt="xs">
              <PushNotificationSettings />
            </Tabs.Panel>

            <Tabs.Panel value="totp" pt="xs">
              {user?.totpVerified ? (
                <>
                  <form
                    onSubmit={disableTotpForm.onSubmit((values) => {
                      authService
                        .disableTOTP(values.code, values.password)
                        .then(() => {
                          toast.success(t("account.notify.totp.disable"));
                          values.password = "";
                          values.code = "";
                          refreshUser();
                        })
                        .catch(toast.axiosError);
                    })}
                  >
                    <Stack>
                      <PasswordInput
                        description={t(
                          "account.card.security.totp.disable.description",
                        )}
                        label={t("account.card.password.title")}
                        {...disableTotpForm.getInputProps("password")}
                      />

                      <TextInput
                        variant="filled"
                        label={t("account.modal.totp.code")}
                        placeholder="******"
                        {...disableTotpForm.getInputProps("code")}
                      />

                      <Group justify="flex-end">
                        <Button color="red" type="submit">
                          <FormattedMessage id="common.button.disable" />
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                </>
              ) : (
                <>
                  <form
                    onSubmit={enableTotpForm.onSubmit((values) => {
                      authService
                        .enableTOTP(values.password)
                        .then((result) => {
                          showEnableTotpModal(modals, refreshUser, {
                            qrCode: result.qrCode,
                            secret: result.totpSecret,
                            password: values.password,
                          });
                          values.password = "";
                        })
                        .catch(toast.axiosError);
                    })}
                  >
                    <Stack>
                      <PasswordInput
                        label={t("account.card.password.title")}
                        description={t(
                          "account.card.security.totp.enable.description",
                        )}
                        {...enableTotpForm.getInputProps("password")}
                      />
                      <Group justify="flex-end">
                        <Button type="submit">
                          <FormattedMessage id="account.card.security.totp.button.start" />
                        </Button>
                      </Group>
                    </Stack>
                  </form>
                </>
              )}
            </Tabs.Panel>
          </Tabs>
        </Paper>
        <Paper withBorder p="xl" mt="lg">
          <Title order={5} mb="xs">
            <FormattedMessage id="account.card.language.title" />
          </Title>
          <LanguagePicker />
        </Paper>
        <Paper withBorder p="xl" mt="lg">
          <Title order={5} mb="xs">
            <FormattedMessage id="account.card.color.title" />
          </Title>
          <ThemeSwitcher />
        </Paper>
        <Center mt={80} mb="lg">
          <Stack>
            <Button
              variant="light"
              color="red"
              onClick={() =>
                modals.openConfirmModal({
                  title: t("account.modal.delete.title"),
                  children: (
                    <Text size="sm">
                      <FormattedMessage id="account.modal.delete.description" />
                    </Text>
                  ),

                  labels: {
                    confirm: t("common.button.delete"),
                    cancel: t("common.button.cancel"),
                  },
                  confirmProps: { color: "red" },
                  onConfirm: async () => {
                    await userService
                      .removeCurrentUser()
                      .then(() => window.location.reload())
                      .catch(toast.axiosError);
                  },
                })
              }
            >
              <FormattedMessage id="account.button.delete" />
            </Button>
          </Stack>
        </Center>
      </Container>
    </>
  );
};

export default Account;
