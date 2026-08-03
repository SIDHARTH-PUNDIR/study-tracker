import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';
import { joinRoom as joinNostr } from '@trystero-p2p/nostr';
import { joinRoom as joinTorrent } from '@trystero-p2p/torrent';

// Retrieve credentials from environment variables or runtime browser storage
const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const localUrl = localStorage.getItem('study_supabase_url');
  const localKey = localStorage.getItem('study_supabase_key');
  
  return {
    url: (envUrl && envUrl !== 'https://your-project-id.supabase.co') ? envUrl : localUrl,
    key: (envKey && envKey !== 'your-supabase-anon-key') ? envKey : localKey
  };
};

const config = getSupabaseConfig();

export const supabase = (config.url && config.key) 
  ? createClient(config.url, config.key, { auth: { persistSession: true } }) 
  : null;

export const saveCustomSupabaseConfig = (url, key) => {
  if (url && key) {
    localStorage.setItem('study_supabase_url', url.trim());
    localStorage.setItem('study_supabase_key', key.trim());
  } else {
    localStorage.removeItem('study_supabase_url');
    localStorage.removeItem('study_supabase_key');
  }
  window.location.reload();
};

export const isCloudEnabled = !!supabase;

// Universal Cloud Realtime Channel (multi-network redundancy via Trystero WebRTC + SSL MQTT + Local channels)
class UniversalCloudChannel {
  constructor(roomCode, onMessage) {
    this.roomCode = roomCode || 'GLOBAL_STUDY_SPACE';
    this.onMessage = onMessage;
    this.topic = `study-tracker-live-space-2026/room-${this.roomCode}`;
    this.senderId = localStorage.getItem('current_user_id') || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // 1. Local BroadcastChannel for instant same-machine multi-tab testing
    try {
      this.localChannel = new BroadcastChannel(`studyroom_channel_${this.roomCode}`);
      this.localChannel.onmessage = (event) => {
        if (this.onMessage && event.data && event.data.senderId !== this.senderId) {
          this.onMessage(event.data);
        }
      };
    } catch {
      // ignore if BroadcastChannel unsupported
    }

    // 2. Trystero P2P WebRTC over Decentralized Torrent Trackers (Works over standard HTTPS port 443 WebSockets!)
    try {
      this.torrentRoom = joinTorrent({ appId: 'study-tracker-global-space-2026' }, this.roomCode);
      const [sendTorrent, getTorrent] = this.torrentRoom.makeAction('room_sync');
      this.sendTorrent = sendTorrent;
      getTorrent((data) => {
        if (this.onMessage && data && data.senderId !== this.senderId) {
          this.onMessage(data);
        }
      });
      this.torrentRoom.onPeerJoin(() => {
        if (this.onMessage) {
          this.onMessage({ event: 'REQUEST_SYNC' });
        }
      });
    } catch {
      // ignore
    }

    // 3. Trystero P2P WebRTC over Global Nostr Relays (Bulletproof cross-network discovery over HTTPS!)
    try {
      this.nostrRoom = joinNostr({ appId: 'study-tracker-global-space-2026' }, this.roomCode);
      const [sendNostr, getNostr] = this.nostrRoom.makeAction('room_sync');
      this.sendNostr = sendNostr;
      getNostr((data) => {
        if (this.onMessage && data && data.senderId !== this.senderId) {
          this.onMessage(data);
        }
      });
      this.nostrRoom.onPeerJoin(() => {
        if (this.onMessage) {
          this.onMessage({ event: 'REQUEST_SYNC' });
        }
      });
    } catch {
      // ignore
    }

    // 4. Global Free WSS Cloud Broker on Standard SSL Port 8443 / 443 (Prevents firewall blockages on campus/office Wi-Fi)
    try {
      this.client = mqtt.connect('wss://broker.hivemq.com:8443/mqtt', {
        clientId: `st_client_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        reconnectPeriod: 2500,
        connectTimeout: 8000
      });

      this.client.on('connect', () => {
        this.client.subscribe(this.topic, { qos: 0 });
      });

      this.client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          if (this.onMessage && data && data.senderId !== this.senderId) {
            this.onMessage(data);
          }
        } catch {
          // ignore malformed packets
        }
      });
    } catch {
      // ignore network errors
    }
  }

  broadcast(event, payload) {
    const packet = { event, payload, senderId: this.senderId, timestamp: Date.now() };
    
    // Broadcast via local tab channel
    if (this.localChannel) {
      try { this.localChannel.postMessage(packet); } catch {}
    }
    // Broadcast via WebRTC P2P (Torrent trackers)
    if (this.sendTorrent) {
      try { this.sendTorrent(packet); } catch {}
    }
    // Broadcast via WebRTC P2P (Nostr relays)
    if (this.sendNostr) {
      try { this.sendNostr(packet); } catch {}
    }
    // Broadcast via SSL WebSocket MQTT relay
    if (this.client && this.client.connected) {
      try {
        this.client.publish(this.topic, JSON.stringify(packet), { qos: 0 });
      } catch {}
    }
  }

  close() {
    if (this.localChannel) { try { this.localChannel.close(); } catch {} }
    if (this.torrentRoom) { try { this.torrentRoom.leave(); } catch {} }
    if (this.nostrRoom) { try { this.nostrRoom.leave(); } catch {} }
    if (this.client) { try { this.client.end(); } catch {} }
  }
}

// Unified subscription helper with multi-network redundancy for room timers, presence, and session updates
export const subscribeToRoomEvents = (roomCode, onEvent) => {
  const universalChannel = new UniversalCloudChannel(roomCode, onEvent);

  if (isCloudEnabled && supabase) {
    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { ack: false },
        presence: { key: localStorage.getItem('current_user_id') || 'guest' }
      }
    });

    channel
      .on('broadcast', { event: '*' }, (payload) => {
        onEvent({ event: payload.event, payload: payload.payload });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onEvent({ event: 'presence_sync', payload: state });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: localStorage.getItem('current_user_id'),
            onlineAt: new Date().toISOString()
          });
        }
      });

    return {
      broadcast: (event, payload) => {
        channel.send({ type: 'broadcast', event, payload });
        universalChannel.broadcast(event, payload);
      },
      trackPresence: (data) => {
        channel.track(data);
        universalChannel.broadcast('presence_sync', data);
      },
      close: () => {
        supabase.removeChannel(channel);
        universalChannel.close();
      }
    };
  } else {
    return {
      broadcast: (event, payload) => universalChannel.broadcast(event, payload),
      trackPresence: (data) => universalChannel.broadcast('presence_sync', data),
      close: () => universalChannel.close()
    };
  }
};
