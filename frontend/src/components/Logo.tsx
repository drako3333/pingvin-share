import { useState, useEffect } from "react";

// Cache-buster constant per SPA session to prevent aggressive reload on every page change (BUG-008)
const sessionTimestamp = Date.now();

const Logo = ({ height, width }: { height: number; width: number }) => {
  const [logoSrc, setLogoSrc] = useState("/img/logo.png");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setLogoSrc(`/img/logo.png?v=${sessionTimestamp}`);
  }, []);

  if (hasError) {
    // Elegant SVG Fallback for Logo when file is absent (BUG-007)
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "#228be6" }}
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    );
  }

  return (
    <img
      src={logoSrc}
      alt="logo"
      height={height}
      width={width}
      style={{
        objectFit: "contain",
      }}
      onError={() => setHasError(true)}
    />
  );
};

export default Logo;
