"use client";

import Script from "next/script";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId?: string) => void;
    };
  }
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: "light" | "dark" | "auto";
};

const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  function TurnstileWidget(
    { onVerify, onExpire, onError, theme = "dark" }: TurnstileWidgetProps,
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

    const [widgetError, setWidgetError] = useState<string | null>(null);

    const cleanupWidget = useCallback(() => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    }, []);

    const renderWidget = useCallback(() => {
      if (!sitekey) {
        onVerify("");
        onError?.();
        setWidgetError(
          "Turnstile site key is missing. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY to your environment variables.",
        );
        return;
      }

      if (!containerRef.current) {
        return;
      }

      if (!window.turnstile) {
        onVerify("");
        onError?.();
        setWidgetError(
          "Captcha script is not available yet. Refresh the page and try again.",
        );
        return;
      }

      cleanupWidget();

      try {
        setWidgetError(null);

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey,
          theme,
          callback: (token: string) => {
            setWidgetError(null);
            onVerify(token);
          },
          "expired-callback": () => {
            onVerify("");
            onExpire?.();
          },
          "error-callback": () => {
            onVerify("");
            onError?.();
            setWidgetError(
              "Captcha failed to load correctly. Check your Turnstile site key and allowed domains in Cloudflare.",
            );
          },
        });
      } catch (error) {
        console.error("[TURNSTILE_RENDER_ERROR]", error);
        onVerify("");
        onError?.();
        setWidgetError(
          "Captcha could not render. Check your Turnstile site key and allowed domains in Cloudflare.",
        );
      }
    }, [cleanupWidget, onError, onExpire, onVerify, sitekey, theme]);

    useEffect(() => {
      if (window.turnstile) {
        renderWidget();
      }

      return () => {
        cleanupWidget();
      };
    }, [cleanupWidget, renderWidget]);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          onVerify("");
          onExpire?.();

          if (widgetIdRef.current && window.turnstile?.reset) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      }),
      [onExpire, onVerify],
    );

    return (
      <div className="space-y-2">
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderWidget}
          onError={() => {
            onVerify("");
            onError?.();
            setWidgetError(
              "Captcha script failed to load. Refresh the page and try again.",
            );
          }}
        />

        <div
          ref={containerRef}
          className="min-h-[70px] overflow-x-auto rounded-lg"
        />

        {widgetError ? (
          <p className="text-sm text-red-400">{widgetError}</p>
        ) : null}
      </div>
    );
  },
);

export default TurnstileWidget;
