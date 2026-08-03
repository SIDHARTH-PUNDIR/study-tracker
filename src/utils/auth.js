import { supabase, isCloudEnabled } from '../lib/supabase';

// Helper to securely hash password using built-in browser Web Crypto API (SHA-256)
export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const LOCAL_USERS_KEY = 'study_app_local_users';
const CURRENT_USER_KEY = 'current_user_profile';

export const getCurrentUser = () => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem('current_user_id');
  if (isCloudEnabled) {
    supabase.auth.signOut().catch(() => {});
  }
};

// Sign Up handler (Validates phone format, hashes password, saves to Postgres / localStorage)
export const signUpUser = async (name, phone, password) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanPhone.length < 8) {
    throw new Error('Please enter a valid mobile phone number.');
  }
  if (password.length < 5) {
    throw new Error('Password must be at least 5 characters long.');
  }

  const passwordHash = await hashPassword(password);

  if (isCloudEnabled) {
    // 1. Check if phone already exists in Supabase public.app_users
    const { data: existing, error: findError } = await supabase
      .from('app_users')
      .select('*')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('Supabase query error:', findError);
    }
    if (existing) {
      throw new Error('An account with this phone number already exists.');
    }

    // 2. Insert into Supabase app_users table
    const { data: newUser, error: insertError } = await supabase
      .from('app_users')
      .insert([
        { name: name.trim(), phone_number: cleanPhone, password_hash: passwordHash }
      ])
      .select()
      .single();

    if (insertError) {
      throw new Error(insertError.message || 'Failed to create user account on cloud.');
    }

    const userProfile = { id: newUser.id, name: newUser.name, phone: newUser.phone_number };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
    localStorage.setItem('current_user_id', newUser.id);
    return userProfile;
  } else {
    // Fallback to local offline storage for instant testing
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
    if (users.some(u => u.phone === cleanPhone)) {
      throw new Error('An account with this phone number already exists (Local Mode).');
    }

    const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userRecord = { id: newId, name: name.trim(), phone: cleanPhone, passwordHash };
    users.push(userRecord);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));

    const userProfile = { id: userRecord.id, name: userRecord.name, phone: userRecord.phone };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
    localStorage.setItem('current_user_id', userRecord.id);
    return userProfile;
  }
};

// Log In handler (Lookup by phone, match hash)
export const logInUser = async (phone, password) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const inputHash = await hashPassword(password);

  if (isCloudEnabled) {
    const { data: user, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(error);
    }
    if (!user || user.password_hash !== inputHash) {
      throw new Error('Invalid phone number or password.');
    }

    const userProfile = { id: user.id, name: user.name, phone: user.phone_number };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
    localStorage.setItem('current_user_id', user.id);
    return userProfile;
  } else {
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]');
    const user = users.find(u => u.phone === cleanPhone && u.passwordHash === inputHash);
    if (!user) {
      throw new Error('Invalid phone number or password.');
    }

    const userProfile = { id: user.id, name: user.name, phone: user.phone };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
    localStorage.setItem('current_user_id', user.id);
    return userProfile;
  }
};
