import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sesame",
    short_name: "Sesame",
    description: "Une seule page pour tous vos liens.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0B0B0F",
    theme_color: "#0E0E12",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
