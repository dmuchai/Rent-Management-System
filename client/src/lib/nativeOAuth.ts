import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

const NATIVE_AUTH_CALLBACK_URL = "com.rentmanagement.app://auth-callback";

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function getOAuthRedirectUrl() {
  if (isNativePlatform()) {
    return NATIVE_AUTH_CALLBACK_URL;
  }

  return `${window.location.origin}/auth-callback`;
}

export async function openOAuthUrl(url: string) {
  if (isNativePlatform()) {
    await Browser.open({ url });
    return;
  }

  window.location.assign(url);
}

export function registerNativeOAuthHandler() {
  if (!isNativePlatform()) {
    return;
  }

  CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
    if (!url.startsWith(NATIVE_AUTH_CALLBACK_URL)) {
      return;
    }

    await Browser.close().catch(() => {});

    const callbackUrl = new URL(url);
    window.location.href = `/auth-callback${callbackUrl.search}${callbackUrl.hash}`;
  });
}
