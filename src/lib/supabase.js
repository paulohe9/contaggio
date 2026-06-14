import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yooxnlvqzpnevsuxntei.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlvb3hubHZxenBuZXZzdXhudGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjcxMDksImV4cCI6MjA5Njk0MzEwOX0.9RAiBvhyLD_RGpHCMWgTMKitorZbxKlqClVuyPcMwZc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
