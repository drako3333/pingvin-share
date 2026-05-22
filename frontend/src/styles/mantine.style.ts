import { createTheme } from "@mantine/core";

export default createTheme({
  colors: {
    victoria: [
      "#f0f5ff", // 0: Très clair, glacé
      "#deebff", // 1
      "#c2dbff", // 2
      "#9bc5ff", // 3
      "#6fa3ff", // 4
      "#487cff", // 5
      "#2563eb", // 6: Bleu Cobalt Titan (Couleur Primaire)
      "#1d4ed8", // 7
      "#173cb3", // 8
      "#132e8f", // 9
    ],
  },
  primaryColor: "victoria",
  defaultRadius: "sm",
  radius: {
    xs: "4px",
    sm: "6px",
    md: "6px",
    lg: "8px",
    xl: "12px",
  },
  components: {
    Modal: {
      styles: {
        title: {
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "var(--mantine-font-size-lg)",
          fontWeight: "700",
        },
      },
    },
    Button: {
      styles: {
        root: {
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          transition: "transform 0.1s ease, filter 0.1s ease",
          "&:active": {
            transform: "scale(0.97)",
          },
        },
      },
    },
  },
});
