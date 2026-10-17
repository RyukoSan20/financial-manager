// Health check endpoint
import { corsHeaders, jsonResponse } from '../_shared/database.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return jsonResponse({
    status: 'healthy',
    service: 'financial-manager-edge-functions',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
