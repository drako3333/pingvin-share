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
        {/* Section 1: Stockage Fusionné Multi-Tier */}
        {stats.storageStats ? (
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
            <Title order={4} mb="xs" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <TbDatabase size={22} color={theme.colors.blue[6]} />
              Architecture de Stockage Fusionnée Multi-Tier
            </Title>
            <Text size="xs" c="dimmed" mb="lg">
              Surveillance en temps réel du stockage en cascade (Local Hot SSD ➔ MinIO LAN Warm ➔ Cloud B2 Cold)
            </Text>

            <Stack gap="xl">
              {/* Hot Local SSD (Tier 1) */}
              <div>
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text size="sm" fw={700}>
                      {stats.storageStats.local.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      SSD NVMe local ultra-rapide pour partages éphémères et prioritaires
                    </Text>
                  </div>
                  <Text size="xs" fw={700} color={stats.storageStats.local.free < 100 * 1024 * 1024 * 1024 ? "red" : "teal"}>
                    {byteToHumanSizeString(stats.storageStats.local.free)} libre
                  </Text>
                </Group>

                <Progress.Root size="xl" radius="xl" mb="xs">
                  <Progress.Section
                    value={(stats.storageStats.local.consumed / stats.storageStats.local.total) * 100}
                    color="blue"
                    striped
                    animated
                  >
                    <Progress.Label>Ustro Share ({Math.round((stats.storageStats.local.consumed / stats.storageStats.local.total) * 100)}%)</Progress.Label>
                  </Progress.Section>
                  <Progress.Section
                    value={(Math.max(0, stats.storageStats.local.used - stats.storageStats.local.consumed) / stats.storageStats.local.total) * 100}
                    color="orange"
                    striped
                  >
                    <Progress.Label>Système / Autre ({Math.round((Math.max(0, stats.storageStats.local.used - stats.storageStats.local.consumed) / stats.storageStats.local.total) * 100)}%)</Progress.Label>
                  </Progress.Section>
                  <Progress.Section
                    value={(stats.storageStats.local.free / stats.storageStats.local.total) * 100}
                    color="teal"
                  >
                    <Progress.Label>Libre ({Math.round((stats.storageStats.local.free / stats.storageStats.local.total) * 100)}%)</Progress.Label>
                  </Progress.Section>
                </Progress.Root>
                
                <Grid mt={5}>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Taille Totale</Text>
                    <Text size="sm" fw={600}>{byteToHumanSizeString(stats.storageStats.local.total)}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Consommé Ustro Share</Text>
                    <Text size="sm" fw={600} color="blue">{byteToHumanSizeString(stats.storageStats.local.consumed)}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Seuil de Sécurité SSD</Text>
                    <Text size="sm" fw={600} color="red">100 GB (Restant)</Text>
                  </Grid.Col>
                </Grid>
              </div>

              {/* MinIO LAN sharding & selective replication (Tier 2 - Warm) */}
              {stats.storageStats.buckets.filter((b) => b.type === "minio").length > 0 && (
                <div>
                  <Text size="sm" fw={700} mb="xs">
                    MinIO LAN Cluster (Tier 2 - Warm Storage - RAID-0/1)
                  </Text>
                  <Stack gap="md">
                    {stats.storageStats.buckets.filter((b) => b.type === "minio").map((b) => (
                      <div key={b.id} style={{ borderLeft: "3px solid #228be6", paddingLeft: 12 }}>
                        <Group justify="space-between" mb="xs">
                          <div>
                            <Text size="sm" fw={600}>{b.name} (MinIO)</Text>
                            <Text size="xs" c="dimmed">
                              Serveur LAN de 24 TB physique pour sharding & miroir
                            </Text>
                          </div>
                          {b.free !== null && (
                            <Text size="xs" fw={700} color={b.free < 1024 * 1024 * 1024 * 1024 ? "red" : "teal"}>
                              {byteToHumanSizeString(b.free)} libre
                            </Text>
                          )}
                        </Group>

                        {b.total ? (
                          <Progress.Root size="lg" radius="xl" mb="xs">
                            <Progress.Section
                              value={(b.consumed / b.total) * 100}
                              color="blue"
                              striped
                              animated
                            >
                              <Progress.Label>Ustro Share ({Math.round((b.consumed / b.total) * 100)}%)</Progress.Label>
                            </Progress.Section>
                            <Progress.Section
                              value={(Math.max(0, (b.used ?? 0) - b.consumed) / b.total) * 100}
                              color="violet"
                              striped
                            >
                              <Progress.Label>Nextcloud / Privé ({Math.round((Math.max(0, (b.used ?? 0) - b.consumed) / b.total) * 100)}%)</Progress.Label>
                            </Progress.Section>
                            <Progress.Section
                              value={((b.free ?? 0) / b.total) * 100}
                              color="teal"
                            >
                              <Progress.Label>Libre ({Math.round(((b.free ?? 0) / b.total) * 100)}%)</Progress.Label>
                            </Progress.Section>
                          </Progress.Root>
                        ) : (
                          <Progress value={100} color="blue" size="sm" striped animated mb="xs" />
                        )}

                        <Grid>
                          <Grid.Col span={4}>
                            <Text size="xs" c="dimmed">Consommé Ustro Share</Text>
                            <Text size="sm" fw={600} color="blue">{byteToHumanSizeString(b.consumed)}</Text>
                          </Grid.Col>
                          <Grid.Col span={4}>
                            {b.total && (
                              <>
                                <Text size="xs" c="dimmed">Espace Nextcloud</Text>
                                <Text size="sm" fw={600} color="violet">{byteToHumanSizeString(Math.max(0, (b.used ?? 0) - b.consumed))}</Text>
                              </>
                            )}
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <Text size="xs" c="dimmed">Migration Cascade B2</Text>
                            <Text size="sm" fw={600} color="red">&lt; 1 TB restant</Text>
                          </Grid.Col>
                        </Grid>
                      </div>
                    ))}
                  </Stack>
                </div>
              )}

              {/* Cloud B2 (Tier 3 - Cold) */}
              {stats.storageStats.buckets.filter((b) => b.type === "b2").length > 0 && (
                <div>
                  <Text size="sm" fw={700} mb="xs">
                    Backblaze B2 Cloud (Tier 3 - Cold Cascade Storage)
                  </Text>
                  <Grid>
                    {stats.storageStats.buckets.filter((b) => b.type === "b2").map((b) => (
                      <Grid.Col key={b.id} span={12}>
                        <Paper
                          withBorder
                          p="md"
                          radius="md"
                          style={{
                            background: isDark ? "rgba(103, 114, 229, 0.05)" : "rgba(103, 114, 229, 0.02)",
                            borderColor: theme.colors.indigo[3],
                          }}
                        >
                          <Group justify="space-between">
                            <div>
                              <Text size="sm" fw={600} color="indigo">{b.name} (Backblaze B2)</Text>
                              <Text size="xs" c="dimmed">
                                Stockage Cloud externe illimité et sécurisé pour délestage dynamique
                              </Text>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <Text size="xs" c="dimmed">Total Consommé</Text>
                              <Text size="lg" fw={800} color="indigo">{byteToHumanSizeString(b.consumed)}</Text>
                            </div>
                          </Group>
                        </Paper>
                      </Grid.Col>
                    ))}
                  </Grid>
                </div>
              )}
            </Stack>
          </Paper>
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
