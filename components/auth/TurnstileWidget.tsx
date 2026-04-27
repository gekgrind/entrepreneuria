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
    const onVerifyRef = useRef(onVerify);
    const onExpireRef = useRef(onExpire);
    const onErrorRef = useRef(onError);
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

    const [widgetError, setWidgetError] = useState<string | null>(null);

    useEffect(() => {
      onVerifyRef.current = onVerify;
      onExpireRef.current = onExpire;
      onErrorRef.current = onError;
    }, [onError, onExpire, onVerify]);

    const cleanupWidget = useCallback(() => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    }, []);

    const renderWidget = useCallback(() => {
      if (!sitekey) {
        onVerifyRef.current("");
        onErrorRef.current?.();
        setWidgetError(
          "Turnstile site key is missing. Add NEXT_PUBLIC_TURNSTILE_SITE_KEY to your environment variables.",
        );
        return;
      }

      if (!containerRef.current) {
        return;
      }

      if (!window.turnstile) {
        onVerifyRef.current("");
        onErrorRef.current?.();
        setWidgetError(
          "Captcha script is not available yet. Refresh the page and try again.",
        );
        return;
      }

      if (widgetIdRef.current) {
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
            onVerifyRef.current(token);
          },
          "expired-callback": () => {
            onVerifyRef.current("");
            onExpireRef.current?.();
          },
          "error-callback": () => {
            onVerifyRef.current("");
            onErrorRef.current?.();
            setWidgetError(
              "Captcha failed to load correctly. Check your Turnstile site key and allowed domains in Cloudflare.",
            );
          },
        });
      } catch (error) {
        console.error("[TURNSTILE_RENDER_ERROR]", error);
        onVerifyRef.current("");
        onErrorRef.current?.();
        setWidgetError(
          "Captcha could not render. Check your Turnstile site key and allowed domains in Cloudflare.",
        );
      }
    }, [cleanupWidget, sitekey, theme]);

    useEffect(() => {
      let renderTimer: number | undefined;

      if (window.turnstile) {
        renderTimer = window.setTimeout(renderWidget, 0);
      }

      return () => {
        if (renderTimer !== undefined) {
          window.clearTimeout(renderTimer);
        }

        cleanupWidget();
      };
    }, [cleanupWidget, renderWidget]);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          onVerifyRef.current("");
          onExpireRef.current?.();
          setWidgetError(null);

          if (widgetIdRef.current && window.turnstile?.reset) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      }),
      [],
    );

    return (
      <div className="space-y-2">
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderWidget}
          onError={() => {
            onVerifyRef.current("");
            onErrorRef.current?.();
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
          <p className="rounded-lg border border-red-400/30 bg-red-950/50 px-3 py-2 text-sm text-red-100">
            {widgetError}
          </p>
        ) : null}
      </div>
    );
  },
);

export default TurnstileWidget;
