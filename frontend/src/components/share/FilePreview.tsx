import {
  Button,
  Center,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
  Group,
  ActionIcon,
  Tooltip,
  Loader,
  Box,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import Markdown, { MarkdownToJSX } from "markdown-to-jsx";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import api from "../../services/api.service";
import mime from "mime-types";
import axios from "axios";
import shareService from "../../services/share.service";
import { FileMetaData } from "../../types/File.type";
import {
  TbChevronLeft,
  TbChevronRight,
  TbZoomIn,
  TbZoomOut,
  TbRefresh,
  TbPlayerPlay,
  TbPlayerPause,
  TbDownload,
} from "react-icons/tb";

import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-scss";

const getPrismLanguage = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "html":
      return "markup";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "json":
      return "json";
    case "py":
      return "python";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "cpp":
    case "c":
    case "h":
      return "clike";
    case "cs":
      return "csharp";
    case "sh":
    case "bash":
      return "bash";
    case "yml":
    case "yaml":
      return "yaml";
    case "xml":
      return "markup";
    case "sql":
      return "sql";
    default:
      return "markup";
  }
};

const FilePreview = ({
  shareId,
  files,
  initialFileId,
}: {
  shareId: string;
  files: FileMetaData[];
  initialFileId: string;
}) => {
  const [activeFileId, setActiveFileId] = useState(initialFileId);

  // Keep only previewable files
  const previewableFiles = files.filter((f) =>
    shareService.doesFileSupportPreview(f.name),
  );

  const currentIndex = previewableFiles.findIndex((f) => f.id === activeFileId);
  const currentFile = previewableFiles[currentIndex];

  const handlePrev = () => {
    if (currentIndex > 0) {
      setActiveFileId(previewableFiles[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < previewableFiles.length - 1) {
      setActiveFileId(previewableFiles[currentIndex + 1].id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, previewableFiles]);

  if (!currentFile) {
    return (
      <Center style={{ minHeight: 200 }}>
        <Text color="dimmed">Aucun fichier à prévisualiser.</Text>
      </Center>
    );
  }

  const mimeType = (mime.contentType(currentFile.name) || "").split(";")[0];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingLeft: "45px",
        paddingRight: "45px",
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4} style={{ wordBreak: "break-all" }}>
            {currentFile.name.split("/").pop()}
          </Title>
          <Text size="xs" color="dimmed">
            Format : {mimeType} • Index : {currentIndex + 1} /{" "}
            {previewableFiles.length}
          </Text>
        </div>
      </Group>

      {/* Preview decider */}
      <Box style={{ position: "relative", minHeight: "200px" }}>
        <FileDecider
          shareId={shareId}
          fileId={currentFile.id}
          mimeType={mimeType}
          fileName={currentFile.name}
        />
      </Box>

      {/* Navigation - Left */}
      {currentIndex > 0 && (
        <ActionIcon
          onClick={handlePrev}
          variant="filled"
          color="blue"
          radius="xl"
          size="lg"
          style={{
            position: "absolute",
            left: "0px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
          }}
        >
          <TbChevronLeft size={20} />
        </ActionIcon>
      )}

      {/* Navigation - Right */}
      {currentIndex < previewableFiles.length - 1 && (
        <ActionIcon
          onClick={handleNext}
          variant="filled"
          color="blue"
          radius="xl"
          size="lg"
          style={{
            position: "absolute",
            right: "0px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
          }}
        >
          <TbChevronRight size={20} />
        </ActionIcon>
      )}

      {/* Footer link */}
      <Center mt="md">
        <Button
          variant="subtle"
          component={Link}
          onClick={() => modals.closeAll()}
          target="_blank"
          href={`/api/shares/${shareId}/files/${currentFile.id}?download=false`}
          leftSection={<TbDownload size={16} />}
        >
          Voir le fichier original
        </Button>
      </Center>
    </div>
  );
};

const FileDecider = ({
  shareId,
  fileId,
  mimeType,
  fileName,
}: {
  shareId: string;
  fileId: string;
  mimeType: string;
  fileName: string;
}) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const codeExts = [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "py",
    "rs",
    "go",
    "cpp",
    "c",
    "h",
    "cs",
    "html",
    "css",
    "scss",
    "sh",
    "yml",
    "yaml",
    "xml",
    "sql",
    "md",
    "txt",
    "ini",
    "conf",
    "env",
  ];

  if (mimeType === "application/pdf") {
    return <PdfPreview shareId={shareId} fileId={fileId} />;
  } else if (mimeType.startsWith("video/")) {
    return <VideoPreview shareId={shareId} fileId={fileId} />;
  } else if (mimeType.startsWith("image/")) {
    return <ImagePreview shareId={shareId} fileId={fileId} />;
  } else if (mimeType.startsWith("audio/")) {
    return <AudioPreview shareId={shareId} fileId={fileId} />;
  } else if (
    mimeType.startsWith("text/") ||
    (ext && codeExts.includes(ext)) ||
    mimeType === "application/json" ||
    mimeType === "application/javascript"
  ) {
    return (
      <TextPreview shareId={shareId} fileId={fileId} fileName={fileName} />
    );
  } else {
    return <UnSupportedFile />;
  }
};

