import { createClient } from '@supabase/supabase-js';

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

// Simulated local real-time channel fallback (enables instantaneous multi-tab sync locally without cloud keys!)
class LocalRealtimeChannel {
  constructor(roomCode, onMessage) {
    this.roomCode = roomCode;
    this.onMessage = onMessage;
    this.channel = new BroadcastChannel(`studyroom_channel_${roomCode}`);
    
    this.channel.onmessage = (event) => {
      if (this.onMessage) {
        this.onMessage(event.data);
      }
    };
  }

  broadcast(event, payload) {
    this.channel.postMessage({ event, payload, senderId: localStorage.getItem('current_user_id') });
  }

  close() {
    this.channel.close();
  }
}

// Unified subscription helper for room timers, presence, and session updates
export const subscribeToRoomEvents = (roomCode, onEvent) => {
  if (isCloudEnabled) {
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
      broadcast: (event, payload) => channel.send({ type: 'broadcast', event, payload }),
      trackPresence: (data) => channel.track(data),
      close: () => supabase.removeChannel(channel)
    };
  } else {
    // Fallback to BroadcastChannel for smooth multi-window testing
    const localChannel = new LocalRealtimeChannel(roomCode, onEvent);
    return {
      broadcast: (event, payload) => localChannel.broadcast(event, payload),
      trackPresence: (data) => localChannel.broadcast('presence_sync', data),
      close: () => localChannel.close()
    };
  }
};
