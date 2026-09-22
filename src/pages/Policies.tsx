/**
 * Footer ke saare "dead" links ab in pages par aate hain.
 *
 * ZAROORI: yeh text ek starting draft hai. Launch se pehle apne actual
 * business rules aur (Pakistan mein) e-commerce/consumer laws ke mutabiq
 * review karwa lein. Contact details `src/config/site.ts` se aati hain.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { site } from "../config/site";

function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-8 sm:py-12 max-w-3xl">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink">{title}</h1>
      {intro && <p className="text-ink-soft mt-2">{intro}</p>}
      <div className="flex flex-col gap-6 mt-8">{children}</div>
      <p className="text-xs text-ink-soft mt-10 border-t border-surface-border pt-4">
        Have a question? <Link to="/contact" className="text-brand-600 font-medium">Contact us</Link>.
      </p>
    </div>
  );
}

function Block({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-ink">{heading}</h2>
      <div className="text-sm text-ink-soft leading-relaxed mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

/* ------------------------------ Contact ------------------------------ */

export function Contact() {
  const hasChannel = Boolean(site.supportEmail || site.supportPhone || site.address);

  return (
    <LegalPage
      title="Contact us"
      intro="Reach out to us about any order, listing, or account-related question."
    >
      {hasChannel ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {site.supportEmail && (
            <a href={`mailto:${site.supportEmail}`} className="card-base p-4 flex items-center gap-3 hover:border-brand-400">
              <Mail size={18} className="text-brand-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-ink-soft">Email</p>
                <p className="text-sm font-medium text-ink truncate">{site.supportEmail}</p>
              </div>
            </a>
          )}
          {site.supportPhone && (
            <a href={`tel:${site.supportPhone}`} className="card-base p-4 flex items-center gap-3 hover:border-brand-400">
              <Phone size={18} className="text-brand-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-ink-soft">Phone</p>
                <p className="text-sm font-medium text-ink truncate">{site.supportPhone}</p>
              </div>
            </a>
          )}
          {site.address && (
            <div className="card-base p-4 flex items-center gap-3 sm:col-span-2">
              <MapPin size={18} className="text-brand-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-ink-soft">Address</p>
                <p className="text-sm font-medium text-ink">{site.address}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          Contact details have not been added yet. Add them in <code>src/config/site.ts</code>.
        </p>
      )}

      <Block heading="Response time">
        <p>
          We aim to respond to messages within one working day. If your query is about an
          order, please include your order number (BZ-…) so we can assist you faster.
        </p>
      </Block>
    </LegalPage>
  );
}

/* --------------------------- Returns & refunds --------------------------- */

export function Returns() {
  const days = site.policies.returnDays;

  return (
    <LegalPage title="Returns &amp; refunds">
      {days === null ? (
        <Block heading="Return policy">
          <p>
            New products on Bazaario are shipped directly by sellers. If you receive an item
            that is damaged, incorrect, or different from its description, please{" "}
            <Link to="/contact" className="text-brand-600">contact us</Link> immediately after
            delivery. We will work with the seller to help resolve the issue.
          </p>
          <p>
            We do not currently offer general "change of mind" returns. Used products and
            vehicles are purchased directly from the seller, so returns do not apply to
            these categories.
          </p>
        </Block>
      ) : (
        <Block heading={`${days}-day returns`}>
          <p>
            You may request a return on new products within {days} days of delivery,
            provided the item is unused and in its original packaging.
          </p>
        </Block>
      )}

      <Block heading="Items that are not eligible for return">
        <p>
          Used products and automobiles are purchased directly from the seller. The
          transaction is strictly between you and the seller. Personal care items,
          innerwear, and custom-made products are also not eligible for return.
        </p>
      </Block>

      <Block heading="How refunds are issued">
        <p>
          Refunds for Cash on Delivery orders are issued via bank transfer or mobile
          wallet. The refund is processed once the item has been received back and
          inspected.
        </p>
      </Block>
    </LegalPage>
  );
}

/* ---------------------------- Payment methods ---------------------------- */

export function Payments() {
  const methods = site.policies.paymentMethods;
  const freeOver = site.policies.freeDeliveryOver;

  return (
    <LegalPage title="Payment methods">
      <Block heading="Accepted payment methods">
        {methods.length ? (
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {methods.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p>Payment methods have not been configured yet.</p>
        )}
      </Block>

      <Block heading="Delivery charges">
        <p>
          The standard delivery charge is Rs. {site.policies.deliveryFee.toLocaleString("en-PK")}
          {freeOver !== null
            ? `, and delivery is free on orders above Rs. ${freeOver.toLocaleString("en-PK")}.`
            : "."}
        </p>
      </Block>

      <Block heading="Safety">
        <p>
          We will never ask for your OTP, PIN, or card CVV over a call or message. For used
          products and vehicles, avoid making advance payments and only pay after inspecting
          the item in person.
        </p>
      </Block>
    </LegalPage>
  );
}

/* ------------------------------- Privacy ------------------------------- */

export function Privacy() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This page explains what data we collect and why."
    >
      <Block heading="What we collect">
        <p>
          When you create an account: your name and email. When you place an order: your
          delivery address, phone number, and order details. When you post a listing: the
          information you enter into the listing form.
        </p>
      </Block>

      <Block heading="How we use it">
        <p>
          To process orders, arrange delivery, provide support, and keep your account
          secure. We do not sell your data.
        </p>
      </Block>

      <Block heading="Where your data is stored">
        <p>
          Account and order data is stored with our hosting/database provider. Items such
          as your wishlist and sign-in session are also saved locally in your browser on
          your device.
        </p>
      </Block>

      <Block heading="Your rights">
        <p>
          You may request to view, correct, or delete your data. Reach us through the{" "}
          <Link to="/contact" className="text-brand-600">contact page</Link>.
        </p>
      </Block>
    </LegalPage>
  );
}

