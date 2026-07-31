# Dyngja CLI

An experimental CLI client for Dyngja, the Icelandic virtual-stock-market app.

The initial API investigation is documented in [research/dyngja-api.md](research/dyngja-api.md). It includes a verified APK fingerprint, the live API host, authentication details, the recovered client wrapper inventory, and the CLI/agent design constraints.

The client is intentionally not sending trades yet. The downloaded APK is version 3.9.0, while the public store listing reports a newer Android build; the exact trade payload and a few dynamic route suffixes should be validated against a dedicated test account and the current build before implementing execution.

All future agent execution should default to dry-run and require an explicit opt-in for virtual trades.

