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

// Universal Cloud Realtime Channel (multi-broker cloud grid + Trystero WebRTC + local channels)
class UniversalCloudChannel {
  constructor(roomCode, onMessage) {
    this.roomCode = roomCode || 'GLOBAL_STUDY_SPACE';
    this.onMessage = onMessage;
    this.topic = `study-tracker-2026-global-unified/room-${this.roomCode}`;
    this.senderId = localStorage.getItem('current_user_id') || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.clients = [];
    
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
      this.torrentRoom = joinTorrent({ appId: 'study-tracker-2026-global-space' }, this.roomCode);
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

    // 3. Trystero P2P WebRTC over Global Nostr Relays
    try {
      this.nostrRoom = joinNostr({ appId: 'study-tracker-2026-global-space' }, this.roomCode);
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

    // 4. Multi-Broker High-Speed Realtime WebSocket Cloud Grid
    // Opens simultaneous WebSocket connections to the world's most robust public real-time brokers (Shiftr, EMQX, HiveMQ, Mosquitto)
    const brokerUrls = [
      'wss://public:public@public.cloud.shiftr.io',
      'wss://broker.emqx.io:8084/mqtt',
      'wss://broker.hivemq.com:8443/mqtt',
      'wss://test.mosquitto.org:8081'
    ];

    brokerUrls.forEach((url) => {
      try {
        const c = mqtt.connect(url, {
          clientId: `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          clean: true,
          reconnectPeriod: 2500,
          connectTimeout: 7000
        });

        c.on('connect', () => {
          console.log('⚡ Connected to Realtime Cloud Relay:', url);
          c.subscribe(this.topic, { qos: 0 });
          // Notify application immediately upon connecting to perform instant presence handshake!
          if (this.onMessage) {
            this.onMessage({ event: 'NETWORK_CONNECTED', payload: { broker: url } });
            this.onMessage({ event: 'REQUEST_SYNC' });
          }
        });

        c.on('message', (t, msg) => {
          try {
            const data = JSON.parse(msg.toString());
            if (this.onMessage && data && data.senderId !== this.senderId) {
              this.onMessage(data);
            }
          } catch {
            // ignore malformed packets
          }
        });

        this.clients.push(c);
      } catch {
        // ignore network errors for specific broker
      }
    });
  }

  broadcast(event, payload) {
    const packet = { event, payload, senderId: this.senderId, timestamp: Date.now() };
    const jsonStr = JSON.stringify(packet);
    
    // 1. Local Tabs
    if (this.localChannel) {
      try { this.localChannel.postMessage(packet); } catch {}
    }
    // 2. WebRTC P2P
    if (this.sendTorrent) { try { this.sendTorrent(packet); } catch {} }
    if (this.sendNostr) { try { this.sendNostr(packet); } catch {} }

    // 3. Cloud WebSocket Grid (Broadcast across ALL open brokers simultaneously!)
    this.clients.forEach((c) => {
      if (c && c.connected) {
        try {
          c.publish(this.topic, jsonStr, { qos: 0 });
        } catch {}
      }
    });
  }

  close() {
    if (this.localChannel) { try { this.localChannel.close(); } catch {} }
    if (this.torrentRoom) { try { this.torrentRoom.leave(); } catch {} }
    if (this.nostrRoom) { try { this.nostrRoom.leave(); } catch {} }
    this.clients.forEach((c) => { try { c.end(); } catch {} });
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
          onEvent({ event: 'REQUEST_SYNC' });
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
