# Isolated Android device test

This test application uses its own application ID and does not replace production app data. The private test module is injected as local assets by an authorized cloud build. No private module is stored in this public directory. This is a WebView device validation harness, not the production React Native integration.

Builds use standard GitHub-hosted runners. Only an encrypted result archive is retained; its recipient private key stays with the operator. No production deployment or store submission is performed.

## Non-C integration payload

The new payload is held separately at `../private/site-mobile`. From the public repository root run `node scripts/stage-mobile-assets.mjs ../private/site-mobile`, then pass the printed `-PmobileAssetsDir=...` to the existing cloud Gradle build. Staging uses the ignored `app/build/generated/mobile-assets` directory and refuses mixed/stale assets. The historical C payload and workflow remain unchanged until a new fixed private commit is deliberately selected. Do not commit generated resources or private source to this public repository.

This first integration remains a test harness, not the completed React Native production entry. Device verification, account/cloud sync, native file export/import and final store identity remain separate work items.