/* -------------------------------- Terms -------------------------------- */

export function Terms() {
  const promo = site.policies.sellerFeePromoDays;
  const freeMonths = site.policies.sellerFreeListingMonths;

  return (
    <LegalPage title="Terms of use">
      <Block heading="Our role as a platform">
        <p>
          Bazaario is a marketplace. Transactions for used products and vehicles take
          place directly between the buyer and the seller; we do not guarantee the
          accuracy of any listing.
        </p>
      </Block>

      <Block heading="Your account">
        <p>
          You are responsible for your account and password. Accounts may be suspended
          for providing false information, using someone else's images, or listing
          illegal items.
        </p>
      </Block>

      <Block heading="Listings &amp; fees">
        <p>
          Sellers may only list items that can be legally sold and whose details are
          accurate.
          {promo !== null
            ? ` New sellers get a 0% commission promotion for their first ${promo} days.`
            : ""}
        </p>
      </Block>

      <Block heading="Seller free listing period">
        <p>
          New sellers can list products for free for the first {freeMonths} months. The free
          period starts on the date the seller account is created and ends {freeMonths} months
          later. The exact end date is shown to the seller on the Seller Dashboard and on every
          listing form.
        </p>
        <p>
          After {freeMonths} months, continued listing access requires a paid seller plan.
          Listings created during the free period remain published; only the creation of new
          listings requires an active plan.
        </p>
      </Block>

      <Block heading="Seller plan payments">
        <p>
          Online payments for the seller plan are made to {site.name}. Pricing has not been
          finalised yet and will be shown to the seller when renewal is due. No payment is
          collected before that, and no charge is ever taken automatically.
        </p>
        <p>
          Payments are processed through an online payment provider. Until that provider is
          live, sellers whose free period has ended can{" "}
          <Link to="/contact" className="text-brand-600">contact us</Link> to arrange renewal.
        </p>
      </Block>

      <Block heading="Agreement before publishing">
        <p>
          Sellers must read and agree to these Seller Terms before publishing a listing. The
          date of acceptance is recorded on the seller's account.
        </p>
      </Block>

      <Block heading="Changes to these terms">
        <p>
          These terms may be updated from time to time. We will post a notice on the site
          for any significant changes.
        </p>
      </Block>
    </LegalPage>
  );
}

/* -------------------------------- Cookies -------------------------------- */

export function Cookies() {
  return (
    <LegalPage title="Cookies &amp; local storage">
      <Block heading="What we store">
        <p>
          Bazaario saves your wishlist and sign-in session in your browser's local
          storage, so this information isn't lost when you refresh the page.
        </p>
      </Block>

      <Block heading="Advertising cookies">
        <p>
          We do not use third-party advertising cookies. If analytics are added in the
          future, this page will be updated.
        </p>
      </Block>

      <Block heading="Control">
        <p>
          You can clear site data through your browser settings, which will also clear
          your saved wishlist.
        </p>
      </Block>
    </LegalPage>
  );
}
