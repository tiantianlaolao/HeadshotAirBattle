import Foundation
import Network

// A loopback-only, read-only asset origin. Keep the port stable for IndexedDB.
final class LocalServer {
    static let port: UInt16 = 18741
    static let origin = "http://127.0.0.1:18741"
    private let root: URL
    private let queue = DispatchQueue(label: "training.local-assets")
    private var listener: NWListener?
    init(root: URL) { self.root = root.resolvingSymlinksInPath() }
    private var ready = false
    private var starting = false
    private var generation = 0
    private var waiters: [(Bool) -> Void] = []
    func start(completion: @escaping (Bool) -> Void) throws {
        queue.async { self.begin(completion) }
    }
    private func finish(_ success: Bool) {
        starting = false; ready = success
        let callbacks = waiters; waiters.removeAll()
        DispatchQueue.main.async { callbacks.forEach { $0(success) } }
    }
    private func begin(_ completion: @escaping (Bool) -> Void) {
        if ready { DispatchQueue.main.async { completion(true) }; return }
        waiters.append(completion)
        if starting { return }
        starting = true; generation += 1
        let token = generation
        listener?.cancel(); listener = nil
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
            parameters.allowLocalEndpointReuse = true
            let server = try NWListener(using: parameters)
            listener = server
            server.stateUpdateHandler = { [weak self, weak server] state in
                guard let self = self, self.generation == token else { return }
                switch state {
                case .ready: self.finish(true)
                case .failed, .cancelled:
                    self.generation += 1
                    self.ready = false; self.listener = nil
                    server?.cancel(); self.finish(false)
                default: break
                }
            }
            server.newConnectionHandler = { [weak self] connection in
                guard let self = self else { connection.cancel(); return }
                connection.start(queue: self.queue)
                self.receive(connection, buffered: Data())
                self.queue.asyncAfter(deadline: .now() + 15) { connection.cancel() }
            }
            server.start(queue: queue)
            queue.asyncAfter(deadline: .now() + 5) { [weak self] in
                guard let self = self, self.generation == token, self.starting else { return }
                self.generation += 1; self.listener?.cancel(); self.listener = nil; self.finish(false)
            }
        } catch { finish(false) }
    }
    // Probe the actual loopback origin, not just a stale NWListener.ready flag.
    func ensureAvailable(completion: @escaping (Bool) -> Void) {
        queue.async {
        let probeGeneration = self.generation
        var request = URLRequest(url: URL(string: Self.origin + "/index.html")!)
        request.cachePolicy = .reloadIgnoringLocalCacheData; request.timeoutInterval = 2
        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            guard let self = self else { DispatchQueue.main.async { completion(false) }; return }
            if error == nil, (response as? HTTPURLResponse)?.statusCode == 200 {
                DispatchQueue.main.async { completion(true) }; return
            }
            self.queue.async {
                if self.generation != probeGeneration && self.ready { DispatchQueue.main.async { completion(true) }; return }
                if self.starting { self.waiters.append(completion); return }
                self.ready = false; self.generation += 1
                self.listener?.cancel(); self.listener = nil
                self.begin(completion)
            }
        }.resume()
        }
    }
    #if DEBUG
    func stopForRecoveryTest(completion: @escaping () -> Void) {
        queue.async { self.generation += 1; self.listener?.cancel(); self.listener = nil; self.finish(false); DispatchQueue.main.async { completion() } }
    }
    #endif
    private func receive(_ connection: NWConnection, buffered: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, complete, error in
            guard let self = self else { connection.cancel(); return }
            var buffer = buffered; if let data = data { buffer.append(data) }
            if buffer.count > 16384 { connection.cancel(); return }
            if let range = buffer.range(of: Data("\r\n\r\n".utf8)), let header = String(data: buffer[..<range.lowerBound], encoding: .utf8) {
                self.respond(connection, header: header)
            } else if complete || error != nil { connection.cancel() }
            else { self.receive(connection, buffered: buffer) }
        }
    }
    private func respond(_ connection: NWConnection, header: String) {
        let lines = header.components(separatedBy: "\r\n")
        let request = (lines.first ?? "").split(separator: " ")
        let hostOK = lines.dropFirst().contains { $0.lowercased() == "host: 127.0.0.1:\(Self.port)" }
        var body = Data(), status = "404 Not Found", mime = "text/plain"
        if request.count == 3, request[0] == "GET", hostOK,
           let requested = String(request[1]).components(separatedBy: "?").first?.removingPercentEncoding,
           requested.hasPrefix("/"), !requested.contains("\0"), !requested.contains("\\") {
            let relative = requested == "/" ? "index.html" : String(requested.dropFirst())
            let file = root.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
            let types = ["html":"text/html; charset=utf-8", "js":"text/javascript; charset=utf-8", "css":"text/css; charset=utf-8", "json":"application/json", "txt":"text/plain; charset=utf-8"]
            if file.path.hasPrefix(root.path + "/"), let type = types[file.pathExtension], let bytes = try? Data(contentsOf: file) {
                body = bytes; status = "200 OK"; mime = type
            }
        }
        let policy = "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob: https://stampday.tybbtech.com/yijiang/api/auth/; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; object-src 'none'; frame-src 'none'; base-uri 'self'"
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: \(policy)\r\nConnection: close\r\n\r\n".utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
    deinit { listener?.cancel() }
}
