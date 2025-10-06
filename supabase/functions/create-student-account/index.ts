// supabase/functions/create-student-account/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const { email, password, firstName, lastName, studentClass } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: { user }, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: email, password: password, email_confirm: true,
    });
    if (signUpError) throw new Error(`Auth Error: ${signUpError.message}`);
    if (!user) throw new Error("User creation failed in Auth.");

    const { error: profileError } = await supabaseAdmin.from('student_profiles').insert({
      id: user.id, first_name: firstName, last_name: lastName, student_class: studentClass,
    });
    if (profileError) throw new Error(`Profile Error: ${profileError.message}`);

    return new Response(JSON.stringify({ message: "User created. Please check email for confirmation." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})