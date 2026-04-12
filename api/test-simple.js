module.exports = async function handler(req, res) {
  try {
    const { createClient } = require('@supabase/supabase-js')
    return res.json({ ok: true, hasLib: !!createClient })
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack })
  }
}
