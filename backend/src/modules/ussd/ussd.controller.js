import UssdMenuService from './ussd.service.js';

// ======================================================================
// USSD CONTROLLER
// ======================================================================
//
// Implements Africa's Talking's actual USSD webhook contract:
//   - AT POSTs { sessionId, serviceCode, phoneNumber, text } on EVERY
//     keypress, as application/x-www-form-urlencoded.
//   - `text` is the FULL accumulated input for the session so far
//     (e.g. "1*2*500"), not just the latest key.
//   - The response body must be plain text starting with "CON " (show
//     another screen, session continues) or "END " (final screen,
//     session terminates). No JSON.
// ======================================================================

export const handleUssdRequest = async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;

    if (!sessionId || !phoneNumber) {
      res.set('Content-Type', 'text/plain');
      return res.status(200).send('END Invalid USSD request.');
    }

    const { message, endSession } = await UssdMenuService.handle({ sessionId, phoneNumber, text });

    res.set('Content-Type', 'text/plain');
    return res.status(200).send(`${endSession ? 'END' : 'CON'} ${message}`);
  } catch (error) {
    console.error('[ussd] request handling failed:', error);
    res.set('Content-Type', 'text/plain');
    // Always respond 200 with END — AT has no concept of a 5xx retry for
    // USSD, and a hung session is worse for the member than a clean error.
    return res.status(200).send('END Sorry, something went wrong. Please try again.');
  }
};

export const cleanupUssdSessions = async (_req, res) => {
  try {
    const cleaned = await UssdMenuService.cleanupExpiredSessions();
    return res.status(200).json({ success: true, message: `Cleaned up ${cleaned} expired sessions`, data: { cleaned_count: cleaned } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
