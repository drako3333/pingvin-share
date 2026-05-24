import {
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
  Divider,
} from "@mantine/core";
import { useMantineTheme, useMantineColorScheme } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TbArrowLeft, TbDatabase, TbLink, TbUsers } from "react-icons/tb";
import { FormattedMessage } from "react-intl";
import Meta from "../../components/Meta";
import configService from "../../services/config.service";
import useTranslate from "../../hooks/useTranslate.hook";
import { byteToHumanSizeString } from "../../utils/fileSize.util";

interface StorageDetail {
  name: string;
  total: number;
  free: number;
  used: number;
  consumed: number;
}

interface BucketDetail {
  id: string;
  name: string;
  type: string;
  total: number | null;
  free: number | null;
  used: number | null;
  consumed: number;
}

interface AdminStats {
  totalShares: number;
  activeShares: number;
  expiredShares: number;
  sharesCreatedToday: number;
  totalUsers: number;
  totalFiles: number;
  totalSize: number;
  averageShareSize: number;
  passwordProtectedShares: number;
  totalDownloads: number;
  downloadsToday: number;
  diskTotal: number;
  diskFree: number;
  diskUsed: number;
  disableLocalStorage?: boolean;
  storageStats?: {
    local: StorageDetail;
    buckets: BucketDetail[];
  };
}

