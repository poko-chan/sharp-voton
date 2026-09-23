drop policy if exists "settings_read_all" on public.app_settings;
create policy "settings_read_auth" on public.app_settings for select to authenticated using (true);