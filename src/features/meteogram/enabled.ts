/**
 * Build-time feature gate for the optional meteogram module.
 *
 * The meteogram (click-the-map → forecast chart popup) is only wired up when a
 * deployment supplies Belgingur WOD credentials. Vite inlines `import.meta.env.*`
 * at build time, so when the vars are absent this returns a constant `false` and
 * the guarded dynamic `import()` of the feature is dead-code-eliminated — the
 * public build ships with no meteogram code, CSS, or DOM.
 *
 * The credentials are handed to the `<bel-meteogram>` widget (via its
 * forecastApiUser/forecastApiPassword attributes) so it can authenticate its
 * forecast-data requests with HTTP Basic auth; their presence also gates whether
 * the feature is exposed at all. See setup.ts createWidget.
 */
export function isMeteogramEnabled(): boolean {
  const user = import.meta.env.VITE_WOD_API_USER;
  const password = import.meta.env.VITE_WOD_API_PASSWORD;
  return Boolean(
    typeof user === "string" &&
      user.trim() &&
      typeof password === "string" &&
      password.trim(),
  );
}
