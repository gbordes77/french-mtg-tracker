import type { Config } from "tailwindcss";
// @ts-expect-error — JS preset, pas de types
import manaTunerPreset from "./design-system/tailwind.preset.js";

/**
 * Le tracker hérite intégralement du design system ManaTuner via le preset.
 * On y ajoute UNIQUEMENT :
 *  - Les couleurs drapeau FR (accent identitaire du tracker, cohabite avec la mana palette)
 *  - Le content path (Tailwind a besoin de connaître nos sources)
 *
 * Ne PAS dupliquer ici les tokens du preset — tout est déjà dans design-system/.
 * Voir design-system/BRANDBOOK.md pour les règles d'usage.
 */

const config: Config = {
  presets: [manaTunerPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Identité FR du tracker — coexiste avec la palette mana ManaTuner.
        // Rationale (brandbook §8) : sur un projet MTG-adjacent, on garde la canon mana
        // et on ajoute une couleur de chrome qui différencie le projet.
        fr: {
          blue: "#0055a4",
          red:  "#ef4135",
        },
      },
    },
  },
};

export default config;
