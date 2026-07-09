/**
 * Lee una variable de entorno funcionando en los dos contextos:
 * - `astro dev` / build: Astro las expone en `import.meta.env`.
 * - Funciones serverless (Netlify/Vercel): llegan en `process.env` en tiempo de ejecución.
 */
export function readEnv(name: string): string | undefined {
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  if (fromVite) return fromVite;
  if (typeof process !== "undefined" && process.env) return process.env[name];
  return undefined;
}
