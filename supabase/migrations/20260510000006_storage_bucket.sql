-- Single private media bucket. All reads/writes go through signed URLs minted
-- by SECURITY DEFINER RPCs after an authorisation check. Default policies on
-- storage.objects deny everything — we add no policies, so only the service
-- role (used by createSignedUploadUrl in the RPC) can touch it.

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO UPDATE SET public = false;
