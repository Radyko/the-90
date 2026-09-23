// Minimal message lookup for messages/en.json: `{name}` values and ICU-style
// `{n, plural, one {# task} other {# tasks}}`. Swap for next-intl when adding languages.
import messages from "@/messages/en.json";

type Vars = Record<string, string | number>;

const plural = new Intl.PluralRules("en");

function lookup(key: string): string {
  const value = key.split(".").reduce<unknown>(
    (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
    messages,
  );
  return typeof value === "string" ? value : key;
}

function format(template: string, vars: Vars): string {
  // Plural blocks first: {n, plural, one {…} other {…}}
  const withPlurals = template.replace(
    /\{(\w+), plural, ((?:\w+ \{[^{}]*\}\s*)+)\}/g,
    (_, name: string, cases: string) => {
      const n = Number(vars[name] ?? 0);
      const options = Object.fromEntries([...cases.matchAll(/(\w+) \{([^{}]*)\}/g)].map((m) => [m[1], m[2]]));
      return (options[plural.select(n)] ?? options.other ?? "").replace(/#/g, String(n));
    },
  );
  return withPlurals.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** t("today.timeLeft", { time: "3h" }) → "3h left" */
export function t(key: string, vars: Vars = {}): string {
  return format(lookup(key), vars);
}
