import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Function environment is incomplete.' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Authentication required.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const workspaceId = String(body.workspaceId || '');
  const email = normalizeEmail(body.email);
  const fullName = String(body.name || '').trim();
  const role = String(body.role || 'viewer');

  if (!workspaceId || !email || !fullName) return json({ error: 'Workspace, full name, and email are required.' }, 422);
  if (!['admin', 'editor', 'viewer'].includes(role)) return json({ error: 'Invalid workspace role.' }, 422);

  const { data: membership, error: membershipError } = await adminClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (membershipError) return json({ error: membershipError.message }, 500);
  if (!membership || !['owner', 'admin'].includes(membership.role)) return json({ error: 'Only owners and admins can invite members.' }, 403);

  const rawToken = crypto.randomUUID();
  const tokenHash = await sha256(rawToken);

  const { data: invitation, error: invitationError } = await adminClient
    .from('workspace_invitations')
    .insert({
      workspace_id: workspaceId,
      email,
      full_name: fullName,
      role,
      token_hash: tokenHash,
      invited_by: authData.user.id
    })
    .select('id, workspace_id, email, full_name, role, status, expires_at')
    .single();

  if (invitationError) return json({ error: invitationError.message }, 409);

  const redirectBase = request.headers.get('origin') || Deno.env.get('SITE_URL') || '';
  const redirectTo = `${redirectBase.replace(/\/$/, '')}/#dashboard`;

  // Workspace identity and role are deliberately NOT placed in raw user metadata.
  // Authorization comes from the already-authorized invitation row below.
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName }
  });

  if (inviteError || !inviteData.user?.id) {
    await adminClient.from('workspace_invitations').delete().eq('id', invitation.id);
    return json({ error: inviteError?.message || 'Invitation user could not be provisioned.' }, 409);
  }

  // Provision only the exact auth identity returned for the invited email, and derive
  // role/workspace from the server-side invitation row. No caller/user metadata is trusted.
  const { error: provisionError } = await adminClient
    .from('workspace_members')
    .upsert({
      workspace_id: invitation.workspace_id,
      user_id: inviteData.user.id,
      role: invitation.role
    }, { onConflict: 'workspace_id,user_id' });

  if (provisionError) {
    await adminClient.from('workspace_invitations').delete().eq('id', invitation.id);
    return json({ error: provisionError.message }, 500);
  }

  return json({
    id: invitation.id,
    email: invitation.email,
    full_name: invitation.full_name,
    role: invitation.role,
    status: invitation.status,
    expires_at: invitation.expires_at,
    userId: inviteData.user.id
  }, 201);
});
