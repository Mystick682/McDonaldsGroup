// supabase/functions/create-student-account/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, firstName, lastName, dateOfBirth, studentClass, admissionNumber } = await req.json();

    // Create a Supabase Admin Client. This has special permissions.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // STEP 1: Create the user in Supabase's main authentication system.
    // This is an admin action that also sends a confirmation email.
    const { data: { user }, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // This ensures the confirmation email is sent.
    })

    if (signUpError) {
      // This will catch errors like "User already registered".
      throw new Error(`Authentication Error: ${signUpError.message}`);
    }
    if (!user) throw new Error("User creation failed in the authentication system.");

    // STEP 2: If the user was created successfully, now create their profile.
    const { error: profileError } = await supabaseAdmin
      .from('student_profiles')
      .insert({
        id: user.id, // This links the profile to the auth user.
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        student_class: studentClass,
        admission_number: admissionNumber
      });

    if (profileError) {
      // This is a critical failure. It means the user exists in auth, but has no profile.
      // In a real production app, you might want to automatically delete the auth user here to allow them to try again.
      console.error("CRITICAL ERROR: User created in auth, but profile creation failed:", profileError);
      throw new Error(`Database Error: ${profileError.message}`);
    }

    // If both steps succeed, return a success message.
    return new Response(JSON.stringify({ message: "User and profile created successfully. Please check your email." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })

  } catch (error) {
    // If anything fails, send a clear error message back to the browser.
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})