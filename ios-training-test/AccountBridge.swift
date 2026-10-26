import UIKit
import WebKit
import AuthenticationServices
import Security

// Generic native login and secure session storage. No game/model data crosses this bridge.
final class AccountBridge: NSObject, WKScriptMessageHandler, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    weak var owner: UIViewController?
    weak var web: WKWebView?
    private var pending: String?
    private var flow: ASAuthorizationController?
    private let service = "yijiang.account.session.v1"
    init(owner: UIViewController) { self.owner = owner }
    private func reply(_ id: String, _ value: [String: Any]) {
        guard let bytes = try? JSONSerialization.data(withJSONObject: [id, value]), let args = String(data: bytes, encoding: .utf8) else { return }
        web?.evaluateJavaScript("window.__nativeAccountResult&&window.__nativeAccountResult(...\(args))", completionHandler: nil)
    }
    private var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session"] }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "http", message.frameInfo.securityOrigin.host == "127.0.0.1", message.frameInfo.securityOrigin.port == Int(LocalServer.port),
              let data = message.body as? [String: String], let id = data["id"], id.count < 100, let op = data["op"] else { return }
        switch op {
        case "capabilities": reply(id, ["providers": ["apple"]])
        case "read":
            var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?; let status = SecItemCopyMatching(q as CFDictionary, &item)
            if status == errSecItemNotFound { reply(id, [:]) }
            else if status == errSecSuccess, let bytes = item as? Data, let text = String(data: bytes, encoding: .utf8) { reply(id, ["session": text]) }
            else { reply(id, ["error": "storage_error"]) }
        case "write":
            guard let text = data["session"], let bytes = text.data(using: .utf8), bytes.count < 8192 else { reply(id, ["error": "storage_error"]); return }
            let attributes: [String: Any] = [kSecValueData as String: bytes, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
            var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
            if status == errSecItemNotFound { status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) }
            reply(id, status == errSecSuccess ? ["ok": true] : ["error": "storage_error"])
        case "clear":
            let status = SecItemDelete(query as CFDictionary)
            reply(id, status == errSecSuccess || status == errSecItemNotFound ? ["ok": true] : ["error": "storage_error"])
        case "signin":
            guard pending == nil, data["provider"] == "apple", let nonce = data["nonce"], nonce.count == 64 else { reply(id, ["error": "busy"]); return }
            pending = id
            let request = ASAuthorizationAppleIDProvider().createRequest(); request.requestedScopes = [.email]; request.nonce = nonce; request.state = id
            let controller = ASAuthorizationController(authorizationRequests: [request]); flow = controller
            controller.delegate = self; controller.presentationContextProvider = self; controller.performRequests()
        default: reply(id, ["error": "unsupported"])
        }
    }
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { owner!.view.window! }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let id = pending else { return }; defer { pending = nil; flow = nil }
        guard let c = authorization.credential as? ASAuthorizationAppleIDCredential, c.state == id, let bytes = c.identityToken, let token = String(data: bytes, encoding: .utf8) else { reply(id, ["error": "invalid_identity"]); return }
        reply(id, ["token": token])
    }
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let id = pending else { return }; pending = nil; flow = nil
        reply(id, ["error": (error as NSError).code == ASAuthorizationError.canceled.rawValue ? "cancelled" : "provider_error"])
    }
}
