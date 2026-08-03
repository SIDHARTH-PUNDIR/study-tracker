-- Complete Supabase PostgreSQL Schema for Minimalist Real-Time Study Room
-- Instructions: Copy and paste this entire script into your Supabase project's SQL Editor and click "Run".

-- 1. Enable extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users table (Stores phone numbers and simple hashed passwords)
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Room Members link table (Tracks who has joined which room)
CREATE TABLE IF NOT EXISTS public.room_members (
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- 5. Real-time Room Timer & State table (One record per active room)
CREATE TABLE IF NOT EXISTS public.room_state (
  room_id UUID PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  timer_status TEXT NOT NULL DEFAULT 'stopped', -- 'running', 'paused', 'stopped'
  timer_seconds INTEGER NOT NULL DEFAULT 0,
  last_started_at TIMESTAMPTZ,
  updated_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL
);

-- 6. User Sessions & Objectives (Tracks daily objectives, focus hours, break times, and streaks)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_start_time TIMESTAMPTZ DEFAULT NOW(),
  total_break_seconds INTEGER DEFAULT 0,
  is_on_break BOOLEAN DEFAULT FALSE,
  objective_text TEXT DEFAULT '',
  objective_completed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, date)
);

-- 7. Configure Realtime and Policies
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for straightforward testing & zero-cost non-OTP deployment
CREATE POLICY "Allow all operations on app_users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on rooms" ON public.rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on room_members" ON public.room_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on room_state" ON public.room_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on user_sessions" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);

-- Enable full replication identity for live real-time broadcasts
ALTER TABLE public.room_state REPLICA IDENTITY FULL;
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.room_members REPLICA IDENTITY FULL;

-- Add tables to the built-in Supabase realtime publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.room_state, public.user_sessions, public.room_members;
COMMIT;
