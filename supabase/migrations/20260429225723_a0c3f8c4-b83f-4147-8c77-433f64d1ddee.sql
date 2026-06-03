
-- Re-create functions with explicit search_path and SECURITY INVOKER where appropriate
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

-- Lock down EXECUTE on SECURITY DEFINER functions: revoke from PUBLIC, anon, authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Restrict avatar bucket listing: replace broad SELECT with one that only allows owner-listing,
-- but the bucket remains public so direct URLs still work for displaying images.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_owner_list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
