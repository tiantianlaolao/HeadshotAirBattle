import UIKit
import WebKit
import GoogleSignIn

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = TrainingController()
        window.makeKeyAndVisible(); self.window = window
        return true
    }
    func applicationDidBecomeActive(_ application: UIApplication) {
        (window?.rootViewController as? TrainingController)?.resume()
    }
    func applicationWillResignActive(_ application: UIApplication) {
        (window?.rootViewController as? TrainingController)?.pause()
    }
}

final class TrainingController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
    private var web: WKWebView!
    private var server: LocalServer?
    private var exportID: String?
    private var exportFolder: URL?
    private var accountBridge: AccountBridge!
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.07, blue: 0.11, alpha: 1)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "nativeFiles")
        config.userContentController.add(self, name: "nativeAssets")
        accountBridge = AccountBridge(owner: self)
        config.userContentController.add(accountBridge!, name: "nativeAccount")
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--smoke-test") { config.userContentController.add(self, name: "nativeQA") }
        #endif
        web = WKWebView(frame: .zero, configuration: config)
        accountBridge.web = web
        web.navigationDelegate = self; web.uiDelegate = self
        web.isOpaque = false; web.backgroundColor = view.backgroundColor
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        guard let root = Bundle.main.url(forResource: "site", withExtension: nil) else { showError(); return }
        server = LocalServer(root: root)
        do { try server?.start { [weak self] ready in
            guard let self = self else { return }
            if ready { self.web.load(URLRequest(url: URL(string: LocalServer.origin + "/index.html")!)) }
            else { self.showError() }
        }} catch { showError() }
    }
    func pause() { web?.evaluateJavaScript("window.pauseForBackground&&window.pauseForBackground()", completionHandler: nil) }
    func resume() {
        guard web?.url != nil else { return }
        web.evaluateJavaScript("window.dispatchEvent(new Event('app-foreground'))", completionHandler: nil)
        server?.ensureAvailable { _ in }
    }
    private func showError() {
        let label = UILabel(); label.text = "Unable to start local training. Please close and reopen the app."
        label.textColor = .white; label.numberOfLines = 0; label.frame = view.bounds.insetBy(dx: 24, dy: 80); view.addSubview(label)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.navigationType == .linkActivated, let link = action.request.url {
            let legalPaths = ["/agent-arena/_t/futurehub-browser-20261018-v1/training-unified-20261018-v1/rivals-20261021-v1/yijiang/privacy.html", "/agent-arena/_t/futurehub-browser-20261018-v1/training-unified-20261018-v1/rivals-20261021-v1/yijiang/terms.html", "/agent-arena/_t/futurehub-browser-20261018-v1/training-unified-20261018-v1/rivals-20261021-v1/yijiang/delete-account.html"]
            let legal = link.scheme == "https" && link.host == "www.tybbtech.com" && (link.port == nil || link.port == 443) && link.user == nil && link.password == nil && legalPaths.contains(link.path)
            let support = link.scheme == "mailto" && link.path == "service@tybbtech.com"
            if legal || support { UIApplication.shared.open(link); decisionHandler(.cancel); return }
        }
        let url = action.request.url
        decisionHandler(url?.scheme == "http" && url?.host == "127.0.0.1" && url?.port == Int(LocalServer.port) ? .allow : .cancel)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { server?.ensureAvailable { ready in if ready { webView.reload() } } }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--smoke-test"), let url = Bundle.main.url(forResource: ProcessInfo.processInfo.arguments.contains("--account-smoke") ? "SmokeAccount" : "Smoke", withExtension: "js"), let script = try? String(contentsOf: url, encoding: .utf8) {
            webView.evaluateJavaScript(script, completionHandler: nil)
        }
        #endif
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        #if DEBUG
        if message.name == "nativeQA", ProcessInfo.processInfo.arguments.contains("--smoke-test"), message.frameInfo.isMainFrame {
            if let data = try? JSONSerialization.data(withJSONObject: message.body, options: [.prettyPrinted]), let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                try? data.write(to: folder.appendingPathComponent("native-qa.json"), options: .atomic)
            }
            return
        }
        #endif
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == "127.0.0.1",
              message.frameInfo.securityOrigin.port == Int(LocalServer.port),
              let data = message.body as? [String: String], let id = data["id"] else { return }
        if message.name == "nativeAssets", id.count <= 80, id.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).contains($0) }) {
            let respond: (Bool) -> Void = { [weak self] ready in self?.web.evaluateJavaScript("window.__arenaAssetsReady && window.__arenaAssetsReady('\(id)',\(ready ? "true" : "false"))", completionHandler: nil) }
            #if DEBUG
            if data["test"] == "stop", ProcessInfo.processInfo.arguments.contains("--smoke-test") {
                server?.stopForRecoveryTest { respond(true) }; return
            }
            #endif
            server?.ensureAvailable(completion: respond); return
        }
        guard exportID == nil, presentedViewController == nil, id.count <= 80,
              let name = data["name"], name.count <= 160, name.hasSuffix(".json"),
              !name.contains("/"), !name.contains("\\"), !name.unicodeScalars.contains(where: { $0.value < 32 }),
              let text = data["text"], let bytes = text.data(using: .utf8), bytes.count <= 64*1024*1024 else { result(id, "error"); return }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent(name)
            try bytes.write(to: file, options: .atomic)
            exportID = id; exportFolder = folder
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            picker.delegate = self; present(picker, animated: true)
        } catch { try? FileManager.default.removeItem(at: folder); result(id, "error") }
    }
    private func result(_ id: String, _ status: String) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: [id, status]), let args = String(data: bytes, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.__nativeFileResult&&window.__nativeFileResult(...\(args))", completionHandler: nil)
    }
    private func finishExport(_ status: String) {
        if let id = exportID { result(id, status) }
        if let folder = exportFolder { try? FileManager.default.removeItem(at: folder) }
        exportID = nil; exportFolder = nil
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finishExport("cancelled") }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { finishExport(urls.isEmpty ? "cancelled" : "saved") }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
}
