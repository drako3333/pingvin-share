import {
  Button,
  Badge,
  Card,
  Group,
  Loader,
  Space,
  Table,
  Text,
  TextInput,
  Title,
  Center,
} from "@mantine/core";
import {
  TbArrowLeft,
  TbSearch
} from "react-icons/tb";
import Link from "next/link";
import { useEffect, useState } from "react";
import Meta from "../../components/Meta";
import auditService, { AuditLog } from "../../services/audit.service";
import moment from "moment";

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    auditService
      .getAll()
      .then((res) => {
        setLogs(res);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const getBadgeColor = (action: string) => {
    switch (action) {
      case "CONNEXION":
        return "green";
      case "PARTAGE_CREE":
        return "blue";
      case "TELECHARGEMENT":
        return "teal";
      case "TELECHARGEMENT_ZIP":
        return "cyan";
      case "PARTAGE_SUPPRIME":
        return "orange";
      default:
        return "gray";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "CONNEXION":
        return "Connexion";
      case "PARTAGE_CREE":
        return "Partage créé";
      case "TELECHARGEMENT":
        return "Téléchargement";
      case "TELECHARGEMENT_ZIP":
        return "Téléchargement ZIP";
      case "PARTAGE_SUPPRIME":
        return "Partage supprimé";
      default:
        return action;
    }
  };

  const formatDetails = (action: string, detailsStr: string) => {
    try {
      const details = JSON.parse(detailsStr);
      switch (action) {
        case "CONNEXION":
          return `Connexion réussie pour l'utilisateur "${details.username}"`;
        case "PARTAGE_CREE":
          return `ID de partage: ${details.shareId} (${details.filesCount} fichier(s))`;
        case "TELECHARGEMENT": {
          const name = details.fileName?.split("/").pop() || "Fichier";
          return `Téléchargement du fichier "${name}"`;
        }
        case "TELECHARGEMENT_ZIP":
          return `Téléchargement de l'archive ZIP du partage "${details.shareId}"`;
        case "PARTAGE_SUPPRIME":
          return `Partage ID "${details.shareId}" supprimé`;
        default:
          return detailsStr;
      }
    } catch {
      return detailsStr;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const term = search.toLowerCase();
    const actionLabel = getActionLabel(log.action).toLowerCase();
    const detailsLabel = formatDetails(log.action, log.details).toLowerCase();
    const username = (log.username || "Anonyme").toLowerCase();
    const ip = log.ip.toLowerCase();
    const date = moment(log.createdAt).format("DD/MM/YYYY HH:mm:ss");

    return (
      actionLabel.includes(term) ||
      detailsLabel.includes(term) ||
      username.includes(term) ||
      ip.includes(term) ||
      date.includes(term)
    );
  });

  return (
    <>
      <Meta title="Journaux d'audit - Administration" />
      <Group position="apart" mb={20}>
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
          <Title order={3} mb={5}>
            Journaux d'audit du système
          </Title>
          <Text size="sm" color="dimmed">
            Historique complet des connexions, créations, téléchargements et suppressions.
          </Text>
        </div>
      </Group>

      <Card p="md" radius="md" withBorder mb={20}>
        <TextInput
          placeholder="Rechercher par utilisateur, IP, action, détails..."
          icon={<TbSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card radius="md" withBorder p={0} style={{ overflow: "auto" }}>
        {isLoading ? (
          <Center p={50}>
            <Loader size="md" />
          </Center>
        ) : filteredLogs.length === 0 ? (
          <Center p={50}>
            <Text color="dimmed">Aucune activité enregistrée.</Text>
          </Center>
        ) : (
          <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Action</th>
                <th>Utilisateur</th>
                <th>IP</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <Text size="sm" weight={500}>
                      {moment(log.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                    </Text>
                  </td>
                  <td>
                    <Badge color={getBadgeColor(log.action)} variant="light" size="md">
                      {getActionLabel(log.action)}
                    </Badge>
                  </td>
                  <td>
                    <Text size="sm" weight={log.username ? 600 : 400}>
                      {log.username || "Anonyme"}
                    </Text>
                  </td>
                  <td>
                    <Text size="sm" color="dimmed">
                      {log.ip}
                    </Text>
                  </td>
                  <td>
                    <Text size="sm" style={{ wordBreak: "break-all" }}>
                      {formatDetails(log.action, log.details)}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Space h="xl" />
    </>
  );
};

export default AuditLogs;
