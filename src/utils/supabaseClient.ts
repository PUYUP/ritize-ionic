import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
    'https://supabase.atlanize.com',
    'sb_publishable_IHU8xCkm5kPQHAnmfAHBrD_f9mmSDiy'
);