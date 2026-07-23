(function () {
  window.VitrinOS = window.VitrinOS || {};

  class SSEClient {
    constructor() {
      this.eventSource = null;
      this.lastEventId = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.baseDelay = 1000;
      this.listeners = new Set();
      this.isConnected = false;
    }

    connect() {
      if (this.eventSource) {
        this.eventSource.close();
      }

      const baseUrl = window.VitrinOS.config?.apiBaseUrl || "/api/v1";
      let sseUrl = `${baseUrl}/events/jobs`;

      // Pass last event ID if reconnecting
      if (this.lastEventId) {
        sseUrl += `?lastEventId=${encodeURIComponent(this.lastEventId)}`;
      }

      try {
        this.eventSource = new EventSource(sseUrl, { withCredentials: true });

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
        };

        this.eventSource.onmessage = (event) => {
          if (event.lastEventId) {
            this.lastEventId = event.lastEventId;
          }
          try {
            const data = JSON.parse(event.data);
            this.notify(data);
          } catch (e) {
            console.error("SSE parse error:", e);
          }
        };

        this.eventSource.onerror = (err) => {
          this.isConnected = false;
          this.eventSource.close();

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(30000, this.baseDelay * Math.pow(2, this.reconnectAttempts));
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), delay);
          }
        };
      } catch (err) {
        console.error("SSE connection error:", err);
      }
    }

    disconnect() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.isConnected = false;
    }

    subscribe(fn) {
      this.listeners.add(fn);
      if (!this.eventSource && !this.isConnected) {
        this.connect();
      }
      return () => {
        this.listeners.delete(fn);
        if (this.listeners.size === 0) {
          this.disconnect();
        }
      };
    }

    notify(data) {
      this.listeners.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error("SSE listener error:", e);
        }
      });
    }
  }

  window.VitrinOS.sseClient = new SSEClient();
})();
