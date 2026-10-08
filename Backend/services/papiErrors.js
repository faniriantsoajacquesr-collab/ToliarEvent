const checkoutErrors = {
  CHECKOUT_CONFLICT: { status: 409, message: 'Cette tentative correspond déjà à une commande avec des informations différentes. Retrouvez votre commande depuis son lien de suivi.' },
  TICKET_UNAVAILABLE: { status: 409, message: 'Cette catégorie de billets n’est plus disponible pour cet événement. Actualisez la page et choisissez une catégorie active.' },
  EVENT_UNAVAILABLE: { status: 409, message: 'Cet événement est terminé ou n’est plus disponible à l’achat. Choisissez un événement à venir.' },
  INVALID_AMOUNT: { status: 400, message: 'Le total des billets doit être d’au moins 300 Ar, pour une quantité comprise entre 1 et 20.' },
};

function checkoutError(error) {
  const code = Object.keys(checkoutErrors).find(key => error?.message?.includes(key));
  if (!code) return { status: 503, code: 'CHECKOUT_UNAVAILABLE', message: 'Le paiement en ligne n’est pas encore disponible.' };
  return { ...checkoutErrors[code], code };
}
module.exports = { checkoutError };