const ImagePreview = ({
  shareId,
  fileId,
}: {
  shareId: string;
  fileId: string;
}) => {
  const { colorScheme } = useMantineColorScheme();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Reset zoom when file changes
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [fileId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <Stack align="center" gap="xs">
      <Group gap="xs" justify="center">
        <Tooltip label="Zoomer">
          <ActionIcon onClick={zoomIn} variant="light" color="blue">
            <TbZoomIn size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Dézoomer">
          <ActionIcon onClick={zoomOut} variant="light" color="blue">
            <TbZoomOut size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Réinitialiser">
          <ActionIcon onClick={resetZoom} variant="light" color="gray">
            <TbRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <div
        style={{
          width: "100%",
          height: "60vh",
          overflow: "hidden",
          position: "relative",
          borderRadius: "8px",
          backgroundColor: colorScheme === "dark" ? "#1a1b1e" : "#f8f9fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={`/api/shares/${shareId}/files/${fileId}?download=false`}
          alt={`${fileId}_preview`}
          style={{
            maxHeight: "100%",
            maxWidth: "100%",
            objectFit: "contain",
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.2s ease",
            userSelect: "none",
            pointerEvents: scale > 1 ? "none" : "auto",
          }}
        />
      </div>
    </Stack>
  );
};

const VideoPreview = ({
  shareId,
  fileId,
}: {
  shareId: string;
  fileId: string;
}) => {
  return (
    <div
      style={{
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <video width="100%" controls style={{ display: "block" }}>
        <source src={`/api/shares/${shareId}/files/${fileId}?download=false`} />
      </video>
    </div>
  );
};

const PdfPreview = ({
  shareId,
  fileId,
}: {
  shareId: string;
  fileId: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
  }, [fileId]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "70vh",
        overflow: "hidden",
        borderRadius: "8px",
      }}
    >
      {isLoading && (
        <Center
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Stack align="center">
            <Loader size="xl" />
            <Text size="sm" color="dimmed">
              Chargement du document PDF...
            </Text>
          </Stack>
        </Center>
      )}
      <iframe
        src={`/api/shares/${shareId}/files/${fileId}?download=false`}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: isLoading ? "none" : "block",
        }}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
};

const AudioPreview = ({
  shareId,
  fileId,
}: {
  shareId: string;
  fileId: string;
}) => {
  const { colorScheme } = useMantineColorScheme();
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLoadingAudio(true);
    setAudioBuffer(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const url = `/api/shares/${shareId}/files/${fileId}?download=false`;

    axios
      .get(url, { responseType: "arraybuffer" })
      .then(async (res) => {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          setLoadingAudio(false);
          return;
        }
        const audioContext = new AudioCtx();
        const buffer = await audioContext.decodeAudioData(res.data);
        setAudioBuffer(buffer);
        setDuration(buffer.duration);
        setLoadingAudio(false);
      })
      .catch((err) => {
        console.error("Audio decoding failed", err);
        setLoadingAudio(false);
      });
  }, [shareId, fileId]);

  // Decode peaks
  const getPeaks = (buffer: AudioBuffer, count: number): number[] => {
    const step = Math.floor(buffer.length / count);
    const peaks: number[] = [];
    const chanData = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, buffer.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(chanData[j]);
        if (val > max) max = val;
      }
      peaks.push(max);
    }
    const maxPeak = Math.max(...peaks) || 1;
    return peaks.map((p) => Math.max(0.05, p / maxPeak));
  };

  // Draw Waveform
  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    const numBars = 75;
    const peaks = getPeaks(audioBuffer, numBars);
    const barWidth = (width / numBars) * 0.65;
    const barGap = (width / numBars) * 0.35;

    const progress = duration > 0 ? currentTime / duration : 0;
    const activeColor = colorScheme === "dark" ? "#228be6" : "#1971c2";
    const mutedColor = colorScheme === "dark" ? "#373a40" : "#dee2e6";

    for (let i = 0; i < numBars; i++) {
      const peak = peaks[i];
      const barHeight = peak * height * 0.85;
      const x = i * (barWidth + barGap);
      const y = (height - barHeight) / 2;

      const isPlayed = i / numBars <= progress;
      ctx.fillStyle = isPlayed ? activeColor : mutedColor;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 2);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
  }, [audioBuffer, currentTime, duration, colorScheme]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((e) => console.error("Playback failed", e));
      setIsPlaying(true);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !audioRef.current || duration === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetTime = percentage * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loadingAudio) {
    return (
      <Center style={{ minHeight: 200 }}>
        <Stack align="center" gap="xs">
          <Loader />
          <Text size="sm" color="dimmed">
            Décryptage des fréquences audio...
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Center style={{ minHeight: 200 }}>
      <Stack align="center" gap="md" style={{ width: "100%" }}>
        <audio
          ref={audioRef}
          src={`/api/shares/${shareId}/files/${fileId}?download=false`}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onDurationChange={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />

        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: "100%",
            height: "80px",
            cursor: "pointer",
            borderRadius: "6px",
          }}
        />

        <Group justify="space-between" style={{ width: "100%" }} px="xs">
          <ActionIcon
            onClick={togglePlay}
            variant="filled"
            color="blue"
            size="xl"
            radius="xl"
          >
            {isPlaying ? (
              <TbPlayerPause size={24} />
            ) : (
              <TbPlayerPlay size={24} />
            )}
          </ActionIcon>
          <Text size="sm" fw={600} color="dimmed">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </Group>
      </Stack>
    </Center>
  );
};

