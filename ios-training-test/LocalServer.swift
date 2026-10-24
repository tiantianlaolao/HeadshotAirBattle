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
    func start(completion: @escaping (Bool) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
        let server = try NWListener(using: parameters)
        listener = server
        var reported = false
        server.stateUpdateHandler = { state in
            switch state {
            case .ready:
                if !reported { reported = true; DispatchQueue.main.async { completion(true) } }
            case .failed:
                if !reported { reported = true; DispatchQueue.main.async { completion(false) } }
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
    }
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
        let policy = "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; object-src 'none'; frame-src 'none'; base-uri 'self'"
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: \(policy)\r\nConnection: close\r\n\r\n".utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
    deinit { listener?.cancel() }
}
