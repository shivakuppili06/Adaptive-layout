import { defineAd } from "./spec";

export const demoAd = defineAd({
  id: "trail-runner-ad",
  elements: [
    {
      id: "product-image",
      type: "image",
      role: "hero",
      priority: 1,
      src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=60",
      aspectRatio: 1,
    },
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "Trailblazer GTX — built for the storm.",
    },
    {
      id: "cta",
      type: "button",
      role: "action",
      priority: 1,
      content: "Shop Now",
    },
    {
      id: "price",
      type: "text",
      role: "secondary",
      priority: 2,
      content: "₹6,499",
    },
    {
      id: "logo",
      type: "image",
      role: "branding",
      priority: 3,
      src: "https://dummyimage.com/80x80/8a8f9c/ffffff.png&text=LOGO",
      aspectRatio: 1,
    },
  ],
});
