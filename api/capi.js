
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this for production security if needed
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { event_name, event_source_url, user_data, custom_data } = req.body;

    // Use Environment Variable OR User-provided Fallback
    const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || "EAAGGWiYzZCJYBQpgP5yGBfDwRG5JvIZARMZAfzobMhqHJ0cqjqcZBVp06Tk1Yj9Go1DYs9y5O0pspDJbBNz7Qjw6tIHIiycmhEJ3hzNBoRjOGYoh4bZAZCxzZAMlVhI6jHjj5NnlOfrw8qBWbc6lwZB022HRcYB6yg01Rd8a9AKNS13DK7XTjOd4vQkeFrpCygZDZD";
    const PIXEL_ID = '1232580981668009';

    if (!ACCESS_TOKEN) {
        return res.status(500).json({ error: 'Missing Server Configuration (Token)' });
    }

    // Hash user data if needed (Meta requires hashed PII options, but if we send raw, 
    // we should really hash it on client or here. Meta CAPI usually expects hashed unless safe.)
    // For simplicity, we assume generic data or user-provided hashing, OR we hash here.
    // Minimally: client_ip and user_agent are key.

    // Construct Meta CAPI Payload
    const payload = {
        data: [
            {
                event_name: event_name,
                event_time: Math.floor(Date.now() / 1000),
                action_source: "website",
                event_source_url: event_source_url,
                user_data: {
                    client_ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                    client_user_agent: req.headers['user-agent'],
                    ...user_data
                },
                custom_data: custom_data
            }
        ]
    };

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Meta CAPI Error:', data.error);
            return res.status(400).json({ error: data.error });
        }

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
