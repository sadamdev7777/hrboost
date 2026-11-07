import type { MetadataRoute } from "next";

// PWA (CLAUDE.md §2): boleh dipasang di skrin utama telefon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HRBoost.io",
    short_name: "HRBoost",
    description: "Sistem HR percuma untuk syarikat di Malaysia, terus melalui WhatsApp.",
    lang: "ms",
    start_url: "/utama",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F6F5",
    theme_color: "#0F6B5F",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
