const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async function(event, context) {
  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: {
        'Access-Control-Allow-Origin': '*', // For CORS
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }
  
  try {
    const { email, score, game_version } = JSON.parse(event.body);
    
    if (!email || !score) {
      return { 
        statusCode: 400, 
        headers: {
          'Access-Control-Allow-Origin': '*', // For CORS
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Email and score are required' }) 
      };
    }
    
    // Insert the score
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([{ email, score, game_version }]);
      
    if (error) throw error;
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // For CORS
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*', // For CORS
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};