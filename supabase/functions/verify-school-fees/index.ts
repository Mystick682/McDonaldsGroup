// supabase/functions/verify-school-fees/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const { reference } = await req.json();
    if (!reference) throw new Error("Payment reference is required.");
    
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${paystackSecretKey}` },
    });
    const paystackResult = await paystackResponse.json();
    if (!paystackResult.status || paystackResult.data.status !== 'success') {
      throw new Error(paystackResult.message || "Payment not successful on Paystack.");
    }

    const { amount, metadata, customer } = paystackResult.data;
    const studentId = metadata.student_id;
    const amountPaidNaira = amount / 100;
    if (!studentId) throw new Error("Transaction is missing student ID in metadata.");
    
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    
    // Call the database function to add the payment
    const { error: rpcError } = await supabaseAdmin.rpc('add_fee_payment', {
        student_id_input: studentId, amount_paid_input: amountPaidNaira
    });
    if (rpcError) throw rpcError;

    // Log the transaction
    await supabaseAdmin.from('transactions').insert({
        user_id: studentId, service_type: 'fee_payment',
        description: `School Fees Payment via ${customer.email}`,
        amount: amountPaidNaira, status: 'success'
    });
    
    return new Response(JSON.stringify({ success: true, amountPaid: amountPaidNaira }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
})