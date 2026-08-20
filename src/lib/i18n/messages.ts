import type { Locale } from "./config";

/**
 * Message catalogue.
 *
 * Typed as a record keyed by the French catalogue, so adding a key without
 * translating it is a compile error rather than a string that silently falls
 * back at runtime in front of a user.
 */
const fr = {
  "page.noLinks": "Cette page n'a pas encore de liens.",
  "page.poweredBy": "Propulsé par Sesame",
  "page.locked": "protégé par mot de passe",
  "page.verified": "Compte vérifié",
  "unlock.title": "Ce lien est protégé. Entrez le mot de passe pour continuer.",
  "unlock.placeholder": "Mot de passe",
  "unlock.cancel": "Annuler",
  "unlock.submit": "Ouvrir",
  "unlock.checking": "Vérification…",
  "unlock.wrong": "Mot de passe incorrect.",
  "consent.body":
    "Nous mesurons les visites de cette page de façon anonyme, sans cookie ni adresse IP conservée.",
  "consent.accept": "Accepter",
  "consent.decline": "Refuser",
  "consent.label": "Consentement aux mesures d'audience",
  "gallery.open": "Agrandir l'image",
  "gallery.close": "Fermer",
  "gallery.previous": "Image précédente",
  "gallery.next": "Image suivante",
  "form.send": "Envoyer",
  "form.sending": "Envoi…",
  "form.error": "L'envoi a échoué. Réessayez.",
  "form.required": "Ce champ est requis.",
} as const;

export type MessageKey = keyof typeof fr;

const en: Record<MessageKey, string> = {
  "page.noLinks": "This page has no links yet.",
  "page.poweredBy": "Powered by Sesame",
  "page.locked": "password protected",
  "page.verified": "Verified account",
  "unlock.title": "This link is protected. Enter the password to continue.",
  "unlock.placeholder": "Password",
  "unlock.cancel": "Cancel",
  "unlock.submit": "Open",
  "unlock.checking": "Checking…",
  "unlock.wrong": "Incorrect password.",
  "consent.body":
    "We measure visits to this page anonymously, with no cookies and no IP address stored.",
  "consent.accept": "Accept",
  "consent.decline": "Decline",
  "consent.label": "Analytics consent",
  "gallery.open": "Enlarge image",
  "gallery.close": "Close",
  "gallery.previous": "Previous image",
  "gallery.next": "Next image",
  "form.send": "Send",
  "form.sending": "Sending…",
  "form.error": "Sending failed. Please try again.",
  "form.required": "This field is required.",
};

const es: Record<MessageKey, string> = {
  "page.noLinks": "Esta página todavía no tiene enlaces.",
  "page.poweredBy": "Con tecnología de Sesame",
  "page.locked": "protegido con contraseña",
  "page.verified": "Cuenta verificada",
  "unlock.title": "Este enlace está protegido. Introduce la contraseña para continuar.",
  "unlock.placeholder": "Contraseña",
  "unlock.cancel": "Cancelar",
  "unlock.submit": "Abrir",
  "unlock.checking": "Comprobando…",
  "unlock.wrong": "Contraseña incorrecta.",
  "consent.body":
    "Medimos las visitas a esta página de forma anónima, sin cookies ni direcciones IP almacenadas.",
  "consent.accept": "Aceptar",
  "consent.decline": "Rechazar",
  "consent.label": "Consentimiento de analítica",
  "gallery.open": "Ampliar imagen",
  "gallery.close": "Cerrar",
  "gallery.previous": "Imagen anterior",
  "gallery.next": "Imagen siguiente",
  "form.send": "Enviar",
  "form.sending": "Enviando…",
  "form.error": "El envío ha fallado. Inténtalo de nuevo.",
  "form.required": "Este campo es obligatorio.",
};

const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { fr, en, es };

export type Translator = (key: MessageKey) => string;

/** Returns a lookup function bound to one locale. */
export function translator(locale: Locale): Translator {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES.fr;
  return (key) => catalogue[key] ?? CATALOGUES.fr[key];
}

export { CATALOGUES };
