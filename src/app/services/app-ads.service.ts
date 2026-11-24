import { Injectable, isDevMode } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';

const TEST_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const PRODUCTION_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-1256592546820339/9301409597';

@Injectable({ providedIn: 'root' })
export class AppAdsService {
  private interstitialReady = false;
  private preparingInterstitial = false;

  async prepareInterstitial(): Promise<void> {
    const isAndroid = Capacitor.getPlatform() === 'android';
    if (!isAndroid || this.preparingInterstitial || this.interstitialReady) return;

    const testMode = isDevMode();
    const adId = testMode ? TEST_ANDROID_INTERSTITIAL_ID : PRODUCTION_ANDROID_INTERSTITIAL_ID;
    if (!adId) return;

    this.preparingInterstitial = true;
    try {
      await AdMob.prepareInterstitial({ adId, isTesting: testMode });
      this.interstitialReady = true;
    } catch (error) {
      console.warn('Interstitial ad could not be prepared:', error);
    } finally {
      this.preparingInterstitial = false;
    }
  }

  async showInterstitialAtNaturalBreak(): Promise<void> {
    if (!this.interstitialReady || Capacitor.getPlatform() !== 'android') return;
    this.interstitialReady = false;

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
      void this.prepareInterstitial();
    }
  }
}
