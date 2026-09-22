/**
 * Ek hi jagah se poori site ke claims, links aur contact details control karein.
 *
 * ZAROORI: niche jo bhi value aap set karte hain, woh website par publicly
 * dikhegi. Agar koi policy abhi actually exist nahi karti, us field ko `null`
 * ya khaali string kar dein — UI apne aap woh claim hide kar degi.
 */

export interface SitePolicies {
  /** Rs. amount jiske upar delivery free hai. `null` = koi free delivery offer nahi. */
  freeDeliveryOver: number | null;
  /** Standard delivery charge (Rs.). */
  deliveryFee: number;
  /** Return window (days). `null` = returns offer nahi kar rahe. */
  returnDays: number | null;
  /** New sellers ke liye 0% fee promo (days). `null` = promo band. */
  sellerFeePromoDays: number | null;
  /**
   * Naye seller ko kitne mahine free listing milti hai. Iske baad paid
   * seller plan chahiye. Fee abhi decide nahi hui — koi price yahan ya
   * kahin aur hardcode NA karein.
   */
  sellerFreeListingMonths: number;
  /** Payment methods jo aap sach mein accept karte hain. Khaali array = hide. */
  paymentMethods: string[];
  /** Delivery timeline claim. Khaali string = hide. */
  deliveryPromise: string;
  /** Support availability claim. Khaali string = hide. */
  supportPromise: string;
}

export interface SiteConfig {
  name: string;
  supportEmail: string;
  /** International format, e.g. "+923001234567". Khaali = Contact buttons hide. */
  supportPhone: string;
  /** WhatsApp number, sirf digits with country code, e.g. "923001234567". */
  whatsapp: string;
  address: string;
  social: {
    facebook: string;
    instagram: string;
    youtube: string;
  };
  policies: SitePolicies;
}

export const site: SiteConfig = {
  name: "Bazaario",
  supportEmail: "support@bazaario.pk",
  supportPhone: "",
  whatsapp: "",
  address: "",
  social: {
    facebook: "",
    instagram: "",
    youtube: "",
  },
  policies: {
    // Launch se pehle in sab ko apni asli policy ke mutabiq set karein.
    freeDeliveryOver: 3000,
    deliveryFee: 250,
    returnDays: null,
    sellerFeePromoDays: null,
    sellerFreeListingMonths: 12,
    paymentMethods: ["Cash on Delivery"],
    deliveryPromise: "",
    supportPromise: "",
  },
};

export function hasAnySocial() {
  return Boolean(site.social.facebook || site.social.instagram || site.social.youtube);
}
