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
  Badge,
} from "@mantine/core";
import { useMantineTheme, useMantineColorScheme } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TbArrowLeft, TbDatabase, TbServer, TbCloud } from "react-icons/tb";
import Meta from "../../../components/Meta";
import configService from "../../../services/config.service";
import { byteToHumanSizeString } from "../../../utils/fileSize.util";

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
  ssdSecurityThreshold?: number;
  storageStats?: {
    local: StorageDetail;
    buckets: BucketDetail[];
  };
}

const AdminAnalyticsAdvanced = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
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

  if (!stats.storageStats) {
    return (
      <Center style={{ height: "70vh" }}>
        <Text>Aucune statistique de stockage disponible.</Text>
      </Center>
    );
  }

  const localStats = stats.storageStats.local;
  const bucketsList = stats.storageStats.buckets || [];

  return (
    <>
      <Meta title="Détails de Stockage Avancés" />

      <Group justify="space-between" mb={20} align="center">
        <div>
          <Button
            component={Link}
            href="/admin/analytics"
            variant="subtle"
            leftSection={<TbArrowLeft size={16} />}
            size="xs"
            mb={10}
          >
            ← Retour aux statistiques générales
          </Button>
          <Title order={3}>
            Détails de Stockage Avancés (Multi-Tier)
          </Title>
          <Text size="sm" color="dimmed">
            Surveillance et diagnostic en temps réel de l'architecture de stockage en cascade.
          </Text>
        </div>
      </Group>

      <Stack gap="xl">
        {/* Hot SSD NVMe Local - Tier 1 */}
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
          <Group justify="space-between" mb="md">
            <div>
              <Group gap="xs">
                <TbServer size={22} color={theme.colors.blue[6]} />
                <Text size="md" fw={700}>
                  SSD Local (Hot - Tier 1)
                </Text>
                <Badge color="blue" variant="light">Local</Badge>
                {stats.disableLocalStorage && (
                  <Badge color="red" variant="filled">Désactivé</Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                {stats.disableLocalStorage
                  ? "Le stockage local est actuellement désactivé au profit du stockage cloud Multi-Tier."
                  : "Stockage local ultra-rapide utilisé pour les nouveaux partages, le cache chaud et les partages prioritaires."}
              </Text>
            </div>
            <Text size="xs" fw={700} color={localStats.free < 100 * 1024 * 1024 * 1024 ? "red" : "teal"}>
              {byteToHumanSizeString(localStats.free)} libre
            </Text>
          </Group>

          <Progress.Root size="xl" radius="xl" mb="md">
            <Progress.Section
              value={(localStats.consumed / localStats.total) * 100}
              color="blue"
              striped
              animated
            >
              <Progress.Label>Partages ({Math.round((localStats.consumed / localStats.total) * 100)}%)</Progress.Label>
            </Progress.Section>
            <Progress.Section
              value={(Math.max(0, localStats.used - localStats.consumed) / localStats.total) * 100}
              color="orange"
              striped
            >
              <Progress.Label>Système / Autre ({Math.round((Math.max(0, localStats.used - localStats.consumed) / localStats.total) * 100)}%)</Progress.Label>
            </Progress.Section>
            <Progress.Section
              value={(localStats.free / localStats.total) * 100}
              color="teal"
            >
              <Progress.Label>Libre ({Math.round((localStats.free / localStats.total) * 100)}%)</Progress.Label>
            </Progress.Section>
          </Progress.Root>

          <Grid mt={15}>
            <Grid.Col span={4}>
              <Text size="xs" c="dimmed">Taille Totale</Text>
              <Text size="sm" fw={600}>{byteToHumanSizeString(localStats.total)}</Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text size="xs" c="dimmed">Espace consommé</Text>
              <Text size="sm" fw={600} color="blue">{byteToHumanSizeString(localStats.consumed)}</Text>
            </Grid.Col>
            <Grid.Col span={4}>
              <Text size="xs" c="dimmed">Seuil de Sécurité SSD</Text>
              <Text size="sm" fw={600} color="red">
                {stats.ssdSecurityThreshold ? byteToHumanSizeString(stats.ssdSecurityThreshold) : "100 GB"} (Restant)
              </Text>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* MinIO LAN Cluster - Tier 2 */}
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
          <Group gap="xs" mb="sm">
            <TbDatabase size={22} color={theme.colors.teal[6]} />
            <Text size="md" fw={700}>
              MinIO LAN Cluster (Tier 2 - Warm Storage - RAID-0/1)
            </Text>
            <Badge color="teal" variant="light">MinIO</Badge>
          </Group>
          <Text size="xs" c="dimmed" mb="lg">
            Serveurs de stockage physiques secondaires en réseau local pour l'archivage, la répartition (sharding) et la réplication miroir.
          </Text>

          {bucketsList.filter((b) => b.type === "minio").length === 0 ? (
            <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
              Aucune instance MinIO locale/LAN configurée dans le Routage Multi-Buckets.
            </Text>
          ) : (
            <Stack gap="xl">
              {bucketsList.filter((b) => b.type === "minio").map((b) => (
                <div key={b.id} style={{ borderLeft: "3px solid #0ca678", paddingLeft: 16 }}>
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text size="sm" fw={600}>{b.name} ({b.id})</Text>
                      <Text size="xs" c="dimmed">
                        Serveur LAN physique pour partages délestés et stockage chaud/tiède.
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
                        <Progress.Label>Partages ({Math.round((b.consumed / b.total) * 100)}%)</Progress.Label>
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

                  <Grid mt={10}>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">Espace consommé</Text>
                      <Text size="sm" fw={600} color="blue">{byteToHumanSizeString(b.consumed)}</Text>
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <Text size="xs" c="dimmed">Seuil de Migration B2</Text>
                      <Text size="sm" fw={600} color="red">&lt; 1 TB restant</Text>
                    </Grid.Col>
                  </Grid>
                </div>
              ))}
            </Stack>
          )}
        </Paper>

        {/* Backblaze B2 Cloud - Tier 3 */}
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
          <Group gap="xs" mb="sm">
            <TbCloud size={22} color={theme.colors.indigo[6]} />
            <Text size="md" fw={700}>
              S3/B2 (Tier 3 - Cold Cascade Storage)
            </Text>
            <Badge color="indigo" variant="light">Cloud Distant (Cold)</Badge>
          </Group>
          <Text size="xs" c="dimmed" mb="lg">
            Stockage cloud objet hors-site résilient et hautement sécurisé pour la sauvegarde de partages archivés ou expirés.
          </Text>

          {bucketsList.filter((b) => b.type === "b2").length === 0 ? (
            <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
              Aucun stockage cloud Backblaze B2 configuré dans le Routage Multi-Buckets.
            </Text>
          ) : (
            <Grid gap="md">
              {bucketsList.filter((b) => b.type === "b2").map((b) => (
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
                        <Text size="sm" fw={600} color="indigo">{b.name} ({b.id})</Text>
                        <Text size="xs" c="dimmed" mt={2}>
                          Solution de délestage Cloud à capacité élastique et illimitée.
                        </Text>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Text size="xs" c="dimmed">Total Stocké</Text>
                        <Text size="lg" fw={800} color="indigo">{byteToHumanSizeString(b.consumed)}</Text>
                      </div>
                    </Group>
                  </Paper>
                </Grid.Col>
              ))}
            </Grid>
          )}
        </Paper>
      </Stack>
    </>
  );
};

export default AdminAnalyticsAdvanced;
