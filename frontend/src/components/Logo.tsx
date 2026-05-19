import { useState, useEffect } from "react";

const Logo = ({ height, width }: { height: number; width: number }) => {
  const [logoSrc, setLogoSrc] = useState("/img/logo.png");

  useEffect(() => {
    // Force browser cache bypass by appending a unique timestamp query parameter on mount
    setLogoSrc(`/img/logo.png?v=${Date.now()}`);
  }, []);

  return (
    <img
      src={logoSrc}
      alt="logo"
      height={height}
      width={width}
      style={{
        objectFit: "contain",
      }}
    />
  );
};

export default Logo;
