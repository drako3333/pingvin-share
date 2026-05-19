import {
  Button,
  Center,
  Col,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMantineTheme } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TbArrowLeft,
  TbDatabase,
  TbDownload,
  TbLink,
  TbUsers,
} from "react-icons/tb";
import Meta from "../../components/Meta";
import configService from "../../services/config.service";
import { byteToHumanSizeString } from "../../utils/fileSize.util";

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
}

const AdminAnalytics = () => {
  const theme = useMantineTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    configService
      .getAdminStats()
      .then(setStats)
      .catch(console.error);
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
      <Meta title="Statistiques & Analyses" />

      <Group position="apart" mb={20} align="center">
        <div>
          <Button
            component={Link}
            href="/admin"
            variant="subtle"
            leftIcon={<TbArrowLeft size={16} />}
            compact
            mb={10}
          >
            Retour à l'administration
          </Button>
          <Title order={3}>Statistiques & Analyses</Title>
          <Text size="sm" color="dimmed">
            Vue d'ensemble de l'activité de la plateforme, du stockage et du trafic.
          </Text>
        </div>
      </Group>

      <Stack spacing="lg">
        {/* Section 1: Stockage Disque */}
        {stats.diskTotal > 0 ? (
          <Paper withBorder p="xl" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
            <Group position="apart" mb="xs">
              <div>
                <Text size="sm" weight={700}>Stockage Disque du Système</Text>
                <Text size="xs" color="dimmed">Capacité physique de la partition de données</Text>
              </div>
              <Text size="sm" weight={700} color="teal">
                {Math.round((stats.diskFree / stats.diskTotal) * 100)}% Libre
              </Text>
            </Group>

            <Progress
              sections={[
                { value: (stats.diskUsed / stats.diskTotal) * 100, color: "blue", label: "Utilisé" },
                { value: (stats.diskFree / stats.diskTotal) * 100, color: "teal", label: "Libre" },
              ]}
              size="xl"
              radius="xl"
              striped
              animate
              mb="md"
            />

            <Grid>
              <Col span={4}>
                <Text size="xs" color="dimmed">Espace total</Text>
                <Text size="md" weight={700}>{byteToHumanSizeString(stats.diskTotal)}</Text>
              </Col>
              <Col span={4}>
                <Text size="xs" color="dimmed">Espace utilisé</Text>
                <Text size="md" weight={700} color="blue">{byteToHumanSizeString(stats.diskUsed)}</Text>
              </Col>
              <Col span={4}>
                <Text size="xs" color="dimmed">Espace libre</Text>
                <Text size="md" weight={700} color="teal">{byteToHumanSizeString(stats.diskFree)}</Text>
              </Col>
            </Grid>
          </Paper>
        ) : (
          <Paper withBorder p="xl" radius="lg" style={{ background: "rgba(255,255,255,0.01)" }}>
            <Group position="apart" mb="xs">
              <div>
                <Text size="sm" weight={700}>Volume de Stockage des Fichiers</Text>
                <Text size="xs" color="dimmed">Espace disque total consommé par les fichiers du site</Text>
              </div>
              <Text size="sm" weight={700} color="indigo">
                {stats.totalFiles} Fichiers
              </Text>
            </Group>

            <Progress
              value={100}
              color="indigo"
              size="xl"
              radius="xl"
              striped
              animate
              mb="md"
            />

            <Grid>
              <Col span={6}>
                <Text size="xs" color="dimmed">Espace consommé par les partages</Text>
                <Text size="md" weight={700} color="indigo">{byteToHumanSizeString(stats.totalSize)}</Text>
              </Col>
              <Col span={6}>
                <Text size="xs" color="dimmed">Taille moyenne d'un partage</Text>
                <Text size="md" weight={700}>{byteToHumanSizeString(stats.averageShareSize)}</Text>
              </Col>
            </Grid>
          </Paper>
        )}

        {/* Section 2: Chiffres clés en Grille */}
        <Grid gutter="md">
          {/* Card 1: Partages */}
          <Col xs={12} md={4}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group spacing="md" mb="md" noWrap>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(99, 102, 241, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.indigo[6]
                }}>
                  <TbLink size={22} />
                </div>
                <div>
                  <Text size="sm" weight={700}>Hébergement & Partages</Text>
                  <Text size="xs" color="dimmed">Vue d'ensemble des liens actifs</Text>
                </div>
              </Group>

              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" color="dimmed">Total des partages créés</Text>
                  <Text size="sm" weight={700}>{stats.totalShares}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Partages actuellement actifs</Text>
                  <Text size="sm" weight={700} color="teal">{stats.activeShares}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Partages ayant expiré</Text>
                  <Text size="sm" weight={700} color="red">{stats.expiredShares}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Nouveaux partages aujourd'hui</Text>
                  <Text size="sm" weight={700} color="indigo">{stats.sharesCreatedToday}</Text>
                </Group>
              </Stack>
            </Paper>
          </Col>

          {/* Card 2: Fichiers & Volume */}
          <Col xs={12} md={4}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group spacing="md" mb="md" noWrap>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(249, 115, 22, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.orange[6]
                }}>
                  <TbDatabase size={22} />
                </div>
                <div>
                  <Text size="sm" weight={700}>Données & Volume</Text>
                  <Text size="xs" color="dimmed">Poids et répartition des fichiers</Text>
                </div>
              </Group>

              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" color="dimmed">Fichiers totaux hébergés</Text>
                  <Text size="sm" weight={700}>{stats.totalFiles}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Volume total des fichiers</Text>
                  <Text size="sm" weight={700} color="orange">{byteToHumanSizeString(stats.totalSize)}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Taille moyenne par partage</Text>
                  <Text size="sm" weight={700}>{byteToHumanSizeString(stats.averageShareSize)}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Partages sécurisés (Password)</Text>
                  <Text size="sm" weight={700} color="blue">{stats.passwordProtectedShares}</Text>
                </Group>
              </Stack>
            </Paper>
          </Col>

          {/* Card 3: Utilisateurs & Activité */}
          <Col xs={12} md={4}>
            <Paper withBorder p="xl" radius="lg" style={{ height: "100%" }}>
              <Group spacing="md" mb="md" noWrap>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(34, 197, 94, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.colors.green[6]
                }}>
                  <TbUsers size={22} />
                </div>
                <div>
                  <Text size="sm" weight={700}>Membres & Trafic</Text>
                  <Text size="xs" color="dimmed">Tendance d'utilisation et visites</Text>
                </div>
              </Group>

              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" color="dimmed">Utilisateurs inscrits</Text>
                  <Text size="sm" weight={700}>{stats.totalUsers}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Téléchargements totaux</Text>
                  <Text size="sm" weight={700} color="green">{stats.totalDownloads}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Téléchargements aujourd'hui</Text>
                  <Text size="sm" weight={700} color="teal">{stats.downloadsToday}</Text>
                </Group>
                <Group position="apart">
                  <Text size="xs" color="dimmed">Ratio de téléchargement</Text>
                  <Text size="sm" weight={700}>
                    {stats.totalShares > 0 ? (stats.totalDownloads / stats.totalShares).toFixed(1) : 0} par partage
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Col>
        </Grid>
      </Stack>
    </>
  );
};

export default AdminAnalytics;
