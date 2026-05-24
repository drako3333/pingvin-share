import {
  Card,
  Group,
  Text,
  Badge,
  Progress,
  Stack,
  TextInput,
  Select,
  Button,
  Paper,
  Title,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  TbBroadcast,
  TbUpload,
  TbDownload,
  TbShield,
  TbUserCheck,
  TbUserX,
  TbSearch,
  TbTrash,
  TbDatabase,
  TbTerminal,
} from "react-icons/tb";
import api from "../../services/api.service";
import { byteToHumanSizeString } from "../../utils/fileSize.util";
import moment from "moment";

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: "upload-progress" | "download" | "auth" | "security-alert";
  data: any;
}

export default function LiveActivityFeed() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    // 1. Fetch historical recent events
    api.get("/activity/recent")
      .then((res) => {
        setEvents(res.data);
      })
      .catch((err) => {
        console.error("Failed to load historical activity logs", err);
      });

    // 2. Establish persistent Server-Sent Events stream connection
    const sse = new EventSource("/api/activity/stream", { withCredentials: true });

    sse.onopen = () => {
      setConnected(true);
    };

    sse.onerror = () => {
      setConnected(false);
    };

    sse.onmessage = (e) => {
      try {
        const newEvent = JSON.parse(e.data) as ActivityEvent;
        setEvents((prev) => {
          // If it is upload progress, update the existing file progress card in place to prevent layout spam
          if (newEvent.type === "upload-progress") {
            const index = prev.findIndex(
              (x) => x.type === "upload-progress" && x.data.fileId === newEvent.data.fileId
            );
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = newEvent;
              return updated;
            }
          }

          // Otherwise, insert new event at front and truncate to maximum buffer of 50
          const updated = [newEvent, ...prev];
          if (updated.length > 50) {
            updated.pop();
          }
          return updated;
        });
      } catch (err) {
        console.error("Error parsing live feed event", err);
      }
    };

    return () => {
      sse.close();
    };
  }, []);

  const handleClear = () => {
    setEvents([]);
  };

  const filteredEvents = events.filter((event) => {
    // 1. Apply type filter
    if (typeFilter !== "all" && event.type !== typeFilter) {
      return false;
    }

    // 2. Apply search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      const matchText = (text?: string) => text?.toLowerCase().includes(query);

      const fileMatch = matchText(event.data.fileName);
      const userMatch = matchText(event.data.username);
      const ipMatch = matchText(event.data.ip);
      const targetMatch = matchText(event.data.target);
      const typeMatch = matchText(event.type);

      return fileMatch || userMatch || ipMatch || targetMatch || typeMatch;
    }

    return true;
  });

  return (
    <Paper p="md" radius="md" style={{ border: "1px solid rgba(148, 163, 184, 0.12)" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes live-pulse {
          0% { transform: scale(0.9); opacity: 0.4; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.4; }
        }
        @keyframes redBorderPulse {
          0% { border-color: rgba(224, 49, 49, 0.3); box-shadow: 0 0 0 0 rgba(224, 49, 49, 0.1); }
          50% { border-color: rgba(224, 49, 49, 0.85); box-shadow: 0 0 8px 2px rgba(224, 49, 49, 0.15); }
          100% { border-color: rgba(224, 49, 49, 0.3); box-shadow: 0 0 0 0 rgba(224, 49, 49, 0.1); }
        }
        .live-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
        }
        .live-pulse-dot.online {
          background-color: #40c057;
          animation: live-pulse 2s infinite ease-in-out;
        }
        .live-pulse-dot.offline {
          background-color: #f76707;
          animation: live-pulse 1s infinite ease-in-out;
        }
        .security-pulse-card {
          animation: redBorderPulse 2.5s infinite ease-in-out;
          background-color: ${isDark ? "rgba(224, 49, 49, 0.04) !important" : "rgba(224, 49, 49, 0.02) !important"};
        }
        .activity-card-entrance {
          animation: cardEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      ` }} />

      {/* Header */}
      <Group justify="space-between" mb="md" align="center">
        <Group gap="xs">
          <TbBroadcast size={24} style={{ color: connected ? "#40c057" : "#f76707" }} />
          <div>
            <Title order={4} style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              Flux d'Activité en Direct
            </Title>
            <Text size="xs" c="dimmed">
              Événements de l'instance capturés en temps réel via SSE
            </Text>
          </div>
        </Group>

        <Badge
          color={connected ? "green" : "orange"}
          variant="light"
          p="sm"
          style={{ display: "flex", alignItems: "center" }}
        >
          <span className={`live-pulse-dot ${connected ? "online" : "offline"}`} />
          {connected ? "Live Connecté" : "Reconnexion..."}
        </Badge>
      </Group>

      {/* Filters Toolbar */}
      <Group mb="md" grow style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <TextInput
          placeholder="Rechercher fichier, utilisateur, IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<TbSearch size={16} />}
          style={{ flex: 2, minWidth: "220px" }}
        />

        <Select
          value={typeFilter}
          onChange={(val) => setTypeFilter(val || "all")}
          placeholder="Tous les types"
          style={{ flex: 1, minWidth: "150px" }}
          data={[
            { value: "all", label: "Tous les événements" },
            { value: "upload-progress", label: "Téléversements" },
            { value: "download", label: "Téléchargements" },
            { value: "auth", label: "Connexions" },
            { value: "security-alert", label: "Alerte Sécurité" },
          ]}
        />

        <Button
          variant="default"
          leftSection={<TbTrash size={16} />}
          onClick={handleClear}
          style={{ flex: 0, minWidth: "110px" }}
        >
          Vider
        </Button>
      </Group>

      {/* Live Feed Container */}
      <Stack gap="sm" style={{ maxHeight: "550px", overflowY: "auto", paddingRight: "4px" }}>
        {filteredEvents.length === 0 ? (
          <Paper
            p="xl"
            radius="md"
            style={{
              textAlign: "center",
              backgroundColor: isDark ? "rgba(13, 15, 23, 0.4)" : "rgba(0, 0, 0, 0.01)",
              border: "1px dashed rgba(148, 163, 184, 0.2)",
            }}
          >
            <TbTerminal size={32} style={{ color: "#8b949e", marginBottom: "8px" }} />
            <Text c="dimmed" size="sm">
              Aucune activité capturée. Les événements apparaîtront dès qu'un utilisateur interagira avec l'instance.
            </Text>
          </Paper>
        ) : (
          filteredEvents.map((event) => {
            const timeStr = moment(event.timestamp).format("HH:mm:ss");
            const relativeTime = moment(event.timestamp).fromNow();

            switch (event.type) {
              case "upload-progress": {
                const { fileName, username, progress, size } = event.data;
                const progressNum = Number(progress);
                const isComplete = progressNum >= 100;

                return (
                  <Card
                    key={event.id}
                    p="sm"
                    radius="md"
                    className="activity-card-entrance"
                    style={{
                      borderLeft: "4px solid #40c057",
                      backgroundColor: isDark ? "rgba(13, 15, 23, 0.6)" : "#ffffff",
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <TbUpload size={18} style={{ color: "#40c057" }} />
                        <Text size="sm" fw={600}>
                          {isComplete ? "Téléversement complété" : "Téléversement en cours"}
                        </Text>
                        <Badge size="xs" color="gray" variant="outline">
                          {username}
                        </Badge>
                      </Group>
                      <Tooltip label={relativeTime} position="top">
                        <Text size="xs" c="dimmed" style={{ fontFamily: "JetBrains Mono" }}>
                          {timeStr}
                        </Text>
                      </Tooltip>
                    </Group>

                    <Text size="sm" lineClamp={1} fw={500} mb="xs">
                      {fileName}
                    </Text>

                    <Group gap="sm" mb="xs" align="center">
                      <Progress
                        value={progressNum}
                        color={isComplete ? "green" : "teal"}
                        size="sm"
                        striped={!isComplete}
                        animated={!isComplete}
                        style={{ flex: 1 }}
                      />
                      <Text size="xs" fw={700} style={{ width: "35px", textAlign: "right" }}>
                        {progressNum}%
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        Taille : {size ? byteToHumanSizeString(Number(size)) : "Inconnue"}
                      </Text>
                      {isComplete && (
                        <Badge size="xs" color="green" variant="filled">
                          Succès
                        </Badge>
                      )}
                    </Group>
                  </Card>
                );
              }

              case "download": {
                const { fileName, username, ip, fileId } = event.data;
                const isZip = fileId === "ZIP";

                return (
                  <Card
                    key={event.id}
                    p="sm"
                    radius="md"
                    className="activity-card-entrance"
                    style={{
                      borderLeft: "4px solid #228be6",
                      backgroundColor: isDark ? "rgba(13, 15, 23, 0.6)" : "#ffffff",
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <TbDownload size={18} style={{ color: "#228be6" }} />
                        <Text size="sm" fw={600}>
                          {isZip ? "Archive ZIP téléchargée" : "Fichier téléchargé"}
                        </Text>
                        <Badge size="xs" color="blue" variant="light">
                          {username}
                        </Badge>
                      </Group>
                      <Tooltip label={relativeTime} position="top">
                        <Text size="xs" c="dimmed" style={{ fontFamily: "JetBrains Mono" }}>
                          {timeStr}
                        </Text>
                      </Tooltip>
                    </Group>

                    <Text size="sm" lineClamp={1} fw={500} mb="xs">
                      {fileName}
                    </Text>

                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" style={{ fontFamily: "JetBrains Mono" }}>
                        IP : {ip || "Inconnue"}
                      </Text>
                      <Badge size="xs" color="blue">
                        {isZip ? "ZIP Archive" : "Fichier"}
                      </Badge>
                    </Group>
                  </Card>
                );
              }

              case "auth": {
                const { action, username, ip, success } = event.data;
                const isLogin = action === "login";

                return (
                  <Card
                    key={event.id}
                    p="sm"
                    radius="md"
                    className="activity-card-entrance"
                    style={{
                      borderLeft: `4px solid ${isLogin ? "#7950f2" : "#be4bdb"}`,
                      backgroundColor: isDark ? "rgba(13, 15, 23, 0.6)" : "#ffffff",
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        {isLogin ? (
                          <TbUserCheck size={18} style={{ color: "#7950f2" }} />
                        ) : (
                          <TbUserX size={18} style={{ color: "#be4bdb" }} />
                        )}
                        <Text size="sm" fw={600}>
                          {isLogin ? "Connexion utilisateur" : "Déconnexion"}
                        </Text>
                        <Badge size="xs" color={isLogin ? "indigo" : "grape"} variant="light">
                          {username}
                        </Badge>
                      </Group>
                      <Tooltip label={relativeTime} position="top">
                        <Text size="xs" c="dimmed" style={{ fontFamily: "JetBrains Mono" }}>
                          {timeStr}
                        </Text>
                      </Tooltip>
                    </Group>

                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" style={{ fontFamily: "JetBrains Mono" }}>
                        IP : {ip || "N/A"}
                      </Text>
                      <Badge size="xs" color={success ? "green" : "red"} variant="outline">
                        {success ? "Réussite" : "Échec"}
                      </Badge>
                    </Group>
                  </Card>
                );
              }

              case "security-alert": {
                const { alertType, ip, target } = event.data;
                const isFailedLogin = alertType === "failed-login";

                return (
                  <Card
                    key={event.id}
                    p="sm"
                    radius="md"
                    className="activity-card-entrance security-pulse-card"
                    style={{
                      borderLeft: "4px solid #e03131",
                    }}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <TbShield size={18} style={{ color: "#e03131" }} />
                        <Text size="sm" fw={700} style={{ color: "#e03131" }}>
                          ALERTE SÉCURITÉ
                        </Text>
                        <Badge size="xs" color="red" variant="filled">
                          {isFailedLogin ? "Login Échoué" : "Share Password Échoué"}
                        </Badge>
                      </Group>
                      <Tooltip label={relativeTime} position="top">
                        <Text size="xs" c="dimmed" style={{ fontFamily: "JetBrains Mono" }}>
                          {timeStr}
                        </Text>
                      </Tooltip>
                    </Group>

                    <Text size="sm" mb="xs">
                      {isFailedLogin ? (
                        <>
                          Tentative de connexion refusée pour l'utilisateur{" "}
                          <Text component="span" fw={700} style={{ fontFamily: "JetBrains Mono" }}>
                            "{target}"
                          </Text>
                        </>
                      ) : (
                        <>
                          Mot de passe incorrect entré sur le partage sécurisé{" "}
                          <Text component="span" fw={700} style={{ fontFamily: "JetBrains Mono" }}>
                            "{target}"
                          </Text>
                        </>
                      )}
                    </Text>

                    <Group justify="space-between">
                      <Text size="xs" style={{ fontFamily: "JetBrains Mono", color: "#e03131" }} fw={600}>
                        IP Source : {ip || "Inconnue"}
                      </Text>
                      <Badge size="xs" color="red" variant="light" style={{ animation: "live-pulse 1s infinite" }}>
                        Intrus Suspect
                      </Badge>
                    </Group>
                  </Card>
                );
              }

              default:
                return null;
            }
          })
        )}
      </Stack>
    </Paper>
  );
}
