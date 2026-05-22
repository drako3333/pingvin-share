import {
  Button,
  Stack,
  Text,
  Center,
  Group,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useModals } from "@mantine/modals";
import { ModalsContextProps } from "@mantine/modals/lib/context";
import moment from "moment";
import { useRouter } from "next/router";
import { FormattedMessage } from "react-intl";
import useTranslate, {
  translateOutsideContext,
} from "../../../hooks/useTranslate.hook";
import { CompletedShare } from "../../../types/share.type";
import CopyTextField from "../CopyTextField";
import { useEffect, useRef } from "react";
import {
  TbBrandWhatsapp,
  TbBrandTelegram,
  TbMail,
  TbDownload,
} from "react-icons/tb";

const showCompletedUploadModal = (
  modals: ModalsContextProps,
  share: CompletedShare,
) => {
  const t = translateOutsideContext();
  return modals.openModal({
    closeOnClickOutside: false,
    withCloseButton: false,
    closeOnEscape: false,
    title: t("upload.modal.completed.share-ready"),
    children: <Body share={share} />,
  });
};

const Body = ({ share }: { share: CompletedShare }) => {
  const modals = useModals();
  const router = useRouter();
  const t = useTranslate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isReverseShare = !!router.query["reverseShareToken"];
  const link = `${window.location.origin}/s/${share.id}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 512, 512);

    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.src = `/api/shares/${share.id}/qrcode`;

    qrImg.onload = () => {
      // Draw background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);

      // Draw QR Code SVG
      const padding = 24;
      ctx.drawImage(
        qrImg,
        padding,
        padding,
        512 - padding * 2,
        512 - padding * 2,
      );

      // Draw Ustrohosting logo container in the center
      const logoSize = 110;
      const logoX = (512 - logoSize) / 2;
      const logoY = (512 - logoSize) / 2;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(logoX - 10, logoY - 10, logoSize + 20, logoSize + 20, 20);
      ctx.fill();

      // Load Ustrohosting logo PNG
      const logoImg = new Image();
      logoImg.src = `/img/logo.png?v=${Date.now()}`;
      logoImg.onload = () => {
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      };

      logoImg.onerror = () => {
        // Draw elegant vector fallback in case image fails to load
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const scale = logoSize / 24;
        ctx.save();
        ctx.translate(logoX, logoY);
        ctx.scale(scale, scale);

        const p1 = new Path2D("M12 2L2 7l10 5 10-5-10-5z");
        ctx.stroke(p1);

        const p2 = new Path2D("M2 17l10 5 10-5");
        ctx.stroke(p2);

        const p3 = new Path2D("M2 12l10 5 10-5");
        ctx.stroke(p3);

        ctx.restore();
      };
    };
  }, [share.id]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qrcode-${share.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Voici un fichier partagé avec vous : ${link}`,
  )}`;

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(
    "Voici un fichier partagé avec vous",
  )}`;

  const emailUrl = `mailto:?subject=${encodeURIComponent(
    t("upload.modal.completed.share-title-email"),
  )}&body=${encodeURIComponent(
    t("upload.modal.completed.share-body-email", { link }),
  )}`;

  return (
    <Stack align="stretch" gap="md">
      <CopyTextField link={link} />

      {/* Premium custom QR Code Container */}
      <Center my="xs">
        <div
          style={{
            position: "relative",
            padding: 16,
            borderRadius: 20,
            background: "linear-gradient(135deg, #ffffff 0%, #f0f5ff 100%)",
            boxShadow: "0 15px 35px rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(37, 99, 235, 0.15)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: 180,
              height: 180,
              display: "block",
              borderRadius: 12,
            }}
            width={512}
            height={512}
          />
        </div>
      </Center>

      {/* Actionable buttons */}
      <Center>
        <Button
          leftSection={<TbDownload size={16} />}
          variant="light"
          size="xs"
          onClick={downloadPng}
          styles={{
            root: {
              background: "rgba(37, 99, 235, 0.08)",
              color: "#2563eb",
              border: "1px solid rgba(37, 99, 235, 0.15)",
              "&:hover": {
                background: "rgba(37, 99, 235, 0.15)",
              },
            },
          }}
        >
          {t("upload.modal.completed.download-qr-png")}
        </Button>
      </Center>

      {/* Direct Social Sharing Actions */}
      <Stack align="center" gap={4} mt="xs">
        <Text
          size="xs"
          fw={700}
          c="dimmed"
          style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}
        >
          Partager via
        </Text>
        <Group gap="md" justify="center">
          <Tooltip label={t("upload.modal.completed.share-whatsapp")}>
            <ActionIcon
              component="a"
              href={whatsappUrl}
              target="_blank"
              size="lg"
              radius="xl"
              style={{
                background: "rgba(37, 211, 102, 0.1)",
                color: "#25D366",
                border: "1px solid rgba(37, 211, 102, 0.2)",
                transition: "transform 0.2s ease",
              }}
              className="hover-scale"
            >
              <TbBrandWhatsapp size={20} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t("upload.modal.completed.share-telegram")}>
            <ActionIcon
              component="a"
              href={telegramUrl}
              target="_blank"
              size="lg"
              radius="xl"
              style={{
                background: "rgba(0, 136, 204, 0.1)",
                color: "#0088cc",
                border: "1px solid rgba(0, 136, 204, 0.2)",
                transition: "transform 0.2s ease",
              }}
              className="hover-scale"
            >
              <TbBrandTelegram size={20} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label={t("upload.modal.completed.share-email")}>
            <ActionIcon
              component="a"
              href={emailUrl}
              size="lg"
              radius="xl"
              style={{
                background: "rgba(70, 80, 158, 0.1)",
                color: "#46509e",
                border: "1px solid rgba(70, 80, 158, 0.2)",
                transition: "transform 0.2s ease",
              }}
              className="hover-scale"
            >
              <TbMail size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>

      {share.notifyReverseShareCreator === true && (
        <Text size="sm" c="dimmed" ta="center">
          {t("upload.modal.completed.notified-reverse-share-creator")}
        </Text>
      )}

      <Text size="xs" c="dimmed" ta="center">
        {moment(share.expiration).unix() === 0
          ? t("upload.modal.completed.never-expires")
          : t("upload.modal.completed.expires-on", {
              expiration: moment(share.expiration).format("LLL"),
            })}
      </Text>

      <Button
        mt="md"
        onClick={() => {
          modals.closeAll();
          if (isReverseShare) {
            router.reload();
          } else {
            router.push("/upload");
          }
        }}
      >
        <FormattedMessage id="common.button.done" />
      </Button>

      {/* Styled hover micro-animations */}
      <style jsx global>{`
        .hover-scale {
          transition: transform 0.2s ease !important;
        }
        .hover-scale:hover {
          transform: scale(1.15) translateY(-2px);
        }
      `}</style>
    </Stack>
  );
};

export default showCompletedUploadModal;
