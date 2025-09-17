// supabase/functions/verify-school-fees/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const { reference } = await req.json();
    if (!reference) throw new Error("Payment reference is required.");
    
    // 1. VERIFY TRANSACTION WITH PAYSTACK
    // This MUST use your LIVE secret key for real transactions
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${paystackSecretKey}` },
    });
    const paystackResult = await paystackResponse.json();

    if (!paystackResult.status || paystackResult.data.status !== 'success') {
      throw new Error(paystackResult.message || "Payment not successful on Paystack.");
    }

    // 2. GET DETAILS FROM THE TRANSACTION
    const { amount, metadata } = paystackResult.data;
    const studentId = metadata.student_id;
    const amountPaidNaira = amount / 100; // Amount from Paystack is in kobo

    if (!studentId) throw new Error("Transaction is missing student ID. Cannot update records.");
    
    // 3. SECURELY UPDATE THE STUDENT'S RECORD
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Call the database function we created in Step 1
    const { error: rpcError } = await supabaseAdmin.rpc('add_fee_payment', {
        student_id_input: studentId,
        amount_paid_input: amountPaidNaira
    });
    
    if (rpcError) throw rpcError;
    
    // 4. RETURN SUCCESS
    return new Response(JSON.stringify({ success: true, amountPaid: amountPaidNaira }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
})