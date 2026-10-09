// Route newly added Express endpoints (transactions, administration and
// password recovery) through Vercel without requiring a separate function file
// for every Express sub-route. More-specific api/*.ts functions remain intact.
import app from '../server/app.js';

export default app;
