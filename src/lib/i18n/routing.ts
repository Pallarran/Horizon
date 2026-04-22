import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr-CA", "en-CA"],
  defaultLocale: "fr-CA",
  localePrefix: "never",
});
