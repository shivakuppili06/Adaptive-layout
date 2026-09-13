import { defineAd } from "./spec";

export const demoAd = defineAd({
  id: "trail-runner-ad",
  elements: [
    {
      id: "product-image",
      type: "image",
      role: "hero",
      priority: 1,
      src: "https://images.unsplash.com/photo-1572569433114-118d09618fce?w=600&q=60", // Sleek tech watch
      aspectRatio: 1,
    },
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "Lumina Series 5 — Focus on what matters.",
    },
    {
      id: "cta",
      type: "button",
      role: "action",
      priority: 1,
      content: "Pre-order",
    },
    {
      id: "price",
      type: "text",
      role: "secondary",
      priority: 2,
      content: "Starting at $199",
    },
    {
      id: "logo",
      type: "image",
      role: "branding",
      priority: 3,
      src: "https://dummyimage.com/120x60/16181d/ffffff.png&text=LUMINA",
      aspectRatio: 2,
    },
  ],
});
