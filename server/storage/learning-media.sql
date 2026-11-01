-- Provision through a trusted SQL connection, never from the browser.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('learning-media','learning-media',false,20971520,ARRAY['video/mp4'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=20971520,allowed_mime_types=ARRAY['video/mp4'];

DROP POLICY IF EXISTS asignx_media_upload ON storage.objects;
CREATE POLICY asignx_media_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='learning-media'
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
 AND name ~ '^signs/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$'
 AND EXISTS(SELECT 1 FROM public.signs WHERE id::text=split_part(name,'/',2)));

DROP POLICY IF EXISTS asignx_media_read ON storage.objects;
CREATE POLICY asignx_media_read ON storage.objects FOR SELECT TO anon,authenticated
USING(bucket_id='learning-media' AND (
 EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
 OR EXISTS(SELECT 1 FROM public.signs WHERE demo_path=name AND is_published)));

-- Only unreferenced uploads can be removed. Replacements use new object paths.
DROP POLICY IF EXISTS asignx_media_cleanup ON storage.objects;
CREATE POLICY asignx_media_cleanup ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='learning-media'
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')
 AND NOT EXISTS(SELECT 1 FROM public.signs WHERE demo_path=name));
