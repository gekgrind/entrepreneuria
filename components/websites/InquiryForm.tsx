"use client";

import { AlertCircle, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";

import TurnstileWidget, { type TurnstileWidgetHandle } from "@/components/auth/TurnstileWidget";
import { BUSINESS_TYPES, INQUIRY_ENDPOINT, WEBSITES_TURNSTILE_ACTION } from "@/lib/services/websites/content";
import {
  EMPTY_FORM,
  FIELD_LABELS,
  FIELD_ORDER,
  serverFieldToFormField,
  toInquiryFields,
  utmFromSearch,
  validateForm,
  type FormValues,
  type ValidatedField,
} from "@/lib/services/websites/form-rules";
import { STYLE_OPTIONS, isStyleInterest } from "@/lib/services/websites/styles";

import { useSelection, type PackageChoice } from "./SelectionContext";
import s from "./websites.module.css";

const SUBMIT_LABEL = "Request My Free Website Preview";
const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x: number) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const resolver: Resolver<FormValues> = async (values) => {
  const bad = validateForm(values);
  if (!bad.length) return { values, errors: {} };
  const errors: FieldErrors<FormValues> = {};
  for (const [field, message] of bad) errors[field] = { type: "rule", message };
  return { values: {}, errors };
};

const ERR_ID: Record<string, string> = {
  name: "e-name",
  business: "e-biz",
  email: "e-email",
  phone: "e-phone",
  business_type: "e-type",
  website: "e-site",
  package_interest: "e-pkg",
  sms_consent: "e-consent",
  contact_method: "e-contact",
};
const INPUT_ID: Record<string, string> = {
  name: "f-name",
  business: "f-biz",
  email: "f-email",
  phone: "f-phone",
  business_type: "f-type",
  website: "f-site",
  package_interest: "f-pkg",
  sms_consent: "f-consent",
  contact_method: "f-contact-email",
};

type Outcome = { firstName: string; method: FormValues["contact_method"] } | null;

/** Fields the error summary lists (and that render an inline error). */
const SUMMARY_FIELDS = [...FIELD_ORDER, "contact_method"] as const;
type SummaryField = (typeof SUMMARY_FIELDS)[number];