const AdminAnalytics = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const t = useTranslate();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    configService.getAdminStats().then(setStats).catch(console.error);
  }, []);

  if (!stats) {
    return (
      <Center style={{ height: "70vh" }}>
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <>
      <Meta title={t("analytics.title")} />

      <Group justify="space-between" mb={20} align="center">
        <div>
          <Button
            component={Link}
            href="/admin"
            variant="subtle"
            leftSection={<TbArrowLeft size={16} />}
            size="xs"
            mb={10}
          >
            <FormattedMessage id="analytics.back-to-admin" />
          </Button>
          <Title order={3}>
            <FormattedMessage id="analytics.title" />
          </Title>
          <Text size="sm" color="dimmed">
            <FormattedMessage id="analytics.subtitle" />
          </Text>
        </div>
      </Group>

      <Stack gap="lg">
        {stats.storageStats ? (
          (() => {
            const localStats = stats.storageStats.local;
            const bucketsList = stats.storageStats.buckets || [];

            let combinedTotal = localStats.total;
            let combinedConsumed = localStats.consumed;
            let combinedFree = localStats.free;

            for (const b of bucketsList) {
              if (b.total !== null) {
                combinedTotal += b.total;
              }
              combinedConsumed += b.consumed;
              if (b.free !== null) {
                combinedFree += b.free;
              }
            }

            const combinedUsed = combinedTotal - combinedFree;
            const otherSystemUsed = Math.max(0, combinedUsed - combinedConsumed);

            const consumedPercent = combinedTotal > 0 ? (combinedConsumed / combinedTotal) * 100 : 0;
            const otherPercent = combinedTotal > 0 ? (otherSystemUsed / combinedTotal) * 100 : 0;
            const freePercent = combinedTotal > 0 ? (combinedFree / combinedTotal) * 100 : 0;

            return (
              <Paper
                withBorder
                p="xl"
                radius="lg"
                style={{
                  background: isDark ? "rgba(26, 27, 30, 0.5)" : "rgba(255, 255, 255, 0.75)",
                  backdropFilter: "blur(12px)",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
                  <Title order={4} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <TbDatabase size={22} color={theme.colors.blue[6]} />
                    Architecture de Stockage Fusionnée
                  </Title>
                  <Button
                    component={Link}
                    href="/admin/analytics/advanced"
                    size="xs"
                    variant="light"
                  >
                    Voir les détails avancés (Multi-Tier) →
                  </Button>
                </Group>
                
                <Text size="xs" c="dimmed" mb="lg">
                  {stats.disableLocalStorage
                    ? "Capacité de stockage unifiée combinant vos serveurs MinIO (Warm) et vos Clouds B2 (Cold) (Stockage SSD Local désactivé)."
                    : "Capacité de stockage unifiée combinant votre SSD Local (Hot), vos serveurs MinIO (Warm) et vos Clouds B2 (Cold)."}
                </Text>

                <Stack gap="xl">
                  {/* Unified Progress Bar */}
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={700}>
                        Espace de Stockage Global
                      </Text>
                      <Text size="xs" fw={700} color={combinedFree < 100 * 1024 * 1024 * 1024 ? "red" : "teal"}>
                        {byteToHumanSizeString(combinedFree)} libre
                      </Text>
                    </Group>

                    <Progress.Root size="xl" radius="xl" mb="xs">
                      <Progress.Section
                        value={consumedPercent}
                        color="blue"
                        striped
                        animated
                      >
                        <Progress.Label>Partages ({Math.round(consumedPercent)}%)</Progress.Label>
                      </Progress.Section>
                      {otherPercent > 1 && (
                        <Progress.Section
                          value={otherPercent}
                          color="orange"
                          striped
                        >
                          <Progress.Label>Système / Autre ({Math.round(otherPercent)}%)</Progress.Label>
                        </Progress.Section>
                      )}
                      <Progress.Section
                        value={freePercent}
                        color="teal"
                      >
                        <Progress.Label>Libre ({Math.round(freePercent)}%)</Progress.Label>
                      </Progress.Section>
                    </Progress.Root>

                    <Grid mt={5}>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Taille Totale Combinée</Text>
                        <Text size="sm" fw={600}>{byteToHumanSizeString(combinedTotal)}</Text>
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Espace consommé</Text>
                        <Text size="sm" fw={600} color="blue">{byteToHumanSizeString(combinedConsumed)}</Text>
                      </Grid.Col>
                      <Grid.Col span={4}>
                        <Text size="xs" c="dimmed">Espace Libre Restant</Text>
                        <Text size="sm" fw={600} color="teal">{byteToHumanSizeString(combinedFree)}</Text>
                      </Grid.Col>
                    </Grid>
                  </div>
                </Stack>
              </Paper>
            );
          })()
        ) : stats.diskTotal > 0 ? (
          <Paper
            withBorder
            p="xl"
            radius="lg"
            style={{ background: "rgba(255,255,255,0.01)" }}
          >
            <Group justify="space-between" mb="xs">
              <div>
                <Text size="sm" fw={700}>
                  <FormattedMessage id="analytics.disk.title" />
                </Text>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.subtitle" />
                </Text>
              </div>
              <Text size="sm" fw={700} color="teal">
                <FormattedMessage
                  id="analytics.disk.free"
                  values={{
                    percentage: Math.round(
                      (stats.diskFree / stats.diskTotal) * 100,
                    ),
                  }}
                />
              </Text>
            </Group>

            <Progress.Root size="xl" radius="xl" mb="md">
              <Progress.Section
                value={(stats.diskUsed / stats.diskTotal) * 100}
                color="blue"
                striped
                animated
              >
                <Progress.Label>
                  {t("analytics.disk.used-label")}
                </Progress.Label>
              </Progress.Section>
              <Progress.Section
                value={(stats.diskFree / stats.diskTotal) * 100}
                color="teal"
                striped
                animated
              >
                <Progress.Label>
                  {t("analytics.disk.free-label")}
                </Progress.Label>
              </Progress.Section>
            </Progress.Root>

            <Grid>
              <Grid.Col span={4}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.total-space" />
                </Text>
                <Text size="md" fw={700}>
                  {byteToHumanSizeString(stats.diskTotal)}
                </Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.used-space" />
                </Text>
                <Text size="md" fw={700} color="blue">
                  {byteToHumanSizeString(stats.diskUsed)}
                </Text>
              </Grid.Col>
              <Grid.Col span={4}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.disk.free-space" />
                </Text>
                <Text size="md" fw={700} color="teal">
                  {byteToHumanSizeString(stats.diskFree)}
                </Text>
              </Grid.Col>
            </Grid>
          </Paper>
        ) : (
          <Paper
            withBorder
            p="xl"
            radius="lg"
            style={{ background: "rgba(255,255,255,0.01)" }}
          >
            <Group justify="space-between" mb="xs">
              <div>
                <Text size="sm" fw={700}>
                  <FormattedMessage id="analytics.storage.title" />
                </Text>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.storage.subtitle" />
                </Text>
              </div>
              <Text size="sm" fw={700} color="indigo">
                <FormattedMessage
                  id="analytics.storage.files"
                  values={{ count: stats.totalFiles }}
                />
              </Text>
            </Group>

            <Progress
              value={100}
              color="indigo"
              size="xl"
              radius="xl"
              striped
              animated
              mb="md"
            />

            <Grid>
              <Grid.Col span={6}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.storage.consumed" />
                </Text>
                <Text size="md" fw={700} color="indigo">
                  {byteToHumanSizeString(stats.totalSize)}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="xs" color="dimmed">
                  <FormattedMessage id="analytics.storage.average" />
                </Text>
                <Text size="md" fw={700}>
                  {byteToHumanSizeString(stats.averageShareSize)}
                </Text>
              </Grid.Col>
            </Grid>
          </Paper>
        )}

        {/* Section 2: Chiffres clés en Grille */}
        <Grid gap="md">
          {/* Card 1: Partages */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group gap="md" mb="md" wrap="nowrap">
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(99, 102, 241, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.colors.indigo[6],
                  }}
                >
                  <TbLink size={22} />
                </div>
                <div>
                  <Text size="sm" fw={700}>
                    <FormattedMessage id="analytics.card.hosting.title" />
                  </Text>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.subtitle" />
                  </Text>
                </div>
              </Group>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.total" />
                  </Text>
                  <Text size="sm" fw={700}>
                    {stats.totalShares}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.active" />
                  </Text>
                  <Text size="sm" fw={700} color="teal">
                    {stats.activeShares}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.expired" />
                  </Text>
                  <Text size="sm" fw={700} color="red">
                    {stats.expiredShares}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.hosting.today" />
                  </Text>
                  <Text size="sm" fw={700} color="indigo">
                    {stats.sharesCreatedToday}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Card 2: Fichiers & Volume */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group gap="md" mb="md" wrap="nowrap">
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(249, 115, 22, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.colors.orange[6],
                  }}
                >
                  <TbDatabase size={22} />
                </div>
                <div>
                  <Text size="sm" fw={700}>
                    <FormattedMessage id="analytics.card.data.title" />
                  </Text>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.subtitle" />
                  </Text>
                </div>
              </Group>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.total-files" />
                  </Text>
                  <Text size="sm" fw={700}>
                    {stats.totalFiles}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.total-size" />
                  </Text>
                  <Text size="sm" fw={700} color="orange">
                    {byteToHumanSizeString(stats.totalSize)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.average-size" />
                  </Text>
                  <Text size="sm" fw={700}>
                    {byteToHumanSizeString(stats.averageShareSize)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.data.password" />
                  </Text>
                  <Text size="sm" fw={700} color="blue">
                    {stats.passwordProtectedShares}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Card 3: Utilisateurs & Activité */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group gap="md" mb="md" wrap="nowrap">
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(34, 197, 94, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.colors.green[6],
                  }}
                >
                  <TbUsers size={22} />
                </div>
                <div>
                  <Text size="sm" fw={700}>
                    <FormattedMessage id="analytics.card.members.title" />
                  </Text>
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.subtitle" />
                  </Text>
                </div>
              </Group>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.users" />
                  </Text>
                  <Text size="sm" fw={700}>
                    {stats.totalUsers}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.downloads" />
                  </Text>
                  <Text size="sm" fw={700} color="green">
                    {stats.totalDownloads}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.downloads-today" />
                  </Text>
                  <Text size="sm" fw={700} color="teal">
                    {stats.downloadsToday}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" color="dimmed">
                    <FormattedMessage id="analytics.card.members.ratio" />
                  </Text>
                  <Text size="sm" fw={700}>
                    <FormattedMessage
                      id="analytics.card.members.ratio-value"
                      values={{
                        ratio:
                          stats.totalShares > 0
                            ? (
                                stats.totalDownloads / stats.totalShares
                              ).toFixed(1)
                            : 0,
                      }}
                    />
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>
      </Stack>
    </>
  );
};

export default AdminAnalytics;
