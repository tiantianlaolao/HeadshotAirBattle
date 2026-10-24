# Isolated Android device test

This test application uses its own application ID and does not replace production app data. The private test module is injected as local assets by an authorized cloud build. No private module is stored in this public directory. This is a WebView device validation harness, not the production React Native integration.

Builds use standard GitHub-hosted runners. Only an encrypted result archive is retained; its recipient private key stays with the operator. No production deployment or store submission is performed.
