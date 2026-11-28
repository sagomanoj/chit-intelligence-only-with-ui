import { Injectable, isDevMode } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';

const TEST_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const PRODUCTION_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-1256592546820339/9301409597';

@Injectable({ providedIn: 'root' })
export class AppAdsService {
  private canRequestAds = false;
  private readyUntil = 0;
  private showingInterstitial = false;
  private preparingInterstitial = false;

  setConsent(canRequestAds: boolean): void {
    this.canRequestAds = canRequestAds;
    if (canRequestAds) void this.prepareInterstitial();
    else this.readyUntil = 0;
  }

  async prepareInterstitial(): Promise<void> {
    const isAndroid = Capacitor.getPlatform() === 'android';
    if (!isAndroid || !this.canRequestAds || this.showingInterstitial ||
        this.preparingInterstitial || Date.now() < this.readyUntil) return;

    const testMode = isDevMode();
    const adId = testMode ? TEST_ANDROID_INTERSTITIAL_ID : PRODUCTION_ANDROID_INTERSTITIAL_ID;

    this.preparingInterstitial = true;
    try {
      await AdMob.prepareInterstitial({ adId, isTesting: testMode });
      if (this.canRequestAds) this.readyUntil = Date.now() + 60 * 60_000;
    } catch (error) {
      console.warn('Interstitial ad could not be prepared:', error);
    } finally {
      this.preparingInterstitial = false;
    }
  }

  async showInterstitialAtNaturalBreak(): Promise<void> {
    if (!this.canRequestAds || this.showingInterstitial || Capacitor.getPlatform() !== 'android') return;
    if (Date.now() >= this.readyUntil) {
      // Load for the next break. Never interrupt the user after they have moved on.
      void this.prepareInterstitial();
      return;
    }
    this.readyUntil = 0;
    this.showingInterstitial = true;

    let finish!: () => void;
    const dismissed = new Promise<void>(resolve => { finish = resolve; });
    const handles: PluginListenerHandle[] = [];
    const finishOnce = (() => {
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        finish();
      };
    })();

    try {
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, finishOnce));
      handles.push(await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, finishOnce));
      const timeout = setTimeout(finishOnce, 60_000);
      try {
        await AdMob.showInterstitial();
        await dismissed;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.warn('Interstitial ad could not be shown:', error);
    } finally {
      await Promise.all(handles.map(handle => handle.remove().catch(() => undefined)));
      this.showingInterstitial = false;
      void this.prepareInterstitial();
    }
  }
}
