// Public registration is paused during student early access.
module.exports = function registrationClosed(_req, res) {
  return res.status(403).json({
    success: false,
    code: 'REGISTRATION_CLOSED',
    error: 'ToliarEvent est disponible en accès anticipé aux étudiants, contactez-nous pour recevoir vos logins.',
  });
};