const TextPreview = ({
  shareId,
  fileId,
  fileName,
}: {
  shareId: string;
  fileId: string;
  fileName: string;
}) => {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const { colorScheme } = useMantineColorScheme();

  useEffect(() => {
    setLoading(true);
    api
      .get(`/shares/${shareId}/files/${fileId}?download=false`)
      .then((res) => {
        setText(
          typeof res.data === "object"
            ? JSON.stringify(res.data, null, 2)
            : (res.data ?? ""),
        );
        setLoading(false);
      })
      .catch(() => {
        setText("Le contenu n'a pas pu être chargé.");
        setLoading(false);
      });
  }, [shareId, fileId]);

  if (loading) {
    return (
      <Center style={{ minHeight: 200 }}>
        <Loader />
      </Center>
    );
  }

  const isMarkdown = fileName.endsWith(".md");

  if (isMarkdown) {
    const options: MarkdownToJSX.Options = {
      disableParsingRawHTML: true,
      overrides: {
        pre: {
          props: {
            style: {
              backgroundColor:
                colorScheme === "dark"
                  ? "rgba(50, 50, 50, 0.5)"
                  : "rgba(220, 220, 220, 0.5)",
              padding: "0.75em",
              whiteSpace: "pre-wrap",
            },
          },
        },
        table: {
          props: {
            className: "md",
          },
        },
      },
    };
    return <Markdown options={options}>{text}</Markdown>;
  }

  const lang = getPrismLanguage(fileName);
  const highlighted = Prism.highlight(
    text,
    Prism.languages[lang] || Prism.languages.markup,
    lang,
  );

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        code[class*="language-"], pre[class*="language-"] {
          font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
          font-size: 0.9rem;
          text-align: left;
          white-space: pre-wrap;
          word-spacing: normal;
          word-break: normal;
          word-wrap: normal;
          line-height: 1.5;
          tab-size: 4;
          hyphens: none;
          color: ${colorScheme === "dark" ? "#f8f9fa" : "#212529"};
        }
        pre[class*="language-"] {
          padding: 1em;
          margin: .5em 0;
          overflow: auto;
          border-radius: 8px;
          background: ${colorScheme === "dark" ? "#1a1b1e" : "#f8f9fa"} !important;
          border: 1px solid ${colorScheme === "dark" ? "#373a40" : "#e9ecef"};
        }
        .token.comment, .token.prolog, .token.doctype, .token.cdata {
          color: ${colorScheme === "dark" ? "#a6a7ab" : "#868e96"};
          font-style: italic;
        }
        .token.punctuation {
          color: ${colorScheme === "dark" ? "#ced4da" : "#495057"};
        }
        .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted {
          color: ${colorScheme === "dark" ? "#ff922b" : "#f76707"};
        }
        .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted {
          color: ${colorScheme === "dark" ? "#8ce99a" : "#2b8a3e"};
        }
        .token.operator, .token.entity, .token.url {
          color: ${colorScheme === "dark" ? "#ffd43b" : "#fab005"};
        }
        .token.atrule, .token.attr-value, .token.keyword {
          color: ${colorScheme === "dark" ? "#ff8787" : "#e03131"};
          font-weight: bold;
        }
        .token.function, .token.class-name {
          color: ${colorScheme === "dark" ? "#4dabf7" : "#1c7ed6"};
        }
        .token.regex, .token.important, .token.variable {
          color: ${colorScheme === "dark" ? "#da77f2" : "#ae3ec9"};
        }
      `,
        }}
      />
      <pre
        className={`language-${lang}`}
        style={{ maxHeight: "60vh", overflow: "auto" }}
      >
        <code
          className={`language-${lang}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </>
  );
};

const UnSupportedFile = () => {
  return (
    <Center style={{ minHeight: 200 }}>
      <Stack align="center" gap={10}>
        <Title order={3}>Format non pris en charge</Title>
        <Text>
          Ce format de fichier ne peut pas être prévisualisé en ligne.
        </Text>
      </Stack>
    </Center>
  );
};

export default FilePreview;
