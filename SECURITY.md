# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

Report it privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
open the **Security** tab of this repository and choose **Report a
vulnerability**. This creates a private advisory visible only to the
maintainers.

Please include the affected version/commit, steps to reproduce, and the impact
you observed. We will acknowledge the report and keep you updated on the fix.

## Scope

Mímir is a browser-side weather-map viewer. It reads forecast data from a
configurable backend (`VITE_BELGINGUR_BASE_URL`) and holds no server-side
secrets of its own. Issues with the forecast API itself belong with the
operator of that backend, not this repository.
