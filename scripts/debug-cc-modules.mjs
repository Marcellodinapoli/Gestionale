import {
  parseEnabledModules,
  hasModule,
  packagesFromModules,
  modulesFromPackages,
} from "../src/lib/platform/modules.ts";

const raw =
  '{"v":2,"modules":["core","recovery","incassi","dialer","affidi","lavorazione","legale","formazione","recruiting","strumenti","utp-npl"]}';
const m = parseEnabledModules(raw);
console.log(
  JSON.stringify(
    {
      creditcalc: hasModule(m, "creditcalc"),
      packages: packagesFromModules(m),
      roundTrip: modulesFromPackages([
        "credixa-base",
        "recruiting",
        "formazione",
        "dialer",
        "legale",
        "creditcalc",
      ]),
    },
    null,
    2
  )
);