export function InquiryForm({
  packages,
  initialType,
  smsConsentLabel,
  privacySentence,
  contactEmail,
}: {
  packages: ReadonlyArray<{ id: string; displayName: string }>;
  initialType: string;
  /** Approved SMS consent wording, or undefined while texting is not offered. */
  smsConsentLabel?: string;
  /** Approved privacy sentence, or undefined (the Privacy Policy link always shows). */
  privacySentence?: string;
  contactEmail: string;
}) {
  const smsEnabled = Boolean(smsConsentLabel);
  const { style, setStyle, pkg, setPkg, focusTick } = useSelection();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormValues>({
    defaultValues: { ...EMPTY_FORM, business_type: initialType, package_interest: pkg, style_interest: style },
    resolver,
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: false,
  });

  const [banner, setBanner] = useState<ReactNode>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const idemKey = useRef<string>("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    idemKey.current = newIdempotencyKey();
  }, []);

  const contact = useWatch({ control, name: "contact_method" });

  /* Gallery toggles / package cards → form. */
  useEffect(() => {
    if (getValues("style_interest") !== style) setValue("style_interest", style);
  }, [style, getValues, setValue]);
  useEffect(() => {
    if (getValues("package_interest") !== pkg) setValue("package_interest", pkg, { shouldValidate: isSubmitted });
  }, [pkg, getValues, setValue, isSubmitted]);
  useEffect(() => {
    if (!focusTick) return;
    const t = window.setTimeout(() => document.getElementById("f-name")?.focus({ preventScroll: true }), 450);
    return () => window.clearTimeout(t);
  }, [focusTick]);

  /* Hydration guard: until React owns the form, the submit button stays
     disabled so a native submit can never put personal data in a URL. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /* Contact method drives the phone requirement and the consent box. Re-check
     only when the method actually changes, so server-set errors survive. */
  const prevContact = useRef(contact);
  useEffect(() => {
    if (prevContact.current === contact) return;
    prevContact.current = contact;
    if (contact !== "text") setValue("sms_consent", false);
    if (isSubmitted) void trigger(["phone", "sms_consent"]);
  }, [contact, isSubmitted, setValue, trigger]);

  const blurCheck = (field: ValidatedField) => (e: { target: { value: string } }) => {
    if (isSubmitted || e.target.value) void trigger(field);
  };
  /* Like the design: once a field shows an error, re-check it as the visitor types. */
  const liveCheck = (field: ValidatedField) => () => {
    if (errors[field]) void trigger(field);
  };
  const reg = (field: ValidatedField) => register(field, { onBlur: blurCheck(field), onChange: liveCheck(field) });

  /* Focus moves after React commits the element it targets (summary, banner,
     result or the first field), never before it exists. */
  const [focusReq, setFocusReq] = useState<{ target: "summary" | "banner" | "result" | "name"; n: number } | null>(null);
  const requestFocus = (target: "summary" | "banner" | "result" | "name") =>
    setFocusReq((prev) => ({ target, n: (prev?.n ?? 0) + 1 }));
  useEffect(() => {
    if (!focusReq) return;
    const el =
      focusReq.target === "summary"
        ? summaryRef.current
        : focusReq.target === "banner"
          ? bannerRef.current
          : focusReq.target === "result"
            ? resultRef.current
            : document.getElementById("f-name");
    el?.focus();
    if (focusReq.target === "banner") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
  }, [focusReq]);

  const showBanner = (node: ReactNode) => {
    setBanner(node);
    requestFocus("banner");
  };

  const genericFailure = (
    <>
      <strong>We could not send your request.</strong>
      <span>Your answers are still here. Please try again, or email us at {contactEmail}.</span>
    </>
  );

  const onValid = async (values: FormValues) => {
    setBanner(null);
    if (TURNSTILE_ENABLED && !turnstileToken) {
      showBanner(
        <>
          <strong>Please complete the verification check.</strong>
          <span>It sits just above the send button. Your answers are still here.</span>
        </>
      );
      return;
    }
    let res: Response;
    try {
      res = await fetch(INQUIRY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: toInquiryFields(values, { smsEnabled }),
          hp: (document.getElementById("f-hp") as HTMLInputElement | null)?.value || undefined,
          turnstile_token: turnstileToken || undefined,
          idempotency_key: idemKey.current,
          page_url: `${window.location.origin}${window.location.pathname}`,
          utm: utmFromSearch(window.location.search),
        }),
      });
    } catch {
      showBanner(genericFailure);
      return;
    }

    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      fieldErrors?: Record<string, string[]>;
    };

    if (res.ok && body.ok) {
      setOutcome({ firstName: values.name.trim().split(/\s+/)[0] || "there", method: values.contact_method });
      requestFocus("result");
      return;
    }

    if (res.status === 400 && body.error === "invalid" && body.fieldErrors) {
      /* Only fields the summary can show count as handled; anything else gets the banner. */
      const shown = Object.entries(body.fieldErrors).flatMap(([key, messages]) => {
        const field = serverFieldToFormField(key);
        return field && SUMMARY_FIELDS.includes(field as SummaryField) && messages[0] ? [[field, messages[0]] as const] : [];
      });
      if (shown.length) {
        for (const [field, message] of shown) setError(field, { type: "server", message });
        requestFocus("summary");
        return;
      }
    }
    /* Turnstile tokens are single-use and the server verifies before it does
       anything else, so any response past validation/rate limiting spent it. */
    if (TURNSTILE_ENABLED && !(res.status === 400 && body.error === "invalid") && res.status !== 429) {
      setTurnstileToken("");
      turnstileRef.current?.reset();
    }
    showBanner(genericFailure);
  };

  const onInvalid = () => {
    setBanner(null);
    requestFocus("summary");
  };

  const startOver = () => {
    reset({ ...EMPTY_FORM });
    setStyle("");
    setPkg("");
    setOutcome(null);
    setBanner(null);
    setTurnstileToken("");
    turnstileRef.current?.reset();
    idemKey.current = newIdempotencyKey();
    requestFocus("name");
  };

  /* Ordered error list for the summary (client rules + server messages). */
  const summaryItems = SUMMARY_FIELDS.map((f) => [f, errors[f]?.message] as const).filter(
    (x): x is readonly [SummaryField, string] => Boolean(x[1])
  );

  const describedBy = (field: string, extra?: string) =>
    [extra, errors[field as keyof FormValues] ? ERR_ID[field] : null].filter(Boolean).join(" ") || undefined;
  const invalid = (field: keyof FormValues) => (errors[field] ? true : undefined);

  const fieldError = (field: keyof FormValues) =>
    errors[field]?.message ? (
      <p className={s.err} id={ERR_ID[field]}>
        <AlertCircle aria-hidden="true" />
        <span>{errors[field]?.message}</span>
      </p>
    ) : null;

  const phoneRequired = contact === "text" || contact === "phone";
  const contactOptions: Array<{ value: FormValues["contact_method"]; label: string }> = [
    { value: "email", label: "Email" },
    ...(smsEnabled ? [{ value: "text" as const, label: "Text message" }] : []),
    { value: "phone", label: "Phone call" },
  ];

  if (outcome) {
    const how = outcome.method === "email" ? "email" : outcome.method === "text" ? "text message" : "phone, at a time that suits you";
    return (
      <div className={s.formPanel}>
        <div className={s.result} role="status" tabIndex={-1} ref={resultRef}>
          <span className={s.ico}>
            <Check aria-hidden="true" />
          </span>
          <h3>Thanks, {outcome.firstName}. Your request is in.</h3>
          <p>We will follow up by {how}.</p>
          <button className={`${s.btn} ${s.btnInk}`} type="button" onClick={startOver}>
            Send another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.formPanel}>
      {banner ? (
        <div className={s.errBanner} role="alert" tabIndex={-1} ref={bannerRef}>
          {banner}
        </div>
      ) : null}

      {isSubmitted && summaryItems.length ? (
        <div className={s.summary} role="alert" tabIndex={-1} ref={summaryRef}>
          <h3>{summaryItems.length === 1 ? "1 thing needs" : `${summaryItems.length} things need`} your attention</h3>
          <ul>
            {summaryItems.map(([f, msg]) => (
              <li key={f}>
                <a
                  href={`#${INPUT_ID[f]}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(INPUT_ID[f])?.focus();
                  }}
                >
                  {FIELD_LABELS[f]}
                </a>
                : {msg}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form noValidate method="post" action={INQUIRY_ENDPOINT} onSubmit={(e) => void handleSubmit(onValid, onInvalid)(e)} aria-busy={isSubmitting}>
        <fieldset className={`${s.fields} ${s.two}`} disabled={isSubmitting}>
          <legend className="sr-only">Website inquiry form</legend>

          <div className={s.hp} aria-hidden="true">
            <label htmlFor="f-hp">Leave this field empty</label>
            <input id="f-hp" name="hp" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>

          <div className={s.field}>
            <label htmlFor="f-name">Your name</label>
            <input
              className={s.control}
              id="f-name"
              type="text"
              autoComplete="name"
              required
              aria-invalid={invalid("name")}
              aria-describedby={describedBy("name")}
              {...reg("name")}
            />
            {fieldError("name")}
          </div>
          <div className={s.field}>
            <label htmlFor="f-biz">Business name</label>
            <input
              className={s.control}
              id="f-biz"
              type="text"
              autoComplete="organization"
              required
              aria-invalid={invalid("business")}
              aria-describedby={describedBy("business")}
              {...reg("business")}
            />
            {fieldError("business")}
          </div>
          <div className={s.field}>
            <label htmlFor="f-email">Email</label>
            <input
              className={s.control}
              id="f-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              aria-invalid={invalid("email")}
              aria-describedby={describedBy("email")}
              {...reg("email")}
            />
            {fieldError("email")}
          </div>
          <div className={s.field}>
            <label htmlFor="f-phone">
              Phone <span className={s.opt}>{phoneRequired ? "(required for this contact method)" : "(optional)"}</span>
            </label>
            <input
              className={s.control}
              id="f-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required={phoneRequired}
              aria-invalid={invalid("phone")}
              aria-describedby={describedBy("phone", "h-phone")}
              {...reg("phone")}
            />
            <p className={s.help} id="h-phone">
              Only used if you choose {smsEnabled ? "text or phone" : "phone"} below.
            </p>
            {fieldError("phone")}
          </div>
          <div className={s.field}>
            <label htmlFor="f-type">Type of business</label>
            <select
              className={s.control}
              id="f-type"
              required
              aria-invalid={invalid("business_type")}
              aria-describedby={describedBy("business_type")}
              {...reg("business_type")}
            >
              <option value="">Choose one</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {fieldError("business_type")}
          </div>
          <div className={s.field}>
            <label htmlFor="f-site">
              Existing website <span className={s.opt}>(optional)</span>
            </label>
            <input
              className={s.control}
              id="f-site"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourbusiness.com"
              aria-invalid={invalid("website")}
              aria-describedby={describedBy("website")}
              {...reg("website")}
            />
            {fieldError("website")}
          </div>
          <div className={`${s.field} ${s.span2}`}>
            <label htmlFor="f-pkg">Service or package of interest</label>
            <select
              className={s.control}
              id="f-pkg"
              required
              aria-invalid={invalid("package_interest")}
              aria-describedby={describedBy("package_interest")}
              {...register("package_interest", { onChange: (e) => { setPkg(e.target.value as PackageChoice); liveCheck("package_interest")(); } })}
            >
              <option value="">Choose one</option>
              <option value="unsure">Not sure yet</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
            {fieldError("package_interest")}
          </div>
          <div className={`${s.field} ${s.span2}`}>
            <label htmlFor="f-style">
              Which website style do you like? <span className={s.opt}>(optional)</span>
            </label>
            <select
              className={s.control}
              id="f-style"
              aria-describedby="h-style"
              {...register("style_interest", {
                onChange: (e) => setStyle(isStyleInterest(e.target.value) ? e.target.value : ""),
              })}
            >
              <option value="">Choose a style</option>
              {STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className={s.help} id="h-style">
              These match the three examples above. Your website is still personalized to your business.
            </p>
          </div>
          <div className={`${s.field} ${s.span2}`}>
            <span className={s.lbl} id="lbl-contact">
              Preferred contact method
            </span>
            <div
              className={s.radios}
              role="radiogroup"
              aria-labelledby="lbl-contact"
              aria-describedby={describedBy("contact_method")}
              style={{ ["--radio-cols" as string]: contactOptions.length }}
            >
              {contactOptions.map((o) => (
                <label key={o.value} className={s.radio}>
                  <input type="radio" id={`f-contact-${o.value}`} value={o.value} {...register("contact_method")} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
            {fieldError("contact_method")}
          </div>
          {smsConsentLabel && contact === "text" ? (
            /* Rendered only once the SMS consent wording is approved (legal-copy.ts → policies.ts). */
            <div className={`${s.consent} ${s.span2}`}>
              <input
                type="checkbox"
                id="f-consent"
                aria-invalid={invalid("sms_consent")}
                aria-describedby={describedBy("sms_consent")}
                {...register("sms_consent", { onChange: liveCheck("sms_consent") })}
              />
              <div>
                <label htmlFor="f-consent">{smsConsentLabel}</label>
                {fieldError("sms_consent")}
              </div>
            </div>
          ) : null}
          <div className={`${s.field} ${s.span2}`}>
            <label htmlFor="f-msg">
              Message <span className={s.opt}>(optional)</span>
            </label>
            <textarea
              className={s.control}
              id="f-msg"
              maxLength={1000}
              placeholder="Anything we should know about your business or what you need?"
              {...register("message")}
            />
          </div>
        </fieldset>

        {TURNSTILE_ENABLED ? (
          <div className={s.turnstile}>
            <TurnstileWidget ref={turnstileRef} theme="light" action={WEBSITES_TURNSTILE_ACTION} onVerify={setTurnstileToken} />
          </div>
        ) : null}

        <div className={s.formActions}>
          <button className={`${s.btn} ${s.btnPrimary} ${s.btnBlock}`} type="submit" disabled={isSubmitting || !hydrated}>
            {isSubmitting ? (
              <>
                <span className={s.spinner} aria-hidden="true" />
                &nbsp; Sending&hellip;
              </>
            ) : (
              SUBMIT_LABEL
            )}
          </button>
          <p className={s.formFine}>
            {privacySentence ? `${privacySentence} ` : null}
            See our <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </form>
    </div>
  );
}

