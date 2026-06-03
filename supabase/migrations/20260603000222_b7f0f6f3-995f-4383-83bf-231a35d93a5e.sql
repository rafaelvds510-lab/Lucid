ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_keys FROM anon;
REVOKE ALL ON public.api_keys FROM authenticated;
GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON SEQUENCE public.api_keys_id_seq TO service_role;
REVOKE ALL ON SEQUENCE public.api_keys_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.api_keys_id_seq FROM authenticated;