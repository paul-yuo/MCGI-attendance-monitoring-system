"""
MCGI Attendance Monitoring System - Local Server Launcher
Starts a simple HTTP server with no-cache headers to serve the monitoring system on a local port.
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for rapid development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    port = PORT
    server_cls = getattr(http.server, 'ThreadingHTTPServer', socketserver.ThreadingTCPServer)
    for attempt in range(10):
        try:
            with server_cls(("", port), Handler) as httpd:
                url = f"http://localhost:{port}"
                print("=" * 60)
                print(f" MCGI ATTENDANCE MONITORING SYSTEM")
                print(f" Theme: Metallic Blue & Golden Amber (MCGI Productions)")
                print(f" Serving at: {url}")
                print("=" * 60)
                print("Press Ctrl+C to stop the server.")
                
                # Attempt to open browser automatically
                try:
                    webbrowser.open(url)
                except Exception:
                    pass
                    
                httpd.serve_forever()
                break
        except OSError:
            port += 1
            continue

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
