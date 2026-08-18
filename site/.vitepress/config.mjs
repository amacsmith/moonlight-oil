import { defineConfig } from "vitepress";

export default defineConfig({
  ignoreDeadLinks: [/^http:\/\/localhost/],
  title: "Moonlight Oil",
  description:
    "One-click Windows installer for a private, self-hosted home library",
  head: [["link", { rel: "icon", href: "/favicon.ico" }]],
  themeConfig: {
    logo: "/moon.svg",
    nav: [
      { text: "Guide", link: "/guide/what-is-moonlight-oil" },
      { text: "For Dad", link: "/for-dad" },
      { text: "Self-Hosting", link: "/self-hosting/running-the-stack" },
      { text: "Contributing", link: "/contributing/getting-started" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            {
              text: "What is Moonlight Oil?",
              link: "/guide/what-is-moonlight-oil",
            },
            { text: "Architecture", link: "/guide/architecture" },
          ],
        },
        {
          text: "Getting Started",
          items: [
            { text: "Installation", link: "/guide/installation" },
            { text: "Quick Start", link: "/guide/quick-start" },
          ],
        },
      ],
      "/self-hosting/": [
        {
          text: "Self-Hosting",
          items: [
            {
              text: "Running the Stack",
              link: "/self-hosting/running-the-stack",
            },
            { text: "Configuration", link: "/self-hosting/configuration" },
            { text: "Updating", link: "/self-hosting/updating" },
          ],
        },
      ],
      "/contributing/": [
        {
          text: "Contributing",
          items: [
            {
              text: "Getting Started",
              link: "/contributing/getting-started",
            },
            {
              text: "Branching Strategy",
              link: "/contributing/branching-strategy",
            },
            { text: "CI/CD Pipeline", link: "/contributing/ci-cd" },
            { text: "Testing", link: "/contributing/testing" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/amacsmith/moonlight-oil" },
    ],
    footer: {
      message: "Built with care for Dad.",
    },
    search: {
      provider: "local",
    },
  },
});
